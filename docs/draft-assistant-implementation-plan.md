# Draft Assistant Implementation Plan

Status: core 2026 implementation complete; use this document for architecture
and validation, not as a backlog of speculative scoring systems.

## Product Contract

- FantasyPros ECR average is required player-quality data for draft advice.
- Sleeper ADP describes room timing; it does not replace ECR.
- Overall tier and position tier are separate signals.
- Projected points, VORP, BEER, and league-manager values do not participate in
  draft recommendations.
- `VAL` is the only recommendation score shown during the draft.
- Missing ECR is visible as a data error and makes the player recommendation-
  ineligible.

## One Data Path

Every draft surface uses the same flow:

1. Build the scoring-specific aggregate bundle.
2. Convert ALL-shard rows plus position-shard tiers through
   `DraftCandidateSchema`.
3. Overlay Sleeper picks and user ownership in `buildDraftViewModel`.
4. Build one `recommendationBoard`.
5. Attach that board's metrics to live UI rows, mock UI rows, algorithm
   decisions, API output, and saved artifacts.

Do not add a second recommendation list or rescore a reduced `RankedPlayer`
shape. The removed `nextPickRecommendations`, `dynamicRecommendations`, and
`/api/draft` paths must stay removed.

## Recommendation Model

Each raw signal is normalized to `-100..100`; the active draft-phase profile
contains the only weights.

1. `value`: FantasyPros ECR, position rank, and overall tier value.
2. `timing`: Sleeper ADP, next-turn availability, position runs, and tier
   fallback timing.
3. `starterNeed`: open starter and FLEX requirements.
4. `construction`: RB/WR anchors and balanced starter quality.
5. `onesie`: elite QB/TE windows, viable starter timing, early reaches, and
   filled-slot penalties.
6. `depth`: RB/WR bench balance and upside.
7. `demand`: remaining league-wide positional need.
8. `risk`: missing secondary fields and injury/news flags.

Profiles remain intentionally small: starter build, core balance, depth build,
and endgame. Add a parameter only when repeated multi-seed evidence identifies
a failure that cannot be expressed by an existing signal or phase weight.

## Roster Policy

- Build usable RB and WR starters before accumulating one-sided depth.
- Tier-one QB/TE value can be taken when the timing and roster state support it.
- Do not reach before ADP for an ordinary QB.
- Use exactly one QB and one TE in default 1QB/1TE redraft mocks.
- Spend normal bench picks on RB/WR upside.
- Draft DEF and K in the final two rounds, normally K last.
- Treat RB/WR balance as a tie-breaker until the roster becomes materially
  lopsided.

## Main UI

Keep visible:

- Recommended player and `VAL`.
- Close alternatives.
- Strongest pros, cons, and data warnings.
- Open starter/FLEX state and RB/WR bench balance.
- League starter demand and other demand as separate bars.
- Combined table and per-position tables.

Keep optional under recommendation diagnostics:

- Active weight profile.
- Weighted component values.
- Detailed source metadata.

Do not repeat the same top players in several cards or keep freshness panels
permanently expanded.

## Validation Contract

Before treating a scoring change as successful:

1. Run focused unit/integration tests.
2. Run all ten draft slots with multiple seeds.
3. Require complete rosters, exactly one QB/TE/K/DEF, RB/WR depth floors,
   usable QB/TE starters, and late K/DEF.
4. Review the first eight picks and explanation text for team-state coherence.
5. Grade representative drafts sequentially with the external analyzer when it
   is available; do not tune from one grade or send a large parallel batch.

Target an `A-` floor across the fixed validation matrix and an `A`/`A+` median.
Draft and grader variance make literal A+ on every run an aspiration, not a
correctness invariant.

## Later Research

- Player news and role context fetched on demand.
- Market-derived ranks or tiers from legal, stable real-money data sources.
- Ranking history and bye-week-aware hold/drop analysis for league manager.
- More opponent models for validation: pure ADP, roster-need pressure, and
  position-run behavior.

## Sleeper Calibration And Footballguys Workstream

Status as of 2026-07-11:

- [x] Keep `sleeper-adp-needs` as the hard starter-needs strategy.
- [x] Add a registry-based strategy interface for future opponent models.
- [x] Add `sleeper-market-v1`, using Sleeper ADP, soft roster pressure, and
  calibrated pick variance.
- [x] Convert raw Sleeper pick boards into the canonical `draft-result.json`
  artifact used by mock drafts and retrospective tools.
- [x] Validate the importer against a complete saved 150-pick Sleeper board.
- [x] Discover and reproduce the public Footballguys rankings request without
  browser cookies.
- [x] Fetch Footballguys consensus ranks/tiers and each of its 13 selectable
  ADP providers as separate, timestamped datasets.
- [x] Record ADP row count and coverage per provider; never substitute another
  provider when a listed feed is empty.
- [x] Join Footballguys rankings to Sleeper players by normalized name and
  position while retaining both source IDs. The current public board matches
  498 relevant Sleeper rows.
- [x] Add Footballguys rank/tier and available ADP sources to the aggregate
  source model and comparison UI. Keep them out of production `VAL` until
  multi-draft validation shows a useful, stable role.
- [x] Compare `sleeper-market-v1` against held-out real Sleeper boards by
  pick-rank distribution, position timing, and complete-roster quality.
- [x] Add a replay evaluator that runs assistant decisions against imported
  real boards without changing historical availability.
- [x] Add a resumable Footballguys Rate My Team experiment runner that enforces
  at least 15 seconds between cases, assigns unique names, and saves progress
  after every request. A single baseline transport case completed successfully.
  Change one roster characteristic per pair and save every request/report.
- [x] Build a deduplicated local grader dataset keyed by roster hash, league
  settings, grading date, and rankings snapshot.
- [x] Fit an evaluation-only ordinal surrogate for overall and starter-position
  grades.
  Split train/validation by whole draft, not individual teams, and do not use
  the surrogate as recommendation truth until held-out accuracy is credible.

Held-out strategy replay favors `sleeper-market-v1`: 28.0% top-one, 57.0%
top-three, and 77.9% top-ten versus 27.7%, 51.9%, and 72.8% for
`sleeper-adp-needs`. The strict needs strategy remains available, and mock
config supports per-slot strategy assignments so both can coexist in one room.

The deduplicated grader dataset currently contains 399 rosters. The
evaluation-only seven-neighbor model has 0.90 grade-step mean absolute error
and is within one grade step 62.7% of the time on whole-draft holdouts. This is
adequate only for rough local screening and must not influence draft `VAL`.
Starter-position holdout errors are QB 0.57, RB 1.28, WR 1.84, and TE 0.56
grade steps. Position estimates, especially WR, remain diagnostic only.

Footballguys grades should be assumed to depend on Footballguys' own player
valuations and the submitted league settings. Grader features therefore include
team count, PPR mode, starting-slot structure, FantasyPros ECR, and current
public-default FBG rank strength. Current FBG ranks are not historical snapshots
and are not customized to non-member league settings, so they are explicitly a
temporally mismatched approximation for older reports. Never infer that the
same roster would receive the same grade in 10-team standard and 12-team PPR.

Observed Sleeper calibration from 16 complete saved boards (2,160 bot picks;
1,872 with known Sleeper ADP): the selected player was the top available ADP
31.3% of the time, top three 66.9%, top ten 96.0%, with median available rank
2. This is evidence for market-weighted variance, not evidence that Sleeper
bots optimize roster construction.

Footballguys rankings are delivered as a server-rendered HTML fragment from
`/rankings`. The request explicitly carries scoring, passing rules, roster
slots, team count, expert selection, position, season, and ADP provider. The
public endpoint returned the complete table without account cookies. Rank and
tier are Footballguys data; the selectable ADP provider is a separate field.
Projected points from this page must not enter draft recommendation value.
Without a paid membership, only the complete public default rankings should be
ingested. Custom league settings return a 15-row `data-roadblocked="1"`
fragment even when the browser is authenticated. Label public-default FBG data
with its 12-team PPR settings and never present it as league-customized.
