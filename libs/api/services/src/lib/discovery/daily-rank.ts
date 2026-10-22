/**
 * A stable shuffle key for something on a given day, so a daily pick is the
 * same all day and different the next.
 *
 * @param day - The date, `YYYY-MM-DD`.
 * @param id - What is being ranked.
 */
export function dailyRank(day: string, id: string): number {
  let hash = 2166136261;
  for (const char of `${day}:${id}`) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  }
  return hash >>> 0;
}
