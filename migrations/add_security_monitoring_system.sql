-- Migration: Add Security Monitoring System
-- This migration adds comprehensive security monitoring capabilities for ECS Admin

-- 1. Add security-related fields to User table
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS block_reason TEXT,
ADD COLUMN IF NOT EXISTS blocked_by INTEGER REFERENCES "User"(user_id),
ADD COLUMN IF NOT EXISTS security_risk_level VARCHAR(20) DEFAULT 'low' CHECK (security_risk_level IN ('low', 'medium', 'high', 'critical')),
ADD COLUMN IF NOT EXISTS last_security_review TIMESTAMP;

-- 2. Create Security_Flag table for flagged messages
CREATE TABLE IF NOT EXISTS "Security_Flag" (
  flag_id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES "Message"(message_id),
  flagged_by INTEGER NOT NULL REFERENCES "User"(user_id),
  flag_reason VARCHAR(255) NOT NULL,
  risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  admin_notes TEXT,
  flagged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP,
  reviewed_by INTEGER REFERENCES "User"(user_id),
  review_notes TEXT,
  action_taken VARCHAR(100) -- 'none', 'warned', 'blocked', 'deleted', 'approved'
);

-- 3. Create User_Block table for blocked users
CREATE TABLE IF NOT EXISTS "User_Block" (
  block_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES "User"(user_id),
  blocked_by INTEGER NOT NULL REFERENCES "User"(user_id),
  block_reason VARCHAR(255) NOT NULL,
  admin_notes TEXT,
  block_duration VARCHAR(50), -- 'temporary', 'permanent', '24h', '7d', '30d'
  blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  unblocked_at TIMESTAMP,
  unblocked_by INTEGER REFERENCES "User"(user_id),
  unblock_reason TEXT
);

-- 4. Create Security_Alert table for automated alerts
CREATE TABLE IF NOT EXISTS "Security_Alert" (
  alert_id SERIAL PRIMARY KEY,
  alert_type VARCHAR(100) NOT NULL, -- 'suspicious_message', 'high_risk_user', 'unusual_activity'
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  related_user_id INTEGER REFERENCES "User"(user_id),
  related_message_id INTEGER REFERENCES "Message"(message_id),
  alert_data JSONB, -- Store additional context data
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at TIMESTAMP,
  acknowledged_by INTEGER REFERENCES "User"(user_id),
  resolved_at TIMESTAMP,
  resolved_by INTEGER REFERENCES "User"(user_id),
  resolution_notes TEXT
);

-- 5. Create Security_Log table for detailed security events
CREATE TABLE IF NOT EXISTS "Security_Log" (
  log_id SERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  event_description TEXT NOT NULL,
  user_id INTEGER REFERENCES "User"(user_id),
  ip_address INET,
  user_agent TEXT,
  session_id VARCHAR(255),
  risk_score INTEGER DEFAULT 0,
  event_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_security_flag_message ON "Security_Flag"(message_id);
CREATE INDEX IF NOT EXISTS idx_security_flag_flagged_by ON "Security_Flag"(flagged_by);
CREATE INDEX IF NOT EXISTS idx_security_flag_risk_level ON "Security_Flag"(risk_level);
CREATE INDEX IF NOT EXISTS idx_security_flag_flagged_at ON "Security_Flag"(flagged_at);

CREATE INDEX IF NOT EXISTS idx_user_block_user ON "User_Block"(user_id);
CREATE INDEX IF NOT EXISTS idx_user_block_blocked_by ON "User_Block"(blocked_by);
CREATE INDEX IF NOT EXISTS idx_user_block_blocked_at ON "User_Block"(blocked_at);

CREATE INDEX IF NOT EXISTS idx_security_alert_type ON "Security_Alert"(alert_type);
CREATE INDEX IF NOT EXISTS idx_security_alert_severity ON "Security_Alert"(severity);
CREATE INDEX IF NOT EXISTS idx_security_alert_created_at ON "Security_Alert"(created_at);

CREATE INDEX IF NOT EXISTS idx_security_log_event_type ON "Security_Log"(event_type);
CREATE INDEX IF NOT EXISTS idx_security_log_user_id ON "Security_Log"(user_id);
CREATE INDEX IF NOT EXISTS idx_security_log_created_at ON "Security_Log"(created_at);

-- 7. Add comments to document the system
COMMENT ON TABLE "Security_Flag" IS 'Flags suspicious messages for admin review';
COMMENT ON TABLE "User_Block" IS 'Tracks user blocking actions for security reasons';
COMMENT ON TABLE "Security_Alert" IS 'Automated security alerts and notifications';
COMMENT ON TABLE "Security_Log" IS 'Detailed log of all security-related events';

COMMENT ON COLUMN "User".blocked_at IS 'When user was blocked for security reasons';
COMMENT ON COLUMN "User".block_reason IS 'Reason for blocking the user';
COMMENT ON COLUMN "User".security_risk_level IS 'Current security risk assessment level';
COMMENT ON COLUMN "User".last_security_review IS 'Last time user was reviewed for security';

-- 8. Add triggers for automatic security monitoring
CREATE OR REPLACE FUNCTION log_security_event()
RETURNS TRIGGER AS $$
BEGIN
  -- Log security events automatically
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'Security_Flag' THEN
    INSERT INTO "Security_Log" (event_type, event_description, user_id, event_data)
    VALUES (
      'message_flagged',
      'Message flagged for security review',
      NEW.flagged_by,
      jsonb_build_object(
        'flag_id', NEW.flag_id,
        'message_id', NEW.message_id,
        'risk_level', NEW.risk_level,
        'flag_reason', NEW.flag_reason
      )
    );
  END IF;
  
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'User_Block' THEN
    INSERT INTO "Security_Log" (event_type, event_description, user_id, event_data)
    VALUES (
      'user_blocked',
      'User blocked for security reasons',
      NEW.blocked_by,
      jsonb_build_object(
        'block_id', NEW.block_id,
        'blocked_user_id', NEW.user_id,
        'block_reason', NEW.block_reason,
        'block_duration', NEW.block_duration
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER security_flag_log_trigger
  AFTER INSERT ON "Security_Flag"
  FOR EACH ROW EXECUTE FUNCTION log_security_event();

CREATE TRIGGER user_block_log_trigger
  AFTER INSERT ON "User_Block"
  FOR EACH ROW EXECUTE FUNCTION log_security_event();

-- 9. Insert sample security alert types
INSERT INTO "Security_Alert" (alert_type, severity, title, description) VALUES
('suspicious_message', 'medium', 'Suspicious Message Detected', 'Message contains suspicious keywords or patterns'),
('high_risk_user', 'high', 'High Risk User Activity', 'User exhibiting suspicious behavior patterns'),
('unusual_activity', 'medium', 'Unusual Activity Detected', 'Unusual login patterns or message volume detected'),
('potential_spam', 'low', 'Potential Spam Message', 'Message may be spam based on content analysis')
ON CONFLICT DO NOTHING;

-- 10. Update existing users to have default security settings
UPDATE "User" 
SET security_risk_level = 'low',
    last_security_review = CURRENT_TIMESTAMP
WHERE security_risk_level IS NULL;

-- Add comment to document the migration
COMMENT ON SCHEMA public IS 'Security monitoring system added for comprehensive ECS Admin oversight';
