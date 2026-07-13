# Fantasy Tiers Project Context

Last updated: 2026-07-13

This document is a fast orientation guide for agents working on this repo. Read it after `AGENTS.md`.

## Product Purpose

Fantasy Tiers is a personal fantasy football draft and league management app. The main user wants to use it to prepare for the new season, manage drafts, inspect Sleeper leagues, compare player rankings, and make roster decisions. A few other people may use it, but it is primarily optimized for the owner's workflow rather than a broad SaaS audience.

The app should help answer questions like:

- Who should I draft now?
- Which positions are getting scarce?
- Is this player a value compared with ADP or expert rankings?
- Which roster spots are weak?
- Is a player actually droppable, or are they temporarily suppressed by bye week, injury, or weekly-ranking context?
- Which data source is fresh, stale, or missing?

## Current App Surfaces

- `/` is a home hub linking to the two main tools.
- `/draft-assistant` is enabled again. It is the live draft room surface.
- `/mock-draft` is a development-only seeded mock draft room. It uses bot teams, the live Sleeper Zod schemas, and the shared draft view-model path so agents can tune draft-assistant decisions locally without opening Sleeper. It is intentionally hidden from the home page; the route and its result-saving API return 404 in production.
- `/league-manager` loads Sleeper user/league data and evaluates roster quality.
- API routes under `/api/*` serve aggregate shards, bundles, rankings, draft view-models, Sleeper data, freshness metadata, and local mock draft result artifacts.

The old root page was API usage text. It has been replaced with a product entry page.

## Stack And Conventions

- Next.js App Router, React 19, TypeScript, Tailwind v4.
- shadcn/ui primitives live under `src/components/ui`.
- React Query is the expected data-fetching layer.
- Zod should validate external boundaries and derive types where practical.
- Tests use Vitest for unit/integration coverage and Playwright for browser coverage.
- Follow `AGENTS.md`: use shadcn, React Query, Zod, narrow casts only when unavoidable, and focused integration-heavy tests.

## Data Sources

The core sources today are:

- Sleeper: public API for users, leagues, drafts, picks, player metadata, and projections.
- FantasyPros: scraped rankings/projections, including draft and weekly modes.
- Tiers: tier CSV rankings generated locally from current FantasyPros draft ECR.

Possible future sources discussed:

- Vegas odds.
- Prediction market sites.
- Other ranking sites.
- Player news feeds.

The key architectural need is a source model that can grow beyond the current three sources without hard-coding every new provider into the UI and aggregate schemas.

## Data Pipeline

Important commands:

```bash
pnpm run fetch:all
pnpm run agg:all
pnpm run validate:aggregates:ci
```

Scheduled draft refreshes set `SEASON=2026`, `DRAFT=true`, and
`FP_FETCH_PROJECTIONS=false`. Semantic validation writes the committed
`public/data/aggregate/quality-report.json` and fails closed on short ECR,
collapsed draft-relevant ADP/tier coverage, stale sources, wrong mode/season,
or large regressions from the prior healthy report.

Source fetchers and aggregators live in:

- `scripts/sleeper/fetchProjections.ts`
- `scripts/fp/fetch-fantasypros-all.ts`
- `scripts/fp/scrape-fantasypros.ts`
- `scripts/fp/scrape-ecr-adp.ts`
- `scripts/fp/aggregate-fantasypros.ts`
- `scripts/aggregate/buildCombinedAggregate.ts`

### FantasyPros 2026 Notes

As of 2026-06-30, FantasyPros draft ECR is still publicly fetchable and is the reliable scheduled source for 2026 draft rankings:

```bash
DRAFT=true pnpm run fetch:fp
pnpm run agg:fp
pnpm run agg:combine
pnpm run validate:aggregates
```

The draft fetch writes `public/data/fantasypros/raw/fetch-mode.json`. The aggregator uses that marker so a fresh draft fetch does not accidentally prefer stale weekly raw files from a previous season.

