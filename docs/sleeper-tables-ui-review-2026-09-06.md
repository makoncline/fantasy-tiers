# Sleeper tables-only UI rehearsal — September 6, 2026

## Result and limits

Completed eight manual selections in a new Sleeper bot mock. The room is paused at pick 100 with 99 recorded picks. All eight selections were submitted through Sleeper's rendered DRAFT controls and verified against the public pick feed. The assistant showed the same roster. No ninth owner pick was made.

- Room: https://sleeper.com/beta/draft/nfl/1402538677917188096
- Assistant: http://localhost:3009/draft-assistant?userId=467542001726779392&draftId=1402538677917188096
- Slot 4, 12 teams, snake, 14 rounds; 1 QB, 2 RB, 2 WR, 1 TE, 2 FLEX, 1 D/ST, 5 bench, no kicker.
- Sleeper ranking format: half-PPR. No linked league or full scoring map was available. This does not reproduce the owner's exact 0.69 scoring.
- Recommendations were hidden in an isolated copy. Adj values and the default Adj table sort remained visible. This was not a test without model influence.
- Refreshed FP, Sleeper, and tier data in the isolated copy; aggregate generation and both validation commands passed. The UI reported Data ready, core 127/127, draft pool 181/181.
- Used pauses at owner turns for inspection. This tested a manual workflow, not performance under a 60-second clock.
- No scoring changes or product fixes were made during the test. No deployment occurred.
- This is a UI rehearsal, not a prospective availability-validation board. No forecast accuracy or fantasy-outcome claim follows from it. Choosing a different player from the default is not a forecast-integrity failure.

## Pick-by-pick review

| Pick | Selection and reasoning | Useful | Bad or missing |
| --- | --- | --- | --- |
| 1.04, #4 | Jahmyr Gibbs, RB1. Clear Val lead over the available alternatives. | Selected players were removed; Data ready, slot, open starters, and exact 16-pick wait were visible. | Full roster with empty bench rows occupies the space above the player pool. At this viewport, only a few candidates fit without further scrolling. |
| 2.09, #21 | A.J. Brown, WR1. Compared with Bowers and Walker; preferred WR with a short return interval. | Strip correctly changed to six intervening picks. Bowers' preview separated base value from starter adjustments. | The default Overall list put many late WRs above Walker, whose Val was 101.7 but Adj 65.1. Bowers' preview compared him with Olave, not Brown or Walker. “League needs 36 TE” did not explain the FLEX contribution. |
| 3.04, #28 | George Pickens, WR2. Val 66.2 versus Javonte Williams 68; stronger ECR/market position supported the WR choice. | Position tabs exposed both options and their direct slots. Bye overlap was visible on Higgins and Judkins. | Both Bowers and Walker had left the board during the six-pick wait. The app gave no record of the earlier comparison or summary of which considered options disappeared. A short wait did not mean safe availability. |
| 4.09, #45 | D'Andre Swift, RB2. Preferred his higher base value to Judkins. | Preview: +9 Val but only +0.2 Adj versus Judkins. Recent news explained a cramp behind the Questionable flag. | The compact status alone lacked that useful context; a preview was required. The table still repeated unexplained league-demand counts. |
| 5.04, #52 | Drake Maye, QB. Compared the elite QB option with Adams at FLEX and Warren at TE. | QB/FLEX/TE tabs showed different roster purposes. Maye's 29.9 Val and 106.4 Adj were distinct from Adams' 45.5 and 63.9. | No side-by-side chosen-player comparison. Every shared bye received the same treatment, although QB and WR require different replacements. |
| 6.09, #69 | Christian Watson, FLEX1, over Kraft. Manual preference for the higher-Val WR; left TE for the short return. | Kraft preview showed -5.8 Val but +7 Adj versus Watson, with starter need as the largest component difference. Recovery news was useful beyond “Surgery.” | Could not retain that pair for the next turn. A selected comparison pair would also help show what must remain available for this path to work. |
| 7.04, #76 | Harold Fannin, TE, after Kraft was taken. | TE and FLEX tables showed remaining TE choices and the four-player bye-11 group. | Kraft vanished during another six-pick wait. Fannin and Pitts shared bye 11 with Maye, Brown, and Watson. The app listed names, but did not explain the required QB, TE, and two WR/FLEX replacements. |
| 8.09, #93 | Quentin Johnston, FLEX2, over Lloyd. Chose to avoid a fifth bye-11 starter. This was a personal trade-off, not a validated better choice. | Val sort exposed Johnston as the next base-value option: 7.8 versus Lloyd 17.6. Lloyd's news described a route to starting work. D/ST rows clearly explained blank Adj as a deferred-specialist policy. | Lloyd's preview compared him with Mason instead of Johnston. “Fills FLEX2” establishes slot eligibility, not starter quality. The UI does not show that distinction or the cost of rejecting Lloyd's modeled advantage. |

