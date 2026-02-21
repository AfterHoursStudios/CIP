-- Fix inspection update policy to allow any company member to update inspections
-- Previously only the assigned inspector or owner/admin could update

DROP POLICY IF EXISTS "Inspectors can update their own inspections" ON inspections;
DROP POLICY IF EXISTS "Company members can update inspections" ON inspections;

CREATE POLICY "Company members can update inspections"
  ON inspections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = inspections.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.is_active = TRUE
    )
  );
