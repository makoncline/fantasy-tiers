# Selected-source within-position ADJ order

Status: implemented in the isolated worktree at the owner's direction. Not deployed.
This replaces the rejected comparison UI proposal. UI layout and VAL are unchanged.

## Source contract

- FP selected: FP ECR average (`fp_rank_ave`) orders players within each position.
- Sleeper selected: native projected position rank under the configured league
  scoring orders players. Sleeper has no separate expert-consensus feed here.
- ADP is market timing. It does not determine player quality.
- FP tiers remain context. A tied source rank is not resolved by arbitrary tier
  gaps, a new tolerance, or an invented projection advantage.
- Native source snapshots contain `qualityRanksByPlayerId`. Both source views,
  lookahead, replay, and the existing source toggle consume that same mapping.
- Internal combined/unranked experiments do not supply this map. They do not
  silently use FP. An explicit map with a missing or invalid player rank makes
  that player recommendation-ineligible.

## Score rule

First compute existing components and enforce existing eligibility. Within each
position, traverse the eligible players in source-rank order. Cap each player's
ADJ before risk at the smallest score before risk among better-ranked players.
Equal-ranked peers do not cap each other. Apply each player's own existing risk
contribution afterward. Thus a lower-ranked player with less modeled risk can
still lead. Confirmed season-long absences remain excluded.

This is a downward constraint, not a bonus to the higher-ranked player. The
position cannot inherit timing from a lower-ranked player. No player-specific
rule, new risk weight, or numeric equivalence tolerance is added. The correction
is recorded in the `rankingOrder` component and in the existing score details.
Component totals still equal ADJ. Score ties use source rank. The existing table
uses canonical recommendation rank for equal ADJ before applying its row limit.

## Validation

- 121 tests pass across scoring, source selection, saved snapshot reconstruction,
  lookahead, decision logs, retrospective data, and the existing table.
- New regression cases cover a lower-ranked player with much higher VAL, a change
  in source order, drafted leaders, missing selected-source rank, material risk,
  and equal-ADJ table order.
- Typecheck and focused ESLint pass. The production Webpack build passes.
- 39 complete drafts per mode: three seeds in all 12 slots plus three extra slot-4
  seeds. All 78 are legal, satisfy one-QB/one-TE owner policy, and pass canonical
  mandatory and core-construction gates.
- Inputs use the earlier frozen preflight hash
  `e586bf8b3b81ac49be3b855b6b626013558352f8da2e9a484517e31607b2ebb4`.
  Actual format: 12 teams, snake, 15 rounds, 0.69 PPR, two FLEX, K/DEF, bench5.
- Output: `data/draft-results/post-draft-20260908/source-order-fp/` and
  `source-order-sleeper/`. Each records its selected source and every pick.

## Measured trade-off

The 39 new FP runs are paired against the previous FP baseline with the same
inputs, opponents, seeds, and slots. There are 269 changed picks across their
complete paths. Mean FP season-projection differences are −2.42 starter points,
−4.30 FLEX points, and −42.75 bench points. This is a real modeled trade-off of
preferring consensus order over the native projection ordering. It is not
hidden by the unchanged legal-completion gates.

On the 19 pairs with complete Sleeper projections for both rosters, the mean
Sleeper differences are +8.37 starters, +1.68 FLEX, and +24.19 bench. These are
not the same 39-pair sample. The frozen Sleeper source lacks A.J. Dillon's
projection; incomplete rosters are not scored as zero. No paired previous-policy
Sleeper-mode batch was run. Its 39 new runs establish construction checks only.

[Compact results](selected-source-order-results.json) include counts and ranges.
Full FP changed-pick traces are in `source-order-fp/changed-picks.json`.
These projections are forecasts, not independent performance outcomes. No live
browser or draft-room test, release, merge, or deploy occurred. The owner-directed
ranking preference is implemented; better fantasy outcomes remain unverified.
