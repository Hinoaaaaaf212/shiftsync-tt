-- Create Business Hours for Existing Restaurants
-- Run this if you already had a restaurant before running the AI scheduler migration
-- This will add default business hours to any restaurant that doesn't have them yet

-- Insert default business hours for ALL restaurants that don't have any
INSERT INTO business_hours (restaurant_id, day_of_week, open_time, close_time, is_closed)
SELECT
  r.id as restaurant_id,
  d.day_of_week,
  CASE
    WHEN d.day_of_week IN (5, 6) THEN '10:00'::time  -- Saturday & Sunday: 10am
    ELSE '09:00'::time  -- Monday-Friday: 9am
  END as open_time,
  CASE
    WHEN d.day_of_week IN (5, 6) THEN '23:00'::time  -- Saturday & Sunday: 11pm
    ELSE '22:00'::time  -- Monday-Friday: 10pm
  END as close_time,
  FALSE as is_closed
FROM restaurants r
CROSS JOIN (VALUES (0), (1), (2), (3), (4), (5), (6)) AS d(day_of_week)
WHERE NOT EXISTS (
  SELECT 1 FROM business_hours bh
  WHERE bh.restaurant_id = r.id
  AND bh.day_of_week = d.day_of_week
);

-- Verify the data was inserted
SELECT
  r.name as restaurant_name,
  bh.day_of_week,
  CASE bh.day_of_week
    WHEN 0 THEN 'Monday'
    WHEN 1 THEN 'Tuesday'
    WHEN 2 THEN 'Wednesday'
    WHEN 3 THEN 'Thursday'
    WHEN 4 THEN 'Friday'
    WHEN 5 THEN 'Saturday'
    WHEN 6 THEN 'Sunday'
  END as day_name,
  bh.open_time,
  bh.close_time,
  bh.is_closed
FROM business_hours bh
JOIN restaurants r ON r.id = bh.restaurant_id
ORDER BY r.name, bh.day_of_week;
