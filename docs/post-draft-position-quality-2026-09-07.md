# Post-draft position quality review

Status: owner rejected the added UI; it has been removed. The requested
deliverable is now correct within-position ADJ order. The owner subsequently
authorized the [selected-source implementation](selected-source-order-2026-09-07.md).
Experiments below record the earlier research at the frozen baseline commit.
No deploy, merge, production policy change, or live draft action occurred.

## Frozen baseline

Frozen at **2026-09-08 02:32:27 UTC** (September 7 in Denver), from commit
`3d5affe2d63f18ccc223b55d10bc42932753743c`. Each selected source file was read
twice and its SHA-256 checked before copying. Originals were not edited.
The manifest records source paths, byte counts, and hashes.

Local artifacts are in `data/draft-results/post-draft-20260908/` (ignored).
The [review manifest](post-draft-position-quality-manifest.json) preserves the
provenance without committing large response files.

- Actual draft: frozen `actual-draft-20260907/` responses, notes, and final picks.
- Final mock: frozen `fresh-context-classic-20260907/` responses, notes, and picks.
- Experiment input: actual `preflight-view-model.json`, including the full
  canonical player pool and separate FP/Sleeper source values. No refresh occurs.
- Actual scoring: 12 teams, snake, slot 4, 15 rounds, 0.69 PPR, QB1/RB2/WR2/TE1,
  two RB/WR/TE FLEX, K1/DEF1, bench5. Exact scoring fields come from the frozen
  snapshot. The older 14-round no-kicker preset is not used.
- FP native projections set the owner baseline. Sleeper native projections are
  evaluated separately. Both share Sleeper K/DST projections. Tiers are FP ECR
  tiers. ADJ is a contextual ranking score, not projected fantasy points.
- The final mock notes do not verify actual 0.69 scoring. Its saved scoring is
  preserved; it is not treated as the same-format trial.

## Actual picks and timing

The frozen final file has 180 sequential, unique picks and 15 slot-4 picks:
Taylor, London, McBride, Skattebo, Jameson Williams, Maye, Pollard, Godwin,
Monangai, Meyers, Deebo Samuel, Shakir, Sampson, Lutz, and Baltimore.
This is saved-state proof of a complete pick sequence, not a new live-state check.

The frozen notes distinguish advice from selections:

- Rounds 1–11: notes record the FP default and subsequent owner selection.
- Round 12: Shakir matched the default, but the final comparison was late.
- Round 13: the owner selected Sampson after a conflict flag. The default was
  Dillon. This is an owner deviation, not an algorithm selection.
- Round 14: Lutz differed from the Fairbairn default. Advice timing and the
  reason for the deviation are not established.
- Round 15: Baltimore is in final picks. This frozen note version has no round-15
  advice record. Do not infer one.

Actual response board numbers are 17, 27, 40, 51, 67, 73, 92, 100, 117, 139,
147, and 163. A filename such as `source-r12.json` does not establish pick 141.
The exact-pick-100 response was read after the owner pick; an exact board number
alone does not establish timely advice. Mock responses at 48 and 79 were late.

## Saved-state findings

All **40 source boards** (20 states × FP/Sleeper) replayed through canonical
scoring with the same lead and **zero component difference** across the eligible
pool. This verifies replay mechanics against these snapshots.

Holding the baseline position fixed gives these diagnostics:

| Snapshot group | States | Highest VAL changes lead | Tier then VAL changes lead |
| --- | ---: | ---: | ---: |
| Actual | 12 | 4 | 3 |
| Final mock | 8 | 0 | 3 |

These selected, dependent states are not independent trials or alternate drafts.
The earlier 16-state result covered only the first eight actual responses; the
new count adds four later actual responses.

Two FP default recommendations meet the measured conflict rule:

