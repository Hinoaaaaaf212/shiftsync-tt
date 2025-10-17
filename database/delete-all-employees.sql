-- ============================================================================
-- DELETE ALL EMPLOYEES
-- WARNING: This will permanently delete all employee records
-- NOTE: Auth users will remain - you need to delete them manually in Supabase Dashboard
-- ============================================================================

-- Delete all shifts first (foreign key dependency)
DELETE FROM shifts;

-- Delete all employee records
DELETE FROM employees;

-- Success message
SELECT 'All employees and their shifts have been deleted!' AS status;
SELECT COUNT(*) AS remaining_employees FROM employees;
SELECT COUNT(*) AS remaining_shifts FROM shifts;
