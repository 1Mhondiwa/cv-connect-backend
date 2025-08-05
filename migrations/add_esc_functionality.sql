-- Migration: Add ESC Admin Functionality
-- This migration adds associate request management and freelancer availability tracking

-- 1. Add availability_status column to Freelancer table
ALTER TABLE "Freelancer" 
ADD COLUMN IF NOT EXISTS availability_status VARCHAR(20) DEFAULT 'available' 
CHECK (availability_status IN ('available', 'unavailable', 'busy'));

-- 2. Create Associate_Request table for managing associate join requests
CREATE TABLE IF NOT EXISTS "Associate_Request" (
    request_id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    industry VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    address TEXT,
    website VARCHAR(255),
    company_name VARCHAR(255),
    request_reason TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    reviewed_by INTEGER REFERENCES "User"(user_id),
    review_notes TEXT
);

-- 3. Add index for better performance
CREATE INDEX IF NOT EXISTS idx_associate_request_status ON "Associate_Request"(status);
CREATE INDEX IF NOT EXISTS idx_freelancer_availability ON "Freelancer"(availability_status);

-- 4. Add comment to document the changes
COMMENT ON COLUMN "Freelancer".availability_status IS 'Tracks freelancer availability: available, unavailable, busy';
COMMENT ON TABLE "Associate_Request" IS 'Stores associate company requests for platform access'; 