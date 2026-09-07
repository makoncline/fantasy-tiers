# Draft without the recommendations section

## Result

The tables are enough to draft the offensive starters. They make independent
value comparisons easier, but the current layout is not a complete replacement
for the choice assistant. Useful facts are spread across a long page. Some
player-preview advice is inaccurate or stronger than its evidence supports.

Completed eight offensive starter picks in Chrome, then stopped at 93 total
selections. No bench or D/ST picks were made. This follows the scope of the
preceding UI rehearsals; it is not a complete 14-round draft.

## Experiment controls

- Local isolated app: localhost:3009/mock-draft.
- Seed: `tables-only-20260906`; slot 4; 12 teams; 14 rounds; 0.69 PPR; two FLEX.
- Set `showRecommendations` to false in the isolated copy. The recommendations
  section, stress report, and two-pick paths were not rendered or consulted.
- Main repository UI and scoring were not changed for this experiment.
- All picks came from rendered table buttons. No API or saved recommendation
  output was used to choose a player.
- Sorted the overall table by Val after inspecting the first pick. The sort
  persisted across turns. Opened the position tables at pick three.
- This was not a blind or algorithm-free test. Adj remained visible in tables,
  and player previews contained recommendation-derived explanations. I had
  also seen earlier runs using these projections. These limits prevent a claim
  that removing recommendations improved outcomes.
- Data ready: core 129/129, draft pool 184/184. No calculation tuning followed.

## Pick-by-pick review

| Round/pick | Selection | Information used | What helped | What was missing or unclear |
| --- | --- | --- | --- | --- |
| 1 / 4 | Jahmyr Gibbs | Val 170.2, ECR 2.5, RB1; comparison with McCaffrey and JSN | Enough information for a strong base-value choice. ADP color and position rank were useful. | Exact wait to the next own pick disappeared with the recommendations section. `Tier 1/1` did not explain its two tier meanings in the row. |
| 2 / 21 | Christian McCaffrey | Val 129.7 versus Jefferson 90.6; second RB slot; Questionable status | Sorting by Val exposed the much higher base-value RB despite lower Adj. Preview showed the risk deduction of 3 and starter-need deduction of 33.6. | Preview said “Likely gone” and “Coin flip” despite showing a 76.7 Adj deficit against Jefferson. It also referenced Carnell Tate, an unrelated comparison. Those words were not used to decide. |
| 3 / 28 | Justin Jefferson | Val 90.6, WR6, ECR 9.6; no WR rostered; Bowers 62.8 | The WR need was visible in the roster. The full value table kept Jefferson above lower-Val alternatives. Position tables showed usable QB/TE depth. | Position tables required scrolling past the large overall list. Gibbs and Jefferson both had bye 6, but there was no adjacent overlap notice; this required comparing with the roster. |
| 4 / 45 | Brock Bowers | TE2, Val 62.8, ECR 21.1; Rice 59.7 and Wilson 56.8 as WR alternatives; deeper TE table | The positional table supported inspecting the gap from an early TE to later TEs. It was possible to weigh a TE against WR2 without a recommendation card. | No concise comparison of the TE-now and WR-now consequences. The exact six-pick wait had to be inferred from the snake draft, not a visible next-turn count. |
| 5 / 52 | Luther Burden | Val 53.8 versus McLaurin 47.5; WR2 open; Questionable | Status was visible in the row. The preview showed “Short-term concern.” Selecting him correctly filled WR2. | “Depth RWR2” was a source-like label, not useful plain language. The short status label did not itself explain the injury or expected absence. News requires a separate fetch. |
| 6 / 69 | Christian Watson | Val 43.5 versus Washington 43.3; FLEX open; QB alternatives inspected | Two FLEX slots remained visible in roster/status. Base values made the close WR choice easy to identify. | Defenses appeared among high-Val offensive alternatives with blank Adj and enabled Pick buttons. The table did not explain the late-defense owner policy. QB comparison required another section. |
| 7 / 76 | Rhamondre Stevenson | Val 20.4 versus Harrison 23.6; chose a third RB alongside three WRs; Herbert/Lawrence inspected for later QB | Position counts, values, byes, and market prices supported a manual roster-balance decision. | Shared bye 11 with Watson required a manual check. No direct “one FLEX remains” consequence beside the table row. Waiting on QB required reasoning without exact wait or grouped alternatives. |
| 8 / 93 | Trevor Lawrence | QB slot open; Val 10.3, ECR 75.5 versus Dart 4.6, ECR 98.7 | The Val sort made the higher-base-value QB visible. Selecting him completed all offensive starters. The preview exposed a −100 QB/TE-policy contribution. | Lawrence had Adj −60.3 versus Dart 33.6. The preview called that a “Slight edge” while showing −93.9 adjusted and comparing with Dontayvion Wicks. This is an explanation defect, not proof that the policy should be tuned. |

