# Team security and reliability

## Scope

Changes are applied to Maat-test only. Production is unchanged. Platform admin
permissions and team roles are separate: platform administrators do not gain
membership or access to private team content through these collaboration RPCs.

## Protections

- A team and its owner membership are created in the same database transaction.
  Direct client membership insertion is disabled; role changes use the guarded RPC.
- Eight public RPCs keep their signatures but are now invoker-only wrappers.
  Privileged implementations are in the unexposed `maat_private` schema, with
  explicit grants, fixed search paths and their existing authorization guards.
- Invitations require an active, confirmed account and the current Auth email.
  The issuer must still have authority at acceptance; revoked or suspended issuers
  cannot leave usable invitations behind. Replaying an accepted invitation cannot
  restore membership after removal. Existing membership roles are never overwritten.
- Acceptance, cancellation and membership changes lock the team first, avoiding
  opposing team/invitation lock orders. This is not a claim of a parallel stress test.
- Client-created invitations cannot be accepted already, expire beyond seven days,
  or use weak tokens. The application generates 72-character random tokens.
- Email links allow only the canonical application, this project's preview hosts,
  or HTTPS origins explicitly configured in `APP_ALLOWED_ORIGINS`. Team name comes
  from the database, not client input. HTML attributes are escaped; provider errors
  do not expose raw response bodies. Resend idempotency keys prevent duplicate
  delivery within its documented 24-hour window.
- An uncertain email response keeps the pending invitation visible; it is not
  automatically cancelled when a request might have succeeded. The user can cancel
  it explicitly before creating a replacement.
- Team caches clear on account change. Overlapping loads publish only the newest
  result; roster/invitation errors do not publish a partial state.

## Verification

`database/test-team-security.sql` creates disposable fixtures and rolls back.
It tests role limits, cross-team project/profile isolation, owner registration,
issuer removal, recipient identity, invitation lifetime, idempotent acceptance,
membership removal and public function grants.

`tools/test-team-invitation-edge.mjs` tests the email handler without sending real
email. `src/app/services/team.service.spec.ts` covers stale responses, sign-out,
creation, invalid names, partial failures and uncertain email delivery.

SQL matrix and email handler tests passed. Seven Angular reliability tests and
application type/template checking passed. Admin access, directory and settings
SQL regression suites also passed, with all fixtures rolled back.

Final preview build is READY:
https://task-board-v1-ad1xdcta0-pontien-misengas-projects.vercel.app/team.
Signed-in browser verification loaded TheDev, the owner, reader and invitation
history, and opened the member management controls without changing real access.
The shared project board also loaded all six existing tasks and connected to
Realtime, displaying five completed tasks and 83% progress without an error.
No real email or membership mutation was performed during browser validation.

The eight previous public SECURITY DEFINER warnings are cleared on Maat-test.
Three informational private admin-table notices are intentional deny-by-default
policies. The existing [leaked-password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
is outside this collaboration block and remains open.

## Deployment order

Apply `database/team-security-hardening.sql`, deploy the email function, then deploy
the client. Older clients that try a second owner-membership insert must be updated.
Do not replay older team/security SQL scripts after this migration: they define
the earlier public privileged functions. Production release requires its own approval.