| Returned pick | Default | Alternative | VAL default / alternative | Position tier | Timing ADJ | Risk ADJ |
| --- | --- | --- | --- | --- | --- | --- |
| 100 | Monangai | Jones | 7.9 / 16.1 | 11 / 10 | +7.8 / −6.9 | −3.2 / 0 |
| 147 | Dillon | Sampson | −46.1 / −42.5 | 11 / 11 | +1.8 / −3.2 | 0 / 0 |

At pick 100, timing supplies a 14.7 ADJ relative edge, overcoming Jones's
8.9 base-component edge and 3.2 risk edge. Other components match. The final
ADJ gap is 2.6. A small ADJ lead thus hides an 8.2 VAL sacrifice.
At pick 147, timing supplies 5.0 ADJ against Sampson's 4.0 base-component edge.
The actual on-clock note at 148 has different timing numbers; it is not relabeled
as the pick-147 response.

Godwin/Pittman at pick 92 is different: Pittman has higher VAL (12.7 versus
10.4), but a worse FP tier (8 versus 7) and a −3 risk component. Godwin's timing
edge is 5.8 ADJ. The conflict rule does not flag this disagreement.
Strict tier-first at pick 100 picks Gainwell (tier 8, VAL 0.4). In the mock it
replaces Rice with Olave, Shakir with Coker, and Dobbins with Dowdle in saved
states. Ordinal tiers alone do not protect native FP value.

The audit records 4,177 pair reversals among players still eligible in two
successive saved responses. Of those, 363 finish with an absolute ADJ gap below
1. This is a descriptive scale, not a new tolerance or acceptance rule. The
raw audit records VAL gaps and every component-gap change. It includes deep
players and intervals with owner picks; it cannot isolate opponent picks as a
cause. No performance inference uses the raw count.

### Why the order can change

`src/lib/draftValue/index.ts` recalculates player-specific ADP thresholds,
comeback pressure, same-tier alternatives, ECR rank-gap cliffs, WR construction,
phase weights, and bench market penalties. These can change one player's score
more than another player's at the same position. General position demand and
run terms usually cancel within a same-position pair. Thresholds and phase
changes can still make the resulting player contributions differ.

`verify-position-replay.ts` checks the saved boards; `audit-position-quality.py`
attributes each observed reversal to component-gap changes. These are separate
from a causal intervention with only one opponent pick changed.

## Rejected explanation proposal

The owner rejected this proposal after review. Its UI and display-only helper
were removed. The description below is retained as the historical proposal,
not current app behavior.

The recommendation table has one compact, collapsed same-position comparison.
It reads the full canonical eligible pool. If a measured conflict exists, it
shows the highest-VAL conflicting alternative. Otherwise it shows the highest
VAL among the other eligible players at that position. Ties use existing ADJ.

A conflict requires strictly higher VAL, known positive equal-or-better position
tier, no greater availability penalty, and no worse data/news risk component.
Unknown availability is not treated as zero risk. Expanded details show both
players' VAL, tier, ADJ, availability, risk, and each nonzero component gap.
The display is hidden while the pick feed is stale. It never changes selection.

## Candidate definitions and acceptance gates

All policies read the canonical eligible pool. No policy uses player names or
IDs as decision rules. Every position competes using its actual representative;
none chooses a position with one player's urgency and silently swaps in another.

- **Baseline:** unchanged canonical top recommendation.
- **Quality guard:** for each position's ADJ leader, use the highest-VAL measured
  conflict only if timing supplies the leader's edge and the alternative's
  non-timing score is at least as high. Then compare representatives by their own
  ADJ. No tolerance is added. Risk stays in the comparison.
- **Highest value:** choose highest VAL at each position among candidates with
  known availability and no worse availability penalty or risk component than
  that position's default. Retain the default if this set is empty. Then compare
  their own ADJ. This is explicitly risk constrained, not unconditional max VAL.
- **Tier-first diagnostic:** choose best known position tier, then VAL, then ADJ
  within each position; compare representatives by their own ADJ. Existing risk
  remains in ADJ, but the tier ordering has no dominance guard.
