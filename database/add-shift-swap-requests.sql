-- ShiftSync TT - Shift Swap Requests Feature
-- This migration adds the ability for employees to request shift swaps with each other
-- Workflow: Employee A → Employee B accepts → Manager approves → Shifts swapped

-- ============================================================================
-- SECTION 1: CREATE SHIFT SWAP REQUESTS TABLE
-- ============================================================================

CREATE TABLE shift_swap_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,

    -- Requester info (person initiating the swap)
    requester_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    requester_shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,

    -- Requested employee info (person being asked to swap)
    requested_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    requested_shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending_employee' CHECK (status IN (
        'pending_employee',  -- Waiting for requested employee to accept
        'pending_manager',   -- Employee accepted, waiting for manager approval
        'approved',          -- Manager approved, swap executed
        'denied',           -- Manager or employee denied
        'cancelled'         -- Requester cancelled before approval
    )),

    -- Notes and responses
    requester_notes TEXT,
    denial_reason TEXT,

    -- Timestamps
    employee_response_at TIMESTAMP WITH TIME ZONE,
    manager_reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    manager_reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT no_self_swap CHECK (requester_id != requested_employee_id),
    CONSTRAINT different_shifts CHECK (requester_shift_id != requested_shift_id)
);

-- ============================================================================
-- SECTION 2: CREATE INDEXES
-- ============================================================================

CREATE INDEX idx_shift_swap_restaurant_id ON shift_swap_requests(restaurant_id);
CREATE INDEX idx_shift_swap_requester_id ON shift_swap_requests(requester_id);
CREATE INDEX idx_shift_swap_requested_employee_id ON shift_swap_requests(requested_employee_id);
CREATE INDEX idx_shift_swap_status ON shift_swap_requests(status);
CREATE INDEX idx_shift_swap_shifts ON shift_swap_requests(requester_shift_id, requested_shift_id);
CREATE INDEX idx_shift_swap_created_at ON shift_swap_requests(created_at DESC);

-- ============================================================================
-- SECTION 3: ENABLE RLS AND CREATE POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE shift_swap_requests ENABLE ROW LEVEL SECURITY;

-- SELECT POLICY: Employees can view swap requests involving them, managers can view all
CREATE POLICY "shift_swap_select_policy" ON shift_swap_requests
    FOR SELECT
    USING (
        -- Employees can see requests they made or received
        requester_id IN (SELECT id FROM employees WHERE user_id = (select auth.uid()))
        OR requested_employee_id IN (SELECT id FROM employees WHERE user_id = (select auth.uid()))
        -- Managers can see all requests for their restaurant
        OR user_owns_restaurant(restaurant_id, (select auth.email()))
    );

-- INSERT POLICY: Employees can create swap requests
CREATE POLICY "shift_swap_insert_policy" ON shift_swap_requests
    FOR INSERT
    WITH CHECK (
        -- Must be the requester
        requester_id IN (SELECT id FROM employees WHERE user_id = (select auth.uid()))
        -- Must be for their restaurant
        AND restaurant_id IN (SELECT restaurant_id FROM employees WHERE user_id = (select auth.uid()))
    );

-- UPDATE POLICY: Employees can respond to requests, managers can approve/deny
CREATE POLICY "shift_swap_update_policy" ON shift_swap_requests
    FOR UPDATE
    USING (
        -- Requester can cancel their own pending requests
        (requester_id IN (SELECT id FROM employees WHERE user_id = (select auth.uid()))
         AND status = 'pending_employee')
        -- Requested employee can accept/deny requests sent to them
        OR (requested_employee_id IN (SELECT id FROM employees WHERE user_id = (select auth.uid()))
            AND status = 'pending_employee')
        -- Managers can approve/deny requests
        OR user_owns_restaurant(restaurant_id, (select auth.email()))
    );

