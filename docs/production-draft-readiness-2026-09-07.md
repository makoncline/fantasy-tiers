# Production draft readiness — September 7, 2026

## Release

The production code release is `9b970b7fd57f55c14bf6b1d5de06b0ebdcfcfdee`. It includes `684987e5` and the current main-branch data. The full data refresh then published `bbd628cf6f2af9200b1d9877077a6db2f66882af`. Both production versions passed the deployment health and aggregate-schema check. The two production trials below used the refreshed data.

Production: https://fantasy-tiers.vercel.app

Actual draft: https://fantasy-tiers.vercel.app/draft-assistant?draftId=1380576960433909760&userId=467542001726779392

The final review found no further actionable release defect. Parallel ESPN work stayed outside the release. No algorithm weight, threshold, roster policy, eligibility rule, or tier calculation changed in this pass.

## Verification

- Release suite: 518 tests in 82 files passed. The root working tree also passed 529 tests in 88 files, including separate ESPN work.
- Typecheck, lint, whitespace checks, and the production webpack build passed.
- Two focused browser tests passed. GitHub Unit Tests run 34161166450 and E2E run 34161166499 passed.
- The display pass preserved the exact recommendation leaders and scores on 56 saved source/decision states. Data updates can change advice; this is distinct from a policy change.
- Production source switching, refresh persistence, draft changes, and two-tab behavior passed. Existing tabs retain their current source; refresh reads the last saved choice. No storage change was needed.
- Production PTS, VAL, ADJ, and projected rank matched the selected source and player dialog.
- Stale-feed failure, Retry, automatic recovery, and removal of a newly drafted target passed controlled browser checks on the release build. Production mock polling also removed CPU-selected targets before owner picks. No artificial outage was imposed on the live production service.

## Current data and actual format

