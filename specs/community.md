# Community

## Purpose

Social features connect listeners to the artists and releases they care about. This domain covers following artists, the feed of new music that following produces, and commenting on releases.

## Roles

- **Listeners** follow artists, read their feed, and comment.
- **Managers** moderate comments and followers on their own artist.

## Web app

### Following

- A listener can follow and unfollow an artist.
- A listener can see the artists they follow.
- An artist's follower count is public.
- On any page showing several artists, a listener can see at a glance which they already follow.

### The feed

- Following an artist produces a feed: the newest published releases from the artists a listener follows, most recently published first.
- The feed is the payoff of following, it is how a listener keeps up with the artists they care about.

### Comments

- A listener can comment on a release.
- A release's comments are shown newest first, each with its author and whether it has been edited.
- A listener can edit and delete their own comments.
- A comment cannot be empty and has a maximum length.
- A manager can delete comments on their own artist's releases (moderation).

## Mobile app

- A listener has full social access: follow and unfollow artists, browse their feed, and read, post, edit, and delete their own comments.
- Manager moderation of comments and followers is **not** available on mobile.

## Rules & constraints

- Following is public: an artist can see who follows them, and a manager can remove a follower.
- A listener follows an artist at most once.
- Comments carry an edited/original distinction so an edited comment can be told apart from its original.
- Comment authorship is enforced: a listener can only edit or delete their own comments, though managers can remove comments on their artist as moderation.
- Any signed-in user can report a comment, and platform admins can delete it or suspend its author (see [Moderation](./moderation.md)).

## Out of scope / future

- Following other listeners, or any listener-to-listener social graph.
- Replies / threaded comments, likes, or reactions.
- Notifications and activity feeds beyond new-release following. (Transactional emails, such as receipts and shipping notices, are covered in the domains that send them.)
- Sharing and reposting.
