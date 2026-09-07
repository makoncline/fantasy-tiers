# Market-only availability: prospective results

**Decision: retain as experimental.** The candidate passes several aggregate checks but fails the predefined defense-exposure check. Do not add it to the active availability display or selection policy. Do not tune it or start another batch from this result.

## What was tested

The frozen candidate uses only platform market order, simple selection variation, the available pool, and the actual wait distance. It has no ECR eligibility requirement, owner backup limit, late-defense rule, roster deadline, or roster-need bonus. It selects sequentially without replacement. The four separation and capture integration tests passed.

The batch contains 12 new complete Sleeper mocks, one per slot: 2,016 actual picks, 156 prospective forecasts, and 9,478 player observations across the combined cohorts. Each forecast has 512 simulated sequences. All captures passed the saved-prefix, conditioned-selection, timestamp, and input-hash checks.

These are standalone Sleeper PPR bot mocks. Opponents were advanced with Sleeper's commissioner `draftCpuPick` action while the room was paused. This prevents clock races. It is not a human-draft test, and equivalence to Sleeper's automatic clock-driven CPU mode has not been established. All 12 drafts expose the PPR label but no complete scoring map. The inferred application scoring map is not verified Sleeper scoring and is not the owner's 0.69 format.

All 156 observed selections with a future forecast followed the default. Adherence did not enter the evidence-validity filter. A direct test separately verifies that a non-default selection is valid when the forecast was captured conditional on that selection. This batch has no live non-default examples.

## Forecast results

Lower Brier and log loss are better. Each paired row below uses the same players for both models.

| Cohort | Observations | Current Brier | Candidate Brier | Current log loss | Candidate log loss |
| --- | ---: | ---: | ---: | ---: | ---: |
| Broad, common coverage | 8,299 | 0.0527 | 0.0408 | 0.1950 | 0.1440 |
| Decision, all positions | 1,158 | 0.1149 | 0.1050 | 0.3836 | 0.4881 |
| Decision, offense | 1,134 | 0.1150 | 0.0985 | 0.3842 | 0.4373 |
| Decision offense, waits with a DEF pick | 281 | 0.1228 | 0.1707 | 0.4070 | 0.9684 |
| Decision offense, waits without a DEF pick | 853 | 0.1125 | 0.0747 | 0.3767 | 0.2623 |

The broad cohort has 9,360 observations. Current-heuristic coverage is 88.7%, so 1,061 observations have no current forecast. The candidate report retains all of them. The decision cohort has 100% common coverage. The combined observation count is not the sum of both cohorts, because they overlap.

Offensive decision Brier improves in 11 of 12 slots. The mean whole-board paired change is **−0.0163**, with a 2,000-resample bootstrap interval of **−0.0276 to −0.0067**. This describes the collected boards; 12 slots are a coverage budget, not a power claim. Candidate log loss worsens in the decision cohort despite the Brier gain. Some forecasts are too confident when wrong.

The candidate predicts 55.5% offensive decision-cohort survival; 49.8% survive. For decision-cohort RBs, it predicts 57.1% versus 45.3% observed. DEF decision forecasts are especially poor: 99.9% predicted survival versus 58.3% observed.

### Fixed acceptance checks

| Check | Result |
| --- | --- |
| Twelve valid complete boards | Pass |
| Common decision-cohort coverage at least 95% | Pass: 100% |
| Offensive decision Brier improves in at least eight slots | Pass: 11/12 |
| Whole-board paired Brier interval below zero | Pass |
| Offensive predicted/observed survival gap no more than 0.10 | Pass: 0.0564 |
| Mean defensive-pick count error within 0.5 per wait | Pass: −0.2546 |
| No offensive Brier regression above 0.03 in either defense-exposure stratum | **Fail: +0.0479 when a DEF was selected** |

The last check was fixed before collection. Do not remove that stratum to approve the preview. Defense exposure also correlates with draft phase, so this comparison does not establish a causal defense effect. It does show that the required evidence for the proposed limited preview is missing.

### Group forecasts

These groups were fixed before outcomes from eligible decision alternatives. They do not assert that players have equal true value.

| Positional group | Captures | At-least-one Brier | Mean absolute error in remaining count |
| --- | ---: | ---: | ---: |
| QB | 72 | 0.0456 | 0.337 |
| RB | 156 | 0.0915 | 0.478 |
| WR | 122 | 0.0904 | 0.355 |
| TE | 71 | 0.0282 | 0.394 |
| DEF | 12 | 0.3327 | 0.833 |

The candidate predicts 84.3 defensive selections across the tested waits; Sleeper makes 124. Per-capture artifacts preserve expected remaining counts and the simulated range of the best remaining Val. Those ranges are not validated prediction intervals.

### Zero-pick waits

An additional diagnostic separates the known zero-pick boundary from probabilistic forecasting. In 96 offensive decision observations with no intervening opponent picks, candidate Brier is 0 and current Brier is 0.1117. With positive waits only, candidate Brier is 0.1076 versus current 0.1153 across 1,038 observations. Thus part of the aggregate gain comes from a deterministic boundary, not a better uncertain-opponent forecast. This diagnostic does not change the predefined acceptance rule.

The A–C waiting explanation now states that other available players remain when the next own pick is immediate. This is a display correction only. Canonical scores, recommendations, and D's frozen code remain unchanged.

## Evidence handling and limitations

- A cloned room copied 168 old picks despite `pre_draft` status. It was rejected before registration. It is not a fresh test board.
- The initial local transport was revised before any valid board was registered. Both freeze records and source archives remain available. Market parameters, platform data, and acceptance criteria did not change.
- Slot 6 had a browser-control timeout during opponent advancement. Recovery used the public prefix at 86 picks and completed the four remaining opponents before the next own turn. All 13 captures passed final validation.
- No registered board was excluded or replaced because of its predictions or owner adherence.
- The 27 older pick files remain descriptive only. Settings were found beside 12 files; uncertain position metadata and format differences are preserved. No current ranks were used to reconstruct a historical holdout.
- No claim of improved player forecasts, better draft decisions, or better fantasy results is supported by this batch.

## Files and reproduction

Protocol: [market-only-prospective-protocol.md](market-only-prospective-protocol.md).

Artifacts are in ignored `data/draft-results/market-only-20260905-v2/`: `freeze.json`, `frozen-source.tar.gz`, source snapshots, `pool.json`, `bundle.json`, `batch-manifest.json`, `report.json`, and per-board initial states, pre-pick captures, completed states, and predictions. The original setup freeze is preserved in `market-only-20260905/`.

Reproduce the fixed report with:

```sh
python3 scripts/draft/evaluate-market-prospective.py data/draft-results/market-only-20260905-v2
```

A–C remains the release candidate. D remains an isolated research tool. The batch is complete and the stopping rule has been applied.
