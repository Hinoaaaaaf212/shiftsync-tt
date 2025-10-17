-- ShiftSync TT Migration: AI Scheduling Tables
-- Execute this in your Supabase SQL Editor
-- Date: 2025-10-12

-- ============================================================================
-- SECTION 1: CREATE NEW TABLES FOR AI SCHEDULING
-- ============================================================================

-- BUSINESS HOURS TABLE
-- Stores restaurant operating hours for each day of the week
CREATE TABLE business_hours (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Monday, 6=Sunday
    open_time TIME NOT NULL,
    close_time TIME NOT NULL,
    is_closed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(restaurant_id, day_of_week),
    CONSTRAINT valid_hours CHECK (close_time > open_time OR is_closed = TRUE)
);

-- EMPLOYEE AVAILABILITY TABLE
-- Tracks when employees are NOT available to work
CREATE TABLE employee_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- NULL for specific dates
    specific_date DATE, -- NULL for recurring weekly blocks
    unavailable_start_time TIME,
    unavailable_end_time TIME,
    is_all_day BOOLEAN DEFAULT FALSE, -- TRUE means entire day unavailable
    reason TEXT,
    is_recurring BOOLEAN DEFAULT TRUE, -- TRUE for weekly recurring, FALSE for one-time
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT date_or_day_required CHECK (
        (day_of_week IS NOT NULL AND specific_date IS NULL AND is_recurring = TRUE) OR
        (day_of_week IS NULL AND specific_date IS NOT NULL)
    ),
    CONSTRAINT time_required_if_not_all_day CHECK (
        is_all_day = TRUE OR (unavailable_start_time IS NOT NULL AND unavailable_end_time IS NOT NULL)
    )
);

-- EMPLOYEE PREFERENCES TABLE
-- Stores employee scheduling preferences and monthly hour targets
CREATE TABLE employee_preferences (
    employee_id UUID PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
    target_monthly_hours INTEGER DEFAULT 160 CHECK (target_monthly_hours >= 40 AND target_monthly_hours <= 200),
    preferred_shift_start_time TIME, -- e.g., "09:00"
    preferred_shift_length_hours DECIMAL(3,1) CHECK (preferred_shift_length_hours >= 4 AND preferred_shift_length_hours <= 12),
    max_days_per_week INTEGER DEFAULT 6 CHECK (max_days_per_week >= 1 AND max_days_per_week <= 7),
    prefers_weekends BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- STAFFING REQUIREMENTS TABLE
-- Defines how many staff are needed for different time slots
CREATE TABLE staffing_requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    time_slot_start TIME NOT NULL,
    time_slot_end TIME NOT NULL,
    min_staff_required INTEGER NOT NULL DEFAULT 1 CHECK (min_staff_required >= 0),
    optimal_staff INTEGER NOT NULL DEFAULT 2 CHECK (optimal_staff >= min_staff_required),
    position_requirements JSONB, -- e.g., {"server": 3, "cook": 2, "bartender": 1}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_time_slot CHECK (time_slot_end > time_slot_start)
);

-- AI GENERATED SCHEDULES TABLE (for versioning and rollback)
CREATE TABLE ai_generated_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    generation_params JSONB, -- Store settings used for generation
    total_shifts INTEGER NOT NULL DEFAULT 0,
    total_hours DECIMAL(8,2),
    estimated_labor_cost DECIMAL(10,2),
    warnings JSONB, -- Array of warning messages
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    generated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    published_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- SECTION 2: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Business hours indexes
CREATE INDEX idx_business_hours_restaurant ON business_hours(restaurant_id);
CREATE INDEX idx_business_hours_day ON business_hours(day_of_week);

-- Employee availability indexes
CREATE INDEX idx_availability_employee ON employee_availability(employee_id);
CREATE INDEX idx_availability_restaurant ON employee_availability(restaurant_id);
CREATE INDEX idx_availability_date ON employee_availability(specific_date) WHERE specific_date IS NOT NULL;
CREATE INDEX idx_availability_day ON employee_availability(day_of_week) WHERE day_of_week IS NOT NULL;
CREATE INDEX idx_availability_recurring ON employee_availability(is_recurring);

