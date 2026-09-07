# Choice assistant A–C: final verification

A–C is the accepted release candidate. Active selections keep the retained final-pick fix. No new selection rule is included.

## Comparison coverage

The audit uses the existing 48 stress snapshots and all six cases per snapshot. It does not rerun or replace those cases.

| Scenario winners | Initial three cards | Expansion | Absent from automatic comparison set |
| --- | ---: | ---: | ---: |
| All 288 results | 278 | 0 | 10 |
| 21 results that change the default | 11 | 0 | 10 |

Absent means absent from the automatic comparison set. An eligible player can still be selected manually. The initial cards do not cover every winner under the tested assumptions. These counts measure display coverage, not forecast accuracy or the probability that a pick is best.

Evidence: `data/draft-results/choice-assistant-release/scenario-winner-visibility.json` and the saved `stress/slot-*-pick-*.json` files.

## Slot 10, round five

At pick 58, the default is Tyler Warren (TE), with Joe Burrow (QB) eligible but outside the automatic comparison set. The second ECR stress case swaps adjacent players within each position. Warren swaps with Harold Fannin; Burrow swaps with Jalen Hurts. Tiers stay fixed by design in this stress case.

| Input or contribution | Warren before | Warren after | Burrow before | Burrow after |
| --- | ---: | ---: | ---: | ---: |
| ECR average | 53.90 | 76.14 | 44.41 | 56.59 |
| Weighted base value | 19.0 | 16.6 | 3.7 | 1.9 |
| Weighted QB/TE policy | 41.4 | -90.0 | 36.9 | 36.9 |
| Adjusted score | 130.8 | -3.0 | 96.6 | 94.8 |

The existing early QB/TE ECR rule applies through round six when ECR is later than the current pick. Warren crosses that boundary. Burrow does not. The QB/TE policy contribution accounts for most of Warren's change. The saved 27.6 Adj lead is Burrow's lead over the new runner-up, Terry McLaurin (67.2), not over Warren.

Adjacent positional ranks can have large overall ECR gaps. Warren moves 22.24 ECR places in this case. This is not a small numerical change. The result shows dependence on an existing timing threshold. It does not establish QB superiority or a confidence level. The trace reproduces the saved winner and score gap. No calculation defect was found. No rule was tuned.

Evidence: `data/draft-results/ac-final-verification/slot-10-trace.json`. Reproduce with `node --import=tsx scripts/draft/audit-choice-release.ts`.

## Wording and correctness

- Comparisons state that tier matches do not prove equal value.
- Waiting text identifies the current ADP heuristic as an unvalidated forecast and uses the next own selection after the current pick.
- Stress labels refer only to tested assumptions. The panel rejects a confidence interpretation and separates stability from the size or reliability of an advantage.
- Val details identify the ECR-calibrated estimate and expose the original league-scored Sleeper projection.
- Existing paired evidence contains 504 unchanged decision records across 36 drafts. All 12 slots are covered.
- Final unit and integration suite: 408 tests passed in 66 files, including D separation tests. Type check, lint, and the production webpack build passed. Chrome checks cover the normal comparison, stress labels, and the zero-opponent boundary.
- A display-only correction replaces the ADP waiting label when no opponent picks intervene. Other available players remain. Canonical scores and selections are unchanged.

A–C makes choices inspectable. It does not validate equivalence between players or improve availability forecasts. D remains separate and advisory.
