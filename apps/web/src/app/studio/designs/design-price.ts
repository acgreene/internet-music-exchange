import type { DesignSummary } from '@ime/models';
import { formatMoney } from '@ime/utils';

/**
 * What a design costs, as the marketplace says it.
 */
export function designPriceLabel(design: DesignSummary): string {
  const currency = design.currency ?? 'usd';
  switch (design.pricingMode) {
    case 'free':
      return 'Free';
    case 'fixed':
      return `${formatMoney(design.minimumPrice, currency)} or more`;
    case 'name_your_price':
      return design.minimumPrice > 0
        ? `Name your price, from ${formatMoney(design.minimumPrice, currency)}`
        : 'Name your price';
  }
}
