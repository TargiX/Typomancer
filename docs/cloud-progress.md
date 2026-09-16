# Accounts, cloud progress and recovery

## Architecture

- Vite frontend and Gemini/OG endpoints stay on Vercel.
- `/api/auth/*` and `/api/progress/*` are same-origin HTTPS rewrites to the
  Coolify backend at `typomancer-progress.phosphene.cc`.
- Better Auth 1.7.5 owns password hashing, HttpOnly sessions, CSRF and auth rate
  limits. The API derives ownership from the session, never a supplied user ID.
- PostgreSQL database/role: `narrative_flow`. The role is not a superuser and
  PostgreSQL is not exposed to the internet. Pool limit: 8 connections.
- Backend migrations run under a PostgreSQL advisory lock before listening.
  The Docker container is non-root and capped at 512 MB in Coolify.

## What is saved

Calibration, recent run metrics (WPM, accuracy, consistency, mistakes, duration,
characters), aggregate key/bigram training statistics, upgrades, XP, credits,
preferences and the current daily attempt state. No typed text or narrative is
uploaded. Mid-run checkpoints remain device-local, isolated per account.

The existing analytics UI uses the latest 60 runs. `player_run` additionally
archives every uploaded run without that cap; `/api/progress/export` exports the
authenticated player's full archived history. Pre-account history can only
include the runs still present on the device.

## Local-first and conflicts

Guests keep the original storage keys. Each account has a separate namespace.
Registration offers an explicit checkbox to copy guest progress into a new
account; signing into an existing account does not import someone else's guest
data. Signing out returns to the untouched guest namespace.

Completed results and profile changes sync every three seconds and when the
page becomes hidden or the browser reconnects. This is not a guarantee that a
request will finish on browser termination: unsent data remains locally and is
retried next time. In-flight typing is recorded when the run/drill completes,
not as a server-side keystroke stream.

Saves use a revision compare-and-swap plus a persisted mutation UUID. Lost
responses retry the same mutation; history rows are deduplicated by run ID.
Stale devices cannot silently overwrite cloud saves. Conflict resolution is
explicit; both versions are downloaded and retained in a local recovery key
before replacing either version. There is no automatic merge of credits or
training aggregates (which would double-count overlapping sessions).

Account identity is checked again server-side on every write, protecting
against a session switched by another browser tab. A logged-out/expired session
never uploads another account's cached data.

## Configuration

Backend-only secrets: `DATABASE_URL`, `BETTER_AUTH_SECRET` (32+ random characters).
Canonical frontend URL: `BETTER_AUTH_URL`; additional exact origins in
`AUTH_TRUSTED_ORIGINS`, comma-separated. Do not allow arbitrary preview domains.
`NODE_ENV=production` enables secure cookies. Do not expose secrets with `VITE_`.

Frontend: `VITE_CLOUD_PROGRESS=true` at build time. Local Vite can proxy the API
with `PROGRESS_API_URL`; launch both services through `dev-safe`, using their
actual printed URLs, and add the exact frontend origin to the backend config.

Email verification/password recovery are not enabled until an approved mail
provider is configured. The account form discloses this limitation; use a
password manager. Do not claim that an unverified email proves ownership.

## Backup policy

Coolify resource `apps-postgres`: daily 02:15 UTC, database `narrative_flow`,
PostgreSQL custom-format dumps, retain 7 local backups. This backup includes
accounts, sessions and password hashes; keep storage private. A same-server
dump is **not** disaster recovery. Off-server storage must be configured and
restore-tested separately before claiming protection against server loss.

Keep the Coolify instance database, its APP_KEY/source `.env`, SSH keys and
deployment configuration in a separate private recovery backup too. Application
DB dumps do not contain PostgreSQL cluster roles; recreate the restricted app
role from the secure credential record before restoring into a fresh cluster.

Restore into a disposable, isolated PostgreSQL 18 instance using
`pg_restore --no-owner --no-acl --exit-on-error`, then verify schema and row counts.
Never run a restore rehearsal against the live database. Restore to production
requires stopping writers, backing up the current state, and explicit approval.

## Verification

- `pnpm test`, `pnpm typecheck`, `pnpm build`.
- Disposable DB/API: `PROGRESS_TEST_URL=<printed API URL> pnpm exec tsx --test tests/progress.integration.ts`.
- Browser: `E2E_CLOUD_PROGRESS=true E2E_BASE_URL=<printed frontend URL> pnpm exec playwright test e2e/cloudProgress.spec.ts`.
- OG compatibility: `pnpm exec tsx --test tests/og.integration.ts`.
- Existing gameplay suite: `E2E_BASE_URL=<printed frontend URL> pnpm test:e2e`.

Integration tests create synthetic accounts and must target disposable local
databases. Production smoke tests use explicitly identified synthetic accounts
and must never reuse customer credentials or erase customer rows.
