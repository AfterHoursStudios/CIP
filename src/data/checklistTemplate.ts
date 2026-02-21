// Define your inspection checklist categories and items here
// Each category contains an array of item names

export interface ChecklistCategory {
  name: string;
  items: string[];
}

export const DEFAULT_CHECKLIST: ChecklistCategory[] = [
  {
    name: 'Chimney Cap',
    items: [
      'Cap condition',
      'Spark arrestor',
      'Animal guard',
      'Proper sizing',
    ],
  },
  {
    name: 'Chimney Crown',
    items: [
      'Cracks or deterioration',
      'Proper slope',
      'Sealant condition',
      'Overhang adequate',
    ],
  },
  {
    name: 'Flue',
    items: [
      'Liner condition',
      'Creosote buildup',
      'Obstructions',
      'Proper sizing',
      'Joints sealed',
    ],
  },
  {
    name: 'Firebox',
    items: [
      'Firebrick condition',
      'Mortar joints',
      'Smoke chamber',
      'Back wall integrity',
      'Floor condition',
    ],
  },
  {
    name: 'Damper',
    items: [
      'Operation',
      'Seal condition',
      'Handle/controls',
      'Rust or corrosion',
    ],
  },
  {
    name: 'Hearth Extension',
    items: [
      'Size adequate',
      'Material condition',
      'Clearance to combustibles',
    ],
  },
  {
    name: 'Exterior Masonry',
    items: [
      'Brick condition',
      'Mortar joints',
      'Flashing',
      'Waterproofing',
      'Structural integrity',
    ],
  },
  {
    name: 'Cleanout',
    items: [
      'Door condition',
      'Seal intact',
      'Accessible',
    ],
  },
];

// Helper to flatten categories into items array for database insertion
export function flattenChecklist(categories: ChecklistCategory[]) {
  const items: { category: string; name: string }[] = [];

  categories.forEach((category) => {
    category.items.forEach((itemName) => {
      items.push({
        category: category.name,
        name: itemName,
      });
    });
  });

  return items;
}
