-- Migration: Add 4 ECS Employees to populate the platform
-- Run this with: psql -U postgres -d CV_Connect -f add-ecs-employees.sql

BEGIN;

-- ECS Employee 1: Sarah Johnson - HR Manager
INSERT INTO "User" (
    email, 
    hashed_password, 
    user_type, 
    created_at, 
    updated_at
)
VALUES (
    'sarah.johnson@ecs.com',
    '$2b$10$rKZvqVJ5xLh4kG8xK5WxNOQXdZ9kP5VxVJxKvVJxKvVJxKvVJxKvV', -- password: ECS2024!
    'ecs_employee',
    NOW() - INTERVAL '3 months',
    NOW() - INTERVAL '1 day'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO "ECS_Employee" (
    user_id,
    first_name,
    last_name,
    employee_id,
    department,
    position,
    phone,
    office_location,
    hire_date,
    is_active,
    can_post_jobs,
    can_review_applications,
    can_conduct_interviews,
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
    'Johannesburg Office - Floor 3',
    (NOW() - INTERVAL '3 months')::date,
    true,
    true,
    true,
    true,
    NOW() - INTERVAL '3 months',
    NOW() - INTERVAL '1 day'
FROM "User" u
WHERE u.email = 'sarah.johnson@ecs.com'
ON CONFLICT (employee_id) DO NOTHING;

-- ECS Employee 2: Michael Chen - Project Manager
INSERT INTO "User" (
    email, 
    hashed_password, 
    user_type, 
    created_at, 
    updated_at
)
VALUES (
    'michael.chen@ecs.com',
    '$2b$10$rKZvqVJ5xLh4kG8xK5WxNOQXdZ9kP5VxVJxKvVJxKvVJxKvVJxKvV', -- password: ECS2024!
    'ecs_employee',
    NOW() - INTERVAL '5 months',
    NOW() - INTERVAL '2 hours'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO "ECS_Employee" (
    user_id,
    first_name,
    last_name,
    employee_id,
    department,
    position,
    phone,
    office_location,
    hire_date,
    is_active,
    can_post_jobs,
    can_review_applications,
    can_conduct_interviews,
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
    'Johannesburg Office - Floor 5',
    (NOW() - INTERVAL '5 months')::date,
    true,
    true,
    true,
    true,
    NOW() - INTERVAL '5 months',
    NOW() - INTERVAL '2 hours'
FROM "User" u
WHERE u.email = 'michael.chen@ecs.com'
ON CONFLICT (employee_id) DO NOTHING;

-- ECS Employee 3: Priya Naidoo - Recruitment Specialist
INSERT INTO "User" (
    email, 
    hashed_password, 
    user_type, 
    created_at, 
    updated_at
)
VALUES (
    'priya.naidoo@ecs.com',
    '$2b$10$rKZvqVJ5xLh4kG8xK5WxNOQXdZ9kP5VxVJxKvVJxKvVJxKvVJxKvV', -- password: ECS2024!
    'ecs_employee',
    NOW() - INTERVAL '7 months',
    NOW() - INTERVAL '30 minutes'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO "ECS_Employee" (
    user_id,
    first_name,
    last_name,
    employee_id,
    department,
    position,
    phone,
    office_location,
    hire_date,
    is_active,
    can_post_jobs,
    can_review_applications,
    can_conduct_interviews,
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
    'Johannesburg Office - Floor 3',
    (NOW() - INTERVAL '7 months')::date,
    true,
    true,
    true,
    true,
    NOW() - INTERVAL '7 months',
    NOW() - INTERVAL '30 minutes'
FROM "User" u
WHERE u.email = 'priya.naidoo@ecs.com'
ON CONFLICT (employee_id) DO NOTHING;

-- ECS Employee 4: James van der Merwe - Technical Lead
INSERT INTO "User" (
    email, 
    hashed_password, 
    user_type, 
    created_at, 
    updated_at
)
VALUES (
    'james.vandermerwe@ecs.com',
    '$2b$10$rKZvqVJ5xLh4kG8xK5WxNOQXdZ9kP5VxVJxKvVJxKvVJxKvVJxKvV', -- password: ECS2024!
    'ecs_employee',
    NOW() - INTERVAL '1 year',
    NOW() - INTERVAL '5 hours'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO "ECS_Employee" (
    user_id,
    first_name,
    last_name,
    employee_id,
    department,
    position,
    phone,
    office_location,
    hire_date,
    is_active,
    can_post_jobs,
    can_review_applications,
    can_conduct_interviews,
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
    'Cape Town Office - Floor 2',
    (NOW() - INTERVAL '1 year')::date,
    true,
    true,
    true,
    true,
    NOW() - INTERVAL '1 year',
    NOW() - INTERVAL '5 hours'
FROM "User" u
WHERE u.email = 'james.vandermerwe@ecs.com'
ON CONFLICT (employee_id) DO NOTHING;

COMMIT;

-- Display the newly added employees
SELECT 
    e.employee_id,
    e.first_name,
    e.last_name,
    e.department,
    e.position,
    u.email,
    e.office_location,
    e.hire_date,
    e.is_active
FROM "ECS_Employee" e
JOIN "User" u ON e.user_id = u.user_id
WHERE e.employee_id IN ('ECS-HR-2024-001', 'ECS-PM-2024-002', 'ECS-REC-2024-003', 'ECS-TECH-2023-004')
ORDER BY e.hire_date DESC;

