-- Fix v2: WITH CHECK should reference 'item_id' not 'inspection_photos.item_id' for INSERT
DROP POLICY IF EXISTS "Users can manage photos of their inspections" ON inspection_photos;

CREATE POLICY "Users can manage photos of their inspections"
ON inspection_photos FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM inspection_items ii
    JOIN inspections i ON i.id = ii.inspection_id
    JOIN company_members cm ON cm.company_id = i.company_id
    WHERE ii.id = inspection_photos.item_id
    AND cm.user_id = auth.uid()
    AND cm.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM inspection_items ii
    JOIN inspections i ON i.id = ii.inspection_id
    JOIN company_members cm ON cm.company_id = i.company_id
    WHERE ii.id = item_id
    AND cm.user_id = auth.uid()
    AND cm.is_active = true
  )
);
