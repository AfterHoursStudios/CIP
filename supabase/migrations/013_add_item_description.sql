-- Add description column to inspection_items
ALTER TABLE inspection_items ADD COLUMN IF NOT EXISTS description TEXT;
