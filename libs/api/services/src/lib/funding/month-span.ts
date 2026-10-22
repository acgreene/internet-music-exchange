const DAY_MS = 86_400_000;

/**
 * When a billing month starts and ends, and how many days it has.
 *
 * @param month - The first day of the month, `YYYY-MM-01`.
 */
export function monthSpan(month: string): {
  start: Date;
  end: Date;
  days: number;
} {
  const start = new Date(`${month}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return {
    start,
    end,
    days: Math.round((end.getTime() - start.getTime()) / DAY_MS),
  };
}
