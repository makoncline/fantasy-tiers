# Draft strategy experiments

Date: 2026-09-05

## Aim and evidence

Keep changes that improve the draft tool. Test one cause at a time. Delete a
candidate from the active scoring path when its evidence is weak or negative.
The external review supplied by the owner is a set of hypotheses. Its embedded
citation IDs cannot identify sources outside the research session.

The [strategy reference](draft-strategy.md) states the intended policy. The
[research contract](draft-strategy-research-contract.md) defines the existing
principles and minimum regression checks.

### Owner clarification: practical improvement, not false precision

Projections and ranks are guesses. Use experiments to catch clear errors and
find choices that remain reasonable when those guesses change. Do not use a
small projected-point or mock-grade gain as a reason to force a pick.

For each decision-policy candidate:

- Set plausible input variations before testing. Check whether the result holds
  across different player forecasts and opponent behavior, not only more seeds
  with the same fixed forecast.
- Separate material improvements from close calls. If small input changes reverse
  the preferred pick, show reasonable alternatives and leave room for owner
  judgment. Do not claim a calibrated confidence band without evidence.
- Review changed picks for clear roster mistakes, large reaches, and useful depth.
  A metric is supporting evidence. It does not replace draft judgment.
- Prefer the simpler method when gains are small or unstable. Stop tuning when
  added precision no longer helps a real draft decision.

Availability testing still has a useful role: whether a player was selected
before our next turn is observable. Better prediction of that event does not
prove that the available player will score more fantasy points.

## Priority and experiment contracts

| Order | Experiment | Accepted principle | Required result | Promotion decision |
| --- | --- | --- | --- | --- |
| 0 | Record full weighted components, legal value sacrificed, fixed input hashes, and paired uncertainty. | DS-09 | Instrumentation must leave every pick unchanged. Reject comparisons with different settings, seeds, or source snapshots. | Keep as evaluation support when checks pass. |
| 1 | Remove waiting effects at the final own pick. | DS-02, DS-03 | Market-price changes and missing ADP must not alter the final timing score. No earlier picks may change. All roster gates must pass. | A calculation fix can pass without a claim about future fantasy wins. |
| 2 | Test profile-preserving ECR calibration under reference scoring, then apply league scoring. | DS-01, DS-02 | Prove player-specific custom-scoring sensitivity. Check all-slot roster regressions. Require independent historical point-error or lineup evidence before promotion as a better forecast. | Hold if forecast evidence is absent. |
| 3 | Cap total positive context; test caps of 30 and 60 current score units. Separately remove demand and timing. | DS-03, DS-04, DS-05 | Check reach tails, starter/FLEX quality, legal completion, and component effects. Caps are screening hypotheses, not calibrated uncertainty bands. | Reject roster regressions. Do not promote on ECR alone. |
| 4 | Test availability prediction before a two-pick policy. | DS-03, DS-08 | Compare a platform-only prediction with roster-aware prediction on complete draft boards and source snapshots saved before the draft. Measure Brier score, log loss, and calibration by exact wait distance. | Do not add a probability policy if the input or prediction gate fails. |
| 5 | Test two-pick sequence utility with the accepted availability model. | DS-03, DS-04 | Replace overlapping timing/run/demand terms. Compare legal marginal lineup utility for pick A then B versus B then A. Test fresh boards and both short and long snake waits. | Require independent outcome evidence and no material tail regression. |
| 6 | Test rank-dependent games, bench roles, bye replacement cost, and rare second-TE FLEX value. | DS-01, DS-04, DS-07 | Change one assumption at a time. Use historical data available before each season. | Lower priority. Keep owner roster limits until an exception passes its test. |

## Frozen screen

Baseline code: `0b0d75c5a3e7eec7871c800673f8fe1ea6a02a92`.
The first screen uses all 12 slots and three independent seeds per slot.
Seed prefix: `review-20260905`. Opponent policy: `sleeper-market-v1`.
League: 12 teams, 14 rounds, 0.69 PPR, 1 QB, 2 RB, 2 WR, 1 TE, 2 FLEX,
0 K, 1 D/ST, 5 bench spots. IR is not drafted.

Local artifacts are under `data/draft-results/research-experiments/`:

