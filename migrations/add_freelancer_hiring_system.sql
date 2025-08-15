-- Migration: Add Freelancer Hiring System
-- This migration creates a dedicated system for tracking hired freelancers by associates

-- Create Freelancer_Hire table for tracking formal hiring relationships
CREATE TABLE IF NOT EXISTS "Freelancer_Hire" (
  hire_id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES "Associate_Freelancer_Request"(request_id),
  associate_id INTEGER NOT NULL REFERENCES "Associate"(associate_id),
  freelancer_id INTEGER NOT NULL REFERENCES "Freelancer"(freelancer_id),
  hire_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  project_title VARCHAR(255) NOT NULL,
  project_description TEXT,
  agreed_terms TEXT,
  agreed_rate DECIMAL(10,2),
  rate_type VARCHAR(20) DEFAULT 'hourly', -- hourly, fixed, monthly
  start_date DATE,
  expected_end_date DATE,
  actual_end_date DATE,
  status VARCHAR(20) DEFAULT 'active', -- active, completed, cancelled, on_hold
  associate_notes TEXT,
  freelancer_notes TEXT,
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_freelancer_hire_associate 
ON "Freelancer_Hire"(associate_id, hire_date DESC);

CREATE INDEX IF NOT EXISTS idx_freelancer_hire_freelancer 
ON "Freelancer_Hire"(freelancer_id, hire_date DESC);

CREATE INDEX IF NOT EXISTS idx_freelancer_hire_request 
ON "Freelancer_Hire"(request_id);

CREATE INDEX IF NOT EXISTS idx_freelancer_hire_status 
ON "Freelancer_Hire"(status, hire_date DESC);

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_freelancer_hire_updated_at 
    BEFORE UPDATE ON "Freelancer_Hire" 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments to document the system
COMMENT ON TABLE "Freelancer_Hire" IS 'Tracks formal hiring relationships between associates and freelancers';
COMMENT ON COLUMN "Freelancer_Hire".agreed_terms IS 'Terms agreed upon between associate and freelancer';
COMMENT ON COLUMN "Freelancer_Hire".agreed_rate IS 'Agreed payment rate for the project';
COMMENT ON COLUMN "Freelancer_Hire".rate_type IS 'Type of rate: hourly, fixed, or monthly';
COMMENT ON COLUMN "Freelancer_Hire".status IS 'Current status of the hiring relationship';
