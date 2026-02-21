-- Add missing HCP integration columns to inspections table
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS hcp_job_id TEXT;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS hcp_job_number TEXT;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS hcp_synced_at TIMESTAMPTZ;

-- Index for faster HCP job lookups
CREATE INDEX IF NOT EXISTS idx_inspections_hcp_job_id ON inspections(hcp_job_id);
