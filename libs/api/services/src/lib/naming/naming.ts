import { HANDLE_PATTERN } from '@ime/db';

export const HANDLE_MAX_LENGTH = 30;
export const SLUG_MAX_LENGTH = 100;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Paths under `/artists/<handle>/` that pages other than releases use, so no
 * release can take them.
 */
export const RESERVED_RELEASE_SLUGS = new Set([
  'about',
  'edit',
  'followers',
  'merch',
  'new',
  'releases',
  'settings',
  'store',
]);

/**
 * Lowercase words joined by hyphens, with accents folded so "Björk" reads
 * "bjork". Anything else becomes a hyphen.
 */
function toWords(text: string, maxLength: number): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, maxLength)
    .replace(/^-+|-+$/g, '');
}

/**
 * Turn a name into a handle, or an empty string when nothing usable is left.
 */
export function toHandle(name: string): string {
  const handle = toWords(name, HANDLE_MAX_LENGTH);
  return isValidHandle(handle) ? handle : '';
}

/**
 * Turn a title into a release slug, or an empty string when nothing usable is
 * left.
 */
export function toSlug(title: string): string {
  return toWords(title, SLUG_MAX_LENGTH);
}

export function isValidHandle(handle: string): boolean {
  return new RegExp(HANDLE_PATTERN).test(handle);
}

export function isValidSlug(slug: string): boolean {
  return (
    SLUG_PATTERN.test(slug) &&
    slug.length <= SLUG_MAX_LENGTH &&
    !RESERVED_RELEASE_SLUGS.has(slug)
  );
}

/**
 * Find the first free variant of a name: the name itself, then `name-2`,
 * `name-3`, and so on, trimmed so the suffix still fits.
 *
 * @param base - The preferred name.
 * @param maxLength - The longest a name may be.
 * @param isFree - Whether a candidate is valid and not taken.
 */
export async function firstAvailable(
  base: string,
  maxLength: number,
  isFree: (candidate: string) => Promise<boolean>,
): Promise<string> {
  if (await isFree(base)) return base;

  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate =
      base.slice(0, maxLength - suffix.length).replace(/-+$/, '') + suffix;
    if (await isFree(candidate)) return candidate;
  }
}
