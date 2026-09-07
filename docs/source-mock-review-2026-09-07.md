# Source comparison mock — September 7, 2026

## What changed

The first four selections agree. On the current-method board, the native Sleeper version changes 6 of 14 top choices (including defense). FP changes 5 of 13 comparable offensive choices; defense is not modeled by FP. All three completed rosters satisfy the owner counts: 5 RB, 6 WR, 1 QB, 1 TE, 1 D/ST. This is one local simulated board, not a Sleeper bot draft or evidence of better season results.

## Frozen experiment

- Slot 4, 12 teams, snake, 14 rounds, 0.69 PPR, two FLEX, five bench, no kicker.
- Existing local `sleeper-market-v1` opponent model; seed `source-review-2026-09-07-slot4`. These are local bots, not actual Sleeper bots.
- Source snapshots are frozen in `frozen-inputs.json`. FP source date September 7; Sleeper projection date September 6. No API calls were made for the experiment.
- Input SHA-256: `27b828113cffc81f0127a78e1766378db706fbe149be80be1ace41385d3cc05f`.
- Main comparison: all three methods see identical previous picks and owner roster at each step; select the current method's winner.
- Separate continuations: same starting state, settings, source files, and seed; each version makes its own picks. Once choices differ, opponents and later boards can differ. These are simulated counterfactuals.
- Current = ECR-calibrated Sleeper curve. Native sources retain their own points; each reruns the existing adjustment model. No model weights were tuned.
- Values in each cell below are **Val / Adj**. Adj is normalized within each source and turn. Compare who leads within a source, not absolute Adj magnitudes between columns.

## Every pick on the current-method path

| Round / pick | Current | Sleeper | FP |
| --- | --- | --- | --- |
| 1 / #4 | Jahmyr Gibbs (RB) **170.2 / 187.0** | Jahmyr Gibbs (RB) **170.2 / 187.0** | Jahmyr Gibbs (RB) **207.8 / 187.0** |
| 2 / #21 | Ceedee Lamb (WR) **95.4 / 171.1** | Ceedee Lamb (WR) **95.4 / 171.1** | Ceedee Lamb (WR) **104.2 / 144.2** |
| 3 / #28 | Jonathan Taylor (RB) **119.5 / 177.5** | Jonathan Taylor (RB) **119.5 / 177.5** | Jonathan Taylor (RB) **155.2 / 177.5** |
| 4 / #45 | Justin Jefferson (WR) **90.6 / 200.1** | Justin Jefferson (WR) **79.2 / 188.7** | Justin Jefferson (WR) **93.1 / 179.5** |
| 5 / #52 | Lamar Jackson (QB) **35.1 / 113.9** | Devon Achane (RB) **100.7 / 114.4** | Devon Achane (RB) **139.1 / 129.7** |
| 6 / #69 | Devon Achane (RB) **97.9 / 127.3** | Devon Achane (RB) **100.7 / 130.1** | Devon Achane (RB) **139.1 / 145.4** |
| 7 / #76 | Carnell Tate (WR) **23.6 / 34.5** | Jayden Reed (WR) **32.6 / 31.3** | Tony Pollard (RB) **29.0 / 125.1** |
| 8 / #93 | Dalton Kincaid (TE) **3.6 / 125.7** | Dalton Kincaid (TE) **2.8 / 124.9** | Dalton Kincaid (TE) **-4.8 / 205.9** |
| 9 / #100 | Quentin Johnston (WR) **12.7 / 5.1** | Jayden Reed (WR) **32.6 / 26.7** | Alec Pierce (WR) **27.4 / 120.1** |
| 10 / #117 | Romeo Doubs (WR) **0.2 / -16.3** | Xavier Worthy (WR) **1.1 / -15.5** | Jakobi Meyers (WR) **9.3 / 92.4** |
| 11 / #124 | Jakobi Meyers (WR) **4.0 / -13.3** | Jakobi Meyers (WR) **6.1 / -11.0** | Jakobi Meyers (WR) **9.3 / 99.1** |
| 12 / #141 | Chris Rodriguez (RB) **-22.1 / -31.1** | Chris Rodriguez (RB) **-11.8 / -19.8** | Chris Rodriguez (RB) **-53.2 / 41.2** |
| 13 / #148 | Houston Texans (DEF) **19.0 / 66.2** | Los Angeles Rams (DEF) **19.0 / 66.1** | Houston Texans (shared specialist; no FP score) |
| 14 / #165 | Ray Davis (RB) **-78.8 / -100.4** | Samaje Perine (RB) **-74.2 / -95.3** | Justice Hill (RB) **-58.4 / 28.5** |

