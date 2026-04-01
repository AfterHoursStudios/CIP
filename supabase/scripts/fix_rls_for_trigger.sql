-- Fix RLS to allow trigger to insert users
-- The handle_new_user trigger runs during signup before auth.uid() is available

-- Option 1: Add a policy that allows postgres/service_role to insert
-- This is safe because only the trigger uses this

-- Drop old restrictive policy
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;

-- Create new policies that allow both:
-- 1. Users to insert their own profile (normal case)
-- 2. Service role/postgres to insert any profile (trigger case)

CREATE POLICY "Users can insert their own profile"
ON users FOR INSERT
WITH CHECK (
    auth.uid() = id  -- User inserting their own profile
    OR current_user IN ('postgres', 'service_role')  -- Trigger/admin inserting
);

-- Also need to update the function to explicitly set the role for RLS bypass
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_company_id UUID;
    user_email TEXT;
    user_name TEXT;
BEGIN
    -- Wrap everything in exception handler to NEVER fail signup
    BEGIN
        -- Get email (handle NULL case for some OAuth providers)
        user_email := COALESCE(NEW.email, '');
        user_name := COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name',
            CASE WHEN user_email != '' THEN split_part(user_email, '@', 1) ELSE 'User' END
        );

        -- Create user profile in users table
        INSERT INTO users (id, email, full_name, avatar_url)
        VALUES (
            NEW.id,
            user_email,
            user_name,
            COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', NULL)
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), users.full_name),
            avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url);

        -- Only create company if user doesn't already have one
        IF NOT EXISTS (
            SELECT 1 FROM company_members WHERE user_id = NEW.id AND is_active = TRUE
        ) THEN
            -- Create a default company for the user
            INSERT INTO companies (id, name, email)
            VALUES (
                gen_random_uuid(),
                user_name || '''s Company',
                NULLIF(user_email, '')
            )
            RETURNING id INTO new_company_id;

            -- Add user as owner of their company
            INSERT INTO company_members (company_id, user_id, role, is_active)
            VALUES (new_company_id, NEW.id, 'owner', true);
        END IF;

    EXCEPTION WHEN OTHERS THEN
        -- Log but NEVER fail - user profile/company can be created later
        RAISE LOG 'handle_new_user failed for %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Grant execute on the function to postgres
ALTER FUNCTION handle_new_user() OWNER TO postgres;
