# Accounts & Profiles

## Purpose

Every person on IME has one account. An account is the identity a listener uses
to buy and own music, and the identity a person uses to create or manage
artists, build designs, and get paid. This domain covers becoming a user,
signing in, and the public profile a user presents.

## Roles

- **Any visitor** can browse public content without an account.
- **A signed-in user** can buy, own, follow, comment, and go on to create
  artists or designs.

## Web app

### Accounts

- A visitor can create an account with an email and password.
- A user can sign in with their email and password, and sign out.
- Rate limiting protects sign-up and sign-in against abuse, with a clear
  "try again later" message rather than a generic failure.
- A user can permanently delete their account. Deleting an account anonymizes
  the user's past orders rather than erasing the artists' sales records, and
  removes their personal profile, follows, and comments.

### Profile

- Every user has a public profile with a **username** (a unique handle) and an
  optional **display name**.
- A user can edit their username and display name independently.
- A username must be unique across the platform. The app should tell a user
  whether a handle is available before they submit, while still handling the
  case where two people claim the same handle at the same moment.
- A user's public profile is reachable by their username.

## Mobile app

- A listener can create an account, sign in, and sign out.
- A listener can view and edit their own profile (username, display name).
- A listener can delete their account.
- Viewing other users' public profiles is supported where they appear (e.g. as
  a commenter or follower).

## Rules & constraints

- An account maps to exactly one identity; a person does not need separate
  accounts to listen versus to sell.
- Email itself is owned by the authentication system, not the public profile;
  usernames and display names are the public-facing identity.
- Account creation is the only entry point — there is no separate "artist
  sign-up." Any signed-in user can become an artist (see
  [Artists & Management](./artists.md)).

## Out of scope / future

- Social login (OAuth providers).
- Profile avatars and bios for general users (artists have bios; users do not yet).
- Email change and password reset flows are assumed handled by the auth system
  and are not specified here.
