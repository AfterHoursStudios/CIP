-- Add completion_percentage column to inspections
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS completion_percentage INTEGER DEFAULT 0;

-- Function to recalculate completion percentage for an inspection
CREATE OR REPLACE FUNCTION update_inspection_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_inspection_id UUID;
  v_total INTEGER;
  v_completed INTEGER;
  v_percentage INTEGER;
BEGIN
  -- Get the inspection_id from either NEW or OLD record
  IF TG_OP = 'DELETE' THEN
    v_inspection_id := OLD.inspection_id;
  ELSE
    v_inspection_id := NEW.inspection_id;
  END IF;

  -- Count total and completed items
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status != 'pending')
  INTO v_total, v_completed
  FROM inspection_items
  WHERE inspection_id = v_inspection_id;

  -- Calculate percentage
  IF v_total > 0 THEN
    v_percentage := ROUND((v_completed::NUMERIC / v_total::NUMERIC) * 100);
  ELSE
    v_percentage := 0;
  END IF;

  -- Update the inspection
  UPDATE inspections
  SET completion_percentage = v_percentage,
      updated_at = NOW()
  WHERE id = v_inspection_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update completion percentage when items change
DROP TRIGGER IF EXISTS update_completion_on_item_change ON inspection_items;
CREATE TRIGGER update_completion_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON inspection_items
  FOR EACH ROW EXECUTE FUNCTION update_inspection_completion();

-- Update existing inspections with their completion percentage
UPDATE inspections i
SET completion_percentage = (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 0
    ELSE ROUND((COUNT(*) FILTER (WHERE status != 'pending')::NUMERIC / COUNT(*)::NUMERIC) * 100)
  END
  FROM inspection_items
  WHERE inspection_id = i.id
);
