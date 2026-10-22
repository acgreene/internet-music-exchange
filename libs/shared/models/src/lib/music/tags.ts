export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;

const TAG_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} '&-]*$/u;

/**
 * A tag as IME stores it: lowercase, trimmed, single spaces. Null when what
 * is left is empty, too long, or holds anything but letters, numbers,
 * spaces, hyphens, apostrophes, and ampersands.
 */
export function normalizeTag(raw: string): string | null {
  const tag = raw.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!tag || tag.length > MAX_TAG_LENGTH || !TAG_PATTERN.test(tag)) {
    return null;
  }
  return tag;
}