-- Employee preferences index
CREATE INDEX idx_preferences_target_hours ON employee_preferences(target_monthly_hours);

-- Staffing requirements indexes
CREATE INDEX idx_staffing_restaurant ON staffing_requirements(restaurant_id);
CREATE INDEX idx_staffing_day_time ON staffing_requirements(day_of_week, time_slot_start);

-- AI schedules indexes
CREATE INDEX idx_ai_schedules_restaurant ON ai_generated_schedules(restaurant_id);
CREATE INDEX idx_ai_schedules_week ON ai_generated_schedules(week_start_date);
CREATE INDEX idx_ai_schedules_status ON ai_generated_schedules(status);

-- ============================================================================
-- SECTION 3: ENABLE RLS AND CREATE POLICIES
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE staffing_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generated_schedules ENABLE ROW LEVEL SECURITY;

-- BUSINESS HOURS POLICIES
CREATE POLICY "business_hours_select" ON business_hours
    FOR SELECT USING (
        user_owns_restaurant(restaurant_id, (select auth.email()))
        OR restaurant_id IN (SELECT restaurant_id FROM employees WHERE user_id = (select auth.uid()))
    );

CREATE POLICY "business_hours_insert" ON business_hours
    FOR INSERT WITH CHECK (user_owns_restaurant(restaurant_id, (select auth.email())));

CREATE POLICY "business_hours_update" ON business_hours
    FOR UPDATE USING (user_owns_restaurant(restaurant_id, (select auth.email())));

CREATE POLICY "business_hours_delete" ON business_hours
    FOR DELETE USING (user_owns_restaurant(restaurant_id, (select auth.email())));

-- EMPLOYEE AVAILABILITY POLICIES
CREATE POLICY "availability_select" ON employee_availability
    FOR SELECT USING (
        employee_id IN (SELECT id FROM employees WHERE user_id = (select auth.uid()))
        OR user_owns_restaurant(restaurant_id, (select auth.email()))
    );

CREATE POLICY "availability_insert" ON employee_availability
    FOR INSERT WITH CHECK (
        employee_id IN (SELECT id FROM employees WHERE user_id = (select auth.uid()))
    );

CREATE POLICY "availability_update" ON employee_availability
    FOR UPDATE USING (
        employee_id IN (SELECT id FROM employees WHERE user_id = (select auth.uid()))
        OR user_owns_restaurant(restaurant_id, (select auth.email()))
    );

CREATE POLICY "availability_delete" ON employee_availability
    FOR DELETE USING (
        employee_id IN (SELECT id FROM employees WHERE user_id = (select auth.uid()))
        OR user_owns_restaurant(restaurant_id, (select auth.email()))
    );

-- EMPLOYEE PREFERENCES POLICIES
CREATE POLICY "preferences_select" ON employee_preferences
    FOR SELECT USING (
        employee_id IN (SELECT id FROM employees WHERE user_id = (select auth.uid()))
        OR employee_id IN (SELECT id FROM employees WHERE restaurant_id IN
            (SELECT id FROM restaurants WHERE owner_email = (select auth.email())))
    );

CREATE POLICY "preferences_insert" ON employee_preferences
    FOR INSERT WITH CHECK (
        employee_id IN (SELECT id FROM employees WHERE user_id = (select auth.uid()))
    );

CREATE POLICY "preferences_update" ON employee_preferences
    FOR UPDATE USING (
        employee_id IN (SELECT id FROM employees WHERE user_id = (select auth.uid()))
    );

CREATE POLICY "preferences_delete" ON employee_preferences
    FOR DELETE USING (
        employee_id IN (SELECT id FROM employees WHERE user_id = (select auth.uid()))
    );

-- STAFFING REQUIREMENTS POLICIES
CREATE POLICY "staffing_select" ON staffing_requirements
    FOR SELECT USING (
        user_owns_restaurant(restaurant_id, (select auth.email()))
        OR restaurant_id IN (SELECT restaurant_id FROM employees WHERE user_id = (select auth.uid()))
    );

