-- Migration: Add 4 ECS Employees based on actual schema
-- Run this with the node script

BEGIN;

-- ECS Employee 1: Sarah Johnson - HR Manager
INSERT INTO "User" (
    email, 
    hashed_password, 
    user_type, 
    is_active,
    is_verified,
    created_at, 
    updated_at
)
VALUES (
    'sarah.johnson@ecs.com',
    '$2b$10$rKZvqVJ5xLh4kG8xK5WxNOQXdZ9kP5VxVJxKvVJxKvVJxKvVJxKvV', -- password: ECS2024!
    'ecs_employee',
    true,
    true,
    NOW() - INTERVAL '3 months',
    NOW() - INTERVAL '1 day'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO "ECS_Employee" (
    user_id,
    first_name,
    last_name,
    employee_id_number,
    department,
    position,
    phone,
    hire_date,
    is_active,
    created_at,
    updated_at
)
SELECT 
    u.user_id,
    'Sarah',
    'Johnson',
    'ECS-HR-2024-001',
    'Human Resources',
    'HR Manager',
    '+27 11 234 5678',
    (NOW() - INTERVAL '3 months')::date,
    true,
    NOW() - INTERVAL '3 months',
    NOW() - INTERVAL '1 day'
FROM "User" u
WHERE u.email = 'sarah.johnson@ecs.com'
AND NOT EXISTS (SELECT 1 FROM "ECS_Employee" WHERE employee_id_number = 'ECS-HR-2024-001');

-- ECS Employee 2: Michael Chen - Project Manager
INSERT INTO "User" (
    email, 
    hashed_password, 
    user_type, 
    is_active,
    is_verified,
    created_at, 
    updated_at
)
VALUES (
    'michael.chen@ecs.com',
    '$2b$10$rKZvqVJ5xLh4kG8xK5WxNOQXdZ9kP5VxVJxKvVJxKvVJxKvVJxKvV', -- password: ECS2024!
    'ecs_employee',
    true,
    true,
    NOW() - INTERVAL '5 months',
    NOW() - INTERVAL '2 hours'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO "ECS_Employee" (
    user_id,
    first_name,
    last_name,
    employee_id_number,
    department,
    position,
    phone,
    hire_date,
    is_active,
    created_at,
    updated_at
)
SELECT 
    u.user_id,
    'Michael',
    'Chen',
    'ECS-PM-2024-002',
    'Project Management',
    'Senior Project Manager',
    '+27 11 345 6789',
    (NOW() - INTERVAL '5 months')::date,
    true,
    NOW() - INTERVAL '5 months',
    NOW() - INTERVAL '2 hours'
FROM "User" u
WHERE u.email = 'michael.chen@ecs.com'
AND NOT EXISTS (SELECT 1 FROM "ECS_Employee" WHERE employee_id_number = 'ECS-PM-2024-002');

-- ECS Employee 3: Priya Naidoo - Recruitment Specialist
INSERT INTO "User" (
    email, 
    hashed_password, 
    user_type, 
    is_active,
    is_verified,
    created_at, 
    updated_at
)
VALUES (
    'priya.naidoo@ecs.com',
    '$2b$10$rKZvqVJ5xLh4kG8xK5WxNOQXdZ9kP5VxVJxKvVJxKvVJxKvVJxKvV', -- password: ECS2024!
    'ecs_employee',
    true,
    true,
    NOW() - INTERVAL '7 months',
    NOW() - INTERVAL '30 minutes'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO "ECS_Employee" (
    user_id,
    first_name,
    last_name,
    employee_id_number,
    department,
    position,
    phone,
    hire_date,
    is_active,
    created_at,
    updated_at
)
SELECT 
    u.user_id,
    'Priya',
    'Naidoo',
    'ECS-REC-2024-003',
    'Recruitment',
    'Recruitment Specialist',
    '+27 11 456 7890',
    (NOW() - INTERVAL '7 months')::date,
    true,
    NOW() - INTERVAL '7 months',
    NOW() - INTERVAL '30 minutes'
FROM "User" u
WHERE u.email = 'priya.naidoo@ecs.com'
AND NOT EXISTS (SELECT 1 FROM "ECS_Employee" WHERE employee_id_number = 'ECS-REC-2024-003');

-- ECS Employee 4: James van der Merwe - Technical Lead
INSERT INTO "User" (
    email, 
    hashed_password, 
    user_type, 
    is_active,
    is_verified,
    created_at, 
    updated_at
)
VALUES (
    'james.vandermerwe@ecs.com',
    '$2b$10$rKZvqVJ5xLh4kG8xK5WxNOQXdZ9kP5VxVJxKvVJxKvVJxKvVJxKvV', -- password: ECS2024!
    'ecs_employee',
    true,
    true,
    NOW() - INTERVAL '1 year',
    NOW() - INTERVAL '5 hours'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO "ECS_Employee" (
    user_id,
    first_name,
    last_name,
    employee_id_number,
    department,
    position,
    phone,
    hire_date,
    is_active,
    created_at,
    updated_at
)
SELECT 
    u.user_id,
    'James',
    'van der Merwe',
    'ECS-TECH-2023-004',
    'Technology',
    'Technical Lead',
    '+27 11 567 8901',
    (NOW() - INTERVAL '1 year')::date,
    true,
    NOW() - INTERVAL '1 year',
    NOW() - INTERVAL '5 hours'
FROM "User" u
WHERE u.email = 'james.vandermerwe@ecs.com'
AND NOT EXISTS (SELECT 1 FROM "ECS_Employee" WHERE employee_id_number = 'ECS-TECH-2023-004');

COMMIT;

-- Display the newly added employees
SELECT 
    e.employee_id_number,
    e.first_name,
    e.last_name,
    e.department,
    e.position,
    u.email,
    e.phone,
    e.hire_date,
    e.is_active
FROM "ECS_Employee" e
JOIN "User" u ON e.user_id = u.user_id
WHERE e.employee_id_number IN ('ECS-HR-2024-001', 'ECS-PM-2024-002', 'ECS-REC-2024-003', 'ECS-TECH-2023-004')
ORDER BY e.hire_date DESC;

