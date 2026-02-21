-- Add Level 1 Chimney Inspection template with measurement items
INSERT INTO checklist_templates (id, name, description, industry, is_system, categories)
VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'Level 1 Chimney Inspection (NO INSERT)',
  'Basic chimney inspection with measurements',
  'Chimney',
  true,
  '[
    {
      "name": "Chimney Dimensions",
      "items": [
        {"name": "Height", "item_type": "measurement", "description": "Measure total chimney height from roofline to top of chimney."},
        {"name": "Width", "item_type": "measurement", "description": "Measure chimney width at its base."},
        {"name": "Width (Above Step)", "item_type": "measurement", "description": "Measure chimney width above the step."},
        {"name": "Depth", "item_type": "measurement", "description": "Measure chimney depth at its base."}
      ]
    },
    {
      "name": "Chimney Cap",
      "items": [
        {"name": "Cap condition", "item_type": "status", "description": "Inspect cap for rust, corrosion, loose fasteners, damage, improper attachment, or signs of failure."},
        {"name": "Spark arrestor", "item_type": "status", "description": "Verify presence of spark arrestor screen. Check for corrosion, clogging, or damaged mesh."},
        {"name": "Animal guard", "item_type": "status", "description": "Confirm animal guard is installed and intact. Check for nesting, entry points, or damage"},
        {"name": "Proper sizing", "item_type": "status", "description": "Verify cap properly fits flue tile or chase top and provides adequate overhang and coverage."}
      ]
    },
    {
      "name": "Chimney Crown",
      "items": [
        {"name": "Cracks or deterioration", "item_type": "status", "description": "Inspect crown for cracks, spalling, scaling, separation from flue tile, or exposed reinforcement."},
        {"name": "Water pooling", "item_type": "status", "description": "Check for signs of standing water, staining, moisture intrusion, or freeze-thaw damage"},
        {"name": "Proper slope", "item_type": "status", "description": "Verify crown is properly sloped away from flue and chimney walls to shed water"},
        {"name": "Sealant condition", "item_type": "status", "description": "Inspect sealant at flue-to-crown joint for cracking, shrinkage, or separation."}
      ]
    },
    {
      "name": "Flue",
      "items": [
        {"name": "Flue condition", "item_type": "status", "description": "Inspect visible flue liner for cracks, gaps, misalignment, spalling, or deterioration."},
        {"name": "Flue size", "item_type": "status", "description": "Verify flue sizing is appropriate for the connected appliance per manufacturer and code requirements."},
        {"name": "Obstructions", "item_type": "status", "description": "Check for debris, nesting materials, collapsed liner sections, or other obstructions affecting draft."},
        {"name": "Visable Creosote Buildup", "item_type": "status", "description": "Assess visible creosote accumulation. Note glazing, stage 2 or stage 3 buildup if present."}
      ]
    },
    {
      "name": "Chimney Exterior",
      "items": [
        {"name": "Exterior Condition", "item_type": "status", "description": "Verify chimney is plumb, stable, and free from leaning, separation, or structural cracking."},
        {"name": "Brick/Masonry Condition", "item_type": "status", "description": "Inspect masonry for cracked, loose, spalled, or deteriorated brick/block units."},
        {"name": "Mortor Joints", "item_type": "status", "description": "Check mortar joints for erosion, gaps, cracking, or need for tuckpointing."},
        {"name": "Flashing Condition", "item_type": "status", "description": "Inspect step flashing and counter flashing for proper installation, corrosion, lifting, or gaps."},
        {"name": "Clearances", "item_type": "status", "description": "Verify 3-2-10 rule (Minumum 3 feet from roof, 2 feet above any part of the building within 10 feet) is met for chimney height and clearance."}
      ]
    },
    {
      "name": "Fireplace",
      "items": [
        {"name": "Smoke Chamber", "item_type": "status", "description": "Inspect smoke chamber for cracks, voids, parging deterioration, or improper construction."},
        {"name": "Damper", "item_type": "status", "description": "Verify damper opens, closes, and seals properly. Check for rust, warping, or misalignment."},
        {"name": "Firebox", "item_type": "status", "description": "Inspect firebox for cracked firebrick, missing mortar, gaps, or refractory damage."},
        {"name": "Ash Container", "item_type": "status", "description": "Check ash dump and container for proper function, corrosion, blockage, or missing cover."},
        {"name": "Spark Screen/Doors", "item_type": "status", "description": "Inspect glass doors or spark screen for proper operation, damaged panels, or loose hardware."},
        {"name": "Hearth", "item_type": "status", "description": "Verify hearth extension is intact, properly supported, and meets clearance requirements."}
      ]
    },
    {
      "name": "Other Safety Considerations",
      "items": [
        {"name": "Smoke Detector", "item_type": "status", "description": "Visually verify presence and location of smoke detectors in required areas. Confirm unit appears operational and recommend testing per manufacturer guidelines. Note missing, expired, or improperly located units."},
        {"name": "Carbon Monoxide Alarms", "item_type": "status", "description": "Verify presence of carbon monoxide alarms near sleeping areas and fuel-burning appliances. Recommend functional testing and battery replacement if needed. Note missing, expired, or improperly installed units."},
        {"name": "Fire Extinguisher", "item_type": "status", "description": "Confirm presence of accessible fire extinguisher in fireplace area. Check gauge for proper charge, inspect for damage or expired service date."}
      ]
    }
  ]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  categories = EXCLUDED.categories,
  updated_at = NOW();