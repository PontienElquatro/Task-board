# Remaining administration work

The confirmed initial principal is quatrosus@gmail.com. Its authority must be
stored against the confirmed Auth user ID, never user-editable metadata or email
alone. Production must not be changed during preview validation.

## Acceptance checklist

- [x] Principal-only appointment, permission changes and revocation, enforced by
  the server and database, not merely hidden buttons.
- [x] Scoped permissions: overview, user consultation, account moderation,
  collaboration consultation, audit consultation, platform settings.
- [x] Principal transfer: recent sign-in, confirmed eligible existing admin,
  explicit successor acceptance, expiry, cancellation and transactional audit.
- [x] Protect every administrator against account suspension and deletion;
  protect the sole principal against revocation even under concurrent requests.
- [x] Recheck live session and live role on sensitive calls; rejected stale
  requests after revocation must not expose directory data.
- [x] Team search is global, before pagination, and supports owner/name/ID;
  detail, empty state, retry and stale-response tests.
- [x] Platform settings are actually persisted and consumed by the application;
  personal preferences remain clearly separate.
- [x] Missing navigation, forbidden access, error and confirmation paths checked.
- [x] Standard versus delegated versus principal test matrix; mobile, keyboard,
  dark theme and preview validation.

Final preview: https://task-board-v1-5imdyb6kh-pontien-misengas-projects.vercel.app/admin.
Principal sign-in and protected navigation were verified, including Escape on
the mobile menu and focus returning to the team opener after dialog closure.
19 Angular tests, Edge/UI checks and transactional SQL rollback suites passed.
Production remains unchanged; no real successor was appointed.

## Already verified before this work

CSV download was confirmed by the user. Admin history filters and pagination
have server-side tests. Deferred account deletion has its own tested lifecycle.
These do not constitute validation of the remaining roles/access work.