- `source-manifest.json`: SHA-256 hashes for every aggregate JSON input.
- `source-snapshot.tar.gz`: the complete aggregate input directory.
- Each named experiment: full canonical draft results and decision logs.
- Comparison reports: paired changes, reach percentiles, component contributions,
  and 95% bootstrap intervals from 2,000 resamples of whole draft pairs.

The source-health report creation time can differ between runs. It is not a
source update. Compare the source file hashes and projection timestamps.
The player-ID signature alone cannot prove unchanged projection or rank values.

Run each candidate through `pnpm run draft:algo-mocks`. Change the canonical
scoring implementation for the run. Do not add a production model selector or
build another recommendation pipeline. Preserve tested candidate patches with
the experiment evidence, then restore candidates that do not pass.

Example comparison:

```sh
python3 scripts/draft/compare-experiments.py BASELINE/batch-summary.json CANDIDATE/batch-summary.json --output comparison.json
```

## Interpretation limits

ECR is an input to Val. The core-starter ECR score is the sum of the selected
starter/FLEX ranks; **lower is better**. It is a regression diagnostic.
Val is also an internal metric. Do not compare its numeric scale across value
model changes as if it were a common outcome scale.

The screen can reject a bad candidate. It cannot establish better season
results. Bootstrap intervals describe variation across these simulated boards;
they do not include forecast error or errors in the opponent model.
Correlations between selected-pick components are descriptive. They do not prove
causation or duplicate information.

For promotion of a forecasting or strategy change, use a separate outcome
source, weekly legal lineup utility, and rolling season holdouts. A historical
optimal lineup is an upper bound; also evaluate a feasible lineup policy that
uses only information available before each game. Keep test seeds separate from
seeds used to choose parameters. Report failures by slot and opponent policy.

## Results

The results below separate retained changes from unproven candidates.

### Retained: final-pick timing fix

The first 36 matched drafts changed only 20 final selections. Each change
increased selected Val; the mean gain across all 36 drafts was **6.35 Val**
(95% paired bootstrap interval: 3.99 to 8.90). No earlier pick changed.

Fresh validation used five seeds per slot and two opponent policies. The seed
prefix was `review-holdout-20260905`. Each row below contains 60 draft pairs.

| Opponent policy | Final picks changed | Mean final-pick Val gain | 95% interval | Earlier picks changed | Roster and construction checks |
| --- | ---: | ---: | --- | ---: | --- |
| Sleeper market | 35/60 | +5.65 | +4.06 to +7.35 | 0 | 60/60 pass |
| ADP plus needs | 39/60 | +6.31 | +4.70 to +7.96 | 0 | 60/60 pass |

Across the first screen and fresh tests, 94 of 156 final selections improved.
Core-starter ECR scores did not change. This fixes an invalid waiting penalty;
it does **not** establish an increase in actual fantasy points or win rate.

The code keeps roster completion and player availability checks. It removes
final-pick timing, run urgency, tier urgency, ADP/depth-price effects, and room
demand. Missing market rank remains visible as a data note but has no final-pick
score penalty. The explanation no longer says that a player can wait or will be
gone before another pick when no future own pick exists.

### Held or rejected: calibration and additive context

Each screen used the same 36 seeds and the final-pick fix as its baseline.
Negative ECR deltas are better. Every screen produced 36 legal, complete rosters.

| Candidate | Changed picks | Mean core ECR delta | 95% interval | Decision |
| --- | ---: | ---: | --- | --- |
| Preserve stat profiles through ECR calibration | 96 | -0.50 | -2.61 to +1.79 | Hold. Custom-scoring behavior works, but outcome benefit is unproven. |
| Cap total positive context at 30 | 240 | -11.97 | -19.68 to -4.62 | Reject this version after fresh construction failures. |
| Cap total positive context at 60 | 171 | -7.46 | -12.77 to -2.37 | Hold. Screen only; no independent outcome evidence. |
| Remove demand component | 13 | -0.86 | -2.46 to +0.12 | Hold. The screen does not show a stable benefit. |
| Remove timing component | 87 | +1.59 | +0.33 to +3.14 | Reject blanket removal. Replace timing with a tested model instead. |