## Close review by round

### Round 1 — pick #4

All three select Gibbs. Different point estimates do not change this choice.

### Round 2 — pick #21

All three select Lamb to start the WR room. A lower FP Adj number is not weaker confidence; the source uses its own normalization.

### Round 3 — pick #28

All three take Taylor as RB2.

### Round 4 — pick #45

All three fill WR2 with Jefferson. His native Sleeper Val is lower than the current ECR-calibrated Val, but the positional context keeps him first.

### Round 5 — pick #52

First roster-path split. Current: Lamar at QB. Sleeper and FP: Achane in FLEX. Current has Lamar 113.9 vs Achane 111.6; Sleeper has Achane 114.4 vs Lamar 113.9. That is a 0.5-point modeled lead, not a strong instruction. FP has Achane 129.7 vs Lamar 82.7. Lamar's current and Sleeper values are identical; Achane's 2.8-point Val increase causes the small Sleeper reversal.

| Candidate | Purpose | Current Val / Adj | Sleeper Val / Adj | FP Val / Adj |
| --- | --- | --- | --- | --- |
| Lamar Jackson | QB starter slot | 35.1 / 113.9 | 35.1 / 113.9 | 27.0 / 82.7 |
| Devon Achane | FLEX starter slot | 97.9 / 111.6 | 100.7 / 114.4 | 139.1 / 129.7 |

### Round 6 — pick #69

On the current-method path, all three now take Achane. In the separate native-source paths, Achane was already drafted, and both take George Pickens here. Same-board agreement at round six does not mean the earlier split had no cost.

### Round 7 — pick #76

Three distinct FLEX choices: current Tate, Sleeper Reed, FP Pollard. Reed's Val changes from 6.1 current to 32.6 Sleeper; Tate changes from 23.6 to 13.8. FP prefers Pollard's 29.0 Val. Pollard would be a fourth RB, but still fills the second FLEX in this roster; that is legal, not automatically excess bench depth.

| Candidate | Purpose | Current Val / Adj | Sleeper Val / Adj | FP Val / Adj |
| --- | --- | --- | --- | --- |
| Carnell Tate | FLEX starter slot | 23.6 / 34.5 | 13.8 / 24.7 | 5.7 / 103.6 |
| Jayden Reed | FLEX starter slot | 6.1 / 4.8 | 32.6 / 31.3 | 6.9 / 92.6 |
| Tony Pollard | FLEX starter slot | 12.5 / 21.6 | 11.8 / 20.9 | 29.0 / 125.1 |

### Round 8 — pick #93

All three take Kincaid on this board. Starter need contributes 75 and QB/TE policy 58 in each calculation. That context overwhelms the differences in TE Val, including negative FP Val. The native-source continuations instead draft Kelce because their preceding picks changed the later board. This is a policy-dominated decision, not evidence of source agreement about Kincaid's quality.

### Round 9 — pick #100

First bench pick on this path: current Johnston, Sleeper Reed, FP Pierce. This is a strong player-assessment disagreement within WR, not a need to change position.

| Candidate | Purpose | Current Val / Adj | Sleeper Val / Adj | FP Val / Adj |
| --- | --- | --- | --- | --- |
| Quentin Johnston | WR coverage | 12.7 / 5.1 | 2.6 / -6.0 | 3.9 / 92.9 |
| Jayden Reed | WR coverage | 6.1 / -2.5 | 32.6 / 26.7 | 6.9 / 95.9 |
| Alec Pierce | WR coverage | 8.7 / 2.1 | 17.8 / 12.1 | 27.4 / 120.1 |