-- DELETE POLICY: Requesters can delete their own cancelled requests, managers can delete any
CREATE POLICY "shift_swap_delete_policy" ON shift_swap_requests
    FOR DELETE
    USING (
        (requester_id IN (SELECT id FROM employees WHERE user_id = (select auth.uid()))
         AND status IN ('cancelled', 'pending_employee'))
        OR user_owns_restaurant(restaurant_id, (select auth.email()))
    );

-- ============================================================================
-- SECTION 4: TRIGGERS
-- ============================================================================

-- Update updated_at timestamp on shift_swap_requests
CREATE TRIGGER update_shift_swap_requests_updated_at
    BEFORE UPDATE ON shift_swap_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SECTION 5: HELPER FUNCTIONS
-- ============================================================================

-- Function to execute a shift swap (swap employee_id on both shifts)
CREATE OR REPLACE FUNCTION execute_shift_swap(p_swap_request_id UUID)
RETURNS BOOLEAN AS $$
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
    FROM shift_swap_requests
    WHERE id = p_swap_request_id;

    -- Validate request exists and is in correct status
    IF NOT FOUND OR v_status != 'pending_manager' THEN
        RAISE EXCEPTION 'Swap request not found or not in pending_manager status';
        RETURN FALSE;
    END IF;

    -- Validate both shifts still exist and are in the future
    IF NOT EXISTS (
        SELECT 1 FROM shifts
        WHERE id = v_requester_shift_id
        AND shift_date >= CURRENT_DATE
    ) THEN
        RAISE EXCEPTION 'Requester shift no longer exists or is in the past';
        RETURN FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM shifts
        WHERE id = v_requested_shift_id
        AND shift_date >= CURRENT_DATE
    ) THEN
        RAISE EXCEPTION 'Requested shift no longer exists or is in the past';
        RETURN FALSE;
    END IF;

    -- Perform the swap (atomic transaction)
    BEGIN
        -- Swap the employee IDs on both shifts
        UPDATE shifts
        SET
            employee_id = v_requested_employee_id,
            updated_at = NOW()
        WHERE id = v_requester_shift_id;

        UPDATE shifts
        SET
            employee_id = v_requester_id,
            updated_at = NOW()
        WHERE id = v_requested_shift_id;

        -- Mark swap request as approved
        UPDATE shift_swap_requests
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if an employee can swap a specific shift
CREATE OR REPLACE FUNCTION can_swap_shift(
    p_employee_id UUID,
    p_shift_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_shift_date DATE;
    v_has_pending_swap BOOLEAN;
BEGIN
    -- Get shift date
    SELECT shift_date INTO v_shift_date
    FROM shifts
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
        SELECT 1 FROM shift_swap_requests
        WHERE (requester_shift_id = p_shift_id OR requested_shift_id = p_shift_id)
        AND status IN ('pending_employee', 'pending_manager')
    ) INTO v_has_pending_swap;

    IF v_has_pending_swap THEN
        RETURN FALSE; -- Shift already has a pending swap
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to get eligible shifts for swapping
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
) AS $$
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
    FROM shifts s
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
    FROM shifts s
    JOIN employees e ON e.id = s.employee_id
    WHERE s.restaurant_id = v_restaurant_id
    AND s.shift_date = v_shift_date
    AND s.shift_date >= CURRENT_DATE
    AND s.employee_id != p_employee_id
    AND e.role != 'manager'
    AND NOT EXISTS (
        SELECT 1 FROM shift_swap_requests ssr
        WHERE (ssr.requester_shift_id = s.id OR ssr.requested_shift_id = s.id)
        AND ssr.status IN ('pending_employee', 'pending_manager')
    )
    ORDER BY s.start_time;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VERIFICATION QUERIES (run these to verify the migration)
-- ============================================================================

-- Check if table was created
-- SELECT COUNT(*) FROM shift_swap_requests;

-- Check if indexes were created
-- SELECT indexname FROM pg_indexes WHERE tablename = 'shift_swap_requests';

-- Check if RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'shift_swap_requests';

-- Check if policies were created
-- SELECT policyname FROM pg_policies WHERE tablename = 'shift_swap_requests';
