# Backup and synchronisation reliability

Scope: local development and Maat-test preview only. Production data and schema
are unchanged. The previous collaboration block was pushed as `bc1229d`.

## Changes

- Device exports include the displayed workspace before awaiting storage, even
  when IndexedDB is unavailable. Missing or malformed sources are recorded in
  the archive's `unavailable` field without aborting readable data exports.
- Export waits for IndexedDB are bounded. The JSON download has a persistent
  retry link; its Blob URL is revoked on replacement, account change or teardown.
- Empty and deliberately cleared task collections are accepted; malformed tasks
  and archives belonging to another account remain rejected.
- Different pending checkpoints block automatic recovery/upload when the shared
  cache is missing. All versions remain available for export and manual review.
- Local deletion uses stale-tab checks and checkpoints, just like an edit.

## Recovery limits

Guided recovery adds absent tasks only. Existing task IDs, projects and goals
are not overwritten. Archives keep full workspace snapshots for manual review;
this is not an automatic whole-workspace restore feature.
These archives cover the personal/local board, not a separate team-data export.
Do not clear real browser storage or overwrite real cloud data to test recovery.

## Verification

`database/test-sync-recovery.sql` passed on Maat-test: stale revisions, preserved
content, account isolation, invalid payloads, suspension and anonymous access.
All Auth, workspace and account-status fixtures were rolled back.
Fifteen independent checkpoint-recovery assertions passed against the actual code.
The final Vercel preview build is READY; compilation does not prove unit tests.

The user confirmed the JSON download from the final preview.
The user-run targeted Angular suite passed: 45 of 45 tests in ChromeHeadless,
with test bundle generation in 9.869 seconds on 12 October 2026.
Preview: https://task-board-v1-4o2udbnp2-pontien-misengas-projects.vercel.app/board.

## Local runner recovery

Four local TypeScript files were found to contain only NUL bytes. They were
reconstructed from intact Git versions with the backup changes and regression
tests reapplied; the cause of the local corruption has not been established.
The recovered files pass the scoped TypeScript check, and all fifteen standalone
checkpoint assertions pass again. The user-run full build after recovery passed
on 12 October 2026 in 54.865 seconds with output in
`dist/backup-sync-final-check`. The initial bundle is 727.53 kB, above the 500 kB
warning budget but below the configured error budget; optimization remains
separate follow-up work.

Run `npm.cmd run test:backup` for the five targeted suites. This opt-in Angular
application-mode runner uses a scoped TypeScript program, no global styles or
assets, and no source maps; the default CI suite is unchanged. It does not replace
visual verification. In the Codex sandbox it currently fails on ancestor-directory
access before launching Chrome. The same command passed outside that sandbox
in the user's Git Bash terminal (45 tests); this is user-provided evidence.
The installed Node 26 is outside the project's declared Node 22/24 engines.
