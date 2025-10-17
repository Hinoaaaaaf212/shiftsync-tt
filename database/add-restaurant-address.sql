-- ShiftSync TT Database Migration
-- Add address field to restaurants table
-- Execute this in your Supabase SQL Editor

-- Add address column to restaurants table
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS address TEXT;

-- Add comment for documentation
COMMENT ON COLUMN restaurants.address IS 'Full business address for official documents (e.g., pay slips, invoices)';

-- Example query to verify the column was added
-- SELECT id, name, address, created_at FROM restaurants LIMIT 5;
