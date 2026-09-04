# Fantasy Tiers Project Context

Last updated: 2026-09-03

This document is a fast orientation guide for agents working on this repo. Read it after `AGENTS.md`.

## Product Purpose

Fantasy Tiers is an owner-first fantasy football draft and league management
app that is available on the internet. Other users can load their Sleeper
drafts, but full strategy support for every league format is not a product
goal. The selected live Sleeper draft is the authority for its settings. The
owner's league is the optimization target, primary regression scenario, and
default local mock preset. For unsupported format rules, load the draft and
show a clear limitation message instead of building another strategy engine.

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

The two independent core providers are:

- Sleeper: public API for users, leagues, drafts, picks, player metadata, and projections.
- FantasyPros: scraped rankings/projections, including draft and weekly modes.

The app also generates tier CSV rankings locally from current FantasyPros draft
ECR. Tiers are derived data, not a third provider.

Possible future sources discussed:

- Vegas odds.
- Prediction market sites.
- Other ranking sites.
- Player news feeds.

Keep the source model focused on these inputs until a new provider has a clear,
validated role.

## Data Pipeline

Important commands:

```bash
pnpm run fetch:all
pnpm run agg:all
pnpm run validate:aggregates:ci
```

Scheduled draft refreshes set `SEASON=2026`, `DRAFT=true`, and
`FP_FETCH_PROJECTIONS=false`. Readiness validation writes the committed
`public/data/aggregate/quality-report.json`. The same readiness module protects
the validator, health endpoint, live assistant, and mock assistant. It fails
closed on stale FantasyPros or Sleeper data, thin expert samples, wrong
mode/season, empty derived shards, or incomplete draft-relevant players.

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

The `pnpm run fetch:tiers` path generates tier raw CSVs in
`public/data/tiers/*` from current FantasyPros draft ECR. It uses deterministic
contiguous 1D k-means over FantasyPros average rank. Overall `ALL` tiers use
three coarse groups followed by 10/8/8 subtiers.

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

Sleeper leagues can use custom scoring. The live draft path must read the exact
available scoring settings from Sleeper before it selects an aggregate ranking
set. For example, `rec: 0.69` maps to the PPR aggregate ranking set. Exact
scoring changes beyond that ranking-set choice need a separate, quality-gated
`ADJ` calculation.

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

The live draft assistant gets draft mechanics, draft order, and the user's slot
from the selected Sleeper draft. It uses the draft's `league_id` to load the
league scoring settings when the draft object does not include them. It must
not use the owner's preset for another user's live draft.

The local mock draft uses the owner's planned 2026 league as its default preset:

- 12 teams, snake order, manual slot 4, and a 60-second timer.
- 1 QB, 2 RB, 2 WR, 1 TE, 2 FLEX, 0 K, 1 DEF, and 5 bench slots.
- 1 IR slot that does not add a draft round. The preset has 14 draft rounds.
- 0.69 points per reception and the detailed scoring rules in
  `src/lib/draftLeagueConfig.ts`.
- No 2026 keepers. The policy permits one keeper per team from 2027 and stores
  the configured eligibility and draft-round cost.

Draft rounds must come from draftable roster slots. Do not add a separate
manual round setting. K and DEF recommendations and simulated picks must follow
the configured roster limits.

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
- FantasyPros ECR average (`rank_ave`) for player order within each position and draft display, plus position rank, ownership, and tier.
- Sleeper ADP and rank context.
- Market delta: `Sleeper ADP - FantasyPros ECR`.
- Positional scarcity / remaining positive value percent.

Draft value model:

- `VAL` is the only player-value baseline. It applies the selected league's supported scoring rules to Sleeper season projections, calibrates each position's projection curve to FantasyPros ECR order, and compares each player with league-specific VOLS and man-games replacement baselines. It does not use the user's roster or the current draft state.
- `ADJ` is the canonical recommendation score. It adjusts `VAL` with pick timing, starter need, roster construction, QB/TE strategy, bench balance, league demand, and data/news risk. Draft-phase weights are the only tuning surface. Missing ECR makes a row recommendation-ineligible.
- Recommendation order and score gaps use `ADJ`.
- Live UI, mock UI, scripts, saved artifacts, and `/api/draft/view-model` must use `DraftCandidateSchema` and the same board. Do not add a second recommendation pipeline.
- If either provider, the derived data, or the exact-scoring value model is not ready, replace the draft surface with a named incident. Do not show a stale board and do not substitute ECR-only value or a generic scoring bucket.
- Keep showing position rank and ADP delta because they answer draft-clock questions quickly.
- Do not add team positional rank by default unless a clear use emerges. The app already shows team/bye, and team positional rank is less obviously actionable than position rank, ADP delta, tier, value, bye, and source confidence.

Mock draft results:

- `/mock-draft` has a `Save result` control that writes the full local draft artifact through `POST /api/draft-results`.
- Saved artifacts go under ignored `data/draft-results/<timestamped-run>/draft-result.json`.
- The evaluation goal is not just "beat bad bots." Bot teams should create real pressure, and the draft assistant should produce complete, balanced rosters from every draft slot.
- Use draft retrospectives to turn results into product improvements: compare each user pick against the actual available board, identify passed players who disappeared before the next pick, identify players who could have waited, and convert repeated mistakes into decision-board rules or UI context.
- Current live proof includes three consecutive completed Sleeper mocks from slots 4, 8, and 6. All 45 user selections were the canonical top recommendation with no auto-picks. Full artifacts remain under ignored `data/draft-results/`.
- Treat local batches as construction and pressure tests, not exact outcome predictors. The calibrated Sleeper-market bots can create materially stronger or different boards than Sleeper's live bots. Never add player-specific branches to chase one result; require valid rosters and generic quality gates locally, then confirm the policy against repeated live rooms.

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

### Draft Readiness

`src/lib/sourceHealth.ts` collects provider facts. It does not decide policy.
`src/lib/draftReadiness.ts` owns all draft-readiness policy:

- FantasyPros and Sleeper must have been fetched in the last 18 hours.
- Each provider timestamp must be no more than 48 hours old.
- FantasyPros must include at least 50 experts and 50% of available experts.
- The top 120 players and the expected league draft pool require 100% coverage.
- The separate reserve slice covers the next three rounds after the expected
  draft pool and requires at least 95% coverage.
- Cohorts use the union of FantasyPros ECR and positive Sleeper ADP/board rank.
- Every required player needs ECR, position rank, overall and position tiers,
  a current Sleeper projection, and a finite exact-scoring `VAL`. Sleeper market
  rank is an independent cohort signal. Its absence does not invalidate a
  player when the required FantasyPros and Sleeper projection data is complete.

The owner CI preset is 12 teams, 14 rounds, 0.69 PPR, two FLEX slots, and no
kicker. Live and imported drafts use their actual Sleeper configuration. The
saved prior report adds `previouslyReadyAt` to player diagnostics only. It is
never a value or UI fallback.

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

Readiness uses a decision-relevant denominator. It does not divide by the full
Sleeper player universe, which includes historical and fringe rows. A player
enters a cohort through FantasyPros ECR or a real Sleeper market rank. Zero
and 900-plus sentinel ranks do not count.
