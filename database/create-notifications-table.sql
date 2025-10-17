-- ShiftSync TT Database Migration: Create Notifications System
-- Execute this in your Supabase SQL Editor
--
-- This migration creates the notifications system for in-app notifications
-- to alert employees about shift assignments, changes, and updates.

-- ============================================================================
-- STEP 1: CREATE NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('shift_created', 'shift_updated', 'shift_deleted', 'welcome', 'reminder')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for fetching user's notifications quickly
CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- Index for restaurant-based queries
CREATE INDEX idx_notifications_restaurant_id ON notifications(restaurant_id);

-- Index for filtering unread notifications
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- Composite index for user's unread notifications (most common query)
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);

-- ============================================================================
-- STEP 3: ENABLE RLS AND CREATE POLICIES
-- ============================================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- SELECT POLICY: Users can view their own notifications
CREATE POLICY "notifications_select_policy" ON notifications
    FOR SELECT
    USING (user_id = (select auth.uid()));

-- UPDATE POLICY: Users can update (mark as read) their own notifications
CREATE POLICY "notifications_update_policy" ON notifications
    FOR UPDATE
    USING (user_id = (select auth.uid()));

-- DELETE POLICY: Users can delete their own notifications
CREATE POLICY "notifications_delete_policy" ON notifications
    FOR DELETE
    USING (user_id = (select auth.uid()));

-- INSERT POLICY: Allow service role to create notifications (for system-generated notifications)
-- Note: In production, you might want to create a specific function with SECURITY DEFINER
-- For now, we'll handle inserts from the application layer with service role or through triggers

-- ============================================================================
-- STEP 4: CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to create a notification for an employee when a shift is assigned
CREATE OR REPLACE FUNCTION create_shift_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    employee_user_id UUID;
    employee_name TEXT;
    shift_date_formatted TEXT;
BEGIN
    -- Get the employee's user_id and name
    SELECT user_id, first_name || ' ' || last_name
    INTO employee_user_id, employee_name
    FROM employees
    WHERE id = NEW.employee_id;

    -- Only create notification if employee has a user account
    IF employee_user_id IS NOT NULL THEN
        -- Format the shift date
        shift_date_formatted := TO_CHAR(NEW.shift_date, 'DD/MM/YYYY');

        -- Create notification for shift creation
        IF (TG_OP = 'INSERT') THEN
            INSERT INTO notifications (
                user_id,
                restaurant_id,
                type,
                title,
                message,
                link
            ) VALUES (
                employee_user_id,
                NEW.restaurant_id,
                'shift_created',
                'New Shift Assigned',
                'You have been assigned a shift on ' || shift_date_formatted || ' from ' ||
                TO_CHAR(NEW.start_time, 'HH12:MI AM') || ' to ' || TO_CHAR(NEW.end_time, 'HH12:MI AM'),
                '/dashboard/my-shifts'
            );
        END IF;

        -- Create notification for shift update
        IF (TG_OP = 'UPDATE') THEN
            -- Only notify if date or time changed
            IF (OLD.shift_date != NEW.shift_date OR
                OLD.start_time != NEW.start_time OR
                OLD.end_time != NEW.end_time) THEN

                INSERT INTO notifications (
                    user_id,
                    restaurant_id,
                    type,
                    title,
                    message,
                    link
                ) VALUES (
                    employee_user_id,
                    NEW.restaurant_id,
                    'shift_updated',
                    'Shift Updated',
                    'Your shift on ' || shift_date_formatted || ' has been updated to ' ||
                    TO_CHAR(NEW.start_time, 'HH12:MI AM') || ' - ' || TO_CHAR(NEW.end_time, 'HH12:MI AM'),
                    '/dashboard/my-shifts'
                );
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Function to create notification when shift is deleted
CREATE OR REPLACE FUNCTION create_shift_deleted_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    employee_user_id UUID;
    shift_date_formatted TEXT;
BEGIN
    -- Get the employee's user_id
    SELECT user_id
    INTO employee_user_id
    FROM employees
    WHERE id = OLD.employee_id;

    -- Only create notification if employee has a user account
    IF employee_user_id IS NOT NULL THEN
        -- Format the shift date
        shift_date_formatted := TO_CHAR(OLD.shift_date, 'DD/MM/YYYY');

        INSERT INTO notifications (
            user_id,
            restaurant_id,
            type,
            title,
            message,
            link
        ) VALUES (
            employee_user_id,
            OLD.restaurant_id,
            'shift_deleted',
            'Shift Cancelled',
            'Your shift on ' || shift_date_formatted || ' at ' ||
            TO_CHAR(OLD.start_time, 'HH12:MI AM') || ' has been cancelled',
            '/dashboard/my-shifts'
        );
    END IF;

    RETURN OLD;
END;
$$;

-- ============================================================================
-- STEP 5: CREATE TRIGGERS
-- ============================================================================

-- Trigger for shift creation and updates
CREATE TRIGGER notify_shift_created_or_updated
    AFTER INSERT OR UPDATE ON shifts
    FOR EACH ROW
    EXECUTE FUNCTION create_shift_notification();

-- Trigger for shift deletion
CREATE TRIGGER notify_shift_deleted
    BEFORE DELETE ON shifts
    FOR EACH ROW
    EXECUTE FUNCTION create_shift_deleted_notification();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verification: Check that table and triggers are created
-- SELECT * FROM pg_tables WHERE tablename = 'notifications';
-- SELECT * FROM pg_trigger WHERE tgname LIKE 'notify_%';

-- Expected result:
-- ✅ notifications table created with RLS enabled
-- ✅ Indexes created for optimal query performance
-- ✅ RLS policies protect user data
-- ✅ Triggers automatically create notifications for shift events
-- ✅ Functions use SECURITY DEFINER to bypass RLS when creating system notifications
