-- Make role_id NOT NULL for users table
-- First, set a default role for any users who don't have one
-- Default to "Business Developer" (the lowest privilege role)

DO $$
DECLARE
    bd_role_id uuid;
BEGIN
    -- Get the Business Developer role ID
    SELECT id INTO bd_role_id FROM roles WHERE name = 'Business Developer' LIMIT 1;

    IF bd_role_id IS NULL THEN
        RAISE EXCEPTION 'Business Developer role not found in roles table';
    END IF;

    -- Update any users with NULL role_id to Business Developer
    UPDATE users SET role_id = bd_role_id WHERE role_id IS NULL;
END $$;

-- Now make role_id NOT NULL
ALTER TABLE users
ALTER COLUMN role_id SET NOT NULL;