CREATE POLICY "staffing_insert" ON staffing_requirements
    FOR INSERT WITH CHECK (user_owns_restaurant(restaurant_id, (select auth.email())));

CREATE POLICY "staffing_update" ON staffing_requirements
    FOR UPDATE USING (user_owns_restaurant(restaurant_id, (select auth.email())));

CREATE POLICY "staffing_delete" ON staffing_requirements
    FOR DELETE USING (user_owns_restaurant(restaurant_id, (select auth.email())));

-- AI GENERATED SCHEDULES POLICIES
CREATE POLICY "ai_schedules_select" ON ai_generated_schedules
    FOR SELECT USING (user_owns_restaurant(restaurant_id, (select auth.email())));

CREATE POLICY "ai_schedules_insert" ON ai_generated_schedules
    FOR INSERT WITH CHECK (user_owns_restaurant(restaurant_id, (select auth.email())));

CREATE POLICY "ai_schedules_update" ON ai_generated_schedules
    FOR UPDATE USING (user_owns_restaurant(restaurant_id, (select auth.email())));

CREATE POLICY "ai_schedules_delete" ON ai_generated_schedules
    FOR DELETE USING (user_owns_restaurant(restaurant_id, (select auth.email())));

-- ============================================================================
-- SECTION 4: TRIGGERS FOR updated_at
-- ============================================================================

CREATE TRIGGER update_business_hours_updated_at
    BEFORE UPDATE ON business_hours
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employee_preferences_updated_at
    BEFORE UPDATE ON employee_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staffing_requirements_updated_at
    BEFORE UPDATE ON staffing_requirements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SECTION 5: HELPER FUNCTIONS FOR AI SCHEDULING
-- ============================================================================

-- Function to check if employee is available for a specific date/time
CREATE OR REPLACE FUNCTION is_employee_available(
    p_employee_id UUID,
    p_date DATE,
    p_start_time TIME,
    p_end_time TIME
)
RETURNS BOOLEAN AS $$
DECLARE
    day_num INTEGER;
    unavailable_count INTEGER;
BEGIN
    -- Get day of week (0=Monday, 6=Sunday)
    day_num := EXTRACT(ISODOW FROM p_date) - 1;

    -- Check for availability blocks
    SELECT COUNT(*) INTO unavailable_count
    FROM employee_availability
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
$$ LANGUAGE plpgsql;

-- Function to get employee monthly hours
CREATE OR REPLACE FUNCTION get_employee_monthly_hours(
    p_employee_id UUID,
    p_year INTEGER,
    p_month INTEGER
)
RETURNS DECIMAL AS $$
DECLARE
    total_hours DECIMAL;
BEGIN
    SELECT COALESCE(SUM(
        EXTRACT(EPOCH FROM (end_time - start_time)) / 3600
    ), 0) INTO total_hours
    FROM shifts
    WHERE employee_id = p_employee_id
        AND EXTRACT(YEAR FROM shift_date) = p_year
        AND EXTRACT(MONTH FROM shift_date) = p_month;

    RETURN total_hours;
END;
$$ LANGUAGE plpgsql;

-- Function to initialize default business hours for new restaurants
CREATE OR REPLACE FUNCTION init_default_business_hours()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert default Mon-Fri 9am-10pm, Sat-Sun 10am-11pm
    INSERT INTO business_hours (restaurant_id, day_of_week, open_time, close_time, is_closed) VALUES
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
$$ LANGUAGE plpgsql;

-- Trigger to auto-create default business hours
CREATE TRIGGER create_default_business_hours
    AFTER INSERT ON restaurants
    FOR EACH ROW
    EXECUTE FUNCTION init_default_business_hours();

-- ============================================================================
-- COMPLETED: AI Scheduling Migration
-- ============================================================================

-- To execute this migration:
-- 1. Open your Supabase project dashboard
-- 2. Go to SQL Editor
-- 3. Paste and run this entire script
-- 4. Verify tables created: SELECT * FROM business_hours LIMIT 1;
