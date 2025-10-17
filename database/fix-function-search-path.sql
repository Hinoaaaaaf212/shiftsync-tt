-- ShiftSync TT Security Fix: Set search_path for all functions
-- Execute this in your Supabase SQL Editor
-- Date: 2025-10-13
--
-- This migration fixes the "Function Search Path Mutable" security warnings
-- by setting an explicit search_path on all functions. This prevents search
-- path attacks, especially important for SECURITY DEFINER functions.
--
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- ============================================================================
-- HELPER FUNCTIONS (from schema.sql)
-- ============================================================================

-- Function to get restaurant_id for an employee (bypasses RLS)
CREATE OR REPLACE FUNCTION get_employee_restaurant_id(emp_user_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT restaurant_id FROM public.employees WHERE user_id = emp_user_id LIMIT 1;
$$;

-- Function to check if user owns a restaurant (bypasses RLS)
CREATE OR REPLACE FUNCTION user_owns_restaurant(restaurant_uuid UUID, user_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE id = restaurant_uuid AND owner_email = user_email
  );
$$;

-- Function to check for shift conflicts
CREATE OR REPLACE FUNCTION check_shift_conflicts(
    p_employee_id UUID,
    p_shift_date DATE,
    p_start_time TIME,
    p_end_time TIME,
    p_shift_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    conflict_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO conflict_count
    FROM public.shifts
    WHERE employee_id = p_employee_id
        AND shift_date = p_shift_date
        AND (p_shift_id IS NULL OR id != p_shift_id)
        AND (
            (start_time <= p_start_time AND end_time > p_start_time) OR
            (start_time < p_end_time AND end_time >= p_end_time) OR
            (start_time >= p_start_time AND end_time <= p_end_time)
        );

    RETURN conflict_count > 0;
END;
$$;

-- Function to get employee schedule for a week
-- Note: Must drop first because we're changing the return type (position -> shift_position)
DROP FUNCTION IF EXISTS get_employee_weekly_schedule(UUID, DATE);

CREATE OR REPLACE FUNCTION get_employee_weekly_schedule(
    p_employee_id UUID,
    p_week_start DATE
)
RETURNS TABLE (
    shift_id UUID,
    shift_date DATE,
    start_time TIME,
    end_time TIME,
    shift_position TEXT,
    notes TEXT,
    total_hours DECIMAL
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.shift_date,
        s.start_time,
        s.end_time,
        s.position AS shift_position,
        s.notes,
        EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600 as total_hours
    FROM public.shifts s
    WHERE s.employee_id = p_employee_id
        AND s.shift_date >= p_week_start
        AND s.shift_date < p_week_start + INTERVAL '7 days'
    ORDER BY s.shift_date, s.start_time;
END;
$$;

-- Function to automatically add holidays for new restaurants
CREATE OR REPLACE FUNCTION add_default_holidays()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.blocked_dates (restaurant_id, date, reason) VALUES
        (NEW.id, '2025-01-01', 'New Year''s Day'),
        (NEW.id, '2025-02-24', 'Carnival Monday'),
        (NEW.id, '2025-02-25', 'Carnival Tuesday'),
        (NEW.id, '2025-08-01', 'Emancipation Day'),
        (NEW.id, '2025-08-31', 'Independence Day'),
        (NEW.id, '2025-12-25', 'Christmas Day'),
        (NEW.id, '2025-12-26', 'Boxing Day')
    ON CONFLICT (restaurant_id, date) DO NOTHING;

    RETURN NEW;
END;
$$;

-- Update updated_at timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ============================================================================
-- TIME OFF FUNCTIONS (from add-shift-templates-and-timeoff.sql)
-- ============================================================================

-- Function to check if employee has approved time off on a specific date
CREATE OR REPLACE FUNCTION has_approved_time_off(
    p_employee_id UUID,
    p_date DATE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    time_off_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO time_off_count
    FROM public.time_off_requests
    WHERE employee_id = p_employee_id
        AND status = 'approved'
        AND p_date >= start_date
        AND p_date <= end_date;

    RETURN time_off_count > 0;
END;
$$;

-- Function to get employee time off for a date range
CREATE OR REPLACE FUNCTION get_employee_time_off(
    p_employee_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    request_id UUID,
    start_date DATE,
    end_date DATE,
    reason TEXT,
    status TEXT,
    days_count INTEGER
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.start_date,
        t.end_date,
        t.reason,
        t.status,
        (t.end_date - t.start_date + 1)::INTEGER as days_count
    FROM public.time_off_requests t
    WHERE t.employee_id = p_employee_id
        AND t.status = 'approved'
        AND NOT (t.end_date < p_start_date OR t.start_date > p_end_date)
    ORDER BY t.start_date;
END;
$$;

-- Function to copy shifts from previous week
CREATE OR REPLACE FUNCTION copy_previous_week_shifts(
    p_restaurant_id UUID,
    p_source_week_start DATE,
    p_target_week_start DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    shifts_copied INTEGER := 0;
    shift_record RECORD;
    new_date DATE;
    days_diff INTEGER;
BEGIN
    days_diff := p_target_week_start - p_source_week_start;

    FOR shift_record IN
        SELECT * FROM public.shifts
        WHERE restaurant_id = p_restaurant_id
            AND shift_date >= p_source_week_start
            AND shift_date < p_source_week_start + INTERVAL '7 days'
    LOOP
        new_date := shift_record.shift_date + days_diff;

        -- Only copy if employee doesn't have approved time off
        IF NOT public.has_approved_time_off(shift_record.employee_id, new_date) THEN
            INSERT INTO public.shifts (
                restaurant_id,
                employee_id,
                shift_date,
                start_time,
                end_time,
                position,
                notes
            ) VALUES (
                shift_record.restaurant_id,
                shift_record.employee_id,
                new_date,
                shift_record.start_time,
                shift_record.end_time,
                shift_record.position,
                'Copied from ' || TO_CHAR(shift_record.shift_date, 'DD/MM/YYYY')
            );

            shifts_copied := shifts_copied + 1;
        END IF;
    END LOOP;

    RETURN shifts_copied;
END;
$$;

-- ============================================================================
-- AI SCHEDULING FUNCTIONS (from add-ai-scheduling-tables.sql)
-- ============================================================================

-- Function to check if employee is available for a specific date/time
CREATE OR REPLACE FUNCTION is_employee_available(
    p_employee_id UUID,
    p_date DATE,
    p_start_time TIME,
    p_end_time TIME
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    day_num INTEGER;
    unavailable_count INTEGER;
BEGIN
    -- Get day of week (0=Monday, 6=Sunday)
    day_num := EXTRACT(ISODOW FROM p_date) - 1;

    -- Check for availability blocks
    SELECT COUNT(*) INTO unavailable_count
    FROM public.employee_availability
    WHERE employee_id = p_employee_id
        AND (
            -- Recurring weekly block
            (is_recurring = TRUE AND day_of_week = day_num AND (
                is_all_day = TRUE OR
                (unavailable_start_time <= p_start_time AND unavailable_end_time > p_start_time) OR
                (unavailable_start_time < p_end_time AND unavailable_end_time >= p_end_time) OR
                (unavailable_start_time >= p_start_time AND unavailable_end_time <= p_end_time)
            ))
            OR
            -- Specific date block
            (is_recurring = FALSE AND specific_date = p_date AND (
                is_all_day = TRUE OR
                (unavailable_start_time <= p_start_time AND unavailable_end_time > p_start_time) OR
                (unavailable_start_time < p_end_time AND unavailable_end_time >= p_end_time) OR
                (unavailable_start_time >= p_start_time AND unavailable_end_time <= p_end_time)
            ))
        );

    RETURN unavailable_count = 0;
END;
$$;

-- Function to get employee monthly hours
CREATE OR REPLACE FUNCTION get_employee_monthly_hours(
    p_employee_id UUID,
    p_year INTEGER,
    p_month INTEGER
)
RETURNS DECIMAL
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    total_hours DECIMAL;
BEGIN
    SELECT COALESCE(SUM(
        EXTRACT(EPOCH FROM (end_time - start_time)) / 3600
    ), 0) INTO total_hours
    FROM public.shifts
    WHERE employee_id = p_employee_id
        AND EXTRACT(YEAR FROM shift_date) = p_year
        AND EXTRACT(MONTH FROM shift_date) = p_month;

    RETURN total_hours;
END;
$$;

-- Function to initialize default business hours for new restaurants
CREATE OR REPLACE FUNCTION init_default_business_hours()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    -- Insert default Mon-Fri 9am-10pm, Sat-Sun 10am-11pm
    INSERT INTO public.business_hours (restaurant_id, day_of_week, open_time, close_time, is_closed) VALUES
        (NEW.id, 0, '09:00', '22:00', FALSE), -- Monday
        (NEW.id, 1, '09:00', '22:00', FALSE), -- Tuesday
        (NEW.id, 2, '09:00', '22:00', FALSE), -- Wednesday
        (NEW.id, 3, '09:00', '22:00', FALSE), -- Thursday
        (NEW.id, 4, '09:00', '22:00', FALSE), -- Friday
        (NEW.id, 5, '10:00', '23:00', FALSE), -- Saturday
        (NEW.id, 6, '10:00', '23:00', FALSE)  -- Sunday
    ON CONFLICT (restaurant_id, day_of_week) DO NOTHING;

    RETURN NEW;
END;
$$;

-- ============================================================================
-- NOTIFICATION FUNCTIONS (from create-notifications-table.sql)
-- ============================================================================

-- Function to create a notification for an employee when a shift is assigned
CREATE OR REPLACE FUNCTION create_shift_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    employee_user_id UUID;
    employee_name TEXT;
    shift_date_formatted TEXT;
BEGIN
    -- Get the employee's user_id and name
    SELECT user_id, first_name || ' ' || last_name
    INTO employee_user_id, employee_name
    FROM public.employees
    WHERE id = NEW.employee_id;

    -- Only create notification if employee has a user account
    IF employee_user_id IS NOT NULL THEN
        -- Format the shift date
        shift_date_formatted := TO_CHAR(NEW.shift_date, 'DD/MM/YYYY');

        -- Create notification for shift creation
        IF (TG_OP = 'INSERT') THEN
            INSERT INTO public.notifications (
                user_id,
                restaurant_id,
                type,
                title,
                message,
                link
            ) VALUES (
                employee_user_id,
                NEW.restaurant_id,
                'shift_created',
                'New Shift Assigned',
                'You have been assigned a shift on ' || shift_date_formatted || ' from ' ||
                TO_CHAR(NEW.start_time, 'HH12:MI AM') || ' to ' || TO_CHAR(NEW.end_time, 'HH12:MI AM'),
                '/dashboard/my-shifts'
            );
        END IF;

        -- Create notification for shift update
        IF (TG_OP = 'UPDATE') THEN
            -- Only notify if date or time changed
            IF (OLD.shift_date != NEW.shift_date OR
                OLD.start_time != NEW.start_time OR
                OLD.end_time != NEW.end_time) THEN

                INSERT INTO public.notifications (
                    user_id,
                    restaurant_id,
                    type,
                    title,
                    message,
                    link
                ) VALUES (
                    employee_user_id,
                    NEW.restaurant_id,
                    'shift_updated',
                    'Shift Updated',
                    'Your shift on ' || shift_date_formatted || ' has been updated to ' ||
                    TO_CHAR(NEW.start_time, 'HH12:MI AM') || ' - ' || TO_CHAR(NEW.end_time, 'HH12:MI AM'),
                    '/dashboard/my-shifts'
                );
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Function to create notification when shift is deleted
CREATE OR REPLACE FUNCTION create_shift_deleted_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    employee_user_id UUID;
    shift_date_formatted TEXT;
BEGIN
    -- Get the employee's user_id
    SELECT user_id
    INTO employee_user_id
    FROM public.employees
    WHERE id = OLD.employee_id;

    -- Only create notification if employee has a user account
    IF employee_user_id IS NOT NULL THEN
        -- Format the shift date
        shift_date_formatted := TO_CHAR(OLD.shift_date, 'DD/MM/YYYY');

        INSERT INTO public.notifications (
            user_id,
            restaurant_id,
            type,
            title,
            message,
            link
        ) VALUES (
            employee_user_id,
            OLD.restaurant_id,
            'shift_deleted',
            'Shift Cancelled',
            'Your shift on ' || shift_date_formatted || ' at ' ||
            TO_CHAR(OLD.start_time, 'HH12:MI AM') || ' has been cancelled',
            '/dashboard/my-shifts'
        );
    END IF;

    RETURN OLD;
END;
$$;

-- ============================================================================
-- SHIFT SWAP FUNCTIONS (from add-shift-swap-requests.sql)
-- ============================================================================

-- Function to execute a shift swap (swap employee_id on both shifts)
CREATE OR REPLACE FUNCTION execute_shift_swap(p_swap_request_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_requester_shift_id UUID;
    v_requested_shift_id UUID;
    v_requester_id UUID;
    v_requested_employee_id UUID;
    v_status TEXT;
BEGIN
    -- Get swap request details
    SELECT
        requester_shift_id,
        requested_shift_id,
        requester_id,
        requested_employee_id,
        status
    INTO
        v_requester_shift_id,
        v_requested_shift_id,
        v_requester_id,
        v_requested_employee_id,
        v_status
    FROM public.shift_swap_requests
    WHERE id = p_swap_request_id;

    -- Validate request exists and is in correct status
    IF NOT FOUND OR v_status != 'pending_manager' THEN
        RAISE EXCEPTION 'Swap request not found or not in pending_manager status';
        RETURN FALSE;
    END IF;

    -- Validate both shifts still exist and are in the future
    IF NOT EXISTS (
        SELECT 1 FROM public.shifts
        WHERE id = v_requester_shift_id
        AND shift_date >= CURRENT_DATE
    ) THEN
        RAISE EXCEPTION 'Requester shift no longer exists or is in the past';
        RETURN FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.shifts
        WHERE id = v_requested_shift_id
        AND shift_date >= CURRENT_DATE
    ) THEN
        RAISE EXCEPTION 'Requested shift no longer exists or is in the past';
        RETURN FALSE;
    END IF;

    -- Perform the swap (atomic transaction)
    BEGIN
        -- Swap the employee IDs on both shifts
        UPDATE public.shifts
        SET
            employee_id = v_requested_employee_id,
            updated_at = NOW()
        WHERE id = v_requester_shift_id;

        UPDATE public.shifts
        SET
            employee_id = v_requester_id,
            updated_at = NOW()
        WHERE id = v_requested_shift_id;

        -- Mark swap request as approved
        UPDATE public.shift_swap_requests
        SET
            status = 'approved',
            manager_reviewed_at = NOW(),
            updated_at = NOW()
        WHERE id = p_swap_request_id;

        RETURN TRUE;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to execute shift swap: %', SQLERRM;
        RETURN FALSE;
    END;
END;
$$;

-- Function to check if an employee can swap a specific shift
CREATE OR REPLACE FUNCTION can_swap_shift(
    p_employee_id UUID,
    p_shift_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_shift_date DATE;
    v_has_pending_swap BOOLEAN;
BEGIN
    -- Get shift date
    SELECT shift_date INTO v_shift_date
    FROM public.shifts
    WHERE id = p_shift_id
    AND employee_id = p_employee_id;

    IF NOT FOUND THEN
        RETURN FALSE; -- Employee doesn't own this shift
    END IF;

    -- Check if shift is in the future
    IF v_shift_date < CURRENT_DATE THEN
        RETURN FALSE; -- Can't swap past shifts
    END IF;

    -- Check if there's already a pending swap for this shift
    SELECT EXISTS(
        SELECT 1 FROM public.shift_swap_requests
        WHERE (requester_shift_id = p_shift_id OR requested_shift_id = p_shift_id)
        AND status IN ('pending_employee', 'pending_manager')
    ) INTO v_has_pending_swap;

    IF v_has_pending_swap THEN
        RETURN FALSE; -- Shift already has a pending swap
    END IF;

    RETURN TRUE;
END;
$$;

-- Function to get eligible shifts for swapping
-- Note: Must drop first because we're changing the return type (position -> shift_position)
DROP FUNCTION IF EXISTS get_eligible_swap_shifts(UUID, UUID);

CREATE OR REPLACE FUNCTION get_eligible_swap_shifts(
    p_employee_id UUID,
    p_shift_id UUID
)
RETURNS TABLE (
    shift_id UUID,
    employee_id UUID,
    employee_name TEXT,
    shift_date DATE,
    start_time TIME,
    end_time TIME,
    shift_position TEXT
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_restaurant_id UUID;
    v_shift_date DATE;
    v_start_time TIME;
    v_end_time TIME;
BEGIN
    -- Get the original shift details
    SELECT
        s.restaurant_id,
        s.shift_date,
        s.start_time,
        s.end_time
    INTO
        v_restaurant_id,
        v_shift_date,
        v_start_time,
        v_end_time
    FROM public.shifts s
    WHERE s.id = p_shift_id
    AND s.employee_id = p_employee_id;

    IF NOT FOUND THEN
        RETURN; -- Employee doesn't own this shift
    END IF;

    -- Return eligible shifts (same date, not the requester, no pending swaps)
    RETURN QUERY
    SELECT
        s.id,
        s.employee_id,
        e.first_name || ' ' || e.last_name AS employee_name,
        s.shift_date,
        s.start_time,
        s.end_time,
        s.position AS shift_position
    FROM public.shifts s
    JOIN public.employees e ON e.id = s.employee_id
    WHERE s.restaurant_id = v_restaurant_id
    AND s.shift_date = v_shift_date
    AND s.shift_date >= CURRENT_DATE
    AND s.employee_id != p_employee_id
    AND e.role != 'manager'
    AND NOT EXISTS (
        SELECT 1 FROM public.shift_swap_requests ssr
        WHERE (ssr.requester_shift_id = s.id OR ssr.requested_shift_id = s.id)
        AND ssr.status IN ('pending_employee', 'pending_manager')
    )
    ORDER BY s.start_time;
END;
$$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- To execute this migration:
-- 1. Open your Supabase project dashboard
-- 2. Go to SQL Editor
-- 3. Paste and run this entire script
-- 4. Verify the fix by running the database linter again

-- Expected result:
-- ✅ All 17 function_search_path_mutable warnings should be resolved
-- ✅ All functions now have SET search_path = '' for security
-- ✅ All table references are now fully qualified with public schema
