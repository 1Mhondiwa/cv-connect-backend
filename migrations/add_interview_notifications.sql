-- Migration: Add Interview Notification System
-- This migration creates a notification system for interview scheduling and reminders

-- Create Notification table for storing interview notifications
CREATE TABLE IF NOT EXISTS "Notification" (
    notification_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES "User"(user_id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL, -- 'interview_scheduled', 'interview_reminder', 'interview_cancelled', etc.
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB, -- Additional data like interview_id, scheduled_date, etc.
    is_read BOOLEAN DEFAULT FALSE,
    is_sent BOOLEAN DEFAULT FALSE, -- Track if notification was sent via WebSocket
    scheduled_for TIMESTAMP, -- For scheduled reminders
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_notification_user_id ON "Notification"(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_type ON "Notification"(notification_type, is_sent);
CREATE INDEX IF NOT EXISTS idx_notification_scheduled ON "Notification"(scheduled_for, is_sent) WHERE scheduled_for IS NOT NULL;

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_notification_updated_at 
    BEFORE UPDATE ON "Notification" 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments to document the system
COMMENT ON TABLE "Notification" IS 'Stores notifications for users including interview scheduling and reminders';
COMMENT ON COLUMN "Notification".notification_type IS 'Type of notification: interview_scheduled, interview_reminder, interview_cancelled, etc.';
COMMENT ON COLUMN "Notification".data IS 'Additional JSON data like interview_id, scheduled_date, reminder_type, etc.';
COMMENT ON COLUMN "Notification".scheduled_for IS 'When to send the notification (for scheduled reminders)';
