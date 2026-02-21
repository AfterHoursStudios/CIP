-- Add assigned employee column for HCP integration
ALTER TABLE inspections
ADD COLUMN IF NOT EXISTS hcp_assigned_employee text;
