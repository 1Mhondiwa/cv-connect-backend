-- Migration: Add Temporary Password Tracking for Associates
-- This migration adds a field to track if associates have changed their temporary password

-- Add has_changed_temp_password column to User table
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS has_changed_temp_password BOOLEAN DEFAULT false;

-- Update existing associates to have changed their temp password (for backward compatibility)
UPDATE "User" 
SET has_changed_temp_password = true 
WHERE user_type = 'associate' AND has_changed_temp_password IS NULL;

-- Add comment to document the changes
COMMENT ON COLUMN "User".has_changed_temp_password IS 'Tracks if associate has changed their temporary password from admin approval';


