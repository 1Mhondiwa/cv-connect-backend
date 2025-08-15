-- Migration: Add ECS Employee System
-- This migration adds ECS Employee functionality following the same pattern as admin users

-- Add ECS Employee user type to the system
-- Note: The User table already supports different user_types, so we just need to ensure
-- the application logic supports 'ecs_employee' as a valid user type

-- Create ECS_Employee table to store employee-specific information
CREATE TABLE IF NOT EXISTS "ECS_Employee" (
    employee_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES "User"(user_id) ON DELETE CASCADE,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    department VARCHAR(255),
    position VARCHAR(255),
    employee_id_number VARCHAR(100) UNIQUE,
    hire_date DATE DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_ecs_employee_user_id ON "ECS_Employee"(user_id);
CREATE INDEX IF NOT EXISTS idx_ecs_employee_active ON "ECS_Employee"(is_active);

-- Add comments to document the changes
COMMENT ON TABLE "ECS_Employee" IS 'Stores ECS Employee specific information';
COMMENT ON COLUMN "ECS_Employee".employee_id IS 'Primary key for ECS Employee records';
COMMENT ON COLUMN "ECS_Employee".user_id IS 'Reference to User table';
COMMENT ON COLUMN "ECS_Employee".first_name IS 'Employee first name';
COMMENT ON COLUMN "ECS_Employee".last_name IS 'Employee last name';
COMMENT ON COLUMN "ECS_Employee".phone IS 'Employee phone number';
COMMENT ON COLUMN "ECS_Employee".department IS 'Employee department within ECS';
COMMENT ON COLUMN "ECS_Employee".position IS 'Employee job position/title';
COMMENT ON COLUMN "ECS_Employee".employee_id_number IS 'Unique employee ID number';
COMMENT ON COLUMN "ECS_Employee".hire_date IS 'Date when employee was hired';
COMMENT ON COLUMN "ECS_Employee".is_active IS 'Whether employee is currently active';
COMMENT ON COLUMN "ECS_Employee".created_at IS 'Record creation timestamp';
COMMENT ON COLUMN "ECS_Employee".updated_at IS 'Record last update timestamp';

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ecs_employee_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ecs_employee_updated_at
    BEFORE UPDATE ON "ECS_Employee"
    FOR EACH ROW
    EXECUTE FUNCTION update_ecs_employee_updated_at();