For the cap screen, positive contributions from timing, starter need,
construction, QB/TE, depth, and demand were scaled together when their sum
exceeded the cap. Negative terms, base value, and risk were unchanged. This is a
simple cap experiment, not the proposed point-equivalent primary-utility gate.

The 30-point cap reduced the 95th-percentile value sacrifice from 31.0 to 14.2
Val in the screen. It also improved ECR in both fresh opponent-policy tests.
However, it moved WR2 to round 6 in three of 120 drafts. The existing contract
requires WR2 by round 5. These were legal rosters that failed a construction
gate, not incomplete rosters. The failures occurred in slot 4 under both bot
policies and slot 12 under the market policy. Do not relax a gate after seeing a
favorable grade. Review whether the gate measures lineup quality in a separate
experiment with independent outcomes.

The profile candidate calculated a reference point curve under the ECR scoring
bucket, scaled each player's own projected total by the reference multiplier,
then applied the league scoring. For the supported linear offense rules, this
is equivalent to scaling that player's stat vector. The owner configuration
uses PPR ECR as its reference, not half-PPR ECR.

A synthetic two-WR check kept both players at 200 reference PPR points. One had
80 receptions and the other had 20. At 0.69 PPR, the profile candidate retained
175.2 and 193.8 points respectively, instead of transferring the higher total
to the better ECR rank. Sixteen existing valuation tests also passed. This
proves the intended transformation, not which projection is more accurate.
No profile-calibration change remains in active scoring.

### Availability: promising offline prototype

The saved return predictions were scored on 120 fresh mock drafts. Among the
market-policy boards, the mean predicted survival was 75.05%, versus 74.71%
observed. That close overall result hid errors by wait length:

| Intervening picks | Current predicted survival | Observed survival |
| --- | ---: | ---: |
| 0–3 | 86.08% | 97.48% |
| 4–7 | 82.77% | 87.90% |
| 8–12 | 76.79% | 75.95% |
| 13+ | 66.51% | 59.59% |

The offline prototype then used 32 simulated continuations per decision. It
reused the market bot's choice distribution and phase rules. The platform-only
variant removed roster needs. The roster-aware variant updated opponent
rosters after every simulated pick and allowed backup QB/TE selections. Both
used the exact next own selection and fresh simulation random draws. With zero
intervening picks, survival was exactly one.

Evaluation used the first fresh seed from all 12 slots under each opponent
policy: 24 boards, 312 decision points, and 9,048 candidate outcomes. The
selected player and final own turn were excluded. The pool was the saved top
30 legal recommendations; it was not the full player population.

| Outcome boards | Current Brier | Platform simulation Brier | Roster simulation Brier | Current log loss | Roster simulation log loss |
| --- | ---: | ---: | ---: | ---: | ---: |
| Sleeper market | 0.1092 | 0.1015 | 0.0827 | 0.3672 | 0.2906 |
| ADP plus needs | 0.0906 | 0.0756 | 0.0574 | 0.3017 | 0.2063 |

Lower is better for both metrics. Whole-board bootstrap intervals for the
roster prototype's Brier change versus current predictions were -0.0310 to
-0.0219 and -0.0373 to -0.0298. These intervals describe synthetic board
variation, not transfer to real leagues. The prototype shared bot methods with
one outcome generator. D/ST Brier became worse under both policies, even
though overall error improved. QB and TE sample counts were small.

**Decision: retain the offline experiment; do not use its probabilities in live
recommendations yet.** It has passed a synthetic mechanism screen, not the live
prediction gate or a two-pick roster-outcome test.

The input audit found 27 saved Sleeper pick files. None had a full saved source
snapshot, and none passed the current verified replay artifact contract. Do not
rebuild their pre-draft predictions from today's ranks and call that a holdout.
Also, the existing local mock engine applies our one-QB/TE roster limit to
opponents. That makes local bots less varied than a real room. The prototype
allows backups, but that behavior still needs live evidence.

Reproduce the prediction screen with:

```sh
node --import=tsx scripts/draft/availability-experiment.ts BATCH/batch-summary.json prototype.json
python3 scripts/draft/evaluate-availability.py prototype.json --prototype --output prototype-report.json
```

