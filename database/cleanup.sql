-- ============================================================================
-- CLEANUP SCRIPT - Run this FIRST to delete all existing tables
-- ============================================================================

-- Drop all policies first
DROP POLICY IF EXISTS "Employees can view own shifts" ON shifts;
DROP POLICY IF EXISTS "Restaurant owners can view shifts" ON shifts;
DROP POLICY IF EXISTS "Restaurant owners can insert shifts" ON shifts;
DROP POLICY IF EXISTS "Restaurant owners can update shifts" ON shifts;
DROP POLICY IF EXISTS "Restaurant owners can delete shifts" ON shifts;

DROP POLICY IF EXISTS "Employees can view own record" ON employees;
DROP POLICY IF EXISTS "Restaurant owners can view employees" ON employees;
DROP POLICY IF EXISTS "Restaurant owners can insert employees" ON employees;
DROP POLICY IF EXISTS "Restaurant owners can update employees" ON employees;
DROP POLICY IF EXISTS "Restaurant owners can delete employees" ON employees;
DROP POLICY IF EXISTS "Employees can update own profile" ON employees;

DROP POLICY IF EXISTS "Users can view their restaurants" ON restaurants;
DROP POLICY IF EXISTS "Employees can view their restaurant" ON restaurants;
DROP POLICY IF EXISTS "Restaurant owners can update" ON restaurants;
DROP POLICY IF EXISTS "Users can create restaurants" ON restaurants;
DROP POLICY IF EXISTS "Restaurant owners can delete" ON restaurants;

DROP POLICY IF EXISTS "Restaurant owners can view blocked dates" ON blocked_dates;
DROP POLICY IF EXISTS "Restaurant owners can insert blocked dates" ON blocked_dates;
DROP POLICY IF EXISTS "Restaurant owners can update blocked dates" ON blocked_dates;
DROP POLICY IF EXISTS "Restaurant owners can delete blocked dates" ON blocked_dates;

-- Drop views
DROP VIEW IF EXISTS employee_schedule_view;
DROP VIEW IF EXISTS restaurant_dashboard_view;

-- Drop functions
DROP FUNCTION IF EXISTS get_employee_restaurant_id(UUID);
DROP FUNCTION IF EXISTS user_owns_restaurant(UUID, TEXT);
DROP FUNCTION IF EXISTS check_shift_conflicts(UUID, DATE, TIME, TIME, UUID);
DROP FUNCTION IF EXISTS get_employee_weekly_schedule(UUID, DATE);
DROP FUNCTION IF EXISTS add_default_holidays();
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables (in reverse order of dependencies)
DROP TABLE IF EXISTS blocked_dates CASCADE;
DROP TABLE IF EXISTS shifts CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS restaurants CASCADE;

-- Success message
SELECT 'All tables, policies, functions, and views have been dropped successfully!' AS status;
