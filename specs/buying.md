# Buying & Checkout

## Purpose

This domain covers how a listener buys: the cart, checkout, what they are charged, and the record of what they've bought. Buying is a listener experience and works the same on web and mobile. The seller's side of the same transaction is covered in [Selling & Fulfillment](./selling.md).

## Roles

- **Listeners / buyers** build a cart, check out, pay, and track what they bought.

## How a purchase is structured

- A single checkout is one **order**, the cart a buyer pays for in one session.
- A cart may contain items from more than one artist. Because each artist is paid directly (see [Getting Paid](./getting-paid.md)), the order settles as one charge **per artist**: everything in the cart from a single artist is paid to that artist and shipped by that artist as one package.
- A cart item is either a digital release or a physical merch variant.

## What a listener can do

### Cart & checkout

- A listener can add releases and merch to a cart and check out.
- Free and name-your-price releases are acquired through the same flow; a zero-total acquisition still results in ownership.
- At checkout, the buyer provides a shipping address when the cart contains anything physical. A fully digital cart needs no address.
- The buyer is charged the item subtotal plus shipping plus tax. Shipping is the sum of the artists' per-product rates (see [Merchandise](./merchandise.md)); tax is calculated at checkout.
- Payment for each artist's portion goes directly to that artist.

### Purchase history

- A buyer can see their past purchases, newest first, each showing the artist, what was bought, the amount, and for physical orders, the shipping status and tracking.
- What a buyer comes to own through purchase appears in their library (see
  [Library & Ownership](./library.md)).

## Web & mobile

- Buying, purchase history, and shipment tracking are available on **both web and mobile**, this is a core listener experience.

## Rules & constraints

- A cart item is exactly one thing: a digital release **or** a physical variant.
- A digital release is owned once, it cannot be bought in a quantity greater than one. Only physical items can have quantity.
- Optional to the seller, buying a physical bundle product can grant the buyer the digital download of its linked release.
- Checkout reduces variant stock atomically; a variant that has sold out between browsing and paying fails the checkout rather than overselling.
- A purchase is recorded only after payment settles, and recording is idempotent, a repeated payment notification never creates a second order or double-grants ownership.
- A refund removes what the purchase granted: its ownership and, for merch, its hold on stock (see [Selling & Fulfillment](./selling.md)).
- A buyer sees their own full order; an artist never sees a buyer's purchases from other artists.

## Out of scope / future

- Cancellation of an order before it settles.
- Order editing after purchase.
- Partial (line-level) refunds; refunds are handled per artist portion.
- Saved carts, wishlists, and gifting a purchase to another listener.
