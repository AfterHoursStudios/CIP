-- Delete the default Chimney Inspection template
DELETE FROM checklist_templates WHERE name = 'Chimney Inspection' AND is_system = true;
