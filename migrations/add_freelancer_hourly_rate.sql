-- Migration: Add hourly rate field to Freelancer table
-- This migration adds the hourly_rate column to store freelancer pricing information

-- Add hourly_rate column to Freelancer table
ALTER TABLE "Freelancer" 
ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2);

-- Add comment to document the column
COMMENT ON COLUMN "Freelancer".hourly_rate IS 'Freelancer hourly rate in South African Rand (ZAR)';

-- Create index for efficient querying by hourly rate
CREATE INDEX IF NOT EXISTS idx_freelancer_hourly_rate 
ON "Freelancer"(hourly_rate) 
WHERE hourly_rate IS NOT NULL;

-- Update existing freelancers to have NULL hourly_rate (they can set it later)
-- No default value needed as this is optional information