### Next experiment boundary

1. Capture complete input bundles, timestamps, actual picks, league settings,
   and pre-pick predictions from new Sleeper mocks. Use a fixed candidate cohort
   with QB/TE representation. Record opposing backup picks.
2. Compare current, platform-only, and roster-aware predictions on those boards.
   Check calibration by exact wait distance and position. Keep D/ST separate if
   its different behavior persists. Do not fit and score on the same boards.
3. If the prediction gate passes, test two-pick utility in the canonical board.
   Replace existing timing/run/demand effects. Preserve roster legality and
   score the resulting roster through an independent lineup evaluator.
4. Obtain historical preseason stat/ECR snapshots and subsequent weekly results,
   or a separate projection source. Test profile calibration and primary-utility
   gating there before changing their production use.

The first cycle completed 648 full mock drafts, including the unchanged instrumentation
rerun, plus the offline prediction continuations. It finished with all source file hashes
matching its frozen manifest. Instrumentation preserved all 504 baseline picks.
Decision log version 2 is required for contribution and legal-value analysis;
rerun older logs instead of guessing missing contributions.

The API health test had a fixed September 4 clock and rejected the September 5
input as future data. Its clock now follows the checked-at time of its data
fixture. No source data was refreshed during the first offline cycle.

## Prospective Sleeper pilot: September 5

**Decision: the roster-aware prototype failed this pilot's promotion screen. Keep
the current production model. Do not connect the prototype to two-pick utility.**

We completed one new Sleeper mock from slot 4. All 14 actual selections matched
the current canonical recommendation saved before that selection. The 13 waits
produced 780 prospective player observations. The final selection had no return
prediction. The owner roster finished with 1 QB, 5 RB, 6 WR, 1 TE, and 1 D/ST.
All required starter and FLEX slots could be filled. This is a roster-completion
check, not an independent roster-quality score.

The candidate cohort was fixed before testing: the top 12 available players by
market order at each of QB, RB, WR, TE, and D/ST, excluding the selected player.
This kept QB and TE in the sample after our starting slots were filled. Each
simulation used 128 samples and allowed opposing backup picks.

| Model | Brier error | Log loss | Mean predicted survival |
| --- | ---: | ---: | ---: |
| Current | 0.0630 | 0.2305 | 76.20% |
| Market and phase rules, without roster adjustments | 0.0480 | 0.1735 | 81.21% |
| Market, phase, and roster rules | 0.0680 | 0.2571 | 81.07% |

Observed survival was 81.15%. Lower error is better. The roster model's close
average did not make its individual probabilities accurate. Its Brier error
was 7.9% worse than current. The simpler model was 23.7% better overall, but
its D/ST error was worse. Neither candidate passed all promotion conditions.

| Position | Current Brier | Market and phase Brier | Roster-aware Brier |
| --- | ---: | ---: | ---: |
| QB | 0.0451 | 0.0283 | 0.0683 |
| RB | 0.0853 | 0.0495 | 0.0579 |
| WR | 0.1054 | 0.0801 | 0.1162 |
| TE | 0.0538 | 0.0372 | 0.0469 |
| D/ST | 0.0251 | 0.0452 | 0.0504 |

The simpler model improved both observed wait groups. Its Brier error was
0.0423 versus 0.0555 for six intervening picks, and 0.0529 versus 0.0693 for
sixteen intervening picks. The roster model was worse in both groups.

### What the pilot exposed

- Opponents selected eight backup QBs and eight backup TEs. The prototype allows
  backups but applies large penalties after an opponent fills a starting slot.
  Several QBs received more than 99% predicted survival and were then selected.
- The shared bot method adds 175 market-rank places to D/ST before round 13.
  That expresses our draft preference, not the observed opponent behavior.
  Sleeper selected defenses at picks 91, 94, 108, 119, 120, 127, and 135 before
  our round-13 defense pick. Several had more than 99% prototype survival.
- The raw Sleeper metadata called Travis Hunter a DB when an opponent selected
  him. Our frozen candidate pool retained his WR eligibility. Preserve raw
  metadata and player IDs when auditing position counts; do not treat that
  source label as proof this was an IDP draft.

