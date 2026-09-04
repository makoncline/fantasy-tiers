# Draft Assistant Implementation Plan

Status: the core live and mock draft path exists. Use this document for current
architecture. Use `docs/draft-strategy-research-contract.md` for accepted
strategy principles, implementation status, and validation requirements.

## Product Contract

- The owner league is the optimization target. Other users can load different
  Sleeper drafts on a best-effort basis.
- The selected live Sleeper draft is the configuration authority. Its related
  league fills scoring details when the draft response omits them.
- Show a clear message for format rules that `ADJ` does not consider. Do not
  build full support for another format without an owner need.
- The owner's 12-team, 0.69 PPR, two-FLEX format is the primary regression
  scenario and the default local mock preset. It is not a live-draft default.
- FantasyPros ECR average is required player-quality data for draft advice.
- Sleeper ADP describes room timing; it does not replace ECR.
- Overall tier and position tier are separate signals.
- `VAL` applies supported league scoring to Sleeper season projections, uses
  FantasyPros ECR to order the projection curve within each position, and
  compares players with league-specific VOLS and man-games baselines.
- `ADJ` starts from `VAL` and adds roster, room, and pick-timing context.
- If scoring, projection capability, or required source data is unavailable,
  replace the draft board with a named incident. Do not use an ECR-only
  fallback or a prior board.
- Missing ECR is visible as a data error and makes the player recommendation-
  ineligible.

## One Data Path

Every draft surface uses the same flow:

1. Convert the selected Sleeper draft into the canonical league configuration.
2. Build the scoring-specific aggregate bundle for that configuration.
3. Convert ALL-shard rows plus position-shard tiers through
   `DraftCandidateSchema`.
4. Overlay Sleeper picks and user ownership in `buildDraftViewModel`.
5. Build one `recommendationBoard`.
6. Attach that board's metrics to live UI rows, mock UI rows, algorithm
   decisions, API output, and saved artifacts.

Do not add a second recommendation list or rescore a reduced `RankedPlayer`
shape. The removed `nextPickRecommendations`, `dynamicRecommendations`, and
`/api/draft` paths must stay removed.

## Recommendation Model

Each raw signal is normalized to `-100..100`; the active draft-phase profile
contains the only weights.

1. `value`: exact supported league scoring plus starter-aware replacement value,
   with FantasyPros ECR ordering each position's projection curve.
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

- Recommended player, `VAL`, and `ADJ`.
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
2. Run every configured draft slot with multiple fixed seeds.
3. Require complete rosters, exactly one QB/TE/K/DEF, RB/WR depth floors,
   usable QB/TE starters, and late K/DEF.
4. Review the first eight picks and explanation text for team-state coherence.
5. Replay representative drafts against held-out Sleeper boards and inspect
   decision logs for repeated misses or avoidable reaches.

Require every run to pass roster-completion and starter-quality gates. Treat
local finish and ECR-based metrics as regression signals, not independent proof.

## Later Research

- Player news and role context fetched on demand.
- Market-derived ranks or tiers from legal, stable real-money data sources.
- Ranking history and bye-week-aware hold/drop analysis for league manager.
- More opponent models for validation: pure ADP, roster-need pressure, and
  position-run behavior.

## Sleeper Calibration Workstream

Status as of 2026-07-11:

- [x] Keep `sleeper-adp-needs` as the hard starter-needs strategy.
- [x] Add a registry-based strategy interface for future opponent models.
- [x] Add `sleeper-market-v1`, using Sleeper ADP, soft roster pressure, and
  calibrated pick variance.
- [x] Convert raw Sleeper pick boards into the canonical `draft-result.json`
  artifact used by mock drafts and retrospective tools.
- [x] Validate the importer against a complete saved 150-pick Sleeper board.
- [x] Compare `sleeper-market-v1` against held-out real Sleeper boards by
  pick-rank distribution, position timing, and complete-roster quality.
- [x] Add a replay evaluator that runs assistant decisions against imported
  real boards without changing historical availability.

Held-out strategy replay favors `sleeper-market-v1`: 28.0% top-one, 57.0%
top-three, and 77.9% top-ten versus 27.7%, 51.9%, and 72.8% for
`sleeper-adp-needs`. The strict needs strategy remains available, and mock
config supports per-slot strategy assignments so both can coexist in one room.

Observed Sleeper calibration from 16 complete saved boards (2,160 bot picks;
1,872 with known Sleeper ADP): the selected player was the top available ADP
31.3% of the time, top three 66.9%, top ten 96.0%, with median available rank
2. This is evidence for market-weighted variance, not evidence that Sleeper
bots optimize roster construction.

## September 2026 Improvement Sequence

### Objective

Maximize the expected quality of the complete roster under the selected live
league rules. Optimize the starting lineup and FLEX quality first, then useful
RB/WR depth, then roster-completion positions. Explanation quality is important
only when it reports the same inputs and score that selected the player.

The system already has one canonical board, separate `VAL` and `ADJ`, roster and
FLEX needs, RB/WR construction, tier cliffs, Sleeper ADP timing, comeback
estimates, position runs, QB/TE quality windows, close options, score gaps, and
pros/cons. Do not rebuild these parts. Improve the gaps below in order.

### 0. Freeze The Baseline And The Sleeper Contract

1. Keep `data/draft-results/algo-batch-20260903183345` as the accepted fixed-
   seed strategy baseline.
