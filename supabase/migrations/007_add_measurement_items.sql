-- Add support for measurement-type checklist items

-- Add item_type to distinguish between status checks and measurements
ALTER TABLE inspection_items
ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'status';

-- Add value column for storing measurement data (JSON)
ALTER TABLE inspection_items
ADD COLUMN IF NOT EXISTS value JSONB;

-- Update the item_status enum isn't needed for measurements
-- Measurements will use 'pending' until a value is entered, then 'satisfactory'
