-- Migration: Fix User table missing updated_at column
-- This migration adds the missing updated_at column to the User table
-- and creates a proper trigger to maintain it

-- Add updated_at column to User table if it doesn't exist
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Update existing records to have updated_at set to created_at
UPDATE "User" 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Create or replace the update_updated_at_column function specifically for User table
CREATE OR REPLACE FUNCTION update_user_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for User table
DROP TRIGGER IF EXISTS trigger_update_user_updated_at ON "User";
CREATE TRIGGER trigger_update_user_updated_at
    BEFORE UPDATE ON "User"
    FOR EACH ROW
    EXECUTE FUNCTION update_user_updated_at();

-- Add comment to document the changes
COMMENT ON COLUMN "User".updated_at IS 'Timestamp of last record update';
COMMENT ON FUNCTION update_user_updated_at() IS 'Trigger function to update updated_at timestamp on User table';

