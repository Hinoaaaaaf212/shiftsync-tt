-- ShiftSync TT Database Schema
-- Execute this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SECTION 1: CREATE ALL TABLES
-- ============================================================================

-- RESTAURANTS TABLE
CREATE TABLE restaurants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    owner_email TEXT NOT NULL,
    timezone TEXT DEFAULT 'America/Port_of_Spain',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- EMPLOYEES TABLE
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    role TEXT NOT NULL CHECK (role IN ('manager', 'server', 'cook', 'bartender', 'host', 'employee')),
    position TEXT,
    hourly_rate DECIMAL(10,2),
    hire_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SHIFTS TABLE
CREATE TABLE shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    position TEXT CHECK (position IN ('server', 'cook', 'bartender', 'host', 'dishwasher')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- BLOCKED DATES TABLE (for Carnival, holidays, etc.)
CREATE TABLE blocked_dates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(restaurant_id, date)
);

-- ============================================================================
-- SECTION 2: CREATE INDEXES
-- ============================================================================

CREATE INDEX idx_employees_restaurant_id ON employees(restaurant_id);
CREATE INDEX idx_employees_user_id ON employees(user_id);
CREATE INDEX idx_shifts_restaurant_id ON shifts(restaurant_id);
CREATE INDEX idx_shifts_employee_id ON shifts(employee_id);
CREATE INDEX idx_shifts_date ON shifts(shift_date);
CREATE INDEX idx_blocked_dates_restaurant_id ON blocked_dates(restaurant_id);
CREATE INDEX idx_blocked_dates_date ON blocked_dates(date);

-- ============================================================================
-- SECTION 3: HELPER FUNCTIONS (Security Definer to avoid RLS recursion)
-- ============================================================================

