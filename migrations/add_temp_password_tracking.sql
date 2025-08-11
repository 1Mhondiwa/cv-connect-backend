-- Migration: Add Temporary Password Tracking for Associates
-- This migration adds a field to track if associates have changed their temporary password

-- Add has_changed_temp_password column to User table for associates
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS has_changed_temp_password BOOLEAN DEFAULT FALSE;

-- Update existing associate users to have this field set to true (they've already changed passwords)
UPDATE "User" 
SET has_changed_temp_password = TRUE 
WHERE user_type = 'associate' AND has_changed_temp_password IS NULL;

-- Add comment to document the changes
COMMENT ON COLUMN "User".has_changed_temp_password IS 'Tracks if associate has changed their temporary password after first login';


