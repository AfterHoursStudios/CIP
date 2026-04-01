-- Run this script in Supabase SQL Editor after the user has signed up
-- This will give support@afterhoursstudios.net full enterprise access for free

-- First, find the user and their company
DO $$
DECLARE
    admin_user_id UUID;
    admin_company_id UUID;
BEGIN
    -- Get the user ID
    SELECT id INTO admin_user_id
    FROM auth.users
    WHERE email = 'support@afterhoursstudios.net';

    IF admin_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found. Please sign up first with support@afterhoursstudios.net';
    END IF;

    -- Get the company ID (if they have one)
    SELECT company_id INTO admin_company_id
    FROM company_members
    WHERE user_id = admin_user_id AND is_active = true
    LIMIT 1;

    IF admin_company_id IS NULL THEN
        -- Create a company for them if they don't have one
        INSERT INTO companies (id, name, email, subscription_plan, subscription_status)
        VALUES (
            gen_random_uuid(),
            'After Hours Studios (Admin)',
            'support@afterhoursstudios.net',
            'enterprise',
            'active'
        )
        RETURNING id INTO admin_company_id;

        -- Add them as owner of the new company
        INSERT INTO company_members (company_id, user_id, role, is_active)
        VALUES (admin_company_id, admin_user_id, 'owner', true);

        RAISE NOTICE 'Created new company and added user as owner';
    ELSE
        -- Update existing company to enterprise plan
        UPDATE companies
        SET
            subscription_plan = 'enterprise',
            subscription_status = 'active',
            subscription_current_period_end = NULL  -- No expiration
        WHERE id = admin_company_id;

        -- Ensure they are owner
        UPDATE company_members
        SET role = 'owner'
        WHERE company_id = admin_company_id AND user_id = admin_user_id;

        RAISE NOTICE 'Updated existing company to enterprise plan';
    END IF;

    RAISE NOTICE 'Admin account setup complete for support@afterhoursstudios.net';
    RAISE NOTICE 'User ID: %', admin_user_id;
    RAISE NOTICE 'Company ID: %', admin_company_id;
END $$;

-- Verify the setup
SELECT
    u.email,
    c.name as company_name,
    c.subscription_plan,
    c.subscription_status,
    cm.role
FROM auth.users u
JOIN company_members cm ON cm.user_id = u.id
JOIN companies c ON c.id = cm.company_id
WHERE u.email = 'support@afterhoursstudios.net';
