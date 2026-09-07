# Draft release verification — September 7, 2026

## Release boundary

Local release verified at `http://localhost:3017`. Actual league URL:

http://localhost:3017/draft-assistant?draftId=1380576960433909760&userId=467542001726779392

Next build ID: `0l7qnOd9uqa2EfAVyoCJt`. Base commit: `a863335e`, plus the existing working tree and this display/reliability pass. This is not a new commit or a production deployment. The running build is in `/private/tmp/fantasy-release-20260906`. Do not assume edits to the repository update this server.

No scoring, weights, thresholds, eligibility, tiers, market columns, or table defaults changed in this pass. Existing parallel ESPN work was preserved.

## Changes and cleanup record

- Reused the existing pick-feed status for recommendation emphasis. A warning removes `Lead` and its value-trade sentence, removes the ADJ emphasis, and shows `Waiting for current picks.`
- Corrected the page error gate: a pick-fetch failure after a successful response keeps the cached tables accessible. A failure before any successful response still blocks the board. Other data failures still block it. Retry is available.
- Moved the existing roster bye warning above Recommendations. It stays visible when recommendations are hidden. Candidate notes use the same roster allocation calculation and say `With current roster`. They count added uncovered starter/FLEX slots, exclude already-undrafted slots, and do not add penalties.
- Labeled the next-turn column `Scenario ADJ`. Its player dialog says `Current-pick details` and still uses current-board values.
- Positive remaining value below 1% displays `<1%`; zero remains `0%`.
- Kept configured position headings when no rows remain. A filled one-player owner policy now says `Owner limit filled`. Eligibility filters remain unchanged.
- Replaced the generic QB/TE adjustment label with its recorded wait, elite, or completion reason when that reason is available. No new calculation path was added.
- Source storage code was not changed. No unintended switch was found.

## Checks

- 124 focused tests passed across the affected display, feed recovery, preference, and frozen scoring checks.
- `pnpm run typecheck`: passed after the build.
- `pnpm run lint`: passed.
- `pnpm exec next build --webpack`: passed. Default Turbopack could not start its local CSS worker under the host port policy, including an escalated retry. The verified running artifact is the webpack build.
- Replayed 56 saved decision states: both sources at all 14 owner picks in both completed drafts. All recommendation scores and leaders were unchanged across this pass. Result digest: `e1b620316853b5306b51aba76fc98b04b30c114bd0b2475385a2f4c837eba0ee`.
- The initial test command also launched the broader suite. It exposed older sidebar and other UI expectations outside this pass. This report does not claim that the entire repository suite passes. Affected surface expectations were corrected and rerun.

## Browser evidence on the final build

Chrome used the exact port 3017 release. Saved pick responses were intercepted in the test browser; no real draft picks were sent.

- Failed pick responses: waiting message appears, Lead disappears, tables remain accessible.
- Retry: a target selected by team 3 disappears from recommendations after the next successful response.
- Automatic polling recovery: waiting clears without clicking Retry.
- Saved round-seven state: `With current roster · Bye 8: uncovered 2 WR, 1 FLEX.` remains visible with Recommendations collapsed. Candidate bye notes are visible at the decision point.
- Scenario table and current-pick dialog labels checked. Example: Jayden Reed has Scenario ADJ 31.7; the labeled current-pick dialog shows Sleeper ADJ 22.7. This distinction is intentional.
- Desktop 1440×1000 and mobile 390×844 dialog checks completed.
- Refresh retained FantasyPros. Changing from the practice draft to the actual league retained FantasyPros.
- A second tab loaded the saved source. Changing that tab to Sleeper did not alter the first tab's current selection. Refreshing the first tab adopted the last saved choice. This is the existing storage contract, not a fallback to another source.
- On the actual league page, each source's PTS, VAL, ADJ, and projected rank matched its canonical source calculation and dialog values. Example, Gibbs: Sleeper 309.9 PTS / 170.2 VAL / 185.1 ADJ / RB1; FantasyPros 348.2 / 207.8 / 185.1 / RB1. Equal ADJ here follows normalization; it does not mean equal projected production.

Artifacts: `data/draft-results/release-verification-20260907/`. Screenshots: `/private/tmp/fantasy-tiers-screenshots/release-details-desktop.png`, `release-details-mobile.png`, and `release-real-league.png`.

## Bounded decision trace

Using the saved source data and actual prior picks reproduces the recorded scores:

| Case | Recorded behavior | Trace |
| --- | --- | --- |
| Burrow, round 5, pick 52 | ADJ 89.7; recommendation | Position tier 1; ECR 51.21; ADP 53.8. The elite QB rule applies without the early-price restriction. Contributions: value −2.7, timing 7.1, starter need 44.8, QB policy 36.9, room demand 3.6. |
| LaPorta, round 6, pick 69 | ADJ −3.8; Pollard leads | ECR 82.77 is 13.8 picks later. The early ECR wait rule remains active, despite ADP 62.4 already passing. Net QB/TE contribution −85.3. |
| LaPorta, round 7, pick 76 | ADJ 139.7; recommendation | The through-round-six ECR wait restriction ends. The open TE completion rule contributes 58. Timing also changes 5→9 and starter need 60.8→57. Total ADJ change 143.5. |

These rules fired as written. This verifies implementation, not that their draft strategy is optimal. No tuning was performed.

## Actual league settings

Public Sleeper league `1380576960417120256`, The Avitan Bowl, links to draft `1380576960433909760`.

- 12 teams; owner slot 4.
- Reception scoring: **0.69**.
- 1 QB, 2 RB, 2 WR, 1 TE, 2 FLEX, **1 K**, 1 D/ST, 5 bench: **15 rounds**.
- The two completed mocks used half-PPR, no K, and 14 rounds. They did not verify this exact format.
- The actual page shows the kicker slot and 15 picks remaining. Existing disclosures remain: two-point conversion scoring is not included in starter-aware value; kicker value uses Sleeper standard projections rather than custom distance splits.

## Stop point

This local candidate is frozen. Production deployment and production URL verification are still pending. No claim of better fantasy outcomes is made. Do not add more strategy or UI work before the draft under this release request.
