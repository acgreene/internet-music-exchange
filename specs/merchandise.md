# Merchandise

## Purpose

Alongside digital music, artists sell physical goods such as vinyl, CDs, cassettes, apparel, and other merch. This domain covers building a product, its buyable variants, stock, imagery, and shipping rates.

## Roles

- **Managers** create and manage products.
- **Listeners** browse and buy merch.

## Web app

### Products

- A manager can create a physical product with a name, a type (vinyl, CD, cassette, shirt, hoodie, sweatshirt, hat, beanie, other), an optional description, and the artist's selling currency.
- A product starts as a **draft**, visible only to managers, and is published to appear in the public store.
- A product can be linked to a release (e.g. the vinyl edition of an album) or stand alone, like a logo tee.
- A product can be sold as a **bundle**: buying it also grants the digital download of its linked release ("buy the vinyl, get the download"). A bundle must be linked to a release.
- A manager can archive a product to pull it from sale while keeping it for the orders that reference it.

### Variants

- The buyable units of a product are its **variants**, one per combination of the product's option axes (e.g. Size + Color). A product with no options still has a single default variant.
- Each variant has its own price and its own stock count, and may carry an optional SKU.
- A manager can add, edit, and remove variants, and set a variant's stock directly (e.g. when restocking).
- No two variants of a product may share the same option combination.
- A product cannot be published until it has at least one variant, there must be something to buy.

### Images

- A product has a gallery of photos, shown in order.
- An image can be general to the product or specific to one variant.

### Shipping

- Because the platform does not calculate shipping, the artist sets flat rates per product.
- Rates are defined per destination zone: **domestic** (the artist's own country) and **international** (everywhere else).
- Each rate specifies a cost for the first unit and a cost for each additional unit of that product.
- At checkout, shipping is summed across the cart's products and charged to the buyer (see [Buying & Checkout](./buying.md)).

## Mobile app

- A listener can browse an artist's store and open a product to see its variants, photos, and price.
- A listener can add merch to their cart and buy it (see
  [Buying & Checkout](./buying.md)).
- A listener can track shipment of merch they've bought.
- Product creation and management are **not** available on mobile.

## Rules & constraints

- A published product always has at least one variant.
- Stock is never negative. A purchase reduces stock atomically at checkout, so the last unit cannot be sold twice; a refund returns the units to stock.
- Archiving keeps a product and its variants intact for historical orders; it does not delete them. A product or variant that has sold cannot be deleted.
- Every product is priced in the artist's single selling currency.
- A digital-bundle product must be tied to the release whose download it grants.

## Out of scope / future

- Platform-calculated / carrier-rated shipping.
- Weight- or dimension-based shipping.
- Inventory across warehouses or fulfillment partners.
- Discounts, coupons, and bundles beyond the digital-download bundle.
