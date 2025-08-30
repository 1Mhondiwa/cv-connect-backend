-- Migration: Fix all tables missing updated_at columns
-- This migration adds missing updated_at columns to all tables that have triggers
-- using the update_updated_at_column function

-- 1. Fix Associate table
ALTER TABLE "Associate" 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Update existing records
UPDATE "Associate" 
SET updated_at = CURRENT_TIMESTAMP 
WHERE updated_at IS NULL;

-- 2. Fix Freelancer table
ALTER TABLE "Freelancer" 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Update existing records
UPDATE "Freelancer" 
SET updated_at = CURRENT_TIMESTAMP 
WHERE updated_at IS NULL;

-- 3. Fix Associate_Request table (add updated_at column)
ALTER TABLE "Associate_Request" 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Update existing records
UPDATE "Associate_Request" 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- 4. Fix Freelancer_Recommendation table (add updated_at column)
ALTER TABLE "Freelancer_Recommendation" 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Update existing records
UPDATE "Freelancer_Recommendation" 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- 5. Fix Questionaire table (add updated_at column)
ALTER TABLE "Questionaire" 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Update existing records
UPDATE "Questionaire" 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- 6. Clean up duplicate triggers on ECS_Employee table
-- Remove the old trigger that uses the old function
DROP TRIGGER IF EXISTS update_ecs_employee_updated_at ON "ECS_Employee";

-- 7. Ensure all tables with updated_at columns have proper triggers
-- Associate table trigger
DROP TRIGGER IF EXISTS update_associate_updated_at ON "Associate";
CREATE TRIGGER update_associate_updated_at
    BEFORE UPDATE ON "Associate"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Freelancer table trigger
DROP TRIGGER IF EXISTS update_freelancer_updated_at ON "Freelancer";
CREATE TRIGGER update_freelancer_updated_at
    BEFORE UPDATE ON "Freelancer"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Associate_Request table trigger
DROP TRIGGER IF EXISTS update_associate_request_updated_at ON "Associate_Request";
CREATE TRIGGER update_associate_request_updated_at
    BEFORE UPDATE ON "Associate_Request"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Freelancer_Recommendation table trigger
DROP TRIGGER IF EXISTS update_freelancer_recommendation_updated_at ON "Freelancer_Recommendation";
CREATE TRIGGER update_freelancer_recommendation_updated_at
    BEFORE UPDATE ON "Freelancer_Recommendation"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Questionaire table trigger
DROP TRIGGER IF EXISTS update_questionaire_updated_at ON "Questionaire";
CREATE TRIGGER update_questionaire_updated_at
    BEFORE UPDATE ON "Questionaire"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments to document the changes
COMMENT ON COLUMN "Associate".updated_at IS 'Timestamp of last record update';
COMMENT ON COLUMN "Freelancer".updated_at IS 'Timestamp of last record update';
COMMENT ON COLUMN "Associate_Request".updated_at IS 'Timestamp of last record update';
COMMENT ON COLUMN "Freelancer_Recommendation".updated_at IS 'Timestamp of last record update';
COMMENT ON COLUMN "Questionaire".updated_at IS 'Timestamp of last record update';
