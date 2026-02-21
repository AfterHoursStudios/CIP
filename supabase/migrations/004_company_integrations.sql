-- Company Integrations table to store API keys at company level
CREATE TABLE IF NOT EXISTS company_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  integration_type text NOT NULL, -- 'housecall_pro', etc.
  api_key text, -- encrypted in production
  is_active boolean DEFAULT true,
  connected_by uuid REFERENCES auth.users(id),
  connected_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, integration_type)
);

-- Enable RLS
ALTER TABLE company_integrations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Members can view company integrations" ON company_integrations;
DROP POLICY IF EXISTS "Owners and admins can manage integrations" ON company_integrations;

-- All company members can view integrations (to know if connected)
CREATE POLICY "Members can view company integrations" ON company_integrations
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Only owners and admins can manage integrations
CREATE POLICY "Owners and admins can manage integrations" ON company_integrations
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_integrations_company ON company_integrations(company_id);
CREATE INDEX IF NOT EXISTS idx_company_integrations_type ON company_integrations(company_id, integration_type);
