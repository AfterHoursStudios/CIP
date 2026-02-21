-- Update item_status enum to match app values
-- Add new enum values
ALTER TYPE item_status ADD VALUE IF NOT EXISTS 'satisfactory';
ALTER TYPE item_status ADD VALUE IF NOT EXISTS 'recommended';
ALTER TYPE item_status ADD VALUE IF NOT EXISTS 'unsafe';
ALTER TYPE item_status ADD VALUE IF NOT EXISTS 'na';
