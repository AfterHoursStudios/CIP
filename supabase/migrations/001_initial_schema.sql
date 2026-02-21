-- =====================================================
-- INITIAL SCHEMA FOR CONSTRUCTION INSPECTION PRO
-- =====================================================

-- gen_random_uuid() is built-in, no extension needed

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- =====================================================
-- COMPANIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- COMPANY MEMBERS TABLE
-- =====================================================
CREATE TYPE member_role AS ENUM ('owner', 'admin', 'inspector');

CREATE TABLE IF NOT EXISTS company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'inspector',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

-- RLS for companies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view companies they belong to"
  ON companies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = companies.id
      AND company_members.user_id = auth.uid()
      AND company_members.is_active = TRUE
    )
  );

CREATE POLICY "Owners and admins can update company"
  ON companies FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = companies.id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('owner', 'admin')
      AND company_members.is_active = TRUE
    )
  );

CREATE POLICY "Authenticated users can create companies"
  ON companies FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- RLS for company_members
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view members of their companies"
  ON company_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = company_members.company_id
      AND cm.user_id = auth.uid()
      AND cm.is_active = TRUE
    )
  );

CREATE POLICY "Owners and admins can manage members"
  ON company_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = company_members.company_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'admin')
      AND cm.is_active = TRUE
    )
  );

CREATE POLICY "Users can insert themselves as owner of new company"
  ON company_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'owner'
    AND NOT EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = company_members.company_id
    )
  );

-- =====================================================
-- INSPECTIONS TABLE
-- =====================================================
CREATE TYPE inspection_status AS ENUM ('draft', 'scheduled', 'in_progress', 'completed', 'cancelled');

CREATE TABLE IF NOT EXISTS inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  inspector_id UUID NOT NULL REFERENCES users(id),
  project_name TEXT NOT NULL,
  project_address TEXT,
  client_name TEXT,
  client_email TEXT,
  scheduled_date TIMESTAMPTZ,
  completed_date TIMESTAMPTZ,
  status inspection_status DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for inspections
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view inspections of their company"
  ON inspections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = inspections.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.is_active = TRUE
    )
  );

CREATE POLICY "Company members can create inspections"
  ON inspections FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = inspections.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.is_active = TRUE
    )
  );

CREATE POLICY "Inspectors can update their own inspections"
  ON inspections FOR UPDATE
  USING (
    inspector_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = inspections.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('owner', 'admin')
      AND company_members.is_active = TRUE
    )
  );

CREATE POLICY "Owners and admins can delete inspections"
  ON inspections FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = inspections.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('owner', 'admin')
      AND company_members.is_active = TRUE
    )
  );

-- =====================================================
-- INSPECTION ITEMS TABLE
-- =====================================================
CREATE TYPE item_status AS ENUM ('pass', 'fail', 'na', 'pending');

CREATE TABLE IF NOT EXISTS inspection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  status item_status DEFAULT 'pending',
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for inspection_items
ALTER TABLE inspection_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view items of their inspections"
  ON inspection_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM inspections i
      JOIN company_members cm ON cm.company_id = i.company_id
      WHERE i.id = inspection_items.inspection_id
      AND cm.user_id = auth.uid()
      AND cm.is_active = TRUE
    )
  );

CREATE POLICY "Users can manage items of their inspections"
  ON inspection_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM inspections i
      JOIN company_members cm ON cm.company_id = i.company_id
      WHERE i.id = inspection_items.inspection_id
      AND cm.user_id = auth.uid()
      AND cm.is_active = TRUE
    )
  );

-- =====================================================
-- INSPECTION PHOTOS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS inspection_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inspection_items(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for inspection_photos
ALTER TABLE inspection_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view photos of their inspections"
  ON inspection_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM inspection_items ii
      JOIN inspections i ON i.id = ii.inspection_id
      JOIN company_members cm ON cm.company_id = i.company_id
      WHERE ii.id = inspection_photos.item_id
      AND cm.user_id = auth.uid()
      AND cm.is_active = TRUE
    )
  );

CREATE POLICY "Users can manage photos of their inspections"
  ON inspection_photos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM inspection_items ii
      JOIN inspections i ON i.id = ii.inspection_id
      JOIN company_members cm ON cm.company_id = i.company_id
      WHERE ii.id = inspection_photos.item_id
      AND cm.user_id = auth.uid()
      AND cm.is_active = TRUE
    )
  );

-- =====================================================
-- COMPANY INVITATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS company_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role member_role DEFAULT 'inspector',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  UNIQUE(company_id, email)
);

