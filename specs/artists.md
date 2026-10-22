# Artists & Management

## Purpose

An artist is the selling identity on IME: the entity that publishes releases, sells merch, and receives payment. This domain covers the artist profile, the users trusted to manage it, and how listeners encounter an artist.

## Roles

- **Any signed-in user** can create an artist.
- **An artist manager** is a user permitted to act on an artist's behalf: edit the profile, publish releases and merch, set pricing, apply page designs, fulfill orders, and share the artist's hosting costs.
- **A listener** views artist profiles and follows them.

## Web app

### Creating and managing an artist

- Any signed-in user can create an artist profile. The creator automatically becomes its first manager.
- An artist has a **name**, a unique **handle**, and optionally a **bio**, an **avatar**, a **header image**, a list of **links** (website, social profiles, and so on), and **where it is based**: a country, and optionally a city in it. Listeners can search and browse by where artists are based (see [Discovery](./discovery.md)).
- An artist's profile is reachable at `/artists/<handle>`.
- A handle must be unique among artists. The app tells a manager whether a handle is available before they submit, while still handling the case where two people claim the same one at the same moment.
- Any manager of an artist can edit its name, handle, bio, where it is based, avatar, header image, and links.
- A user can manage more than one artist, and can switch between the artists they manage.

### Managers

- An artist can have several managers, all with equal authority.
- An existing manager can add another user as a manager, found by username.
- A manager can remove another manager, or remove themselves.
- An artist can never be left with zero managers: the last remaining manager cannot be removed, and cannot delete their account while they are the last manager. (Either would leave the artist unmanageable.)
- Managers can see the other managers of an artist they manage.
- The managers decide how the artist's hosting costs are split between them (see [Funding](./funding.md)).

### Follower management

- A manager can see who follows their artist.
- A manager can remove a follower.

## Mobile app

- A listener can view an artist's public profile: name, where it is based, avatar, header image, bio, links, discography, and merch.
- A listener can follow and unfollow an artist (see [Community](./community.md)).
- Artist creation and management are **not** available on mobile.

## Rules & constraints

- Artist management is a shared, flat role: there is no "owner" above the other managers. Any manager can do anything another manager can, including adding and removing managers.
- An artist cannot be deleted while it still has releases, tracks, merch, or recorded sales: its catalog and history keep it alive.
- Avatar and header images are uploaded to IME.
- The artist's selling currency is not set here; it is established when the artist onboards for payments (see [Getting Paid](./getting-paid.md)).
- An artist can be suspended by platform admins (see [Moderation](./moderation.md)).

## Out of scope / future

- Distinct manager permission tiers (e.g. an owner vs. limited collaborators).
- Transferring an artist to a different set of managers as a single action.
- Verified artist badges.