-- Function to get restaurant_id for an employee (bypasses RLS)
CREATE OR REPLACE FUNCTION get_employee_restaurant_id(emp_user_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT restaurant_id FROM employees WHERE user_id = emp_user_id LIMIT 1;
$$;

-- Function to check if user owns a restaurant (bypasses RLS)
CREATE OR REPLACE FUNCTION user_owns_restaurant(restaurant_uuid UUID, user_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM restaurants
    WHERE id = restaurant_uuid AND owner_email = user_email
  );
$$;

-- ============================================================================
-- SECTION 4: ENABLE RLS AND CREATE POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;

-- RESTAURANTS RLS POLICIES (Optimized)
-- Note: auth functions wrapped in subqueries to prevent per-row evaluation

-- COMBINED SELECT POLICY: Users can view restaurants they own OR work for
CREATE POLICY "restaurants_select_policy" ON restaurants
    FOR SELECT
    USING (
        owner_email = (select auth.email())
        OR id = get_employee_restaurant_id((select auth.uid()))
    );

-- UPDATE POLICY: Restaurant owners can update their restaurants
CREATE POLICY "restaurants_update_policy" ON restaurants
    FOR UPDATE
    USING (owner_email = (select auth.email()));

-- INSERT POLICY: Users can create restaurants
CREATE POLICY "restaurants_insert_policy" ON restaurants
    FOR INSERT
    WITH CHECK (owner_email = (select auth.email()));

-- DELETE POLICY: Restaurant owners can delete
CREATE POLICY "restaurants_delete_policy" ON restaurants
    FOR DELETE
    USING (owner_email = (select auth.email()));

-- EMPLOYEES RLS POLICIES (Optimized)
-- Note: Duplicate policies combined, auth functions wrapped in subqueries

-- COMBINED SELECT POLICY: Employees can view own record OR restaurant owners can view employees
CREATE POLICY "employees_select_policy" ON employees
    FOR SELECT
    USING (
        user_id = (select auth.uid())
        OR user_owns_restaurant(restaurant_id, (select auth.email()))
    );

-- INSERT POLICY: Restaurant owners can insert employees
CREATE POLICY "employees_insert_policy" ON employees
    FOR INSERT
    WITH CHECK (user_owns_restaurant(restaurant_id, (select auth.email())));

-- COMBINED UPDATE POLICY: Restaurant owners can update employees OR employees can update own profile
CREATE POLICY "employees_update_policy" ON employees
    FOR UPDATE
    USING (
        user_owns_restaurant(restaurant_id, (select auth.email()))
        OR user_id = (select auth.uid())
    );

-- DELETE POLICY: Restaurant owners can delete employees
CREATE POLICY "employees_delete_policy" ON employees
    FOR DELETE
    USING (user_owns_restaurant(restaurant_id, (select auth.email())));

-- SHIFTS RLS POLICIES (Optimized)
-- Note: Duplicate policies combined, auth functions wrapped in subqueries

-- COMBINED SELECT POLICY: Employees can view own shifts OR restaurant owners can view shifts
CREATE POLICY "shifts_select_policy" ON shifts
    FOR SELECT
    USING (
        restaurant_id = get_employee_restaurant_id((select auth.uid()))
        OR user_owns_restaurant(restaurant_id, (select auth.email()))
    );

-- INSERT POLICY: Restaurant owners can insert shifts
CREATE POLICY "shifts_insert_policy" ON shifts
    FOR INSERT
    WITH CHECK (user_owns_restaurant(restaurant_id, (select auth.email())));

-- UPDATE POLICY: Restaurant owners can update shifts
CREATE POLICY "shifts_update_policy" ON shifts
    FOR UPDATE
    USING (user_owns_restaurant(restaurant_id, (select auth.email())));

-- DELETE POLICY: Restaurant owners can delete shifts
CREATE POLICY "shifts_delete_policy" ON shifts
    FOR DELETE
    USING (user_owns_restaurant(restaurant_id, (select auth.email())));

-- BLOCKED DATES RLS POLICIES (Optimized)
-- Note: Auth functions wrapped in subqueries

-- SELECT POLICY: Restaurant owners can view blocked dates
CREATE POLICY "blocked_dates_select_policy" ON blocked_dates
    FOR SELECT
    USING (user_owns_restaurant(restaurant_id, (select auth.email())));

-- INSERT POLICY: Restaurant owners can insert blocked dates
CREATE POLICY "blocked_dates_insert_policy" ON blocked_dates
    FOR INSERT
    WITH CHECK (user_owns_restaurant(restaurant_id, (select auth.email())));

-- UPDATE POLICY: Restaurant owners can update blocked dates
CREATE POLICY "blocked_dates_update_policy" ON blocked_dates
    FOR UPDATE
    USING (user_owns_restaurant(restaurant_id, (select auth.email())));

-- DELETE POLICY: Restaurant owners can delete blocked dates
CREATE POLICY "blocked_dates_delete_policy" ON blocked_dates
    FOR DELETE
    USING (user_owns_restaurant(restaurant_id, (select auth.email())));

-- ============================================================================
-- SECTION 5: FUNCTIONS, TRIGGERS, VIEWS, AND DATA
-- ============================================================================

-- FUNCTIONS

-- Function to check for shift conflicts
CREATE OR REPLACE FUNCTION check_shift_conflicts(
    p_employee_id UUID,
    p_shift_date DATE,
    p_start_time TIME,
    p_end_time TIME,
    p_shift_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    conflict_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO conflict_count
    FROM shifts
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
$$ LANGUAGE plpgsql;

-- Function to get employee schedule for a week
CREATE OR REPLACE FUNCTION get_employee_weekly_schedule(
    p_employee_id UUID,
    p_week_start DATE
)
RETURNS TABLE (
    shift_id UUID,
    shift_date DATE,
    start_time TIME,
    end_time TIME,
    position TEXT,
    notes TEXT,
    total_hours DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.shift_date,
        s.start_time,
        s.end_time,
        s.position,
        s.notes,
        EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600 as total_hours
    FROM shifts s
    WHERE s.employee_id = p_employee_id
        AND s.shift_date >= p_week_start
        AND s.shift_date < p_week_start + INTERVAL '7 days'
    ORDER BY s.shift_date, s.start_time;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically add holidays for new restaurants
CREATE OR REPLACE FUNCTION add_default_holidays()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO blocked_dates (restaurant_id, date, reason) VALUES
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
$$ language 'plpgsql';

-- Update updated_at timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- TRIGGERS

-- Trigger to add default holidays when a new restaurant is created
CREATE TRIGGER add_holidays_for_new_restaurant
    AFTER INSERT ON restaurants
    FOR EACH ROW
    EXECUTE FUNCTION add_default_holidays();

-- Update updated_at timestamp on shifts
CREATE TRIGGER update_shifts_updated_at
    BEFORE UPDATE ON shifts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- VIEWS

-- View: Employee schedule with restaurant info
CREATE VIEW employee_schedule_view AS
SELECT
    e.id as employee_id,
    e.first_name,
    e.last_name,
    e.email,
    e.position as default_position,
    r.name as restaurant_name,
    r.timezone,
    s.id as shift_id,
    s.shift_date,
    s.start_time,
    s.end_time,
    s.position as shift_position,
    s.notes,
    EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600 as shift_hours
FROM employees e
JOIN restaurants r ON e.restaurant_id = r.id
LEFT JOIN shifts s ON e.id = s.employee_id
WHERE e.status = 'active';

-- View: Restaurant dashboard summary
CREATE VIEW restaurant_dashboard_view AS
SELECT
    r.id as restaurant_id,
    r.name as restaurant_name,
    COUNT(DISTINCT e.id) as total_employees,
    COUNT(DISTINCT CASE WHEN e.status = 'active' THEN e.id END) as active_employees,
    COUNT(DISTINCT CASE WHEN s.shift_date = CURRENT_DATE THEN s.id END) as today_shifts,
    COUNT(DISTINCT CASE WHEN s.shift_date >= CURRENT_DATE
                        AND s.shift_date < CURRENT_DATE + INTERVAL '7 days'
                        THEN s.id END) as week_shifts
FROM restaurants r
LEFT JOIN employees e ON r.id = e.restaurant_id
LEFT JOIN shifts s ON e.id = s.employee_id
GROUP BY r.id, r.name;