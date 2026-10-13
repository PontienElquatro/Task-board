# Dependency security remediation

Scope: `codex/cloud-admin`, following backup commit `d4eaa26`. No production
deployment, default-branch merge or database/account change is included.

## Findings and remediation

GitHub reported 137 alerts on `main`, which uses a different lockfile. The
initial branch npm audit reported 26 affected packages (3 critical, 21 high,
2 moderate). An initial Angular 20 patch reduced this to 12 high findings,
all deriving from the unpatched `braces` advisory GHSA-vfj7-8cjw-p6xm.

The final dependency set replaces the legacy build adapter and Karma with
`@angular/build` and Vitest. Angular framework/compiler are pinned to 21.2.25,
CLI/build/SSR to 21.2.26, CDK to 21.2.14, Vitest and its browser adapter to
4.1.11, and Playwright to 1.64.0. The retained cache-policy override is 4.3.0.
An intermediate Vitest 3 candidate was rejected after audit exposed additional
advisories. No vulnerable-package alert is suppressed or dismissed.

On 13 October 2026, the final full `npm audit --package-lock-only --json`
completed successfully with zero affected packages at every severity. This is
not a claim that every application-level security weakness has been eliminated.
The lock check also verifies patched versions and absence of the retired
dependency chains, including braces, Karma, SockJS and Tinypool.

## Verification

Dependencies are installed only in the owned, ignored verification copy:
`tmp/security-verification-fd0657523e554d5db7a87d8bb3fd81f6`. The root
`node_modules` junction is shared with another checkout and is not modified.

- Manifest/lock checks and four dependency API/regression tests passed.
- Three migration-converter tests passed.
- Mechanical conversion covered 34 spec files, retaining 160 tests and
  366 assertions. Application zone-based change detection is preserved.
- Final TypeScript checking (`tsc --project tsconfig.spec.json --noEmit`) passed.
- Browser suite and production build verification remain blocked in the agent
  sandbox: esbuild cannot read an ancestor directory (`C:/Users/DELL`). A retry
  after an approved read permission produced the same failure, before tests ran.
  User-terminal verification is required; no final browser/build success is claimed.
- The user-terminal attempt compiled all 34 spec files, but Vitest timed out
  waiting for its browser session before running any test. Because commands were
  chained with `&&`, the subsequent production build did not run.
- A standalone Chromium diagnostic passed in the agent environment (browser
  launch, loopback HTTP, JavaScript and WebSocket). This does not prove that the
  user's Vitest session works. Runner configuration now binds browser traffic to
  127.0.0.1, executes files sequentially, and allows a bounded 180-second browser
  connection timeout. Test assertions/timeouts and error handling are not relaxed.
- After that configuration update, the user-terminal Chromium diagnostic passed
  and `checkpoint-recovery.spec.ts` completed: 1 file, 5 tests passed. This
  validates the focused browser path, not the full 160-test suite or production
  build. Bash reported stray pasted characters outside the successfully executed
  commands; no test failure is inferred from those shell messages.
- The subsequent user-run full suite executed all 160 tests: 158 passed and
  2 failed. Dashboard's empty-state fixture omitted STORAGE_PROVIDER; navigation
  still expected seven mobile links before `/team-projects` was added. The
  fixtures are corrected with isolated in-memory storage and explicit validation
  of all eight mobile destinations. No production component or assertion is
  removed. A rerun and production build are still required.

## Final user-terminal validation — 13 October 2026

The corrected final candidate completed all 34 spec files and all 160 tests
successfully in Chromium. The production build then completed successfully and
the built-CSS check confirmed calendar, controls, layout and dark-mode utilities.
The build reported an initial bundle of 774.31 kB (183.12 kB estimated transfer),
including 131.98 kB of global CSS. The existing 500 kB warning budget remains
exceeded; no budget was raised to hide this warning. Performance optimization
is separate from dependency-vulnerability remediation.

The historical failed attempts above describe the troubleshooting sequence;
they are superseded by this final successful user-terminal validation. No
production deployment or default-branch merge was performed.

The earlier Angular 20 candidate passed four dependency tests, 45 backup tests
and a build in the user's terminal; these are not proof for the final Angular
21 dependency set. The earlier copy omitted `.postcssrc.json`, producing an
artificial CSS-size reduction. The current copy includes it and uses explicit
Tailwind source detection; a built-CSS sentinel check must pass.

CI runs the full audit, lock checks, dependency tests, browser tests and build.
Project-supported Node versions remain 22.12+ and 24; the local Node 26 warning
does not change that support declaration. CI uses Node 24.

GitHub default-branch alerts require a separately approved merge to `main` and
Dependabot re-analysis. A development-branch push alone cannot close them.
