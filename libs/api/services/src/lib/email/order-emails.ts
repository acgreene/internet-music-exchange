import type { Email } from './email-service';
import { formatMoney } from '@ime/utils';

/**
 * A line on a receipt or sale notice.
 */
export interface EmailLine {
  name: string;
  quantity: number;
  unitPrice: number;
}

/**
 * The money side of one artist's portion of an order.
 */
export interface EmailTotals {
  amount: number;
  shippingAmount: number;
  taxAmount: number;
  currency: string;
}

const listLines = (lines: EmailLine[], currency: string) =>
  lines
    .map(
      (line) =>
        `- ${line.name}${line.quantity > 1 ? ` x${line.quantity}` : ''}: ${formatMoney(line.unitPrice * line.quantity, currency)}`,
    )
    .join('\n');

const listTotals = (totals: EmailTotals) =>
  [
    totals.shippingAmount > 0 &&
      `Shipping: ${formatMoney(totals.shippingAmount, totals.currency)}`,
    totals.taxAmount > 0 &&
      `Tax: ${formatMoney(totals.taxAmount, totals.currency)}`,
    `Total: ${formatMoney(totals.amount, totals.currency)}`,
  ]
    .filter(Boolean)
    .join('\n');

/**
 * The emails buying and selling send.
 */
export const orderEmails = {
  receipt(
    to: string,
    artistName: string,
    lines: EmailLine[],
    totals: EmailTotals,
    purchasesUrl: string,
  ): Email {
    return {
      to,
      subject: `Your receipt from ${artistName}`,
      text: `Thanks for supporting ${artistName}. Your payment went straight to them.\n\n${listLines(lines, totals.currency)}\n\n${listTotals(totals)}\n\nMusic you bought is in your library now. See your purchases: ${purchasesUrl}`,
    };
  },

  sale(
    to: string,
    artistName: string,
    lines: EmailLine[],
    totals: EmailTotals,
    ships: boolean,
    salesUrl: string,
  ): Email {
    return {
      to,
      subject: `${artistName} made a sale`,
      text: `${artistName} just sold:\n\n${listLines(lines, totals.currency)}\n\n${listTotals(totals)}${ships ? '\n\nThis order has something to ship.' : ''}\n\nSee your sales: ${salesUrl}`,
    };
  },

  shipped(
    to: string,
    artistName: string,
    tracking: { trackingNumber: string | null; carrier: string | null },
    purchasesUrl: string,
  ): Email {
    const how = [tracking.carrier, tracking.trackingNumber]
      .filter(Boolean)
      .join(' ');
    return {
      to,
      subject: `${artistName} shipped your order`,
      text: `Your order from ${artistName} is on its way.${how ? `\n\nTracking: ${how}` : ''}\n\nSee your purchases: ${purchasesUrl}`,
    };
  },

  refunded(
    to: string,
    artistName: string,
    totals: EmailTotals,
    purchasesUrl: string,
  ): Email {
    return {
      to,
      subject: `${artistName} refunded your order`,
      text: `${artistName} refunded ${formatMoney(totals.amount, totals.currency)} to your payment method. Anything the order added to your library has been removed.\n\nSee your purchases: ${purchasesUrl}`,
    };
  },

  soldOut(to: string, artistName: string, cartUrl: string): Email {
    return {
      to,
      subject: `Your order from ${artistName} could not be completed`,
      text: `Something in your order from ${artistName} sold out while you were paying, so nothing was bought and your payment has been refunded in full.\n\nYour cart: ${cartUrl}`,
    };
  },

  refundRequest(
    to: string,
    artistName: string,
    buyerName: string,
    lines: EmailLine[],
    totals: EmailTotals,
    message: string,
    saleUrl: string,
  ): Email {
    return {
      to,
      subject: `${buyerName} asked ${artistName} for a refund`,
      text: `${buyerName} asked for a refund of this order:\n\n${listLines(lines, totals.currency)}\n\n${listTotals(totals)}\n\nTheir message:\n${message}\n\nWhether to refund is up to you. You can refund from the sale's page: ${saleUrl}`,
    };
  },
};
