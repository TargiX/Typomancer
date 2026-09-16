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

Password recovery uses Resend with runtime-only `RESEND_API_KEY` and
`AUTH_EMAIL_FROM`. The account panel offers a neutral, account-existence-safe
reset request. Links expire after 30 minutes and are single-use; resetting
revokes all existing sessions. The recovery screen removes the token from the
URL, disables telemetry/challenge initialization, and uses a no-referrer policy.
Email verification at signup remains disabled; do not claim that an unverified
email proves ownership. Never log reset links or tokens.

## Backup policy

Coolify resource `apps-postgres`: daily 02:15 UTC, database `narrative_flow`,
PostgreSQL custom-format dumps, retain 7 local backups and up to 30 daily
copies/30 days in private Cloudflare R2 bucket `apps-server-backups` (EU).
Coolify's own DB follows the same retention at 02:45 UTC. These backups include
accounts, sessions and password hashes; keep storage and credentials private.

Keep the Coolify instance database, its APP_KEY/source `.env`, SSH keys and
deployment configuration in a separate private recovery backup too. Application
DB dumps do not contain PostgreSQL cluster roles; recreate the restricted app
role from the secure credential record before restoring into a fresh cluster.

Restore into a disposable, isolated PostgreSQL 18 instance using
`pg_restore --no-owner --no-acl --exit-on-error`, then verify schema and row counts.
Never run a restore rehearsal against the live database. Restore to production
requires stopping writers, backing up the current state, and explicit approval.

### Deployment verification (2026-09-16)

- The Coolify backend is deployed from `Dockerfile.progress` and serves a healthy
  HTTPS `/health`; anonymous progress reads return 401.
- Daily backups are enabled for the application DB (02:15 UTC) and the Coolify
  instance DB (02:45 UTC), each retaining 7 local backups and 30 external copies.
- An application dump was restored with `--exit-on-error` into an isolated
  PostgreSQL 18 container with no network. All seven application/auth tables
  were present. This first rehearsal verified the schema, before real users.
- A bucket-scoped R2 Object Read & Write credential is stored encrypted in
  Coolify. The endpoint uses the EU jurisdiction. Both database dumps were
  uploaded, downloaded from R2, and restored into an isolated PostgreSQL 18
  container. The application had 7 tables; Coolify had the application and both
  backup schedules. The disposable restore container was then removed.
- `apps-recovery-backup.timer` runs at 03:00 UTC (up to 60 seconds jitter).
  It encrypts configuration, APP_KEY, Coolify SSH keys, resource compose files
  and its own recovery job before writing/uploading an archive. It retains 7
  days locally and 30 archives under the R2 `recovery/` prefix. Upload success
  requires a positive completion marker and matching remote object size.
- The RSA private decryption key is deliberately **not on the server**. Its
  secure local path is recorded in the private Obsidian infrastructure note.
  Preserve that key independently; database backups do not replace it.
  A downloaded encrypted archive was successfully decrypted and its contents
  verified. Never extract recovery archives over a running installation.
- Team notification settings use Resend directly for database backup failures;
  recipients are the Coolify team members (currently the owner). Success emails
  are disabled. `apps-recovery-backup.service` has an `OnFailure` hook to
  `apps-recovery-alert.service` for encrypted configuration backup failures.
  The latter retries delivery three times and includes no secrets/log output.
  These alerts require the server, Docker, Coolify and internet to be available;
  they are not an independent off-server heartbeat monitor.
- Vercel OG functions use a plain `.ts` entrypoint and `React.createElement`.
  A `.tsx` entrypoint was incorrectly loaded as CommonJS, and a `.js` import of
  a `.tsx` renderer was not traced. A deployed preview now returns a real
  1200x630 PNG; local rendering tests alone did not catch this packaging issue.

## Verification

- `pnpm test`, `pnpm typecheck`, `pnpm build`.
- Disposable DB/API: `PROGRESS_TEST_URL=<printed API URL> pnpm exec tsx --test tests/progress.integration.ts`.
- Browser: `E2E_CLOUD_PROGRESS=true E2E_BASE_URL=<printed frontend URL> pnpm exec playwright test e2e/cloudProgress.spec.ts`.
- OG compatibility: `pnpm exec tsx --test tests/og.integration.ts`.
- Existing gameplay suite: `E2E_BASE_URL=<printed frontend URL> pnpm test:e2e`.

Integration tests create synthetic accounts and must target disposable local
databases. Production smoke tests use explicitly identified synthetic accounts
and must never reuse customer credentials or erase customer rows.
