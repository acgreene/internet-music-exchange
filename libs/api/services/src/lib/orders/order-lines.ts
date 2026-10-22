import type { OrderItemDetail } from '@ime/db';
import type { EmailLine } from '../email';

/**
 * An order's lines as emails list them, with each variant named.
 */
export function toEmailLines(items: OrderItemDetail[]): EmailLine[] {
  return items.map((item) => ({
    name: item.variantLabel ? `${item.name} (${item.variantLabel})` : item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  }));
}