2. Save a sanitized beta-draft network manifest with request method, endpoint,
   GraphQL operation name, polling cadence, and response field names. Exclude
   cookies, authorization data, user profile responses, chat, direct messages,
   and raw headers.
3. Add a browser smoke test for the beta draftboard's role-based controls:
   claim slot, start, pause, resume, player search, queue, and draft.
4. Keep cache-busted public draft detail and picks REST responses as the live
   state authority. Treat observed Sleeper GraphQL operations as unstable UI
   implementation details, not application dependencies.

Exit criterion: the same two-pick beta mock is represented correctly in the
Sleeper room and `/api/draft/view-model`, the sanitized manifest contains no
credentials or personal data, and the browser smoke test detects a changed
Sleeper surface before a live draft.

### 1. Add A Player Status And News Freshness Gate

Status: Implemented on 2026-09-04. Structured status and saved news timestamps
now affect `Adj`, confidence, and eligibility. `Val` does not change. Detailed
news remains an on-demand review aid and does not affect the score.

Use structured Sleeper player status before unstructured news. Classify each
draft-relevant candidate as healthy, short-term concern, material availability
risk, confirmed unavailable, or unknown. Do not treat every `Questionable`
label as a reason to pass, and do not treat IR, PUP, or suspension as automatic
season-long exclusion.

Compare the newest status or news timestamp with the FantasyPros ECR snapshot.
When material news is newer than ECR, lower recommendation confidence and show
that the ranking might not include the update. Make only confirmed season-long
or non-player states ineligible. Express other cases as a score penalty that
depends on expected missed time, draft cost, roster construction, and whether
the league has usable IR slots.

Keep news fetching bounded. Fetch and cache detailed news only when the user
opens a player preview. News text can explain or trigger manual review, but it
must not become an unvalidated sentiment score. A failed news request must show
`unknown`, not `healthy`.

Exit criterion: integration scenarios cover healthy, questionable, extended-
absence, confirmed-unavailable, newer-than-ECR news, and failed-news cases.
Fixed-seed mocks must avoid unavailable players without turning ordinary injury
labels into large reaches for weaker alternatives.

### 2. Model The Board Other Managers Actually See

Add separate fields for Sleeper's visible player rank, ADP, and projected pick.
Use the visible rank and projected pick only to model opponent behavior. Keep
FantasyPros ECR as player quality. Recalibrate return odds from actual room
picks when the room moves away from the displayed order.

Exit criterion: held-out Sleeper boards show better calibration for whether a
player returns to the next user pick. Report calibration error, not only top-N
pick accuracy.

### 3. Add Direct Next-Turn Opportunity Cost

For each serious candidate, estimate the best same-position option likely to be
available at the next user turn. Calculate the expected value lost by waiting.
Compare the best two-pick paths, not only the current player scores.

Use this calculation to strengthen the QB/TE rule: an elite QB or TE can beat a
close RB/WR, but a position bonus cannot override a clearly better RB/WR or an
open core starter without a measured next-turn advantage.

Exit criterion: saved decisions include the expected next-turn replacement and
value loss. Fixed-seed mocks improve QB/TE opportunity-cost cases without
reducing core RB/WR starter quality.

### 4. Apply Exact Custom Scoring

Status: Implemented as the only `VAL` model on 2026-09-04. Supported league
scoring, including 0.69 points per reception, drives the starter-aware
replacement value. The app blocks recommendations when projection coverage,
freshness, or scoring capability is insufficient. It does not fall back to a
generic PPR bucket or the removed ECR-only model.

### 5. Finish Endgame And Tiebreaker Policy

Hard-block D/ST before the configured endgame window unless it is required to
complete a legal roster. Apply the same rule to kicker when the selected league
has one. Use bye-week coverage after core starters are set. Do not weaken the
starting roster to fix an early bye conflict.

Do not add a general winning-team bonus. If a stable offense-context input is
added later, keep it small, position-aware, and limited to close choices. Prove
it out of sample before it can change a recommendation.

Exit criterion: all fixed-seed rosters remain legal, D/ST and kicker timing
passes the configured gate, and the rule does not create weaker late RB/WR
depth.

### 6. Show A Comparative Decision Trace

Keep the existing compact board. Add one engine-generated comparison between
the recommendation and the strongest alternative:

```text
Raw leader: Player A, VAL 92
Recommendation: Player B, ADJ 99 vs 96
Player B: -3 raw value, +6 roster need, +4 next-turn loss, +1 timing
Result: slight edge because the roster adjustment exceeds the raw gap
```

Call this a decision trace or score explanation. Do not present hidden model
reasoning. Every displayed delta must come from the canonical score components,
and the components must sum to `ADJ`. Use offense context, news, and bye weeks
only when they actually affected the score.

Exit criterion: a user can identify the raw leader, the recommended player,
the runner-up, the score gap, and the decisive adjustment in less than 10
seconds. Integration tests must fail if displayed deltas disagree with the
canonical recommendation board.

### Proof Required After Every Strategy Change

1. Run focused integration tests through the canonical recommendation board.
2. Run all 12 slots with the same three fixed seeds and source snapshot.
3. Require legal rosters and the existing starter-quality gates.
4. Compare the target metric, core-starter ECR, roster balance, and changed
   picks against the fixed baseline.
5. Inspect a few representative drafts and held-out Sleeper replays. Use a few
   independent external grades only as directional checks because they cannot
   represent every league rule.
6. Reject a change that only moves an internal ECR-based metric or fixes one
   named player. Express accepted rules through value, position, roster state,
   timing, tier, and data quality.
