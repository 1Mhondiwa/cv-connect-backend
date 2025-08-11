-- Migration: Add Associate Request System for Freelancer Services
-- This migration creates the system where associates request freelancers through ECS Admin

-- Create Associate_Request table for freelancer service requests
CREATE TABLE IF NOT EXISTS "Associate_Freelancer_Request" (
  request_id SERIAL PRIMARY KEY,
  associate_id INTEGER NOT NULL REFERENCES "Associate"(associate_id),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  required_skills TEXT[] NOT NULL,
  min_experience INTEGER DEFAULT 0,
  preferred_location VARCHAR(255),
  budget_range VARCHAR(100),
  urgency_level VARCHAR(50) DEFAULT 'normal', -- low, normal, high, urgent
  status VARCHAR(50) DEFAULT 'pending', -- pending, reviewed, provided, completed, cancelled
  admin_notes TEXT,
  admin_rating INTEGER DEFAULT 0, -- 1-5 rating by ECS Admin
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP,
  reviewed_by INTEGER REFERENCES "User"(user_id),
  completed_at TIMESTAMP
);

-- Create Freelancer_Recommendation table to track which freelancers were recommended
CREATE TABLE IF NOT EXISTS "Freelancer_Recommendation" (
  recommendation_id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES "Associate_Freelancer_Request"(request_id),
  freelancer_id INTEGER NOT NULL REFERENCES "Freelancer"(freelancer_id),
  admin_notes TEXT,
  admin_rating INTEGER DEFAULT 0, -- ECS Admin rating for this specific match
  is_highlighted BOOLEAN DEFAULT FALSE, -- Top recommendations
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Request_Response table to track associate responses to recommendations
CREATE TABLE IF NOT EXISTS "Request_Response" (
  response_id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES "Associate_Freelancer_Request"(request_id),
  freelancer_id INTEGER NOT NULL REFERENCES "Freelancer"(freelancer_id),
  associate_response VARCHAR(50) DEFAULT 'pending', -- pending, interested, not_interested, hired
  associate_notes TEXT,
  response_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_associate_freelancer_request_status 
ON "Associate_Freelancer_Request"(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_associate_freelancer_request_associate 
ON "Associate_Freelancer_Request"(associate_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_freelancer_recommendation_request 
ON "Freelancer_Recommendation"(request_id);

CREATE INDEX IF NOT EXISTS idx_freelancer_recommendation_freelancer 
ON "Freelancer_Recommendation"(freelancer_id);

CREATE INDEX IF NOT EXISTS idx_request_response_request 
ON "Request_Response"(request_id);

-- Add comments to document the system
COMMENT ON TABLE "Associate_Freelancer_Request" IS 'Associate requests for freelancer services through ECS Admin';
COMMENT ON TABLE "Freelancer_Recommendation" IS 'ECS Admin recommendations for specific requests';
COMMENT ON TABLE "Request_Response" IS 'Associate responses to freelancer recommendations';

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_associate_freelancer_request_updated_at 
    BEFORE UPDATE ON "Associate_Freelancer_Request" 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