These observations identify model assumptions to test. They do not establish
new universal QB, TE, or defense weights. Do not tune this board and then call
its improved score a held-out result.

### Evidence limits and retained work

This is one completed board against Sleeper bots. The 780 rows are correlated;
they are not 780 independent drafts. The report therefore does not give a
between-board confidence interval. It does not prove performance against human
managers or an increase in season lineup points.

The mock used its existing PPR preset, two FLEX slots, no kicker, and 14 rounds.
It was not an exact 0.69-PPR league test. The app derived non-reception scoring
rules from its preset defaults because the mock exposed no full scoring map.
The source refresh was completed before the input bundle was frozen. All 183
players in the expected draft pool passed readiness. Hunter and Higgins remained
reserve-only warnings.

One earlier 60-second-clock attempt failed because browser delays allowed two
automatic user picks. It was stopped and excluded. The completed run used a
ten-minute clock. Our Queue Auto-pick switch stayed off. The room CPU setting
was enabled after the initial pause so unclaimed teams could draft.

Retain the prospective collector and the prediction tests. They save the full
bundle, raw and parsed draft state, canonical view model, selected player,
predictions, and source/code hashes. Files cannot overwrite an earlier capture.
The collector requires a paused own turn, checks the board again before saving,
and verifies all actual own selections at completion. The completed pilot also
has a source-code archive. Small input-validation guards added after this pilot
do not change its model weights.

Artifacts are in ignored
`data/draft-results/live-availability-20260905-slot4-long/`:
`manifest.json`, `bundle.json`, `source-code.tar.gz`, 14 `turn-*.json` files,
`completed-state.json`, `predictions.json`, `report.json`, and
`opponent-backups.json`.

Use the collector as follows. Claim a slot and verify settings before `init`.
Do not alter the inputs or model code during a draft.

```sh
node --import=tsx scripts/draft/capture-sleeper-evidence.ts init DIR DRAFT_ID USER_ID
# Pause on each own turn. Save the prediction before selecting its player.
node --import=tsx scripts/draft/capture-sleeper-evidence.ts turn DIR
node --import=tsx scripts/draft/capture-sleeper-evidence.ts finish DIR
python3 scripts/draft/evaluate-availability.py DIR/predictions.json --prototype --output DIR/report.json
```

### Revised next experiment

1. Separate opponent availability from our roster policy. Test a market-only
   selection distribution that has no forced late-D/ST rule. Use this pilot
   only for development and diagnosis.
2. Freeze that model, then capture new boards at different slots. Compare it
   with current predictions by position, phase, and actual wait distance.
   Require improved D/ST behavior and credible QB/TE backup probabilities.
3. Add roster-demand terms only if they improve new held-out predictions over
   the simpler market model. Do not assume starter completion ends demand.
4. Proceed to two-pick decision experiments only after that prediction gate.
   Keep the separate independent weekly-lineup outcome gate for promotion.

Validation: 401 project tests passed, including the new availability integration
test. TypeScript and focused lint checks passed. The Python report tests also
check that one board cannot produce a confidence interval.

## Source checks