## Final roster

| Slot | Player | Bye |
| --- | --- | --- |
| QB | Drake Maye | 11 |
| RB | Jahmyr Gibbs | 6 |
| RB | D'Andre Swift | 10 |
| WR | A.J. Brown | 11 |
| WR | George Pickens | 14 |
| TE | Harold Fannin | 11 |
| FLEX | Christian Watson | 11 |
| FLEX | Quentin Johnston | 7 |

D/ST and all five bench spots are open by test design. This is not a complete-draft result. The roster has four WRs and two RBs; the bench would need RB coverage. Four starters share bye 11. With no bench drafted, there is no current cover. Later bench picks and waivers could change that assessment.

## What worked

- Live pick removal, roster updates, turn numbers, and 16/6 wait alternation matched Sleeper.
- The compact facts strip remained available with recommendations hidden.
- Tabs made position alternatives accessible. The Val sort remained selected across later pick updates.
- Overall and position tiers were distinct; FLEX tiers included position labels.
- Actual signed preview differences replaced the previous misleading edge labels.
- News timestamps and readable excerpts helped interpret injury flags.
- Early D/ST rows stated why Adj was blank. They did not look like unexplained missing data.
- Waiting copy did not claim validated survival odds or confidence.

## Priority changes from this rehearsal

1. **Let the user select two or three players to compare.** Keep the pair across tabs. Compare the actual chosen alternatives, show Val/Adj and roster consequences, and flag a member when drafted. Do not add scoring weights.
2. **Explain demand counts.** Separate open direct starters from shared FLEX slots. “36 TE needed” is misleading without the allocation basis and can imply far more TE pressure than exists.
3. **Show bye coverage by required slot.** Start with an exact legal-lineup coverage count using the current roster. State what remains uncovered; do not invent projected lost points. Keep this advisory.
4. **Make the player pool reachable without a full roster scroll.** Collapse empty bench rows or use a compact roster summary above the pool. The facts strip is useful, but the full roster pushes it below the first screen.
5. **Expose the source of Adj disagreement in the table.** At #21, WR need dominated the order; at #52, the QB policy changed the comparison. A short contribution summary or an easy Val/Adj view switch would reduce dependence on the first row.
6. **Separate “can fill this slot” from “credible weekly starter.”** Use supported role/news information in details. Do not create a new upside score. Johnston and Lloyd illustrate why slot completion alone is not roster-quality evidence.

No conclusion here establishes that waiting on Bowers or Kraft was wrong in expectation. It records what happened on one board and the information that was absent when choosing. Likewise, the bye-based Johnston choice needs no retroactive change to the model to make the UI test valid.

## Evidence

Private artifacts: `data/draft-results/sleeper-tables-ui-20260906/`.

Includes exact Sleeper settings and picks, refreshed source metadata, decision-time rendered text, preview text, and screenshots. The partial board is kept as raw Sleeper evidence, not imported as a completed draft. The copied room inherited an old research name and CPU drafting disabled; it was renamed and CPU drafting enabled before the first owner selection. All owner selections were manual.