FantasyPros projection pages are less reliable for scheduled scraping. The same page can show a full table in the user's Chrome session while an unauthenticated Node/curl request returns a short registration-fenced table. For that reason, draft fetch skips projections by default and records `projectionsFetched: false`. Set `FP_FETCH_PROJECTIONS=true` only when intentionally testing projection scraping; the projection scraper refuses to write short/fenced responses. If projections are needed for all positions, provide a valid FantasyPros session cookie via `FP_COOKIE` or `FANTASYPROS_COOKIE` at runtime. Do not commit cookies or write them into source files.

On 2026-06-30, using Chrome's FantasyPros cookie with `FP_FETCH_PROJECTIONS=true DRAFT=true pnpm run fetch:fp` successfully fetched projections for QB/RB/WR/TE/K/DST across STD/HALF/PPR. The cookie was stored only in a temporary `/private/tmp` env file, used for the fetch, and deleted afterward.

The app can run with FantasyPros ECR and empty FantasyPros stats, but the current generated aggregate now includes cookie-backed FantasyPros projected points. If future scheduled runs omit the cookie, expect `projectionsFetched: false` and rely on Sleeper projections for point estimates.

### Tiers 2026 Notes

The old Boris Chen fetcher downloaded CSVs from `https://s3-us-west-1.amazonaws.com/fftiers/out/*`, but those files can lag the new season. The default `pnpm run fetch:tiers` path now generates tier raw CSVs in `public/data/tiers/*` from the current FantasyPros draft ECR files.

The upstream `borisachen/fftiers` project uses FantasyPros data and R `mclust` clustering to create tiers. This repo uses a deterministic local approximation: contiguous 1D k-means over FantasyPros average rank. Overall `ALL` tiers use the same broad predraft shape as upstream: three coarse groups, then 10/8/8 subtiers. Keep `pnpm run fetch:borischen:remote` only as a manual fallback or comparison tool.

FantasyPros raw ECR payloads include expert sample metadata (`total_experts`, `filters`, and `experts_available.included/excluded`). Aggregate metadata preserves full expert ID lists once under top-level `expert_samples`; each source/position/scoring entry keeps an `experts` summary with included/available counts, coverage percent, sample-size label, and `sample_key`. Use this to flag early-week rankings with too few submitted experts before trusting tier or drop advice.

Important generated data:

- `public/data/sleeper/projections-latest.json`
- `public/data/sleeper/raw/*`
- `public/data/fantasypros/fantasypros_aggregate.json`
- `public/data/fantasypros/raw/*`
- `public/data/tiers/*`
- `public/data/aggregate/*-combined-aggregate.json`
- `public/data/aggregate/metadata.json`

Position tables must use their dedicated shards, not filtered `ALL` data:

- `QB-combined-aggregate.json`
- `RB-combined-aggregate.json`
- `WR-combined-aggregate.json`
- `TE-combined-aggregate.json`
- `K-combined-aggregate.json`
- `DEF-combined-aggregate.json`
- `FLEX-combined-aggregate.json`
- `ALL-combined-aggregate.json`

## Data Model Hotspots

- `src/lib/schemas-aggregates.ts` defines `CombinedEntry`, currently centered on Sleeper, FantasyPros, and Tiers.
- `src/lib/enrichPlayers.ts` computes derived values such as FantasyPros value, remaining positive value percent, market delta, scarcity metrics, and scoring-specific fields.
- `src/lib/playerRows.ts` maps aggregate entries into table rows.
- `src/lib/scoring.ts` contains scoring helpers.
- `src/lib/ratingHistory/*` stores player/source ratings over time in SQLite via Drizzle/libSQL.
- `src/lib/sleeper.ts` wraps Sleeper API calls.
- `src/hooks/useSleeper.ts` contains React Query hooks for Sleeper user, league, NFL state, and league-user data.
- `src/hooks/useLeagueData.ts` powers the league manager's roster and optimization view.
- `src/app/draft-assistant/_contexts/DraftDataContext.tsx` coordinates draft assistant state and URL synchronization.

## Rating History DB

The app has a local SQLite/libSQL history layer for source freshness, bye-week suppression, and future drop-decision work. Local development can point it at a file with the same libSQL-style environment variables:

