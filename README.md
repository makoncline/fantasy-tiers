# Fantasy Tiers

Personal fantasy-football draft and league-management tools built with Next.js.
The main surfaces are `/draft-assistant`, `/mock-draft`, `/league-manager`, and
`/rating-history`.

Read `docs/project-context.md` before changing data or draft behavior. Read
`docs/draft-assistant-runbook.md` before controlling a Sleeper mock.

## Local Development

```bash
pnpm install
pnpm run dev
```

The app defaults rating history to the ignored local database at
`data/fantasy-history.db` outside production.

## Draft Data

The draft assistant uses 2026 FantasyPros ECR, Sleeper ADP/player data, tiers
generated locally from ECR, and a compact Footballguys public-default comparison
artifact. Draft recommendations do not require point projections. Raw provider
responses remain local and ignored by git.

Run a complete refresh with:

```bash
SEASON=2026 DRAFT=true FP_FETCH_PROJECTIONS=false pnpm run fetch:all
pnpm run agg:all
SEASON=2026 pnpm run validate:aggregates:ci
```

The semantic validator writes
`public/data/aggregate/quality-report.json` and blocks partial or stale source
responses before publication. Position tables always consume their dedicated
QB/RB/WR/TE/K/DEF/FLEX shards, not filtered ALL data.

## Automated Updates

`.github/workflows/fetch-data.yml` runs at 12:00 and 21:00 UTC and can also be
started manually. It:

1. Fetches 2026 draft ECR and Sleeper data.
2. Generates local tiers and aggregate shards.
3. Runs semantic quality checks and focused contract tests.
4. Writes the snapshot to persistent rating history.
5. Commits only validated aggregate artifacts.
6. Waits for Vercel to serve that exact commit and verifies data health.

The workflow aborts if `main` advances while it is running. It never rebases
stale generated output over newer source code.

## Rating History

Production uses `fantasy-tiers-history` in the dedicated `fantasy-tiers` Turso
group. Configure the same database URL in GitHub Actions and Vercel, using a
group-scoped write token for Actions and a separate group-scoped read-only token
for Vercel. Do not use the Turso `default` group or credentials shared with
another application:

```text
FANTASY_HISTORY_DATABASE_URL
FANTASY_HISTORY_DATABASE_AUTH_TOKEN
```

Useful commands:

```bash
pnpm run history:migrate
pnpm run history:ingest:aggregates
pnpm run history:backfill
```

`history:backfill` defaults to the ignored local SQLite database as its source
and requires explicit remote target credentials. It refuses to merge into a
partially populated target because source-run and version IDs must remain
consistent.

See `docs/deployment-runbook.md` for provisioning, verification, and recovery.

## Verification

```bash
pnpm test
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm run e2e:ci
```

`GET /api/health/data` is read-only and uncached. It reports the deployed commit,
committed source quality, and whether rating history is configured/queryable.
It does not expose credentials, database URLs, SQL, or provider payloads.
