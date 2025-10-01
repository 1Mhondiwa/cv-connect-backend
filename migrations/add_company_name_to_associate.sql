-- Migration: Add company_name column to Associate table
-- This migration adds company_name to preserve company information from Associate_Request

-- Add company_name column to Associate table
ALTER TABLE "Associate" 
ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_associate_company_name ON "Associate"(company_name);

-- Add comment to document the change
COMMENT ON COLUMN "Associate".company_name IS 'Company name from the original Associate_Request';
