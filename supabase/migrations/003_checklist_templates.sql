-- Checklist Templates System

-- Table to store checklist template definitions
CREATE TABLE IF NOT EXISTS checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  industry text, -- e.g., 'chimney', 'hvac', 'plumbing', 'electrical', 'general'
  categories jsonb NOT NULL, -- Array of {name: string, items: string[]}
  is_system boolean DEFAULT true, -- System templates vs custom company templates
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE, -- NULL for system templates
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table to track which templates each company has enabled
CREATE TABLE IF NOT EXISTS company_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  is_default boolean DEFAULT false, -- Default template for new inspections
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, template_id)
);

-- Enable RLS
ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_checklist_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view system templates" ON checklist_templates;
DROP POLICY IF EXISTS "Users can view their company custom templates" ON checklist_templates;
DROP POLICY IF EXISTS "Owners and admins can manage company custom templates" ON checklist_templates;
DROP POLICY IF EXISTS "Members can view their company template selections" ON company_checklist_templates;
DROP POLICY IF EXISTS "Owners and admins can manage company template selections" ON company_checklist_templates;

-- RLS Policies for checklist_templates
CREATE POLICY "Users can view system templates" ON checklist_templates
  FOR SELECT USING (is_system = true);

CREATE POLICY "Users can view their company custom templates" ON checklist_templates
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Owners and admins can manage company custom templates" ON checklist_templates
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- RLS Policies for company_checklist_templates
CREATE POLICY "Members can view their company template selections" ON company_checklist_templates
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Owners and admins can manage company template selections" ON company_checklist_templates
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- Insert system templates
INSERT INTO checklist_templates (name, description, industry, categories, is_system) VALUES
(
  'HVAC System Inspection',
  'Heating, ventilation, and air conditioning system inspection',
  'hvac',
  '[
    {"name": "Thermostat", "items": ["Calibration", "Programming", "Wiring connections", "Battery condition"]},
    {"name": "Air Handler", "items": ["Filter condition", "Blower motor", "Belt condition", "Electrical connections"]},
    {"name": "Ductwork", "items": ["Leaks or gaps", "Insulation", "Dampers", "Cleanliness"]},
    {"name": "Condenser Unit", "items": ["Coil condition", "Fan motor", "Refrigerant levels", "Electrical connections", "Clearance around unit"]},
    {"name": "Furnace", "items": ["Heat exchanger", "Burners", "Ignition system", "Flue/venting", "Safety controls"]},
    {"name": "Refrigerant Lines", "items": ["Insulation", "Connections", "Leaks", "Support brackets"]}
  ]'::jsonb,
  true
),
(
  'Plumbing Inspection',
  'Residential plumbing system inspection',
  'plumbing',
  '[
    {"name": "Water Supply", "items": ["Main shutoff valve", "Pressure", "Pipe condition", "Leaks"]},
    {"name": "Water Heater", "items": ["Age/condition", "Temperature setting", "Pressure relief valve", "Venting", "Anode rod"]},
    {"name": "Fixtures", "items": ["Faucets", "Toilets", "Sinks", "Showers/tubs", "Shut-off valves"]},
    {"name": "Drain System", "items": ["Drain flow", "Venting", "Cleanouts", "Signs of backup"]},
    {"name": "Sewer Line", "items": ["Condition", "Tree root intrusion", "Bellies or sags", "Connection to main"]}
  ]'::jsonb,
  true
),
(
  'Electrical Inspection',
  'Residential electrical system inspection',
  'electrical',
  '[
    {"name": "Service Panel", "items": ["Panel condition", "Breaker condition", "Proper labeling", "Grounding", "Clearance"]},
    {"name": "Wiring", "items": ["Wire type/age", "Connections", "Junction boxes", "Cable protection"]},
    {"name": "Outlets & Switches", "items": ["GFCI protection", "Grounding", "Cover plates", "Proper operation"]},
    {"name": "Lighting", "items": ["Fixture condition", "Proper mounting", "Bulb compatibility"]},
    {"name": "Smoke/CO Detectors", "items": ["Locations", "Operation", "Battery condition", "Age"]}
  ]'::jsonb,
  true
),
(
  'General Home Inspection',
  'Basic home inspection checklist',
  'general',
  '[
    {"name": "Exterior", "items": ["Siding condition", "Paint/finish", "Windows", "Doors", "Foundation visible"]},
    {"name": "Roof", "items": ["Shingle condition", "Flashing", "Gutters", "Downspouts", "Ventilation"]},
    {"name": "Interior", "items": ["Walls/ceilings", "Floors", "Doors", "Windows", "Stairs/railings"]},
    {"name": "Kitchen", "items": ["Appliances", "Cabinets", "Countertops", "Plumbing", "Ventilation"]},
    {"name": "Bathrooms", "items": ["Fixtures", "Ventilation", "Caulking", "Water damage signs"]},
    {"name": "Attic", "items": ["Insulation", "Ventilation", "Structure", "Signs of pests"]},
    {"name": "Basement/Crawlspace", "items": ["Moisture signs", "Foundation", "Insulation", "Sump pump"]}
  ]'::jsonb,
  true
),
(
  'Dryer Vent Inspection',
  'Dryer vent cleaning and inspection checklist',
  'chimney',
  '[
    {"name": "Interior Connection", "items": ["Duct connection at dryer", "Duct material type", "Clamp condition", "Lint buildup"]},
    {"name": "Vent Run", "items": ["Duct length", "Number of elbows", "Duct condition", "Support/clearance", "Lint accumulation"]},
    {"name": "Exterior Termination", "items": ["Hood condition", "Damper operation", "Screen (if present)", "Clearance from openings"]},
    {"name": "Dryer Performance", "items": ["Airflow test", "Drying time", "Exhaust temperature"]}
  ]'::jsonb,
  true
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_checklist_templates_company ON company_checklist_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_industry ON checklist_templates(industry);
