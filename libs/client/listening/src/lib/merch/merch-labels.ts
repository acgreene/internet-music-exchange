import type { ProductType } from '@ime/models';

const TYPE_LABELS: Record<ProductType, string> = {
  vinyl: 'Vinyl',
  cd: 'CD',
  cassette: 'Cassette',
  shirt: 'T-shirt',
  hoodie: 'Hoodie',
  sweatshirt: 'Sweatshirt',
  hat: 'Hat',
  beanie: 'Beanie',
  other: 'Merch',
};

/** At or under this many left, stock reads as running low. */
export const LOW_STOCK = 10;

export function productTypeLabel(type: ProductType): string {
  return TYPE_LABELS[type];
}
