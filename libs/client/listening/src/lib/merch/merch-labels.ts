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

export function productTypeLabel(type: ProductType): string {
  return TYPE_LABELS[type];
}