## Final roster

| Slot | Player | Bye |
| --- | --- | --- |
| QB | Trevor Lawrence | 7 |
| RB | Jahmyr Gibbs | 6 |
| RB | Christian McCaffrey | 8 |
| WR | Justin Jefferson | 6 |
| WR | Luther Burden | 10 |
| TE | Brock Bowers | 13 |
| FLEX | Christian Watson | 11 |
| FLEX | Rhamondre Stevenson | 11 |

Three RBs and three WRs. One QB and one TE. All eight offensive slots filled.
No redundant QB/TE or early defense was selected. This is construction evidence,
not a forecast that the roster is better than earlier test rosters.

The bench still needs to account for the Gibbs/Jefferson bye-6 pair and both
FLEX players on bye 11. McCaffrey and Burden carried Questionable labels at
selection. Those are unresolved roster considerations, not automatic reasons
to reject the picks or apply another penalty.

## Is the needed information displayed?

| Need | Assessment |
| --- | --- |
| Available players, position, team, rank | Yes, in the tables. |
| Base value and market price | Yes; Val sorting is particularly useful. |
| Current roster and both FLEX slots | Yes, but separated from the selection table. |
| Exact next own pick and intervening selections | Not visible in the remaining assistant surface on the clock. Can be derived from the draft grid. |
| Difference between base value and contextual score | Numeric difference is visible. Cause requires opening a preview. |
| Reliable explanation of a comparison | No. Two preview summaries contradicted the displayed score difference and named unrelated players. |
| Injury/status | Short label visible; actionable detail requires preview/news and may remain thin. |
| Bye conflict with owned players | Individual byes visible; overlap is a manual comparison. |
| Position depth and room starter needs | Available after expanding position tables. Starter need is not a survival probability or total opponent demand. |
| Specialist policy | Not clear in table rows: blank Adj does not explain why a defense is outside the recommendation policy. |
| Equal meaning of columns across tables | Weak. Overall tiers use paired numbers; position tiers use single numbers. ADP and edge presentation also differ. |
| Current sort | Arrow changes correctly, but the overall caption still says “Top 50 roster-legal players by Adj” after sorting by Val. |

## Priorities suggested by this test

1. Fix the player-preview comparison text. Use the actual compared player and
   signed score gap. Remove unsupported “Coin flip,” “Slight edge,” and strong
   waiting language. Test the negative-gap cases recorded here.
2. Keep exact pick distance, open starting slots, and bye-overlap facts outside
   the optional recommendations section. These are useful facts for either UI.
3. Make the tables easier to use: position navigation near the overall pool,
   less scrolling, accurate sort caption, and clear overall/position tier labels.
4. Mark manual-only choices such as early D/ST with the relevant owner policy.
   Keep a manual pick possible, but explain a blank Adj.
5. Keep the compact status badge; improve actionable detail and source freshness
   on demand. Do not turn a Questionable label into a large new score penalty.

No new scoring weights are justified by this one run. A fair policy comparison
would need paired boards and a separate outcome standard. This test supports a
UI conclusion: keep the tables as a first-class workflow, with a small shared
facts strip and trustworthy optional details.

## Evidence

`data/draft-results/tables-only-20260906/` contains the partial result, UI text
for all eight decisions, two preview captures, and screenshots. The isolated
app retains recommendations hidden for inspection; the normal app is unchanged.

![Roster and status](../data/draft-results/tables-only-20260906/screens/roster.png)
