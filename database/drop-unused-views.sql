-- ShiftSync TT Database Migration
-- Drop unused views that bypass RLS and create security warnings
-- Execute this in your Supabase SQL Editor

-- These views were created in the initial schema but are never used in the application.
-- They bypass Row Level Security (RLS) policies, creating a potential security vulnerability
-- where anyone querying these views directly could see data from ALL restaurants.

-- Drop employee schedule view (bypasses RLS, shows all restaurants' data)
DROP VIEW IF EXISTS employee_schedule_view;

-- Drop restaurant dashboard view (bypasses RLS, shows all restaurants' data)
DROP VIEW IF EXISTS restaurant_dashboard_view;

-- Verification: Check that views are dropped
-- SELECT table_name FROM information_schema.views WHERE table_schema = 'public';

-- Note: All application queries use direct table access with proper RLS enforcement:
-- - supabase.from('employees').select() - Protected by RLS
-- - supabase.from('shifts').select() - Protected by RLS
-- - supabase.from('restaurants').select() - Protected by RLS
