/**
 * A seeded random source, so every run builds the same demo world.
 */
export class Random {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** A float in [0, 1), mulberry32. */
  public next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** An integer in [min, max]. */
  public int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  public chance(probability: number): boolean {
    return this.next() < probability;
  }

  public pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  /** One item, by weight. */
  public weighted<T>(options: readonly (readonly [T, number])[]): T {
    const total = options.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = this.next() * total;
    for (const [value, weight] of options) {
      roll -= weight;
      if (roll < 0) return value;
    }
    return options[options.length - 1][0];
  }

  /** Up to `count` distinct items. */
  public sample<T>(items: readonly T[], count: number): T[] {
    const copy = [...items];
    const out: T[] = [];
    while (out.length < count && copy.length) {
      out.push(copy.splice(Math.floor(this.next() * copy.length), 1)[0]);
    }
    return out;
  }

  /**
   * An index in [0, size), skewed toward the start: a few items are very
   * popular and most are not, as with artists and releases.
   */
  public popular(size: number, skew = 1.6): number {
    return Math.min(size - 1, Math.floor(size * Math.pow(this.next(), skew)));
  }

  /** A moment between two dates. */
  public dateBetween(start: Date, end: Date): Date {
    return new Date(
      start.getTime() + this.next() * (end.getTime() - start.getTime()),
    );
  }

  public hex(length: number): string {
    let out = '';
    for (let i = 0; i < length; i++)
      out += Math.floor(this.next() * 16).toString(16);
    return out;
  }
}

/** Every demo row's id starts with this, so the demo can be removed. */
export const DEMO_ID_PREFIX = 'de30';

const KINDS = [
  'user',
  'artist',
  'release',
  'track',
  'audio',
  'asset',
  'image',
  'link',
  'product',
  'variant',
  'productImage',
  'shippingRate',
  'order',
  'artistOrder',
  'orderItem',
  'comment',
  'payout',
  'design',
  'designVersion',
  'designImage',
  'report',
  'action',
  'contest',
  'contribution',
  'balance',
  'statement',
  'usage',
  'cost',
  'reserve',
] as const;

export type IdKind = (typeof KINDS)[number];

/**
 * A stable id for the nth demo row of a kind, such as
 * `de300300-0000-4000-8000-00000000002a` for release 42.
 */
export function demoId(kind: IdKind, n: number): string {
  const code = KINDS.indexOf(kind).toString(16).padStart(2, '0');
  return `${DEMO_ID_PREFIX}${code}00-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
}
