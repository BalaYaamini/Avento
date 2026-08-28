-- Supabase Patch v41: Food Coupon Integration for Periodic Attendance
-- Adds food coupon configuration columns to event_attendance_periods table

ALTER TABLE public.event_attendance_periods 
  ADD COLUMN IF NOT EXISTS includes_food_coupon BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS food_coupon_name VARCHAR(100) DEFAULT 'Food / Meal Coupon';
