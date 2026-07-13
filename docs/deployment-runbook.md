# Deployment And Data Refresh Runbook

## Architecture

- GitHub Actions fetches and validates public draft data twice daily.
- Validated aggregate JSON is committed to `main`.
- Vercel deploys each `main` commit.
- GitHub Actions writes rating snapshots to Turso/libSQL.
- `/api/health/data` proves the expected commit and data recency.

## Required Configuration

Use a dedicated Turso group named `fantasy-tiers` and a database named
`fantasy-tiers-history`. Never place this database in `default` or reuse a token
from another group. Preserve the local database by creating the remote from the
ignored SQLite file or by running the idempotent backfill command.

Install these names in GitHub Actions with a write-capable token scoped to only
the `fantasy-tiers` group:

```text
FANTASY_HISTORY_DATABASE_URL
FANTASY_HISTORY_DATABASE_AUTH_TOKEN
```

Vercel does not read rating history and should not have these credentials.
Never put secret values in git, logs, screenshots, plans, or shell history.

Before writing secrets from generated command output, use a fail-fast shell and
assert the URL and tokens are non-empty. A failed database-create command must
stop before any environment variable is changed.

## One-time History Migration

1. Back up `data/fantasy-history.db`.
2. Create the remote database or run `pnpm run history:backfill` with remote env.
3. Run `pnpm run history:migrate` against the remote.
4. Run `pnpm run history:ingest:aggregates` once.
5. Compare remote player, source-run, and version counts with the local source.
6. Confirm the generated `rating-history-dashboard.json` snapshot was updated.
7. Confirm `turso db show fantasy-tiers-history` reports group `fantasy-tiers`.
8. Enable and verify delete protection on `fantasy-tiers-history`.

The backfill refuses a partially populated target. Do not bypass that guard;
restore or create a clean target so primary-key relationships remain valid.

## Release Verification

Before merging or pushing:

```bash
SEASON=2026 pnpm run validate:aggregates:ci
pnpm test
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm run e2e:ci
git diff --check
```

After a data commit, the workflow runs:

```bash
pnpm run verify:deployment -- \
  --base-url https://fantasy-tiers.vercel.app \
  --expected-sha <data-commit-sha> \
  --timeout-seconds 240
```

The verifier is bounded and read-only. It waits for the exact Vercel commit,
requires healthy current data, then parses one aggregate bundle response.

## Failure Recovery

- **Provider response is partial or fenced:** the fetch/quality step fails and
  the last committed aggregate remains deployed. Inspect row and coverage logs;
  do not weaken floors to publish the bad response.
- **`main` advanced during refresh:** rerun the workflow from the new head. Do
  not rebase generated output inside the job.
- **Health reports wrong commit:** wait for the bounded Vercel deployment. If it
  times out, inspect the deployment associated with the expected SHA.
- **History is unconfigured:** install both required variables in GitHub
  Actions. Vercel does not require history credentials.
