-- Create visitor tracking table for analytics
CREATE TABLE IF NOT EXISTS "Visitor_Tracking" (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45), -- IPv4 (15 chars) or IPv6 (45 chars)
    user_agent TEXT,
    device_type VARCHAR(50) DEFAULT 'unknown', -- 'desktop', 'mobile', 'tablet'
    visit_date DATE NOT NULL,
    visit_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    page_visited VARCHAR(255),
    referrer VARCHAR(255),
    user_id INTEGER REFERENCES "User"(user_id) ON DELETE SET NULL, -- NULL for anonymous visitors
    country VARCHAR(100),
    city VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_visitor_tracking_date ON "Visitor_Tracking"(visit_date);
CREATE INDEX IF NOT EXISTS idx_visitor_tracking_device ON "Visitor_Tracking"(device_type);
CREATE INDEX IF NOT EXISTS idx_visitor_tracking_session ON "Visitor_Tracking"(session_id);
CREATE INDEX IF NOT EXISTS idx_visitor_tracking_user_id ON "Visitor_Tracking"(user_id);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_visitor_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_visitor_tracking_updated_at
    BEFORE UPDATE ON "Visitor_Tracking"
    FOR EACH ROW
    EXECUTE FUNCTION update_visitor_tracking_updated_at();

-- Insert some sample visitor data for testing (optional)
-- This will give us data to work with immediately
INSERT INTO "Visitor_Tracking" (session_id, ip_address, user_agent, device_type, visit_date, page_visited, user_id) VALUES
('session_001', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'desktop', CURRENT_DATE - INTERVAL '1 day', '/dashboard', NULL),
('session_002', '192.168.1.101', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)', 'mobile', CURRENT_DATE - INTERVAL '1 day', '/dashboard', NULL),
('session_003', '192.168.1.102', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'desktop', CURRENT_DATE - INTERVAL '2 days', '/dashboard', NULL),
('session_004', '192.168.1.103', 'Mozilla/5.0 (Android 10; Mobile; rv:68.0)', 'mobile', CURRENT_DATE - INTERVAL '2 days', '/dashboard', NULL),
('session_005', '192.168.1.104', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'desktop', CURRENT_DATE - INTERVAL '3 days', '/dashboard', NULL),
('session_006', '192.168.1.105', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)', 'mobile', CURRENT_DATE - INTERVAL '3 days', '/dashboard', NULL),
('session_007', '192.168.1.106', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'desktop', CURRENT_DATE - INTERVAL '4 days', '/dashboard', NULL),
('session_008', '192.168.1.107', 'Mozilla/5.0 (Android 10; Mobile; rv:68.0)', 'mobile', CURRENT_DATE - INTERVAL '4 days', '/dashboard', NULL),
('session_009', '192.168.1.108', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'desktop', CURRENT_DATE - INTERVAL '5 days', '/dashboard', NULL),
('session_010', '192.168.1.109', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)', 'mobile', CURRENT_DATE - INTERVAL '5 days', '/dashboard', NULL),
('session_011', '192.168.1.110', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'desktop', CURRENT_DATE - INTERVAL '6 days', '/dashboard', NULL),
('session_012', '192.168.1.111', 'Mozilla/5.0 (Android 10; Mobile; rv:68.0)', 'mobile', CURRENT_DATE - INTERVAL '6 days', '/dashboard', NULL),
('session_013', '192.168.1.112', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'desktop', CURRENT_DATE - INTERVAL '7 days', '/dashboard', NULL),
('session_014', '192.168.1.113', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)', 'mobile', CURRENT_DATE - INTERVAL '7 days', '/dashboard', NULL),
('session_015', '192.168.1.114', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'desktop', CURRENT_DATE - INTERVAL '8 days', '/dashboard', NULL),
('session_016', '192.168.1.115', 'Mozilla/5.0 (Android 10; Mobile; rv:68.0)', 'mobile', CURRENT_DATE - INTERVAL '8 days', '/dashboard', NULL),
('session_017', '192.168.1.116', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'desktop', CURRENT_DATE - INTERVAL '9 days', '/dashboard', NULL),
('session_018', '192.168.1.117', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)', 'mobile', CURRENT_DATE - INTERVAL '9 days', '/dashboard', NULL),
('session_019', '192.168.1.118', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'desktop', CURRENT_DATE - INTERVAL '10 days', '/dashboard', NULL),
('session_020', '192.168.1.119', 'Mozilla/5.0 (Android 10; Mobile; rv:68.0)', 'mobile', CURRENT_DATE - INTERVAL '10 days', '/dashboard', NULL);

-- Add more data for 30 and 90 day ranges
INSERT INTO "Visitor_Tracking" (session_id, ip_address, user_agent, device_type, visit_date, page_visited, user_id)
SELECT 
    'session_' || (ROW_NUMBER() OVER() + 20)::text,
    '192.168.1.' || (ROW_NUMBER() OVER() + 120)::text,
    CASE 
        WHEN (ROW_NUMBER() OVER() % 3) = 0 THEN 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
        WHEN (ROW_NUMBER() OVER() % 3) = 1 THEN 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        ELSE 'Mozilla/5.0 (Android 10; Mobile; rv:68.0)'
    END,
    CASE 
        WHEN (ROW_NUMBER() OVER() % 3) = 0 THEN 'mobile'
        WHEN (ROW_NUMBER() OVER() % 3) = 1 THEN 'desktop'
        ELSE 'mobile'
    END,
    CURRENT_DATE - INTERVAL '1 day' * (ROW_NUMBER() OVER() + 10),
    '/dashboard',
    NULL
FROM generate_series(1, 50);

COMMENT ON TABLE "Visitor_Tracking" IS 'Stores visitor analytics data for tracking website traffic and user behavior';
COMMENT ON COLUMN "Visitor_Tracking".session_id IS 'Unique session identifier for the visitor';
COMMENT ON COLUMN "Visitor_Tracking".device_type IS 'Device type: desktop, mobile, tablet, or unknown';
COMMENT ON COLUMN "Visitor_Tracking".visit_date IS 'Date of the visit (separate from timestamp for easier querying)';
COMMENT ON COLUMN "Visitor_Tracking".user_id IS 'Reference to User table if visitor is logged in, NULL for anonymous visitors';
