-- Migration: Add signed contract support to Freelancer_Hire table
-- This migration adds the ability to store signed contract PDF files uploaded by freelancers

-- Add signed_contract_pdf_path column to Freelancer_Hire table
ALTER TABLE "Freelancer_Hire" 
ADD COLUMN IF NOT EXISTS signed_contract_pdf_path VARCHAR(500);

-- Add signed_contract_uploaded_at timestamp
ALTER TABLE "Freelancer_Hire" 
ADD COLUMN IF NOT EXISTS signed_contract_uploaded_at TIMESTAMP;

-- Add comment to document the columns
COMMENT ON COLUMN "Freelancer_Hire".signed_contract_pdf_path IS 'Path to the signed contract PDF file uploaded by freelancer';
COMMENT ON COLUMN "Freelancer_Hire".signed_contract_uploaded_at IS 'Timestamp when freelancer uploaded the signed contract';

-- Create index for efficient querying by signed contract PDF
CREATE INDEX IF NOT EXISTS idx_freelancer_hire_signed_contract_pdf 
ON "Freelancer_Hire"(signed_contract_pdf_path) 
WHERE signed_contract_pdf_path IS NOT NULL;
