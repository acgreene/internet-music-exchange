# Selling & Fulfillment

## Purpose

This domain covers the artist's side of a sale: seeing what sold, shipping physical goods, and tracking sales totals. It is the seller's view of the same transactions a listener creates by [buying](./buying.md). Selling is an artist management concern and is **web-only**.

## Roles

- **Managers** see their artist's sales, fulfill physical orders, and review totals.

## What a manager can do

### Sales

- A manager can see their artist's sales, newest first, with the buyer and the shipping address for each one.
- A manager sees only their own artist's portion of any order, never a buyer's purchases from other artists.
- A manager can see settled sales totals for their artist, broken out per currency.

### Fulfillment

- A physical sale has a shipping status: **unfulfilled → shipped → delivered**.
- A manager can see the sales that are paid and still need shipping, oldest first, so the longest-waiting order is packed next.
- A manager marks an order shipped, recording a tracking number and carrier.
- A manager can mark a shipped order delivered.
- Digital-only sales have nothing to fulfill.

## Mobile app

- The seller-side experience, sales, fulfillment, and totals, is **not**
  available on mobile. Selling is web-only.

## Rules & constraints

- A manager acts only on their own artist's sales.
- Shipping information (tracking, carrier) is recorded when a manager marks an order shipped; a shipped or delivered order always carries its ship date.
- A refund of a sale removes the buyer's ownership of any digital items it granted and returns its physical units to stock (see
  [Buying & Checkout](./buying.md)).
- Sales totals reflect settled sales only, and are always presented within a single currency since an artist sells in one currency.

## Out of scope / future

- Partial shipments and split fulfillment of a single order.
- Partial (line-level) refunds; refunds are handled per artist portion.
- Shipping-label purchase and carrier integrations.
- Exporting sales data and accounting reports.
