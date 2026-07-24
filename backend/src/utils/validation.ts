/**
 * Institutional email patterns accepted by CampusRent.
 *
 * These patterns are used during student registration to verify
 * whether the provided email appears to belong to an educational
 * institution.
 *
 * Supported examples:
 * - student@college.edu
 * - student@university.ac.uk
 * - student@my.centennialcollege.ca
 * - student@student.college.ca
 * - student@mail.university.edu
 */
const INSTITUTIONAL_PATTERNS: readonly RegExp[] = [
  /\.edu$/i,
  /\.ac\.[a-z]{2}$/i,
  /@my\.centennialcollege\.ca$/i,
  /@student\.[a-z0-9.-]+\.[a-z]{2,}$/i,
  /@mail\.[a-z0-9.-]+\.[a-z]{2,}$/i,
];

/**
 * Standard email-format expression.
 *
 * This expression checks that the email:
 * - contains one @ character;
 * - does not contain spaces;
 * - contains a domain and top-level domain.
 *
 * Institutional validation is performed separately using
 * INSTITUTIONAL_PATTERNS.
 */
const EMAIL_FORMAT_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Checks whether an email address belongs to a supported
 * educational institution.
 *
 * Validation process:
 * 1. Confirm that the input is a string.
 * 2. Remove surrounding spaces.
 * 3. Convert the email to lowercase.
 * 4. Validate the general email format.
 * 5. Compare the normalized email against institutional patterns.
 *
 * Related requirement:
 * Task US-03.4 – Implement institutional-email and
 * verification-status validation.
 *
 * @param email Email address submitted during registration.
 * @returns true when the email is valid and institutional;
 * otherwise, false.
 *
 * @example
 * isInstitutionalEmail(
 *   '301505240@my.centennialcollege.ca'
 * );
 * // true
 *
 * @example
 * isInstitutionalEmail(
 *   'student@gmail.com'
 * );
 * // false
 */
export function isInstitutionalEmail(
  email: string
): boolean {
  if (
    typeof email !== 'string' ||
    email.trim().length === 0
  ) {
    return false;
  }

  const normalizedEmail =
    email.trim().toLowerCase();

  if (
    !EMAIL_FORMAT_PATTERN.test(
      normalizedEmail
    )
  ) {
    return false;
  }

  return INSTITUTIONAL_PATTERNS.some(
    (pattern) =>
      pattern.test(normalizedEmail)
  );
}

/**
 * Categories supported by CampusRent listings.
 *
 * Keeping the categories in one constant helps maintain
 * consistency between:
 * - backend validation;
 * - frontend forms;
 * - MongoDB documents;
 * - filtering and search features.
 */
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

/**
 * Union type generated from LISTING_CATEGORIES.
 *
 * This ensures that TypeScript only accepts one of the
 * supported listing-category values.
 */
export type ListingCategory =
  (typeof LISTING_CATEGORIES)[number];

/**
 * Checks whether a provided value is a supported
 * CampusRent listing category.
 *
 * @param category Category received from a request or form.
 * @returns true when the category exists in
 * LISTING_CATEGORIES; otherwise, false.
 *
 * @example
 * isValidCategory('Electronics');
 * // true
 *
 * @example
 * isValidCategory('Vehicles');
 * // false
 */
export function isValidCategory(
  category: string
): category is ListingCategory {
  return (
    LISTING_CATEGORIES as readonly string[]
  ).includes(category);
}