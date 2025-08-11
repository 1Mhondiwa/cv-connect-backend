-- Migration: Add freelancer approval and management system for ECS Admin
-- This migration adds fields to control freelancer visibility and ECS Admin management

-- Add approval and management fields to Freelancer table
ALTER TABLE "Freelancer" 
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS approval_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES "User"(user_id),
ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS availability_notes TEXT,
ADD COLUMN IF NOT EXISTS admin_rating INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS last_admin_review TIMESTAMP;

-- Add comment to document the changes
COMMENT ON COLUMN "Freelancer".is_approved IS 'Whether freelancer has been approved by ECS Admin';
COMMENT ON COLUMN "Freelancer".approval_date IS 'Date when freelancer was approved';
COMMENT ON COLUMN "Freelancer".approved_by IS 'ECS Admin user who approved the freelancer';
COMMENT ON COLUMN "Freelancer".is_available IS 'Whether freelancer is currently available for new projects';
COMMENT ON COLUMN "Freelancer".availability_notes IS 'Admin notes about freelancer availability';
COMMENT ON COLUMN "Freelancer".admin_rating IS 'ECS Admin rating (1-5) for freelancer quality';
COMMENT ON COLUMN "Freelancer".admin_notes IS 'ECS Admin internal notes about freelancer';
COMMENT ON COLUMN "Freelancer".last_admin_review IS 'Last time ECS Admin reviewed this freelancer';

-- Update existing freelancers to be approved (for backward compatibility)
UPDATE "Freelancer" 
SET is_approved = TRUE, 
    approval_date = CURRENT_TIMESTAMP,
    admin_rating = 3
WHERE is_approved IS NULL;

-- Create index for efficient querying of approved freelancers
CREATE INDEX IF NOT EXISTS idx_freelancer_approved_available 
ON "Freelancer"(is_approved, is_available, admin_rating DESC);

-- Create index for admin review queries
CREATE INDEX IF NOT EXISTS idx_freelancer_admin_review 
ON "Freelancer"(last_admin_review, is_approved);