```bash
FANTASY_HISTORY_DATABASE_URL=file:./data/fantasy-history.db
FANTASY_HISTORY_DATABASE_AUTH_TOKEN=...
```

Local defaults require no env var and write to `data/fantasy-history.db`, which is ignored by git.

Production and Vercel do not use the local-file fallback. They require
`FANTASY_HISTORY_DATABASE_URL` and
`FANTASY_HISTORY_DATABASE_AUTH_TOKEN`. The remote database is
`fantasy-tiers-history` in the dedicated `fantasy-tiers` Turso group. Actions
receives a write token scoped to that group; Vercel receives a separate
read-only group token. Do not use the account's `default` group or credentials
shared with another app.

Key commands:

```bash
pnpm run history:migrate
pnpm run history:ingest:aggregates
pnpm run db:generate
pnpm run db:migrate
```

`history:migrate` uses the repo migration helper and is safe for local setup/tests. `db:generate` and `db:migrate` are Drizzle Kit commands for future schema-managed migrations. If tables were already created by `history:migrate`, do not blindly run the generated initial Drizzle migration against the same DB without checking migration state.

Important tables:

- `source_runs`: one row per ingest scope/source/scoring/position. This records fetch/ingest freshness even when no player values changed.
- `history_players`: current player identity snapshot.
- `player_rating_versions`: type-2 history rows. A new row is inserted only when tracked rating values change; the old row gets `effective_to` and `is_current = false`.

`source_status` distinguishes `present` from `absent`. This is the foundation for the bye-week issue: a good player can be currently absent from a weekly/ranking source but still have a recent prior present rating and durable Sleeper/FantasyPros value. Use `getDropDecisionSignals()` in `src/lib/ratingHistory/queries.ts` to separate “currently missing but previously ranked” from “actually weak.”

## Sleeper Season Behavior

Sleeper's NFL state can roll to a new `league_season` before the user's leagues are created for that season. In June 2026, Sleeper reported `league_season: "2026"` and the user's 2026 leagues endpoint returned no leagues.

The app should use the active Sleeper league season going forward and should not silently fall back to 2025. If no leagues exist for the active season, show a clear empty state.

Relevant code:

- `src/lib/sleeperSeasons.ts`
- `src/hooks/useSleeper.ts`
- `src/app/league-manager/LeagueManagerContent.tsx`

## Scoring Behavior

Sleeper leagues may use custom reception values. A league observed during investigation used `rec: 0.69`. That should map to PPR-style aggregate rankings, not standard.

Relevant code:

- `src/lib/scoring.ts`
- `src/hooks/useLeagueData.ts`
- `tests/lib/scoring.test.ts`

Current simple mapping:

- `rec <= 0` -> standard
- `rec === 0.5` -> half
- `rec === 1` -> PPR
- other values above `0.5` -> PPR
- other positive values below or equal to `0.5` -> half

## Draft Assistant

Main files:

- `src/app/draft-assistant/page.tsx`
- `src/app/draft-assistant/DraftAssistantContent.tsx`
- `src/app/draft-assistant/_contexts/DraftDataContext.tsx`
- `src/app/draft-assistant/_components/DraftAssistantForm.tsx`
- `src/app/draft-assistant/_components/DraftStatusCard.tsx`
- `src/app/draft-assistant/_components/availablePlayers.tsx`
- `src/app/draft-assistant/_components/PositionCompactTables.tsx`
- `src/app/draft-assistant/_components/table/*`

Useful existing ingredients:

- All-player and position-specific tables.
- Drafted-player hiding/dimming.
- Tiers ranks and tiers.
- FantasyPros ECR average (`rank_ave`) for scoring and draft display, plus position rank, ownership, and tier.
- Sleeper ADP and rank context.
- Market delta: `Sleeper ADP - FantasyPros ECR`.
- Positional scarcity / remaining positive value percent.

Draft value default:

