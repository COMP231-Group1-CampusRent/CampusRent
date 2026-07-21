const INSTITUTIONAL_PATTERNS = [
  /\.edu$/i,
  /\.ac\.[a-z]{2}$/i,
  /@mycentennialcollege\.ca$/i,
  /@student\./i,
  /@mail\./i,
];

export function isInstitutionalEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return false;
  return INSTITUTIONAL_PATTERNS.some((pattern) => pattern.test(normalized));
}

export const LISTING_CATEGORIES = [
  'Textbooks',
  'Electronics',
  'Lab Equipment',
  'Sports & Recreation',
  'Tools',
  'Furniture',
  'Clothing',
  'Other',
] as const;

export type ListingCategory = (typeof LISTING_CATEGORIES)[number];

export function isValidCategory(category: string): category is ListingCategory {
  return (LISTING_CATEGORIES as readonly string[]).includes(category);
}
