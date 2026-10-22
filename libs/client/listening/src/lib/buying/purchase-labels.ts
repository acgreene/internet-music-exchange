import type { PurchaseListItem } from '@ime/models';

type PaymentStatus = PurchaseListItem['status'];
type ShippingStatus = NonNullable<PurchaseListItem['fulfillmentStatus']>;

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  pending: 'Processing',
  completed: 'Paid',
  refunded: 'Refunded',
  failed: 'Payment failed',
};

const SHIPPING_LABELS: Record<ShippingStatus, string> = {
  unfulfilled: 'Not shipped yet',
  shipped: 'Shipped',
  delivered: 'Delivered',
};

export function paymentLabel(status: PaymentStatus): string {
  return PAYMENT_LABELS[status];
}

export function shippingLabel(status: ShippingStatus): string {
  return SHIPPING_LABELS[status];
}
