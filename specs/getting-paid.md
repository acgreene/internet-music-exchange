# Getting Paid

## Purpose

IME takes no platform fee and never holds an artist's money. Every sale is a direct charge to the artist's own connected payment account. This domain covers how an artist connects that account, what it must be cleared to do before they can sell, and how the platform stays in sync with the payment provider.

## Roles

- **Managers** connect and monitor the artist's payment account.
- The **platform** records what the payment provider reports and enforces the charge-eligibility gate.

## Web app

### Connecting a payment account

- To sell anything, an artist must connect a payment account through the platform's payment provider (Stripe Connect).
- A manager begins onboarding from the artist's dashboard; the provider collects the artist's details and banking information directly.
- An artist has exactly one connected account. If onboarding is abandoned and restarted, the artist's record points at the new account.
- The artist's **selling currency** is established from their connected account. This is the currency all of that artist's releases and merch are priced in.

### Account status

- A manager can see their account's onboarding and capability status:
  - whether the account can **accept charges**,
  - whether **payouts** to their bank are enabled,
  - whether the provider's onboarding form is **complete**.
- These states are independent: an account may be cleared to take charges while its payouts are still under review.

### The selling gate

- An artist can list releases and merch for sale only once their account is cleared to accept charges.
- Payouts being held for review does **not** block selling, only the ability to accept charges does.

## Mobile app

- Payment onboarding, account status, and payouts are artist-management concerns and are **not** available on mobile.
- Listeners pay for their purchases through the checkout flow (see
  [Buying & Checkout](./buying.md)); they do not interact with payout accounts.

## Rules & constraints

- The platform never holds funds. Buyers pay artists directly; the provider handles the bank payout.
- The capability flags (charges enabled, payouts enabled, details submitted)
  reflect the provider's decisions. The platform records them from the provider's account-update notifications and does not set them itself.
- Payment provider notifications are processed **once**: a repeated delivery of the same event does no work twice, so ownership and account state are never double-applied.
- Supported currencies are currently USD and EUR.

## Out of scope / future

- Multiple payment providers or manual payout methods.
- An artist selling in more than one currency.
- Platform-side ledgers, invoices, or tax reporting for artists.
- Payout scheduling controlled from within IME.
