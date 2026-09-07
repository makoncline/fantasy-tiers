# Separate projection comparison — September 7, 2026

## Product contract
Sources tab compares current Val/Adj with Sleeper Pts/Val/Adj and FP Pts/Val/Adj. This is an experiment, not a new selection policy. Current cards and default recommendations are unchanged.

Sleeper uses each player's original league-scored projection from the validated snapshot. FP uses that player's own projected stat components, scored with the same league rules. Each source builds its own starter/man-games baselines and FLEX allocation. Each Adj reruns the existing canonical board model with those source-native values. ECR is still required for owner eligibility and remains in the existing adjustment logic; it does not reorder source-native point totals.

Adj is normalized within each source. Equal absolute scores across sources do not establish equal value. Compare ordering within a source. Val/Pts retain point-based comparisons.

## Scope and data
- QB, RB, WR, TE only. No FP-to-Sleeper substitution, including specialists.
- Missing player source values show a dash.
- FP projections suppress when stale (more than 72 hours), undated, incomplete by position, or below 90% coverage of the declared ECR cohort. These thresholds are data-quality gates, not confidence estimates.
- FP omits secondary passing for skill players, receiving for QBs, and rushing for TEs. Those provider omissions are not inferred from Sleeper.
- Signed-in browser capture: September 7, 2026; 77 QB, 133 RB, 191 WR, 125 TE rows. Public scraper and saved old session returned registration-fenced data; they did not overwrite valid files.
- Import command: node --import=tsx scripts/fp/import-browser-projections.ts <capture.json>. It validates all four tables before writing. Capture stores only table DOM, source URLs, and visible source date. No credentials.
- Canonical public snapshot: public/data/aggregate/fantasypros-draft-projections.json.
- Sources comparison is not exposed on ESPN drafts because their current raw projection snapshot has different source semantics.

## Observed local comparison
12-team half-PPR mock, slot 4, before the first pick:

| Player | Current Val | Sleeper Val | FP Val |
| --- | ---: | ---: | ---: |
| Jahmyr Gibbs | 173.4 | 173.4 | 199.6 |
| Ja'Marr Chase | 120.0 | 117.6 | 139.7 |
| Puka Nacua | 117.6 | 120.0 | 142.2 |
| Derrick Henry | 94.4 | 111.9 | 132.6 |

Chase/Puka show the ECR reassignment directly. Henry shows a larger disagreement between raw Sleeper and the current method. Neither result proves a superior forecast. Current default stayed Gibbs.

## API key and quota
FANTASYPROS_API_KEY is stored only in ignored .env.local files with 0600 permissions. It is not exposed through NEXT_PUBLIC variables, committed data, browser requests, or logs. One authenticated API probe confirmed truncation: reported 543 players, returned 10 QBs. The key-specific limit is 50 requests/day. See fantasypros-api-reference.md.

The page reads our local snapshot. Reload data does not call FantasyPros. No scheduled workflow or GitHub secret was added. A later API fetch should request all offensive positions in one preseason batch (week=0), cache the result, enforce the confirmed account quota across runs, and stop on quota errors without automatic retries.

## Verification
510 tests passed across 78 files. Typecheck, lint, and production build passed. Local Chrome showed separate source values and the current recommendation unchanged. No push or deployment.