### Round 10 — pick #117

Another WR bench split: Doubs / Worthy / Meyers. Sleeper Worthy leads Doubs by only 0.8 Adj. Current Meyers survives to round eleven on this simulated path; Worthy is taken at the very next pick.

| Candidate | Purpose | Current Val / Adj | Sleeper Val / Adj | FP Val / Adj |
| --- | --- | --- | --- | --- |
| Romeo Doubs | WR coverage | 0.2 / -16.3 | 0.2 / -16.3 | -1.5 / 82.0 |
| Xavier Worthy | WR coverage | -4.9 / -28.4 | 1.1 / -15.5 | -3.1 / 80.2 |
| Jakobi Meyers | WR coverage | 4.0 / -20.0 | 6.1 / -17.7 | 9.3 / 92.4 |

### Round 11 — pick #124

All three choose Meyers on the current path. The FP continuation has already taken him in round ten and takes Doubs instead. The order changes, but these two names end up on both current and FP rosters.

### Round 12 — pick #141

All three choose Rodriguez for RB depth. FP Val is much lower than the other estimates, yet he still ranks first among legal available options under that source. Absolute Adj values across the columns should not be subtracted.

### Round 13 — pick #148

Current selects Houston, Sleeper selects the Rams. FP does not contain D/ST projections in this experiment; its continuation explicitly uses the current specialist choice. Do not count that as FP agreement or a native FP score.

### Round 14 — pick #165

Final bench choice: Davis / Perine / Hill. Timing and room-demand contributions are zero for all three. The split is therefore not a wait-until-next-turn argument; it comes from player value and useful remaining roster depth.

| Candidate | Purpose | Current Val / Adj | Sleeper Val / Adj | FP Val / Adj |
| --- | --- | --- | --- | --- |
| Ray Davis | RB coverage | -78.8 / -100.4 | -77.3 / -98.7 | -117.5 / -36.4 |
| Samaje Perine | RB coverage | -99.2 / -106.1 | -74.2 / -95.3 | -59.0 / 27.9 |
| Justice Hill | RB coverage | -87.7 / -106.1 | -79.4 / -101.0 | -58.4 / 28.5 |

## Actual picks in the three simulated continuations

| Round | Current path | Sleeper path | FP path |
| --- | --- | --- | --- |
| 1 | Jahmyr Gibbs (RB) | Jahmyr Gibbs (RB) | Jahmyr Gibbs (RB) |
| 2 | Ceedee Lamb (WR) | Ceedee Lamb (WR) | Ceedee Lamb (WR) |
| 3 | Jonathan Taylor (RB) | Jonathan Taylor (RB) | Jonathan Taylor (RB) |
| 4 | Justin Jefferson (WR) | Justin Jefferson (WR) | Justin Jefferson (WR) |
| 5 | Lamar Jackson (QB) | Devon Achane (RB) | Devon Achane (RB) |
| 6 | Devon Achane (RB) | George Pickens (WR) | George Pickens (WR) |
| 7 | Carnell Tate (WR) | Justin Herbert (QB) | Justin Herbert (QB) |
| 8 | Dalton Kincaid (TE) | Travis Kelce (TE) | Travis Kelce (TE) |
| 9 | Quentin Johnston (WR) | Alec Pierce (WR) | Alec Pierce (WR) |
| 10 | Romeo Doubs (WR) | Xavier Worthy (WR) | Jakobi Meyers (WR) |
| 11 | Jakobi Meyers (WR) | Jakobi Meyers (WR) | Romeo Doubs (WR) |
| 12 | Chris Rodriguez (RB) | Chris Rodriguez (RB) | Chris Rodriguez (RB) |
| 13 | Houston Texans (DEF) | Los Angeles Rams (DEF) | Houston Texans (DEF) |
| 14 | Ray Davis (RB) | Samaje Perine (RB) | Justice Hill (RB) |

