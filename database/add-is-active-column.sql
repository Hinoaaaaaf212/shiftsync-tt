-- Add is_active column to employees table if it doesn't exist
-- This is an optional migration if your employees table was created without the is_active column
-- Run this in your Supabase SQL Editor

-- Check if column exists and add it if not
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'employees'
        AND column_name = 'is_active'
    ) THEN
        -- Add the column with a default value of TRUE
        ALTER TABLE employees
        ADD COLUMN is_active BOOLEAN DEFAULT TRUE NOT NULL;

        RAISE NOTICE 'Column is_active added to employees table';
    ELSE
        RAISE NOTICE 'Column is_active already exists in employees table';
    END IF;
END $$;

-- Create index for performance (if column was just added)
CREATE INDEX IF NOT EXISTS idx_employees_is_active ON employees(is_active);

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'employees'
AND column_name = 'is_active';
