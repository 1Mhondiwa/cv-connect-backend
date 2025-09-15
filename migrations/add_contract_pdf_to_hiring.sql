-- Migration: Add contract PDF support to Freelancer_Hire table
-- This migration adds the ability to store contract PDF files for hiring records

-- Add contract_pdf column to Freelancer_Hire table
ALTER TABLE "Freelancer_Hire" 
ADD COLUMN IF NOT EXISTS contract_pdf_path VARCHAR(500);

-- Add comment to document the column
COMMENT ON COLUMN "Freelancer_Hire".contract_pdf_path IS 'Path to the uploaded contract PDF file';

-- Create index for efficient querying by contract PDF
CREATE INDEX IF NOT EXISTS idx_freelancer_hire_contract_pdf 
ON "Freelancer_Hire"(contract_pdf_path) 
WHERE contract_pdf_path IS NOT NULL;