## What the round-five split costs on this seed

- Current rounds 5–8: **Lamar + Achane + Tate + Kincaid**.
- Both native-source rounds 5–8: **Achane + Pickens + Herbert + Kelce**.
- This is the clearest review point: an earlier QB versus a stronger-looking set of later skill-position names. It is not enough to select a winner without evaluating those complete paths under independent forecasts and uncertainty.
- On the current path, Pollard goes at #77 after being passed at #76; Pierce goes at #102 after #100; Reed goes at #108. Those are observed events within this simulation, not probabilities and not observations of alternate paths.

## Findings and next review

1. **Review round five first.** A tiny Sleeper score reversal causes a material roster-path change. Show both as reasonable choices; do not interpret 114.4 vs 113.9 as certainty.
2. **Review rounds seven and nine next.** They expose true player-level projection disagreements hidden by the current reassignment, especially Reed, Tate, and Pierce.
3. **Review TE policy separately.** Round eight is driven heavily by starter/onesie terms. Three matching recommendations do not establish high confidence.
4. **Improve score interpretation before choosing a default source.** The high late FP Adj values mostly reflect normalization and context, not hundreds of expected fantasy points or a source that is more confident.
5. **Keep the final-pick fix.** All models correctly remove timing/demand from the last selection.
6. **Do not promote either native source from one mock.** The local bot model leaves some strong players available unusually late; repeat against real Sleeper behavior before making a selection-policy decision.

## Verification and artifacts

Each run has 168 unique draft picks, 14 owner picks, complete required positions, and one QB/TE/DST. Final-pick timing and demand are zero. Full per-pick snapshots, top-candidate cross-scores, component contributions, final rosters, and opponent picks are saved in `current.json`, `sleeper.json`, and `fp.json`. No active scoring or recommendation policy was changed.

## Completed-roster evaluation

Evaluated all three final rosters under each frozen source, using the best legal eight-player offensive lineup: 1 QB, 2 RB, 2 WR, 1 TE, 2 FLEX. This sums full-season point estimates for a fixed lineup. It does not simulate weekly substitutions, byes, injuries, waivers, or wins. Defense is excluded because FP has no defense projections in this artifact. No new forecast data or API requests were used.

| Evaluating source | Current roster | Sleeper roster | FP roster | Native starter edge |
| --- | ---: | ---: | ---: | ---: |
| current | 1914.1 | 1947.7 | 1947.7 | +33.6 |
| sleeper | 1894.9 | 1932.7 | 1932.7 | +37.8 |
| fp | 2045.8 | 2111.8 | 2111.8 | +66.0 |

The native-source rosters are preferable on this board. Both have identical offensive starters. Under current / Sleeper / FP estimates, giving up Lamar for Herbert costs 24.1 / 30.5 / 24.9 season points. Pickens over Tate adds 51.9 / 61.8 / 71.4. Kelce over Kincaid adds 5.8 / 6.6 / 23.0. FP selects Meyers over Tate in the current roster's optimal lineup, reducing the full starter advantage to 66.0.

The combined roster can still win if Lamar's actual QB advantage is larger or the alternative FLEX/TE advantages fail. With the other fixed-lineup estimates held constant, a roughly 58 / 68 / 91 point Lamar-over-Herbert advantage would erase the respective starter edge. These are break-even assumptions, not probability estimates.

Bench totals are not counted as starting production. Sleeper and FP rosters share Pierce, Meyers, and Rodriguez; their remaining offensive differences are Worthy + Perine versus Doubs + Hill. Evaluator preferences split and the native-projection differences are small. There is no credible winner between these two complete rosters from this test. Both also rely on Rodriguez and a late RB for coverage behind three starting RBs.

Conclusion: prefer either native-source roster over the current roster for this seed; treat Sleeper versus FP as unresolved. Agreement across related input models is useful sensitivity evidence, not independent validation. This does not establish that switching the active source will improve future drafts. Saved calculations: `roster-evaluation.json`.
