# Principal, delegated administration and platform settings

## Authority

Maat-test initializes the confirmed `quatrosus@gmail.com` account as principal.
The principal is then identified by its Auth UUID; changing an email does not
transfer authority. The compatibility allowlist follows admin email changes so
existing deletion and moderation guards continue protecting administrator accounts.

Only the principal appoints, changes or revokes delegated administrators. No
delegated permission grants principal-management authority. Management is private
SQL behind a service-only RPC and an authenticated Edge endpoint. Authorization
uses Auth `getUser`, live `auth.sessions`, and live role records, not user metadata.

Role changes require a sign-in within ten minutes, a 10–500 character reason,
explicit UI confirmation and matching version. The principal cannot be revoked.
Pending deletion accounts must cancel deletion before being appointed. Transfer
requires an existing eligible administrator and explicit successor acceptance
within 24 hours; the principal can cancel before acceptance. All changes are
transactionally recorded in a private access journal.

Permissions: overview, users_read, users_manage, teams_read, audit_read,
settings_read, settings_manage. Management permissions also include their
corresponding read permission. Moderation rechecks permissions in the transaction
to coordinate with revocation and permission changes.

## Platform settings versus personal preferences

The console publishes a public contact email and a plain-text announcement.
Both are deliberately readable by all application visitors and displayed in the
shared header. Do not put secrets or personal/confidential information there.
The settings editor checks permission, recent sign-in and optimistic versioning;
updates are logged. An empty announcement hides the banner. Profile, avatar,
password and personal preferences remain at `/admin/settings` for admins and
`/settings` for standard accounts.

## Supervision and navigation

Team search runs in SQL before 50-row pagination. Name, owner email, team ID and
owner ID are searchable; wildcard characters are literal, not query syntax.
The service-only RPC delegates its Auth owner lookup to a private privileged
function; the public wrapper itself does not bypass authorization.

Admin routes wait for session restoration and check server authorization.
Guests go to login; unauthorized accounts get an explicit refusal page with a
return to their personal workspace. The console only shows authorized sections.
Sensitive endpoint permissions remain enforced independently of the UI.

## Verification, 2026-10-11

- 19 Angular admin/access/route tests passed with ChromeHeadlessSandbox.
- Edge and UI Node tests passed; Angular application type/template check passed.
- SQL rollback tests passed for principal protection, delegated self-promotion
  rejection, successor acceptance, fresh sign-in, revoked sessions, moderation
  permission checks, settings persistence and concurrent-update rejection.
- Browser preview verified principal identification, protected target exclusion,
  disabled unconfirmed actions, owner search, empty search, team detail and public
  versus personal settings. Mobile at 390px showed no horizontal overflow; light
  and dark presentation checked. Final preview also verified the principal's
  protected route, Escape on the mobile button and focus returning to the team opener.
- No real successor was appointed; no principal transfer or public announcement
  was performed. Production was not modified.

Supabase advisors report three informational notices for private role tables
with intentionally no client policies (deny by default). Existing public team
SECURITY DEFINER notices and disabled leaked-password protection predate this
change and need a separate Auth/team-security review; this is not a claim that
the entire project's security advisories are cleared.
