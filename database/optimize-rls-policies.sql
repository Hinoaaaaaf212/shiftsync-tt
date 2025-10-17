-- ShiftSync TT Database Migration: Optimize RLS Policies
-- Execute this in your Supabase SQL Editor
--
-- This migration fixes 36 Supabase performance warnings by:
-- 1. Wrapping auth.email() and auth.uid() in subqueries to prevent re-evaluation per row
-- 2. Combining duplicate policies to eliminate redundant permission checks
--
-- Performance improvements:
-- - Auth functions evaluated once per query instead of per row
-- - Fewer policy evaluations through consolidated logic
-- - Better query plan optimization

-- ============================================================================
-- STEP 1: DROP ALL EXISTING RLS POLICIES
-- ============================================================================

-- Drop restaurants policies
DROP POLICY IF EXISTS "Users can view their restaurants" ON restaurants;
DROP POLICY IF EXISTS "Employees can view their restaurant" ON restaurants;
DROP POLICY IF EXISTS "Restaurant owners can update" ON restaurants;
DROP POLICY IF EXISTS "Users can create restaurants" ON restaurants;
DROP POLICY IF EXISTS "Restaurant owners can delete" ON restaurants;

-- Drop employees policies
DROP POLICY IF EXISTS "Employees can view own record" ON employees;
DROP POLICY IF EXISTS "Restaurant owners can view employees" ON employees;
DROP POLICY IF EXISTS "Restaurant owners can insert employees" ON employees;
DROP POLICY IF EXISTS "Restaurant owners can update employees" ON employees;
DROP POLICY IF EXISTS "Restaurant owners can delete employees" ON employees;
DROP POLICY IF EXISTS "Employees can update own profile" ON employees;

-- Drop shifts policies
DROP POLICY IF EXISTS "Employees can view own shifts" ON shifts;
DROP POLICY IF EXISTS "Restaurant owners can view shifts" ON shifts;
DROP POLICY IF EXISTS "Restaurant owners can insert shifts" ON shifts;
DROP POLICY IF EXISTS "Restaurant owners can update shifts" ON shifts;
DROP POLICY IF EXISTS "Restaurant owners can delete shifts" ON shifts;

-- Drop blocked_dates policies
DROP POLICY IF EXISTS "Restaurant owners can view blocked dates" ON blocked_dates;
DROP POLICY IF EXISTS "Restaurant owners can insert blocked dates" ON blocked_dates;
DROP POLICY IF EXISTS "Restaurant owners can update blocked dates" ON blocked_dates;
DROP POLICY IF EXISTS "Restaurant owners can delete blocked dates" ON blocked_dates;

-- ============================================================================
-- STEP 2: CREATE OPTIMIZED RLS POLICIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- RESTAURANTS POLICIES (5 policies → 4 policies)
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- EMPLOYEES POLICIES (6 policies → 4 policies)
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- SHIFTS POLICIES (5 policies → 4 policies)
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- BLOCKED_DATES POLICIES (4 policies remain 4 policies)
-- ----------------------------------------------------------------------------

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
-- MIGRATION COMPLETE
-- ============================================================================

-- Verification: List all policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, cmd;

-- Expected result:
-- ✅ All 36 performance warnings should be resolved
-- ✅ Auth functions wrapped in subqueries (evaluated once per query)
-- ✅ Duplicate policies combined (fewer permission checks)
-- ✅ 20 policies total (down from 24):
--    - restaurants: 4 policies
--    - employees: 4 policies
--    - shifts: 4 policies
--    - blocked_dates: 4 policies
