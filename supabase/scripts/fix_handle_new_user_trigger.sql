-- FIX: Database error saving new user
-- Run this in the Supabase SQL Editor to fix the signup issue
--
-- The previous trigger was failing because:
-- 1. No exception handling - any error would fail the entire signup
-- 2. Assumed subscription columns existed (may not be present)
-- 3. Created company for ALL users, even those with pending invitations

-- Updated function with proper error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_company_id UUID;
    user_email TEXT;
    user_name TEXT;
BEGIN
    -- Get email (handle NULL case for some OAuth providers)
    user_email := COALESCE(NEW.email, '');
    user_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        CASE WHEN user_email != '' THEN split_part(user_email, '@', 1) ELSE 'User' END
    );

    -- Create user profile in users table
    BEGIN
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
    EXCEPTION WHEN OTHERS THEN
        -- Log but don't fail - user can be created later
        RAISE WARNING 'Failed to create user profile for %: %', NEW.id, SQLERRM;
    END;

    -- Only create company if user doesn't already have one (e.g., from invitation)
    IF NOT EXISTS (
        SELECT 1 FROM company_members WHERE user_id = NEW.id AND is_active = TRUE
    ) THEN
        BEGIN
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
        EXCEPTION WHEN OTHERS THEN
            -- Log but don't fail signup - company can be created later via setup flow
            RAISE WARNING 'Failed to create default company for %: %', NEW.id, SQLERRM;
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