- `VAL` is the single tuned pick value score from the canonical `recommendationBoard`. Its player-quality baseline is required FantasyPros ECR plus overall/position tier context, never projected points.
- `VAL` has eight normalized signals: ECR value, pick timing, starter need, roster construction, QB/TE strategy, bench balance, league demand, and data/news risk. Draft-phase weights are the only tuning surface; missing ECR makes a row recommendation-ineligible.
- Live UI, mock UI, scripts, saved artifacts, and `/api/draft/view-model` must use `DraftCandidateSchema` and the same board. Do not add a second recommendation pipeline.
- Draft recommendations should not depend on FantasyPros or Sleeper projected points. Projection fields are for league-manager and optional context, not the draft-clock value baseline.
- Keep showing position rank and ADP delta because they answer draft-clock questions quickly.
- Do not add team positional rank by default unless a clear use emerges. The app already shows team/bye, and team positional rank is less obviously actionable than position rank, ADP delta, tier, value, bye, and source confidence.

Mock draft results:

- `/mock-draft` has a `Save result` control that writes the full local draft artifact through `POST /api/draft-results`.
- Saved artifacts go under ignored `data/draft-results/<timestamped-run>/draft-result.json`.
- Analyzer output, such as Footballguys per-slot report HTML and summary JSON, should be stored in the same run directory so post-draft reviews can compare picks, available context, and external grading.
- The evaluation goal is not just "beat bad bots." Bot teams should be adequate enough to create real pressure, and the draft assistant should help the user consistently beat them from any draft slot. A strong target is an `A-` or better external analyzer grade with no glaring starter or depth holes.
- Use draft retrospectives to turn results into product improvements: compare each user pick against the actual available board, identify passed players who disappeared before the next pick, identify players who could have waited, and convert repeated mistakes into decision-board rules or UI context.
- Current live proof is three consecutive completed Sleeper mocks from slots 4, 8, and 6 graded `A+`, `A+`, and `A`. All 45 user selections were the canonical top recommendation with no auto-picks. Full artifacts remain under ignored `data/draft-results/`.
- Treat local batches as construction and pressure tests, not exact grade predictors. The calibrated Sleeper-market bots can create materially stronger or different boards than Sleeper's live bots, and Footballguys uses private player valuation that can disagree with FP ECR. Never add player-specific branches to chase one external grade; require valid rosters and generic quality gates locally, then confirm the FP-only policy against repeated live rooms.

Near-term product ideas:

- Compact draft-board mode with player, team/bye, tier, value, scarcity, ADP delta, and picked status.
- Make `MD` readable as draft-round delta, not just raw pick delta.
- Stronger tier banding and position-cliff indicators.
- "Will this player make it back to my next pick?" using draft slot, pick order, ADP, and remaining players.
- Separate draft decision surfaces for `best overall`, `by position`, and `FLEX` pools. Overall value is useful, but it should not hide position-specific context or FLEX replacement options.
- Treat late QB/TE value spikes as a review signal, not an automatic recommendation. Once the user has a starter QB or TE, extra QB/TE picks usually need a specific reason such as elite tier value, very late draft cost, roster format, or a clear endgame need.

### Mock Draft Room

Main files:

- `src/app/mock-draft/page.tsx`
- `src/app/mock-draft/MockDraftRoom.tsx`
- `src/lib/simDraft/index.ts`
- `src/hooks/useAggregateBundle.ts`

The mock room lets a user or agent run a local draft without Sleeper. It imports Sleeper league settings when available, uses the aggregate bundle for player data, advances seeded bot teams, pauses on the user's turns, and feeds simulated Sleeper-shaped draft details/picks into `buildDraftViewModel`.

Use `/mock-draft` for fast iteration before live Sleeper validation. The first verified flow was a 10-team slot-5 mock: start at 1.05, pick, undo, re-pick, and advance to 2.06.

## League Manager

Main files:

- `src/app/league-manager/page.tsx`
- `src/app/league-manager/LeagueManagerContent.tsx`
- `src/hooks/useLeagueData.ts`
- `src/lib/rosterOptimizer.ts`

