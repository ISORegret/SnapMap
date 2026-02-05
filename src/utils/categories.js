export const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'automotive', label: 'Automotive' },
  { id: 'urban', label: 'Urban' },
  { id: 'landscape', label: 'Landscape' },
  { id: 'coastal', label: 'Coastal' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'cityscape', label: 'Cityscape' },
];

export function matchesCategory(spot, categoryId) {
  if (categoryId === 'all') return true;
  return spot.tags?.some((t) => t.toLowerCase() === categoryId) ?? false;
}