- **Position timing:** choose each position's representative by ADJ without
  timing and demand. Compare representatives by their own non-market score plus
  their own timing. This also removes explicit room demand as a separate
  ablation. ADJ timing does not contain that demand term; only the display
  urgency summary includes it. No new timing weights or optimizer are added.
  This tests a staged heuristic plus demand removal, not a calibrated
  expected-loss model. Results cannot attribute an effect to either change alone.

Tests use three fixed seeds in all 12 slots, plus three more slot-4 seeds:
39 paired cases per policy. FP inputs, scoring, the full 3,227-player frozen pool,
and `sleeper-market-v1` opponents are fixed. The same seed is used for each pair;
changed picks can change later bot responses. FP and Sleeper forecasts remain
separate. Changed-pick logs retain original component scores and player risk.

Acceptance requires legal completion, unchanged owner-policy compliance, no
unexplained starter/FLEX or depth regression, traceable decision changes, and
robustness beyond this single forecast/opponent model. Projection totals are
internal forecast measures, not independent outcome evidence. A policy is not
accepted merely because its mean is positive.

## Results and decision

All **195/195** drafts completed legal rosters and passed the canonical mandatory
and core-construction checks. All kept the one-QB/one-TE owner policy.
Each candidate has 39 paired cases; the slot-4 subset has six.

Mean candidate-minus-baseline season projection totals follow. Starters exclude
FLEX and include K/DST. FP has 39 complete pairs for every candidate. Sleeper
pairs require projections for every rostered player in both drafts.

| Candidate | FP starters | FP FLEX | FP bench | Sleeper complete pairs | Sleeper starters | Sleeper FLEX | Sleeper bench |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| quality-guard | +0.00 | +0.00 | -0.91 | 18/39 | +0.00 | +0.00 | -1.19 |
| highest-value | +7.93 | +3.99 | +8.87 | 16/39 | -19.96 | -3.93 | +12.83 |
| tier-first | +2.21 | -5.56 | -28.34 | 10/39 | +1.47 | -3.96 | +22.59 |
| position-timing | +0.19 | +3.36 | +2.47 | 16/39 | -4.19 | +1.47 | +11.15 |

The frozen Sleeper source has no A.J. Dillon projection. Roster comparisons
that include this gap are excluded as incomplete, not scored as zero. Different
candidate rows therefore use different complete subsets; do not compare their
Sleeper averages as if they shared all 39 cases. FP projections cover all picks.

| Candidate | Direct interventions on own path | Changed picks versus paired baseline path | Total VAL sacrificed at interventions |
| --- | ---: | ---: | ---: |
| quality-guard | 19 | 26 | 0.8 |
| highest-value | 83 | 178 | 12.4 |
| tier-first | 166 | 212 | 2009.9 |
| position-timing | 47 | 128 | 26.1 |

The VAL-sacrifice column sums positive default-minus-selected VAL on each
candidate path. It is not a season-points loss. Even the quality guard can give
up VAL across positions after the representative changes; its 0.8 sacrifice
occurs at that later position comparison, not a violation of same-position
dominance. Full traces preserve names, tiers, risk, components, seed, and pick.

**Decision: retain baseline selection.** The narrow guard fixes the two saved
conflicts but shows no starter/FLEX gain across 39 paired drafts. FP bench
projection decreases by 0.91 on average (range −44.74 to +9.45): 3 cases worsen,
9 improve, and 27 stay equal. At slot 4 it changes two picks in one of six runs;
average FP bench change is +1.12 with starters/FLEX unchanged. This is insufficient
evidence for a general policy. Keep the guard as the smallest research candidate.

Highest-VAL improves the same FP source that drives it, but loses Sleeper starter
projection on complete pairs. Strict tiers lower FP FLEX and bench totals. The
position-timing ablation does not establish a consistent cross-source gain.
No candidate meets the robustness requirements. This was the initial research decision. The owner subsequently rejected the
explanation and requested a correction to ADJ itself. A separate acceptance/release decision is still
required before any selection-policy promotion or deployment.

