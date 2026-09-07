# Native projection source release — September 7, 2026

## Accepted change

The owner approved separate Sleeper and FantasyPros projection values. The normal draft UI defaults to Sleeper and can switch to FantasyPros. The selected source supplies season PTS, starter-aware VAL, and the inputs used to calculate ADJ. The roster and timing rules stay the same. ADJ is normalized within each source; equal ADJ numbers do not mean equal projected production or confidence.

ECR, tiers, and market timing remain separate context. The old ECR-ordered projection curve is retained only as the explicit `combined` experiment baseline. ESPN keeps its existing league-projection path; this work does not change that provider's selection policy.

The Sources table now shows the two native sources. The former Current Val/Adj columns were removed. Cards and player details show both sources. Overall and position tables show PTS from the selected source. FP offense is not filled with Sleeper projections when data is missing. K/DST use Sleeper in both modes and are labeled as such.

## Existing pipeline inspection

- `scripts/fp/fetch-fantasypros-all.ts`: `DRAFT=true` fetches season ECR. Optional projection fetching already calls `scrape-fantasypros.ts`. Without DRAFT, the current implementation fetches weekly ECR only, not weekly projections.
- `scripts/fp/scrape-fantasypros.ts`: the shared HTML table parser supports `draft` and numbered weeks. It already uses `src/lib/fantasyprosRequest.ts`, with `FP_COOKIE` / `FANTASYPROS_COOKIE`.
- The new `refresh-draft-projections.ts` is a staging and publication wrapper around that existing scraper. It makes four calls, one each for QB/RB/WR/TE, with `week="draft"`. No second HTTP client or cookie implementation was added.
- Draft output is `public/data/aggregate/fantasypros-draft-projections.json`. Raw input validation requires `meta.week="draft"`. Weekly files are neither consumed nor overwritten. Draft refresh does not change the weekly fetch mode.
- Each refresh validates row counts, unique names, complete numeric stats, all four positions, and the actual consensus source date. It writes a temporary output and renames it only after all checks pass. A fetch failure, registration fence, invalid stats, or stale date leaves the prior published file unchanged.
- The app rejects FP data older than 72 hours, insufficient starter depth, or less than 90% coverage of the relevant draft pool. These are data gates, not forecast-confidence estimates.
- Scheduled refresh is twice daily: eight projection website requests per day, no automatic retries. The public API key is not used and its 50/day allowance is untouched by this path. The browser polls our cached endpoint, not FantasyPros.

## Verification

GitHub secret `FP_COOKIE` was set from the owner's authorized signed-in FantasyPros request. The value was not printed, committed, or put in a browser bundle. The temporary local secret file was deleted.

GitHub Actions run: https://github.com/makoncline/fantasy-tiers/actions/runs/34146177610

The isolated `verify/fp-projections-20260907` branch uses the existing workflow's `projections_only` input. Its verification job does not commit data, run history writes, or deploy production.

The Actions run passed and saved a September 7 snapshot with no parser problems:

| Position | Rows |
| --- | ---: |
| QB | 77 |
| RB | 133 |
| WR | 191 |
| TE | 125 |
| Total | 526 |

The same Actions run passed the integration test for atomic publication and exact preservation of prior data after controlled network failure, truncated tables, stale source dates, and a weekly payload. This verifies failure handling through controlled failures; it is not evidence that the session will never expire.

Local checks: 522 tests passed across 84 files. Typecheck and lint passed. The production build passed with webpack in the isolated local checkout. A later position-table-only PTS change passed its two focused tests, typecheck, and lint.

All 72 local drafts completed: two native sources × 12 slots × three paired seeds, using the canonical view model. Each had 14 players, one QB/TE/DST, no kicker, and required RB/WR/FLEX coverage. Inputs and results are saved under ignored `data/draft-results/native-toggle-2026-09-07/`. This is roster-completion evidence, not independent evidence of better fantasy outcomes.

Final local build and the public view-model endpoint also passed. Screenshots: `/private/tmp/fantasy-tiers-screenshots/native-sleeper-toggle.png` and `/private/tmp/fantasy-tiers-screenshots/native-fp-position.png`.

The local browser check confirmed that the source toggle changes card and table values, details show both sources, and data remains ready after a source change. Example at the same pre-draft board: Gibbs Sleeper PTS/VAL 297.9/173.4; FP 334.8/199.6. Both modes rank him first and show 184.7 ADJ due to within-source normalization.

## Pending release work

The normal scheduled workflow on main and the production UI have not been updated by this task. Only the isolated pipeline verification branch was pushed. The shared checkout still contains this release and parallel ESPN work. Review and integrate those changes before merging, then verify the deployed source toggle and a normal scheduled refresh. The Actions success above proves the FP cookie works on a hosted runner now; it does not prove production release completion or future session validity.

## Prepared source views — September 7 follow-up

The owner reported a delay when switching sources. The client memo depended on the selected source, so it reran readiness and all valuation work on each toggle. It also rebuilt the selected board after the comparison had already computed it.

`buildDraftViewModel` now prepares both `sourceViews.sleeper` and `sourceViews.fp` in one data update and reuses the two comparison boards. Each view includes values, the recommendation board, the choice snapshot, status, and draft context. `selectDraftSource` only selects those stored objects. Live and local mock clients keep the source toggle out of the calculation memo dependencies. Draft or source-data changes still refresh both views. The explicit combined experiment and ESPN paths remain separate.

Verification: 523 tests, typecheck, lint, and isolated production build passed. The integration test verifies object identity across source switches and equality with the selected canonical result. In Chrome on localhost:3017, FP and Sleeper values switched correctly, with zero projection/aggregate network requests during the two-toggle check. This does not suppress regular draft polling.

Local build updated; not pushed or deployed.
