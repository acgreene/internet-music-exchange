# Accounts & Profiles

## Purpose

Every person on IME has one account. An account is the identity a listener uses
to buy and own music, and the identity a person uses to create or manage
artists, build designs, and get paid. This domain covers becoming a user,
signing in, and the public profile a user presents.

## Roles

- **Any visitor** can browse public content without an account.
- **A signed-in user** can buy, own, follow, comment, report, and go on to
  create artists or designs.

## Web app

### Accounts

- A visitor can create an account with an email and password, accepting the
  terms of service and privacy policy.
- A new user verifies their email address before they can sign in.
- A user can sign in with their email and password, and sign out.
- A user who forgets their password can reset it by email.
- Rate limiting protects sign-up and sign-in against abuse, with a clear
  "try again later" message rather than a generic failure.
- A user can permanently delete their account. Deleting an account anonymizes
  the user's past orders rather than erasing the artists' sales records, and
  removes their personal profile, follows, and comments.

### Profile

- Every user has a public profile with a **username** (a unique handle) and an
  optional **display name**.
- A user can edit their username and display name independently.
- A username must be unique among users. The app should tell a user whether a
  username is available before they submit, while still handling the case where
  two people claim the same one at the same moment.
- A user's public profile is reachable at `/users/<username>`.

## Mobile app

- A listener can create an account, verify their email, sign in, sign out, and
  reset their password.
- A listener can view and edit their own profile (username, display name).
- A listener can delete their account.
- Viewing other users' public profiles is supported where they appear (e.g. as
  a commenter or follower).

## Rules & constraints

- An account maps to exactly one identity; a person does not need separate
  accounts to listen, to sell, or to design.
- Email itself is owned by the authentication system, not the public profile;
  usernames and display names are the public-facing identity.
- Account creation is the only entry point. There is no separate "artist
  sign-up" or "designer sign-up": any signed-in user can become an artist (see
  [Artists & Management](./artists.md)) or publish designs (see
  [Creative Pages](./creative-pages.md)).
- Usernames and artist handles are separate: a user and an artist can share the
  same name, since they live under different addresses (`/users/` and
  `/artists/`).
- A user cannot delete their account while they are the last manager of an
  artist. They must first add another manager or delete the artist.
- When a seller deletes their account, any unused prepaid balance is refunded
  (see [Funding](./funding.md)).
- A suspended user keeps their account and library but cannot comment, report,
  publish, or sell (see [Moderation](./moderation.md)).

## Out of scope / future

- Social login (OAuth providers).
- Profile avatars and bios for general users (artists have them; users do not
  yet).
- Changing the email address on an account.
