-- ShiftSync TT Migration: Shift Templates and Time Off Requests
-- Execute this in your Supabase SQL Editor
-- Date: 2025-10-12

-- ============================================================================
-- SECTION 1: CREATE NEW TABLES
-- ============================================================================

-- SHIFT TEMPLATES TABLE
-- Stores reusable shift templates for quick scheduling
CREATE TABLE shift_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    position TEXT CHECK (position IN ('server', 'cook', 'bartender', 'host', 'dishwasher')),
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TIME OFF REQUESTS TABLE
-- Manages employee time-off requests with manager approval workflow
CREATE TABLE time_off_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- ============================================================================
-- SECTION 2: CREATE INDEXES
-- ============================================================================

-- Shift Templates indexes
CREATE INDEX idx_shift_templates_restaurant_id ON shift_templates(restaurant_id);
CREATE INDEX idx_shift_templates_is_active ON shift_templates(is_active);

-- Time Off Requests indexes
CREATE INDEX idx_time_off_restaurant_id ON time_off_requests(restaurant_id);
CREATE INDEX idx_time_off_employee_id ON time_off_requests(employee_id);
CREATE INDEX idx_time_off_status ON time_off_requests(status);
CREATE INDEX idx_time_off_dates ON time_off_requests(start_date, end_date);

-- ============================================================================
-- SECTION 3: ENABLE RLS AND CREATE POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE shift_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_off_requests ENABLE ROW LEVEL SECURITY;

-- SHIFT TEMPLATES RLS POLICIES

-- SELECT POLICY: Restaurant owners can view templates
CREATE POLICY "shift_templates_select_policy" ON shift_templates
    FOR SELECT
    USING (user_owns_restaurant(restaurant_id, (select auth.email())));

-- INSERT POLICY: Restaurant owners can create templates
CREATE POLICY "shift_templates_insert_policy" ON shift_templates
    FOR INSERT
    WITH CHECK (user_owns_restaurant(restaurant_id, (select auth.email())));

-- UPDATE POLICY: Restaurant owners can update templates
CREATE POLICY "shift_templates_update_policy" ON shift_templates
    FOR UPDATE
    USING (user_owns_restaurant(restaurant_id, (select auth.email())));

-- DELETE POLICY: Restaurant owners can delete templates
CREATE POLICY "shift_templates_delete_policy" ON shift_templates
    FOR DELETE
    USING (user_owns_restaurant(restaurant_id, (select auth.email())));

-- TIME OFF REQUESTS RLS POLICIES

-- SELECT POLICY: Employees can view own requests OR restaurant owners can view all
CREATE POLICY "time_off_select_policy" ON time_off_requests
    FOR SELECT
    USING (
        employee_id IN (SELECT id FROM employees WHERE user_id = (select auth.uid()))
        OR user_owns_restaurant(restaurant_id, (select auth.email()))
    );

-- INSERT POLICY: Employees can create own requests
CREATE POLICY "time_off_insert_policy" ON time_off_requests
    FOR INSERT
    WITH CHECK (
        employee_id IN (SELECT id FROM employees WHERE user_id = (select auth.uid()))
    );

-- UPDATE POLICY: Employees can update own pending requests OR owners can approve/deny
CREATE POLICY "time_off_update_policy" ON time_off_requests
    FOR UPDATE
    USING (
        (employee_id IN (SELECT id FROM employees WHERE user_id = (select auth.uid())) AND status = 'pending')
        OR user_owns_restaurant(restaurant_id, (select auth.email()))
    );

-- DELETE POLICY: Employees can delete own pending requests OR owners can delete any
CREATE POLICY "time_off_delete_policy" ON time_off_requests
    FOR DELETE
    USING (
        (employee_id IN (SELECT id FROM employees WHERE user_id = (select auth.uid())) AND status = 'pending')
        OR user_owns_restaurant(restaurant_id, (select auth.email()))
    );

-- ============================================================================
-- SECTION 4: TRIGGERS
-- ============================================================================

-- Update updated_at timestamp on shift_templates
CREATE TRIGGER update_shift_templates_updated_at
    BEFORE UPDATE ON shift_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at timestamp on time_off_requests
CREATE TRIGGER update_time_off_requests_updated_at
    BEFORE UPDATE ON time_off_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SECTION 5: HELPER FUNCTIONS
-- ============================================================================

-- Function to check if employee has approved time off on a specific date
CREATE OR REPLACE FUNCTION has_approved_time_off(
    p_employee_id UUID,
    p_date DATE
)
RETURNS BOOLEAN AS $$
DECLARE
    time_off_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO time_off_count
    FROM time_off_requests
    WHERE employee_id = p_employee_id
        AND status = 'approved'
        AND p_date >= start_date
        AND p_date <= end_date;

    RETURN time_off_count > 0;
END;
$$ LANGUAGE plpgsql;

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
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.start_date,
        t.end_date,
        t.reason,
        t.status,
        (t.end_date - t.start_date + 1)::INTEGER as days_count
    FROM time_off_requests t
    WHERE t.employee_id = p_employee_id
        AND t.status = 'approved'
        AND NOT (t.end_date < p_start_date OR t.start_date > p_end_date)
    ORDER BY t.start_date;
END;
$$ LANGUAGE plpgsql;

-- Function to copy shifts from previous week
CREATE OR REPLACE FUNCTION copy_previous_week_shifts(
    p_restaurant_id UUID,
    p_source_week_start DATE,
    p_target_week_start DATE
)
RETURNS INTEGER AS $$
DECLARE
    shifts_copied INTEGER := 0;
    shift_record RECORD;
    new_date DATE;
    days_diff INTEGER;
BEGIN
    days_diff := p_target_week_start - p_source_week_start;

    FOR shift_record IN
        SELECT * FROM shifts
        WHERE restaurant_id = p_restaurant_id
            AND shift_date >= p_source_week_start
            AND shift_date < p_source_week_start + INTERVAL '7 days'
    LOOP
        new_date := shift_record.shift_date + days_diff;

        -- Only copy if employee doesn't have approved time off
        IF NOT has_approved_time_off(shift_record.employee_id, new_date) THEN
            INSERT INTO shifts (
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
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMPLETED: Migration script created
-- ============================================================================

-- To execute this migration:
-- 1. Open your Supabase project dashboard
-- 2. Go to SQL Editor
-- 3. Paste and run this entire script
-- 4. Verify tables created: SELECT * FROM shift_templates LIMIT 1;
-- 5. Verify tables created: SELECT * FROM time_off_requests LIMIT 1;
