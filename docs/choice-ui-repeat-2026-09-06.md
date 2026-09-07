# Repeat UI rehearsal

Completed in Chrome using the final isolated UI candidate at localhost:3009.
Seed: `choice-ui-repeat-20260906-b`. Slot 4, 12 teams, 14 rounds, 0.69 PPR,
two FLEX. Data ready: core 129/129, draft pool 184/184. No code changes.

Stopped after eight offensive starters and 93 total selections. D/ST and bench
were deliberately not drafted. All actions used the rendered UI.

| Pick | Selected | What helped | Limit or observation |
| --- | --- | --- | --- |
| 4 | Puka Nacua | Base-value edge over JSN and Questionable status were visible. | Same overall tier does not mean equal value; the 23.4 Val difference remained explicit. |
| 21 | James Cook | Cook versus McBride paths showed later TE/RB options and open slots. | The scenario removed McBride, but he survived the actual six-pick wait. |
| 28 | Trey McBride | Base edge over Bowers and the TE slot consequence were clear. | Only two TEs appeared initially; no cross-position alternative was visible in the initial cards. |
| 45 | George Pickens | Roster-construction edge, shared bye, Allen alternative, and stable stress winner were clear. | The preview removed Allen; he also survived the next actual turn. |
| 52 | Josh Allen | The default's 44.1 Val sacrifice was explicit. Allen's card Pick button worked. | Manual override of Price. This tests owner choice, not forecast accuracy or better outcomes. |
| 69 | Rhamondre Stevenson | RB2 remained open after Allen; the card showed starter need as the main edge over Watson. | Larger base-value alternative remained visible rather than hidden by the need bonus. |
| 76 | Chris Godwin | Higher base value was visible beside Pollard; stress text correctly said the default stayed the same while the comparison set changed. | Manual override. “Bench balance” is the actual component name but can confuse users when it affects a FLEX starter. |
| 93 | Jonathon Brooks | FLEX2 completion, Questionable detail, Pittman alternative, and open D/ST were visible. | The same “Bench balance” label needs plain-language context. |

Final offensive lineup: Allen; Cook and Stevenson; Nacua and Pickens; McBride;
Godwin and Brooks at FLEX. Three RB and three WR. Byes shared by Cook/Allen,
Nacua/Stevenson, and Pickens/McBride remain bench-planning considerations.

## Result

No blocking UI error was observed. Default and alternative card picks worked.
The recommendation refreshed after each pick. Preview state cleared on turn
changes. Exact waits alternated between 16 and 6. Both FLEX slots were counted.
Off-turn Pick buttons were disabled. Card names were not covered by the status
bar. Saving the partial draft succeeded.

The scenario remains a deterministic what-if. The observed misses above are
useful warnings about its limitations, not enough evidence for a tuning change.
The UI made no probability, equal-value, or validated path-winner claim.

Artifacts: `data/draft-results/choice-ui-repeat-20260906/draft-result.json` and
`screens/` contain each pick's UI text, the stopped state, and a screenshot.

![Final starter cards](../data/draft-results/choice-ui-repeat-20260906/screens/pick-8.png)

## Follow-up wording changes

Changed “Bench balance” to “Roster depth and balance” in the cards, score
breakdown, and player preview. Added a short explanation that this rule can
apply to FLEX starters too. The next-pick badge now says “Illustrative what-if.”
A visible note states that removed players can still survive and shown players
can be taken. Each path starts with “If the room follows this order.” No score
or opponent-model calculation changed. Chrome verification, 10 focused tests,
TypeScript, and focused lint passed. Archived replay source is stored as
`.ts.txt` so evidence files do not enter application compilation.