The league manager takes Sleeper user and league data, detects scoring, loads aggregate data, evaluates roster weak spots, and suggests upgrades. It currently risks overreacting to weekly rankings when players are missing or suppressed by bye week.

The owner explicitly wants the app to avoid bad drop advice for good players who are on bye or temporarily not ranked.

## Source Freshness And History Problem

This is a major revamp area.

Current state:

- `public/data/aggregate/metadata.json` has useful per-source/per-position metadata.
- `/api/aggregates/last-modified` currently exposes only a broad aggregate timestamp.
- Raw source snapshots exist for Sleeper and FantasyPros, but the app does not model ranking history as a first-class feature.
- `CombinedEntry` is provider-specific rather than adapter-oriented.
- A working API route or non-empty UI does not mean the data is draft-ready. On 2026-06-30, the draft assistant core worked, Sleeper draft links worked, and FantasyPros ECR refreshed, but Tiers was still stale and FantasyPros projections were intentionally omitted from scheduled fetches.

Recommended direction:

1. Create a source manifest model that every scraper writes:
   - `source`
   - `provider`
   - `dataset`
   - `season`
   - `week`
   - `scoring`
   - `position`
   - `fetchedAt`
   - `sourceUpdatedAt`
   - `rowCount`
   - `contentHash`
   - `status`
   - `warnings`
   - `sourceUrl`
2. Add `/api/data-sources/health` or similar.
3. Surface source freshness in the home page, draft assistant, and league manager.
4. Preserve source snapshots and build player ranking history from them.
5. Separate weekly start/sit value from rest-of-season or long-term player value.

This matters because a player's weekly rank can disappear during a bye, injury uncertainty, or missing scrape. Drop advice should consider history and long-term value, not only current weekly ranking.

## Player News Direction

Treat news as another normalized source, not as unstructured annotations. Suggested normalized shape:

- `playerId`
- `source`
- `publishedAt`
- `fetchedAt`
- `headline`
- `url`
- `summary`
- `tags` such as `injury`, `role`, `depth_chart`, `trade`, `bye`, `practice`, `suspension`
- `severity` or `confidence` if available

News should influence warnings and decision context before it directly changes rankings.

## Known Test And Verification Notes

Focused tests that were passing during this context write:

```bash
pnpm test tests/lib/sleeperSeasons.test.ts tests/lib/scoring.test.ts
pnpm run build
pnpm playwright test tests/e2e/home.spec.ts --config e2e.config.ts --output=/private/tmp/fantasy-tiers-home-results
```

Known pre-existing suite issues observed:

- Full `pnpm test` had failures in `tests/lib/temp_fantasyprosScrape.test.ts`, which depends on live FantasyPros scrape behavior.
- `tests/lib/sourceUpdateDates.test.ts` imports a missing `src/lib/sourceUpdateDates` module.
- Full typecheck had unrelated test/fixture issues and missing test-library dependency during investigation.

For browser verification, prefer running against a production build when testing simple navigation:

```bash
pnpm run build
pnpm run start
pnpm playwright test tests/e2e/home.spec.ts --config e2e.config.ts --output=/private/tmp/fantasy-tiers-home-results
```

Using default Playwright output under `test-results` while `next dev` watches the repo can trigger repeated recompiles and flaky browser assertions.

## Current Priority Recommendation

The next foundational slice should be source health, not another ranking table:

1. Define a reusable source manifest schema.
2. Teach existing fetchers/builders to write it.
3. Add an API route that reports source health and stale sources.
4. Add a small UI panel on the home page and in data-heavy tool pages.
5. Then add ranking history on top of the same manifest/snapshot model.

After that, adding Vegas odds, prediction markets, other rankings, and player news will be much less risky.

Source-health warnings must use a decision-relevant denominator. For draft assistant coverage, do not divide by the entire Sleeper player universe, because it includes thousands of historical or fringe `ADP 999` rows that will never matter in a normal draft. Use common-sense relevance filters such as real Sleeper ADP, FantasyPros coverage, active scoring tiers, or currently visible draft-board rows, and label the coverage basis explicitly.
