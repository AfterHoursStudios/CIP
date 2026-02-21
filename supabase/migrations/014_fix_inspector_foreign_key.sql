-- Update the foreign key on inspections to SET NULL when user is deleted
-- This preserves inspection records but removes the inspector reference

ALTER TABLE inspections
DROP CONSTRAINT IF EXISTS inspections_inspector_id_fkey;

ALTER TABLE inspections
ADD CONSTRAINT inspections_inspector_id_fkey
FOREIGN KEY (inspector_id) REFERENCES users(id) ON DELETE SET NULL;

-- Also make inspector_id nullable if it isn't already
ALTER TABLE inspections
ALTER COLUMN inspector_id DROP NOT NULL;