The canonical core-starter ECR signal changes by −0.47 (guard), +10.88
(highest-VAL), −9.98 (tier-first), and +3.24 (position-timing); lower is better.
The tier-first ECR improvement alongside FP losses illustrates why this signal
is not independent outcome proof. Positive-VAL bench counts, per-source bounds,
worse/same/better counts, and slot-4 results are in the [compact result data](post-draft-position-quality-results.json).
A positive-VAL count is a depth proxy, not verified weekly usability or injury cover.

## Validation and remaining limits

- 13 focused tests pass, including five new display/policy checks. The UI
  integration test opens the comparison and verifies that the lead and pick
  action remain unchanged. Existing stale-feed and source-change tests pass.
- Typecheck passes. Focused ESLint, including the normally ignored experiment
  scripts, passes. `git diff --check` passes.
- Production Webpack build passes (`pnpm exec next build --webpack`). The default
  Turbopack build first failed to fetch Google Fonts in the sandbox, then failed
  at local worker-port creation with network access. No application workaround
  or dependency change was made.
- No live browser, draft tab, deployment, or pixel-level product verification
  occurred. Display proof is a rendered React integration test and build.
- Only one frozen forecast and one bot model were tested. No prospective
  availability calibration, alternate forecast sensitivity, weekly lineup model,
  or independent season-outcome evidence exists for these candidates.
- Irregular saved-state intervals cannot establish that a specific opponent
  pick caused a reversal. The audit is component attribution, not causal proof.

## Reproduction

These historical results use the baseline commit above. Use that scorer when
reproducing this section; current source-order scoring intentionally changes
the saved leads. Use the frozen files from the review manifest. Commands write only the chosen
output directories. Run the full paired batch before the report command.

```sh
ROOT=data/draft-results/post-draft-20260908
python3 scripts/draft/audit-position-quality.py "$ROOT"
node --import=tsx scripts/draft/verify-position-replay.ts "$ROOT"
node --import=tsx scripts/draft/position-quality-experiment.ts "$ROOT/actual-draft-20260907/preflight-view-model.json" "$ROOT/paired"
node --import=tsx scripts/draft/position-quality-experiment.ts "$ROOT/actual-draft-20260907/preflight-view-model.json" "$ROOT/position-timing" position-timing
node --import=tsx scripts/draft/evaluate-position-quality.ts "$ROOT/actual-draft-20260907/preflight-view-model.json" "$ROOT/paired"
node --import=tsx scripts/draft/evaluate-position-quality.ts "$ROOT/actual-draft-20260907/preflight-view-model.json" "$ROOT/position-timing"
python3 scripts/draft/report-position-quality.py "$ROOT"
```

Input SHA-256: `e586bf8b3b81ac49be3b855b6b626013558352f8da2e9a484517e31607b2ebb4`.
The frozen scores and final run code hashes are recorded in
`data/draft-results/post-draft-20260908/code-manifest.json`.

## Research sources

Reviewed September 7, 2026. These sources support methods, not our weights or
superiority claims:

- [Subvertadown ADP referencing](https://subvertadown.com/article/timing-your-draft-picks-with-adp-referencing---understanding-tapthatdraft-s-time-priority-ordering-of-players-to-help-you-lead-in-your-draft)
  separates personal positional order from timing against an opponent reference.
- [FantasyPros Pick Predictor](https://support.fantasypros.com/hc/en-us/articles/115001315067-What-is-the-Pick-Predictor)
  describes availability estimates. It does not calibrate this app's return model.
- [FantasyPros VBD definitions](https://support.fantasypros.com/hc/en-us/articles/115005868747-What-is-value-based-drafting-What-do-player-draft-values-mean-VORP-VONA-VOLS-VBD)
  distinguish replacement, last-starter, and next-available value.
