/** Sides run A to Z, so a release can start at most 25 new ones. */
export const MAX_SIDE_STARTS = 25;

/**
 * The side a track sits on, from the positions where each side after A
 * begins. Null when the release is not divided into sides.
 *
 * @param position - The track's 1-based slot on the release.
 * @param sideStarts - Ascending slots where sides B, C, and so on begin.
 */
export function sideOf(position: number, sideStarts: number[]): string | null {
  if (sideStarts.length === 0) return null;
  const index = sideStarts.filter((start) => start <= position).length;
  return String.fromCharCode(65 + index);
}
