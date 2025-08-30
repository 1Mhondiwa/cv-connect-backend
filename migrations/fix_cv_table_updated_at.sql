-- Migration: Fix CV table missing updated_at column
-- This migration adds the missing updated_at column to the CV table
-- and fixes the generic update_updated_at_column function to be more robust

-- Add updated_at column to CV table if it doesn't exist
ALTER TABLE "CV" 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Update existing records to have updated_at set to upload_date (which exists in this table)
UPDATE "CV" 
SET updated_at = upload_date 
WHERE updated_at IS NULL;

-- Make the update_updated_at_column function more robust by checking if the column exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if the table has an updated_at column before trying to update it
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = TG_TABLE_NAME 
        AND column_name = 'updated_at'
    ) THEN
        NEW.updated_at = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for CV table if it doesn't exist
DROP TRIGGER IF EXISTS trigger_update_cv_updated_at ON "CV";
CREATE TRIGGER trigger_update_cv_updated_at
    BEFORE UPDATE ON "CV"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment to document the changes
COMMENT ON COLUMN "CV".updated_at IS 'Timestamp of last record update';
COMMENT ON FUNCTION update_updated_at_column() IS 'Robust trigger function to update updated_at timestamp on tables that have this column';