- [FantasyPros scoring settings](https://www.fantasypros.com/scoring-settings/)
  confirms the standard offensive yardage, touchdown, interception, and fumble
  rates used for the reference-scoring experiment. Reception points follow the
  ECR bucket selected by the app.
- [Subvertadown's snake-value method](https://subvertadown.com/article/fantasy-snake-drafts-and-strategizing-for-scarcity----snake-value-based-drafting)
  supports assessing the value lost before a later pick. Its approximations do
  not validate our simulation weights or prove better fantasy outcomes.

## Choice-assistant milestone (supersedes the next-work order above)

Owner decision, September 5: retain the final-pick correction and experiment
 tools. Build a clear choice assistant before a stronger selection policy.
The earlier contracts and decisions remain frozen. In particular, cap-30 stays
rejected under its original WR2 deadline gate. Its three delayed-WR2 drafts are
diagnostic cases, not proof that those rosters were worse. Test the deadline
separately on new cases before changing that hypothesis.

| Work | Deliverable | Active selections |
| --- | --- | --- |
| A | Freeze the retained fix and classify constraints. | Only the retained fix. |
| B | Default lean, credible comparisons, contributions, roster consequences, and personal judgment. | Unchanged. |
| C | Documented stress cases, changes to the choice set, and conditional conclusions. | Unchanged. |
| D | Market-only opponent model; freeze it before 12 complete new boards across all slots. | Advisory only. |
| E | Two-pick path preview; use accepted availability or labeled hypothetical cases. | Advisory only. |
| F | Separate selection-policy experiment and acceptance review. Replace superseded timing terms. | Only after acceptance. |

### Display and stress contract

Use the full canonical eligible board. Keep the default recommendation. Show
up to two automatic alternatives and allow an explicit player comparison.
Include the highest base-value option. For additional options, use the best
base value at each position if it shares the lean's overall tier or has higher
base value; include one nearby same-position tier option. These are transparent
display rules, not calibrated close-choice bands. Do not force a weak position
into the display. Show further matching candidates on expansion. A user-picked
comparison need not be a reasonable alternative.

Show base value separately from the weighted contributions to Adj. When context
reverses base-value order, show the sacrificed Val and the largest contribution
differences. Do not impose a new cap. Show the available starter or FLEX slot and
remaining requirements. Bench coverage is a roster fact, not an upside estimate.
Personal judgment is a separate note and must not alter any score.

Val currently means an **ECR-calibrated value estimate**. Actual custom scoring
shapes each positional point curve, which is then assigned in ECR order. It does
not retain each player's scoring profile. Show the original league-scored
Sleeper projection and ECR-assigned projection in details. Keep the separate
profile-preserving experiment and synthetic tests. A future change to this field's
meaning needs an explicit product decision; forecast superiority needs outcome
evidence from information available at the time.

The first stress set has six hand-set cases, with the actual league rules fixed:

- Swap adjacent ECR pairs within each position, with pair offsets zero and one.
  Move the assigned curve values with those ranks. Keep tiers fixed and state it.
- Change QB and TE expected usable games by minus one and plus one. Recompute
  replacement baselines with the existing value function.
- Move RB market prices one round earlier; separately move WR prices earlier.
  These test the current timing heuristic, not an independent opponent model.

Use the canonical board for every case. Report its default, full choice set,
added and removed options, starting-slot purpose, and Adj lead. Separate a swap
within the initial choice set from a changed roster path or a new candidate.
A path change is a review signal, not an automatic failure. Preserve required
final-slot completion in every case. Use “Stable under tested assumptions”,
“Choice changes with assumptions”, or “Insufficient evidence”. Neither case
frequencies nor an unchanged ordering establish forecast confidence or a large
advantage. Alternate providers, player-profile calibration, and a validated
opponent model are not covered by these first six cases.

### Availability work and stopping rule

The next independent opponent baseline must use platform market order, simple
selection variation, exact wait distance, and sequential picks without
replacement. It must not inherit our ECR requirement, one-QB/TE policy, late-D/ST
policy, or construction deadlines. Add roster features only after they improve
fresh forecasts over that baseline.

Use the 27 older pick files for descriptive behavior counts where identities and
settings are clear. Preserve format and position uncertainty. Do not recreate
historical forecasts with current data. The September 5 pilot is development
only. Freeze the next candidate before 12 new complete boards, one per slot.
This is a coverage budget, not a statistical power claim. Record bot versus
human environment and verify the full scoring map where available; a PPR label
is not verification of the owner's 0.69 rules.

Predeclare a broad cohort and a decision-relevant cohort; hold each fixed across
models before outcomes. Measure Brier score, log loss, calibration, remaining
acceptable options, and the event that at least one acceptable positional option
survives. Report D/ST behavior and its effect on offensive survival. A limited
offensive preview can be accepted only under a predeclared use and evidence that
defense behavior does not distort that preview. Do not discard a bad subgroup
after the results. End the batch with accept limited use, reject, or experimental.
Do not automatically start another tuning cycle.

Two-pick previews must compare legal resulting rosters, include both FLEX slots,
and use consistent assumptions for undrafted slots. Label simulated alternate
paths as simulations, even from a real starting board. Scenario path loss is
model-relative, not measured lost fantasy points. Keep difficult bench paths
advisory. No season simulator, manager personality model, universal upside
score, environment bonus, or further additive cap search is a release priority.

### Choice-assistant implementation result

A–C are implemented locally. The shared live and mock panel now shows the current
lean, up to two automatic comparisons, an explicit eligible-player comparison,
base-value sacrifice, full weighted contributions, roster fit, and qualitative
waiting context. Source projection details explain the current meaning of Val.
A personal note stays separate from scoring. The evidence download includes the
snapshot, shown comparisons, stress report, and personal judgment.

The active final-pick correction and experiment tools remain. No cap, profile
calibration candidate, or availability prototype was promoted. The mock room
now shows the shared recommendation panel again; the former table-only study
setting had hidden it. This changes the display, not picks.

Verification used a fresh frozen baseline and candidate on the same source files:
36 paired drafts (three seeds at every slot), 504 full decision records, zero
changed decision records. All 36 rosters passed the existing checks. Input file
hashes matched. The generated source-health timestamp was excluded from equality
because it records report creation, not changed source data.

The first sensitivity report used 48 decision points: first seed at each slot,
rounds 1, 5, 8, and the final round. Each received the same six stress cases.
Fifteen retained their full choice set; 33 changed it. Five changed the default
roster path under at least one ECR-pair swap. This is descriptive stress evidence,
not a probability or a claim of better outcomes. The five path cases were:

| Slot / round | Current lean | Changed path | Interpretation |
| --- | --- | --- | --- |
| 2 / 5 | QB | FLEX | The changed Adj lead was 2.9. Review QB timing against flexible depth. |
| 3 / 1 | WR | RB | Both are open starter positions. ECR swaps change the opening path. |
| 9 / 5 | WR | QB | The changed Adj lead was 4.3. Review which slot can wait. |
| 10 / 5 | TE | QB | One scenario produced a 27.6 Adj lead. Show the dependence on ECR ordering; do not call it forecast certainty. |
| 12 / 1 | RB | WR | The changed Adj lead was 3.9. Both opening paths remain worth review. |

No changed path is treated as an observed counterfactual or an automatic roster
failure. The required-final-D/ST integration case retained D/ST in all six cases.
The UI test checks that stress analysis does not alter the displayed default.

Artifacts: `data/draft-results/choice-assistant-release/` contains input hashes,
`paired-regression.json`, and `stress/summary.json` plus per-decision reports and
bundle snapshots. Baseline and candidate full drafts are in the adjacent
`choice-assistant-baseline/` and `choice-assistant-candidate/` directories.

Run the reusable diagnostic with:

```sh
node --import=tsx scripts/draft/report-choice-assumptions.ts BATCH-SUMMARY.json OUTPUT-DIR
```

D–F remain separate milestones. The 12-board fresh availability batch has not
started. The September 5 Sleeper pilot remains development evidence. There is
no new opponent model, two-pick controller, or outcome-improvement claim in this
release.

Local verification: 404 tests passed across 64 files. After the final display
and evidence-export refinements, the five affected integration checks passed
again. Type checking, lint, and whitespace checks passed. Chrome verified the
slot-4 0.69-PPR local mock: unchanged default, explicit comparison, personal note,
six stress cases, and the JSON evidence download. The download's weighted
components reconcile with Adj. Evidence and screenshot paths are recorded in
`choice-assistant-release/browser-verification.json`. This is local verification;
no commit, push, or deployment was made for this milestone.

## Final A–C verification and D prospective batch

A–C remains the release candidate, with no additional selection-policy change.
See [the final verification](choice-assistant-release-verification.md) for the
existing-artifact comparison coverage and the slot-10 round-five trace. The
zero-opponent waiting explanation received a display-only correction.

D's market-only candidate is now frozen and its 12-board prospective batch is
complete: 156 forecasts and 9,478 player observations. The result is **retain as
experimental**. Offensive decision Brier improved overall, but the fixed
comparison for waits with a defensive selection failed. Decision-cohort log
loss also worsened. No forecast model or selection policy was promoted.

See [the protocol](market-only-prospective-protocol.md) and
[the complete results](market-only-prospective-results.md). Owner adherence is
recorded separately from forecast evidence validity. All registered boards
passed the prospective boundary checks.
