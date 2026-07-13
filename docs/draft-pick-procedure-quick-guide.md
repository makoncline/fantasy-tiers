# Draft Pick Procedure Quick Guide

Last updated: 2026-07-11

Goal: use the app to draft the strongest complete roster possible. The winning
pattern is not pure best-player-available; it is ECR value plus timing, starter
quality, roster shape, league demand, and position-specific draft policy.

## What We Proved

The canonical top recommendation completed three consecutive live Sleeper
mocks with strong final results from slots 4, 8, and 6. All 45 user picks used
the first recommendation with no manual overrides.

The practical conclusion is simple:

- Take the recommended player by default.
- Treat close alternatives as context, not an invitation to outguess every pick.
- Override only for a concrete problem: stale/missing data, a player who is no
  longer available, an injury/news fact the data has not absorbed, or a league
  rule the app modeled incorrectly.
- Never add a player-specific exception to the process. Improve the generic
  scoring signal when a pattern repeats across drafts.

## Default Roster Shape

Draft:

- 1 QB
- 1 TE, preferably elite or strong
- 2+ RB starters plus RB-heavy depth when value supports it
- 3+ useful WR/FLEX options
- 1 DEF and 1 K at the end

Avoid:

- Backup QB
- Backup TE before the late rounds
- Early K/DEF
- Reaching for QB before ADP, even a good QB
- Taking a non-elite TE just because TE is open
- Forcing a perfect RB/WR ratio when one side has much better value
- Ignoring WR2/WR3 starter quality for too long

## Pick Checklist

For every user pick:

1. Read `Recommended Pick`. This is the deterministic default from the
   eight-signal `VAL` model.
2. Confirm the player is available and no source-health or current-news warning
   invalidates the recommendation.
3. Take the player.
4. Only when the recommendation fails that safety check, compare:
   - top overall row
   - best RB
   - best WR
   - best TE if TE is open
   - best QB if QB is open
   - best FLEX-compatible player
5. Use the explanation and components to diagnose why it failed before choosing
   the next valid recommendation.

## Table-Only Procedure

When only the overall table and position tables are available, use this exact
loop:

1. Sort or read the overall table by `VAL`; treat the first row as the default.
2. Open the RB and WR tables and identify the best undrafted player in each.
3. If TE is open, check the TE table for a tier-one/top-two option. This is a
   real early-round window, not a generic TE boost.
4. If QB is open, check the QB table for a tier-one or viable starter. An
   ordinary but usable quarterback can still be fine; a low-ceiling late QB can
   sink the build.
5. Compare tiers, position ranks, and ADP timing. Do not let small `VAL`
   differences override a disappearing elite TE, a missing RB/WR starter, or
   a QB before ADP.
6. Draft the overall-table default unless one of those checks gives a clear
   roster-construction reason to take the position-table alternative.

## Round Heuristics

Rounds 1-2:

- Prefer elite RB/WR value.
- Do not leave both RB and WR weak.
- Elite TE is acceptable if the board clearly supports it, but most successful
  builds start with RB/WR value.

Rounds 3-6:

- Protect RB/WR starter balance.
- Treat `WR2 anchor` as important when you have exactly one WR.
- Treat elite TE as important while TE is open, especially tier-one/top-two TE
  in rounds 3-4. Waiting for the next TE tier has repeatedly produced weaker
  TE starter quality.
- If `Elite QB` and `Elite TE` are both available, explicitly compare the TE
  window first. A top QB is easier to survive without than a missed elite TE
  tier when the next TE option is much weaker.
- Take a top QB only when `Elite QB` appears at or after ADP and the value/tier
  is clearly better than available RB/WR/TE. Do not take a QB before ADP.
  Otherwise respect `QB wait`.

The successful live drafts repeatedly established their core in the first five
rounds: two RB/WR anchors, an elite TE when available, then the missing RB/WR
starter pieces. This is evidence for the current model, not a fixed position
sequence.

Rounds 7-11:

- Fill remaining QB/TE starter if not done, but keep using `QB wait` / `TE wait`
  while the available player is not meaningfully better than RB/WR/FLEX.
- Prefer RB/WR bench upside and players marked by tier pressure or strong
  meaningful ADP value.
- Use `Bench Balance` as a soft RB/WR tie-breaker. If it says `Action RB` or
  `Action WR`, the roster is materially lopsided, so prefer that side unless
  the value gap is clear. If the combined board still shows another position
  on top, explicitly compare the best player from the `Action` side before
  making the pick.
- Ignore backup QB/TE value unless there is an exceptional reason.

Rounds 12-13:

- Add RB/WR depth unless K/DEF must be filled now.
- Prefer players with roles or upside over pure projection noise.

Rounds 14-15:

- Draft DEF and K.
- Use the app's special-teams scoping. Usually take best visible DEF/K value.

## Tiebreakers

Use these in order:

1. Current `Recommended Pick`.
2. Player availability and current injury/news validity.
3. Source confidence and missing-data warnings.
4. Open starter need or fragile starter quality.
5. Meaningful `VAL` edge and tier cliff.
6. `Likely gone` / low comeback chance.
7. `Bench Balance` for RB/WR depth.
8. Bye-week conflicts.

## Known Traps

- High-value backup QB/TE after starter is filled.
- Pre-ADP QB reaches, even for elite QBs.
- Non-elite QB/TE in the middle rounds when RB/WR/FLEX quality is still live.
- Waiting too long on WR2/WR3 quality, especially when WR starter quality is
  already fragile.
- Taking elite QB over elite TE without checking whether the TE tier will
  disappear before the next pick.
- Letting a strong TE window close while chasing generic RB value.
- Drafting K/DEF before the final rounds.
- Overreacting to one position weakness: an ordinary QB can still be fine if
  RB/WR/TE are strong.
- Overreacting to RB/WR ratio: RB-heavy teams can work well when the RB value
  is real. Use balance as a tie-breaker, not a hard rule.
- Trusting only the final roster headline. A team can look strong overall while
  hiding weak RB starter, WR depth, or TE starter quality; review those spots
  after the draft.

## Recommendation Model

`VAL` combines eight normalized signals: ECR value, pick timing, starter need,
roster construction, QB/TE strategy, bench balance, league demand, and
data/news risk. One draft-phase profile supplies the weights. Missing ECR makes
a player visible but ineligible for recommendation.

Profiles:

- `Starter build`: early RB/WR/FLEX and elite TE/QB starter windows.
- `Core balance`: middle rounds while core starters or FLEX quality are still open.
- `Depth build`: RB/WR bench upside after starters are stable.
- `Endgame`: final K/DEF and roster-completion picks.

## Lessons From Tuning

- Player quality must come from FantasyPros ECR and tiers, not projected points.
- Roster needs modify value; they do not replace it with rigid position quotas.
- Elite TE is a real early exception because positional separation can justify
  the opportunity cost. Non-elite TE is not.
- Early QB requires position-tier quality and fair timing. A pre-ADP QB reach
  is not justified merely because QB is open.
- RB/WR balance matters most for starter quality and later as a soft depth
  tiebreaker. Exact counts are not a hard rule.
- One QB and one TE are normally enough. Bench capital belongs primarily in
  RB/WR upside.
- DEF and K belong in the final two rounds, with K normally last.
- League-wide remaining needs are useful timing context, but the user's final
  roster quality remains the primary objective.
- One evaluator result or one unusual draft room is not enough to tune a rule.
  Require a repeated generic failure across saved drafts.