-- RLS for company_invitations
ALTER TABLE company_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage invitations"
  ON company_invitations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = company_invitations.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('owner', 'admin')
      AND company_members.is_active = TRUE
    )
  );

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get active member count
CREATE OR REPLACE FUNCTION get_active_member_count(p_company_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM company_members
    WHERE company_id = p_company_id
    AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- CREATE COMPANY WITH OWNER (atomic operation)
-- =====================================================
CREATE OR REPLACE FUNCTION create_company_with_owner(
  p_name TEXT,
  p_user_id UUID
)
RETURNS companies AS $$
DECLARE
  v_company companies;
BEGIN
  -- Create the company
  INSERT INTO companies (name)
  VALUES (p_name)
  RETURNING * INTO v_company;

  -- Add the user as owner
  INSERT INTO company_members (company_id, user_id, role)
  VALUES (v_company.id, p_user_id, 'owner');

  RETURN v_company;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- INVITE USER TO COMPANY
-- =====================================================
CREATE OR REPLACE FUNCTION invite_user_to_company(
  p_company_id UUID,
  p_email TEXT,
  p_role member_role,
  p_inviter_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_existing_user_id UUID;
  v_existing_member_id UUID;
BEGIN
  -- Check if inviter has permission (must be owner or admin)
  IF NOT EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = p_company_id
    AND user_id = p_inviter_id
    AND role IN ('owner', 'admin')
    AND is_active = TRUE
  ) THEN
    RETURN json_build_object('success', false, 'error', 'You do not have permission to invite members');
  END IF;

  -- Check if user already exists
  SELECT id INTO v_existing_user_id
  FROM users
  WHERE LOWER(email) = LOWER(p_email);

  IF v_existing_user_id IS NOT NULL THEN
    -- Check if already a member
    SELECT id INTO v_existing_member_id
    FROM company_members
    WHERE company_id = p_company_id
    AND user_id = v_existing_user_id;

    IF v_existing_member_id IS NOT NULL THEN
      RETURN json_build_object('success', false, 'error', 'User is already a member of this company');
    END IF;

    -- Add user directly as member
    INSERT INTO company_members (company_id, user_id, role)
    VALUES (p_company_id, v_existing_user_id, p_role);

    RETURN json_build_object('success', true, 'type', 'added');
  ELSE
    -- Check if invitation already exists
    IF EXISTS (
      SELECT 1 FROM company_invitations
      WHERE company_id = p_company_id
      AND LOWER(email) = LOWER(p_email)
      AND expires_at > NOW()
    ) THEN
      RETURN json_build_object('success', false, 'error', 'An invitation has already been sent to this email');
    END IF;

    -- Create invitation
    INSERT INTO company_invitations (company_id, email, role)
    VALUES (p_company_id, LOWER(p_email), p_role)
    ON CONFLICT (company_id, email)
    DO UPDATE SET role = p_role, expires_at = NOW() + INTERVAL '7 days', created_at = NOW();

    RETURN json_build_object('success', true, 'type', 'invited');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PROCESS PENDING INVITATIONS (called on login)
-- =====================================================
CREATE OR REPLACE FUNCTION process_pending_invitations(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_user_email TEXT;
  v_invitation RECORD;
  v_count INTEGER := 0;
BEGIN
  -- Get user email
  SELECT email INTO v_user_email
  FROM users
  WHERE id = p_user_id;

  IF v_user_email IS NULL THEN
    RETURN 0;
  END IF;

  -- Process all pending invitations for this email
  FOR v_invitation IN
    SELECT * FROM company_invitations
    WHERE LOWER(email) = LOWER(v_user_email)
    AND expires_at > NOW()
  LOOP
    -- Check if not already a member
    IF NOT EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = v_invitation.company_id
      AND user_id = p_user_id
    ) THEN
      -- Add as member
      INSERT INTO company_members (company_id, user_id, role)
      VALUES (v_invitation.company_id, p_user_id, v_invitation.role);

      v_count := v_count + 1;
    END IF;

    -- Delete the invitation
    DELETE FROM company_invitations WHERE id = v_invitation.id;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- REMOVE COMPANY MEMBER
-- =====================================================
CREATE OR REPLACE FUNCTION remove_company_member(
  p_member_id UUID,
  p_remover_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_member RECORD;
  v_remover_role member_role;
BEGIN
  -- Get member details
  SELECT cm.*, c.id as company_id
  INTO v_member
  FROM company_members cm
  JOIN companies c ON c.id = cm.company_id
  WHERE cm.id = p_member_id;

  IF v_member IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Member not found');
  END IF;

  -- Get remover's role
  SELECT role INTO v_remover_role
  FROM company_members
  WHERE company_id = v_member.company_id
  AND user_id = p_remover_id
  AND is_active = TRUE;

  -- Check permission
  IF v_remover_role IS NULL OR v_remover_role NOT IN ('owner', 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'You do not have permission to remove members');
  END IF;

  -- Prevent removing the last owner
  IF v_member.role = 'owner' THEN
    IF (SELECT COUNT(*) FROM company_members WHERE company_id = v_member.company_id AND role = 'owner' AND is_active = TRUE) <= 1 THEN
      RETURN json_build_object('success', false, 'error', 'Cannot remove the last owner');
    END IF;
  END IF;

  -- Deactivate the member (soft delete)
  UPDATE company_members
  SET is_active = FALSE, updated_at = NOW()
  WHERE id = p_member_id;

  RETURN json_build_object('success', true, 'user_deleted', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- AUTO-CREATE USER PROFILE ON AUTH SIGNUP
-- =====================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), users.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create user profile
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- STORAGE BUCKET
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('inspection-photos', 'inspection-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'inspection-photos'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Anyone can view photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'inspection-photos');

CREATE POLICY "Users can delete their photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'inspection-photos'
    AND auth.uid() IS NOT NULL
  );