[Refresh run 34161176630](https://github.com/makoncline/fantasy-tiers/actions/runs/34161176630) succeeded, including aggregate validation, data quality, history capture, publication, and production verification.

- FantasyPros native season projections: 528 players, dated September 7; QB77, RB133, WR193, TE125. No completeness problems reported.
- FantasyPros ECR: fetched 20:55:32 UTC; provider update 20:36:59 UTC; 129 of 182 experts included.
- Sleeper: fetched 20:55:34 UTC; provider update 07:50:54 UTC. A fresh fetch cannot make the provider publish newer projections.
- Production verification completed at 21:07 UTC (3:07 PM Denver).
- A reserve-player data warning remains for Travis Hunter. Core data checks passed. This report does not claim all players have complete source coverage.
- The existing full projection scraper and cookie support were used. The truncated personal API was not used. Existing failure-preservation tests protect the previous complete projection file.

The actual league and both new mocks resolve to **0.69 PPR**, 12 teams, slot4, **15 rounds**: QB1, RB2, WR2, TE1, FLEX2, K1, D/ST1, bench5. The mock's generic PPR label is not used as the complete scoring map. This corrects the scope of the earlier half-PPR, 14-round rehearsals.

Known scoring limits remain visible: two-point conversions are omitted from starter-aware value; kicker value uses standard Sleeper points because distance splits are unavailable. FantasyPros mode also uses Sleeper K/D/ST projections. These are existing limits, not new trial findings.

## Trial method

Two new Sleeper CPU mocks were operated through Chrome. Production was the decision surface. Owner auto-pick was off; CPU picks were on. Each choice used the current owner turn, not an earlier upcoming board. No action was sent to the actual league draft.

A used only the visible top recommendation. B kept Recommendations and the next-pick scenario collapsed and used the overall/position tables and player details. B still saw ADJ, so it is a workflow comparison, not an independent model. The CPU boards differ. These trials do not establish which strategy wins more fantasy games.

### A — top recommendation

Sleeper mock `1402792023416635392`: complete, 180 picks; all 15 owner picks verified against the public pick record. Every required slot and all five bench spots filled.

|Round|Player|PTS|VAL|ADJ|Observation|
|---|---|---:|---:|---:|---|
|1|Puka Nacua|312.2|162.7|182.6|Fresh data changed the preflight lead before the first owner pick.|
|2|Breece Hall|232|91.7|218.5|Need +62.4 vs Rice; Rice VAL 93 ADJ 112.6; Hall ECR 4.04 at 2.09; Javonte 82.5/211.9.|
|3|Rashee Rice|242.5|93|189.2|Flowers 76.7/166.2; Lamar 27/16.3. Candidate bye notes correctly marked With current roster.|
|4|D'Andre Swift|213.3|72.9|190.8|Judkins 59.7/183.3; short wait 6. Need and base-value differences visible; avoids added bye11 overlap.|
|5|Quinshon Judkins|200.1|59.7|130.3|Montgomery 53.8/124.5; Jameson45.2/115.9. Third RB goes to FLEX; bye11 uncovered WR/FLEX warning visible.|
|6|Jaylen Warren|186.6|46.3|125.1|Fourth RB fills second FLEX; Stevenson44.7/119.8, Dak14.6/32.1. Timing +3.8; avoids extra bye11.|
|7|Harold Fannin|163.5|19.4|217.1|TE completion dominates: need +94.5 vs Stevenson; Dak14.6/134.9. Bye11 adds TE gap. Screenshot confirmed on clock75 picks.|
|8|Alec Pierce|176.9|27.4|87|Dobbins led with3 picks away but CPU took him; on-clock lead changed automatically to Pierce. Addison7.1/66.1. QB still open; bench WR coverage.|
|9|Trevor Lawrence|311.9|10.7|222|QB deadline +86 vs Jones; Jones16.1/67.9, Pittman12.7/78.3. On-clock advice differs from earlier upcoming view. Completes offensive starters.|
|10|Aaron Jones|156.4|16.1|111.2|White2.3/92.5. Fifth RB first RB bench; positive-base-value depth; bye6 distinct.|
|11|Jakobi Meyers|158.9|9.3|125.9|White2.3/100; Concepcion-16.4/89.3. Balance +14.7 versusWhite; fourthWR covers existingWRbye gaps. Shares QBbye7 only, no claim of confidence.|
|12|Khalil Shakir|147.3|-2.3|104.5|White led before turn but taken. Shakir nowlead; Coker-22.5/85.6. NegativeVAL bench expected; short-term status visible. FifthWR.|
|13|Rashid Shaheed|137.8|-11.8|94.3|Marks taken before turn. Spears-23.7/78.9. Lastbench WR6 vsRB5; no new bye hole because bench depth can fill FLEX. K/DEF remain.|
|14|Detroit Lions|92|5|183.4|Reichard4.5/182.6; Bills-3/170.6. Specialist values useSleeper. No Week1 matchup context; close values not validated winner. Bye stream warning can be noisy.|
|15|Evan McPherson|106|1.5|178|Required final kicker. Tied modeled score with Loop; follows visible lead. Bye warning for streamable K and DEF is low-priority noise.|

Hall at round2 and Fannin at round7 show the effect of starter need/completion. Lawrence at round9 shows the QB deadline. These are existing policy effects. CPU selections removed Dobbins, White, and Marks before later turns; the visible lead updated each time.

### B — tables only

Sleeper mock `1402795444135800832`: complete, 180 picks; 15 owner picks and all required slots verified. All owner picks were made with Recommendations and scenario hidden, using FantasyPros tables.

|Round|Player|PTS|VAL|ADJ|Decision note|
|---|---|---:|---:|---:|---|
|1|Christian McCaffrey|306.8|166.4|184.2|Highest visible base value, modest edge over Puka. RB anchor. Opened details: source comparison and Questionable status clear; this is a forecast preference, not a proven edge.|
|2|Rashee Rice|242.5|93|190.2|Same ADJ as London, slightly higher VAL; fills WR1 and bye differs from CMC. McBride82VAL is credible TE alternative. No meaningful certainty claimed for 1.6VAL edge.|
|3|Trey McBride|226.1|82|251.9|TE1 VAL82 vs next TE42, while several RBs72-92VAL remain. Accept lower raw VAL than Hall for clear TE surplus. Details labels Elite TE +90. No recommendation section used.|
|4|Zay Flowers|226.2|76.7|197.3|Choose WR2 above Swift despite lower ADJ: slightly higher VAL, substantial gap to next WR51.4; Swift/Judkins/Montgomery are alternatives for RB2 in six selections. Survival is uncertain, not a probability claim. Status warning visible.|
|5|D'Andre Swift|213.3|72.9|215.8|Swift survived; highest RB value by26.6, fills RB2. QB table has multiple similar later options; Burrow12.7VAL/91.7ADJ does not justify passing Swift. Displayed FP expert tiers differ from projection ranks but labels explicit.|
|6|Jaylen Warren|186.6|46.3|140.3|FLEX still empty. Prefer46.3VAL Warren to Daniels11.9 despite Daniels141.4ADJ. Other QBs near Daniels remain; six selections until next turn. Warren186.6PTS also exceeds visible WR options.|
|7|Rhamondre Stevenson|185.1|44.7|127.1|Fills second FLEX. Dak202.9ADJ is higher but14.6VAL vs other close QBs; Stevenson has15.7VAL advantage over next RB. Accept16-pick wait risk at QB. Bye11 differs from other starters.|
|8|Alec Pierce|176.9|27.4|85.7|Best visible WR depth by14.7VAL over Pittman; only two WR owned. Shares Flowers bye13, but remaining RB FLEX coverage helps. QB comparison before pick; six selections until next turn.|
|9|Trevor Lawrence|311.9|10.7|222|Complete QB after FLEX/depth. Best remaining QB points; Purdy only0.9VAL lower, so222vs90.8ADJ should not imply large production gap. Bye7 avoids current core bye weeks.|
|10|Jakobi Meyers|158.9|9.3|100|Prefer fourth WR over fifth RB Jones16.1VAL/111.2ADJ. Meyers158.9PTS helps cover Flowers/Pierce bye13; four RBs already provide FLEX coverage. Small modeled sacrifice for useful depth, no fixed ratio rule.|
|11|Aaron Jones|156.4|16.1|122.4|Jones survived short wait; clear remaining RB point/value edge. Adds RB bench coverage with different bye6. Only roster warning is QBbye7; expected with one-QB policy, not a reason to draft backup.|
|12|Khalil Shakir|147.3|-2.3|106.1|Best remaining projected WR production. Worthy vanished during CPU picks before turn; table updated. Shakir shares Meyers/QBbye7 but other WRs cover required WR/FLEX. Status visible; short bench comparison remains forecast-based.|
|13|Woody Marks|123.8|-16.5|96.7|Final bench: strongest remaining VAL, RB depth. Stribling and Shaheed taken during six CPU selections. Five RB/five WR before pick; choose third RB reserve. No unsupported upside probability.|
|14|Will Reichard|109|4.5|183.8|Late K now, DEF last. K4.5VAL vs Jaguars4; very close, not a meaningful confidence claim. Both specialist tables show candidates and open-slot counts. Week1 matchup not available; no new external feed added.|
|15|Jacksonville Jaguars|91|4|180|Required final DEF. Highest remaining displayed base value; future waiting costs no longer apply. Source is Sleeper specialist projection in FP mode. Both drafts finish15-player rosters.|

## What worked, and what stays deferred

- Current turn, remaining selections, source, position counts, FLEX, and bench assignments were visible at each pick. Both source views remained available in details.
- The table-only workflow was usable. It supported Flowers over Swift at round4, Warren over Daniels at round6, Stevenson over Dak at round7, and Meyers before Jones at round10. The next short turn still offered Swift and Jones in those two cases. These observed outcomes do not establish survival probabilities.
- Recommendations and tables updated after CPU picks. Do not commit to an upcoming lead until the page reports the actual owner turn and current picks.
- Position ranks are projected ranks; the tiers are explicitly FP expert tiers. A disagreement is not a calculation error by itself.
- Large QB/TE timing or completion contributions can make adjacent production forecasts look far apart in ADJ. Lawrence versus Purdy is a clear example. ADJ is a decision score, not expected fantasy points or confidence. Keep the recorded explanation and test these policy effects after the real draft.
- Bye warnings correctly persisted with Recommendations hidden. A required single QB, K, or D/ST always needs a bye replacement. Such warnings can add noise; do not use them to violate the one-player owner policy.
- Week1 D/ST matchup context is still absent. This remains a known deferred feature. The mock specialist picks used the displayed season data; no claim of superior streaming choices is made.
- No new recommendation, eligibility, tier, or opponent-model change is justified by these two trials. No last-minute tuning was applied.

## Evidence limits and handoff

The projection totals below are model diagnostics, not realized results. They assume the strongest legal starters under each source's season points. They do not model weekly injuries, byes, waivers, or start/sit mistakes. Neither source is an independent outcome measure. The two CPU boards differ, and the operator saw ADJ in the table-only trial.

Full pick notes, public pick records, resolved league settings, source comparisons, and final view models are saved under `data/draft-results/prod-ui-trials-20260907/` (ignored local artifacts). Screenshots are under `/private/tmp/fantasy-tiers-screenshots/prod-trial-*.png`. The durable round-by-round record is in this report.

## Roster diagnostics

|Projection source|A starting lineup|B starting lineup|B minus A|A bench|B bench|
|---|---:|---:|---:|---:|---:|
|FantasyPros|2060.0|2098.4|+38.4|777.2|763.3|
|Sleeper|1877.5|1894.7|+17.2|708.3|662.1|

Both sources give B a small starting-lineup advantage and A more bench points. This supports keeping the tables usable alongside the recommendation, not promoting a new algorithm. B had a different CPU board and obtained McBride in round3. Full-season point sums are an imperfect measure of bench usefulness.

A: QB1, RB5, WR6, TE1, K1, D/ST1. B: QB1, RB6, WR5, TE1, K1, D/ST1. Each has ten legal starters including two FLEX, plus five bench players. All 30 owner picks match the recorded UI choices.

One minor endgame wording issue appeared: after the final owner pick, while the CPU finished its remaining picks, the sidebar briefly said `Turn unknown`. It changed to `Finished` when the draft completed. The roster and remaining-pick count were correct. This does not affect an owner decision and is deferred.

## Stop point

Production is ready for use within the stated scoring limits. The actual draft page was opened with FantasyPros selected, Recommendations expanded, slot4, 15 picks remaining, and no actual picks made. The algorithm remains frozen. Refresh the production page before the real draft and use the current on-clock board.
