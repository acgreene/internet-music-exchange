# Getting Paid

## Purpose

IME takes no platform fee and never holds a seller's money. Every sale is a direct charge to the seller's own connected payment account. This domain covers how artists and designers connect that account, what it must be cleared to do before they can sell, and how the platform stays in sync with the payment provider.

## Roles

- **Managers** connect and monitor their artist's payment account.
- **Designers** connect their own payment account to sell paid designs.
- The **platform** records what the payment provider reports and enforces the charge-eligibility gate.

## Web app

### Connecting a payment account

- To sell anything paid, an artist must connect a payment account through the platform's payment provider (Stripe Connect, using Standard accounts).
- A manager begins onboarding from the artist's dashboard; the provider collects the artist's details and banking information directly.
- An artist has exactly one connected account. If onboarding is abandoned, starting again resumes that same account, picking up where the seller left off.
- The artist's **selling currency** is established from their connected account. This is the currency all of that artist's releases and merch are priced in.
- Artists manage payouts, refunds, disputes, and tax settings in the provider's own dashboard.
- A designer connects a payment account the same way to sell paid designs, priced in the designer's selling currency.

### Account status

- A manager can see their account's onboarding and capability status:
  - whether the account can **accept charges**,
  - whether **payouts** to their bank are enabled,
  - whether the provider's onboarding form is **complete**.
- These states are independent: an account may be cleared to take charges while its payouts are still under review.

### The selling gate

- An artist can put paid releases and merch on sale only once their account is cleared to accept charges.
- Payouts being held for review does **not** block selling; only the ability to accept charges does.
- Free releases need no payment account, but every published release needs funded hosting (see [Funding](./funding.md)).

## Mobile app

- Payment onboarding, account status, and payouts are management concerns and are **not** available on mobile.
- Listeners pay for their purchases through the checkout flow (see [Buying & Checkout](./buying.md)); they do not interact with payout accounts.

## Rules & constraints

- The platform never holds funds from sales. Buyers pay sellers directly; the provider handles the bank payout.
- The artist or designer is the legal seller and is responsible for their own sales tax.
- The capability flags (charges enabled, payouts enabled, details submitted) reflect the provider's decisions. The platform records them from the provider's account-update notifications and does not set them itself.
- Payment provider notifications are processed **once**: a repeated delivery of the same event does no work twice, so ownership and account state are never double-applied.
- Supported currencies are currently USD and EUR.
- Hosting contributions are separate from sales and payouts; they never reduce what a seller is paid (see [Funding](./funding.md)).

## Out of scope / future

- An opt-in for Express accounts, with IME-branded onboarding, for sellers willing to cover its extra fees.
- Multiple payment providers or manual payout methods.
- An artist selling in more than one currency.
- Platform-side ledgers, invoices, or tax reporting for sellers.
- Payout scheduling controlled from within IME.
