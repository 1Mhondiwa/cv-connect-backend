-- Migration: Add Interview System for CV-Connect Platform
-- This migration creates the interview scheduling and feedback system

-- Create Interview table for scheduling and managing interviews
CREATE TABLE IF NOT EXISTS "Interview" (
  interview_id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES "Associate_Freelancer_Request"(request_id),
  associate_id INTEGER NOT NULL REFERENCES "Associate"(associate_id),
  freelancer_id INTEGER NOT NULL REFERENCES "Freelancer"(freelancer_id),
  interview_type VARCHAR(50) DEFAULT 'video' CHECK (interview_type IN ('video', 'phone', 'in_person')),
  scheduled_date TIMESTAMP NOT NULL,
  duration_minutes INTEGER DEFAULT 60 CHECK (duration_minutes > 0),
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled', 'in_progress')),
  meeting_link VARCHAR(500), -- For video interviews (WebRTC room ID)
  location VARCHAR(255), -- For in-person interviews
  interview_notes TEXT,
  associate_notes TEXT,
  freelancer_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Interview_Feedback table for structured feedback collection
CREATE TABLE IF NOT EXISTS "Interview_Feedback" (
  feedback_id SERIAL PRIMARY KEY,
  interview_id INTEGER NOT NULL REFERENCES "Interview"(interview_id) ON DELETE CASCADE,
  evaluator_id INTEGER NOT NULL REFERENCES "User"(user_id),
  evaluator_type VARCHAR(20) NOT NULL CHECK (evaluator_type IN ('associate', 'freelancer')),
  technical_skills_rating INTEGER CHECK (technical_skills_rating >= 1 AND technical_skills_rating <= 5),
  communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
  cultural_fit_rating INTEGER CHECK (cultural_fit_rating >= 1 AND cultural_fit_rating <= 5),
  overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
  strengths TEXT,
  areas_for_improvement TEXT,
  recommendation VARCHAR(20) DEFAULT 'pending' CHECK (recommendation IN ('hire', 'no_hire', 'maybe', 'pending')),
  detailed_feedback TEXT,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Interview_Invitation table for tracking interview invitations
CREATE TABLE IF NOT EXISTS "Interview_Invitation" (
  invitation_id SERIAL PRIMARY KEY,
  interview_id INTEGER NOT NULL REFERENCES "Interview"(interview_id) ON DELETE CASCADE,
  associate_id INTEGER NOT NULL REFERENCES "Associate"(associate_id),
  freelancer_id INTEGER NOT NULL REFERENCES "Freelancer"(freelancer_id),
  invitation_status VARCHAR(20) DEFAULT 'pending' CHECK (invitation_status IN ('pending', 'accepted', 'declined', 'expired')),
  invitation_message TEXT,
  response_notes TEXT,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP,
  expires_at TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_interview_request 
ON "Interview"(request_id, scheduled_date DESC);

CREATE INDEX IF NOT EXISTS idx_interview_associate 
ON "Interview"(associate_id, scheduled_date DESC);

CREATE INDEX IF NOT EXISTS idx_interview_freelancer 
ON "Interview"(freelancer_id, scheduled_date DESC);

CREATE INDEX IF NOT EXISTS idx_interview_status 
ON "Interview"(status, scheduled_date DESC);

CREATE INDEX IF NOT EXISTS idx_interview_feedback_interview 
ON "Interview_Feedback"(interview_id);

CREATE INDEX IF NOT EXISTS idx_interview_feedback_evaluator 
ON "Interview_Feedback"(evaluator_id, evaluator_type);

CREATE INDEX IF NOT EXISTS idx_interview_invitation_interview 
ON "Interview_Invitation"(interview_id);

CREATE INDEX IF NOT EXISTS idx_interview_invitation_freelancer 
ON "Interview_Invitation"(freelancer_id, invitation_status);

-- Add trigger to update updated_at timestamp for Interview table
CREATE TRIGGER update_interview_updated_at 
    BEFORE UPDATE ON "Interview" 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments to document the system
COMMENT ON TABLE "Interview" IS 'Tracks interview scheduling and management between associates and freelancers';
COMMENT ON TABLE "Interview_Feedback" IS 'Stores structured feedback from both associates and freelancers after interviews';
COMMENT ON TABLE "Interview_Invitation" IS 'Tracks interview invitations and freelancer responses';

COMMENT ON COLUMN "Interview".interview_type IS 'Type of interview: video (WebRTC), phone, or in_person';
COMMENT ON COLUMN "Interview".meeting_link IS 'WebRTC room ID or meeting link for video interviews';
COMMENT ON COLUMN "Interview".status IS 'Current status of the interview: scheduled, in_progress, completed, cancelled, rescheduled';
COMMENT ON COLUMN "Interview_Feedback".evaluator_type IS 'Who provided the feedback: associate or freelancer';
COMMENT ON COLUMN "Interview_Feedback".recommendation IS 'Hiring recommendation: hire, no_hire, maybe, or pending';
COMMENT ON COLUMN "Interview_Invitation".invitation_status IS 'Status of the interview invitation: pending, accepted, declined, expired';
