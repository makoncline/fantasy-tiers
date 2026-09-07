# Choice assistant UI fixes

Status: implemented and verified locally. No push or deployment.

## Changes

- Cards show the largest weighted score edge against the other choice, with its
  component name and amount. This explains the default without calling Adj
  fantasy points or confidence.
- The header lists open positions. Each card shows the slot it fills and the
  slots left open. Both FLEX slots count.
- Status detail and shared roster byes appear before expansion. These facts do
  not add a score bonus or penalty.
- Stress results list the tested winners and their original display location.
  The full cases and set-membership details require expansion. If only the
  comparison set changes, the text says that the default stays the same.
- The status bar no longer covers card headings. Local mock cards have Pick
  buttons for every displayed eligible choice. The shared callback needs only
  the player ID. Live drafts have no Pick callback.
- The optional preview compares two first picks under one market-order
  assumption. It shows the next lean, the deferred position's remaining option,
  and open slots after the second pick. If only one comparison exists, it says
  so. It does not select a path winner or claim validated survival odds.

Active scoring, owner policy, and opponent behavior were not changed by this
work. The parallel ESPN edits, including provider-neutral labels, were kept.
One existing table text assertion was updated to match those neutral labels.

## Saved-case verification

The prior local rehearsal was replayed at the same five decision points. The
canonical board stayed unchanged during the comparison, stress, and path work.
Each reproduced the previously recorded default.

| Pick | Default | Stress winners | Original display location |
| --- | --- | --- | --- |
| 21 | Chris Olave | Chris Olave | Visible |
| 45 | Jaylen Waddle | Waddle, Garrett Wilson | Both visible |
| 69 | Jayden Daniels | Daniels, D'Andre Swift | Both visible |
| 76 | D'Andre Swift | Swift, George Kittle | Swift visible; Kittle absent from initial comparison set |
| 93 | George Kittle | Kittle, Travis Kelce | Both visible |

No winner in these five cases was hidden only on expansion. At pick 76, Kittle
can be selected for inspection from the stress case details. His absence is
reported rather than concealed by the stable default. Scenario frequency is
not a probability.

At pick 93, the input detail was `Questionable: Surgery` for Kittle. His bye
matched McCaffrey and Olave. Both facts now appear on the compact card. This is
source information, not a new medical judgment or availability forecast.

## Fresh local rehearsal

Used Chrome against an isolated copy on port 3009, seed
`choice-ui-fixes-20260906`, slot 4, 12 teams, 14 rounds, 0.69 PPR, two FLEX.
Stopped after eight offensive starters at 93 total selections. D/ST and bench
were deliberately left for later.

| Round | Pick | UI observation |
| --- | --- | --- |
| 1 | Puka Nacua | Base-value edge and Questionable detail were visible. |
| 2 | CeeDee Lamb | Chose the higher-Val alternative; its new card Pick action worked. Kyren's card identified starter need as the main score edge. |
| 3 | Breece Hall | Starter-need contribution and remaining RB slot were explicit. |
| 4 | Brock Bowers | QB/TE-policy contribution was explicit. Stress kept Bowers first but changed the comparison set; the summary now distinguishes these events. |
| 5 | Jadarian Price | The large Val sacrifice and shared bye were visible. No policy tuning followed this observation. |
| 6 | Parker Washington | Chose a close alternative to Watson, whose bye matched two rostered players. This was a manual choice, not a new bonus. |
| 7 | Rhamondre Stevenson | Preview compared Herbert now → Brooks later with Stevenson now → Dart later. Both paths showed only D/ST open after the second pick. |
| 8 | Jaxson Dart | QB completed the offensive starters; the app then showed only D/ST open. |

The rehearsal verified UI behavior. It does not prove these picks improve
fantasy outcomes or that the market-order scenario predicts a real room.

## Checks and artifacts

- 506 tests passed across 78 files.
- Clean TypeScript check with incremental cache disabled.
- Full lint passed.
- Final isolated production build passed with webpack.
- Browser verified card picks, a manual alternative, two paths, stress summary,
  bye details, disabled picks off turn, and an early stop.

Artifacts are under `data/draft-results/choice-ui-fixes-20260906/` (ignored):
`saved-cases.json`, `draft-result.json`, and `screens/`. The saved replay probe
is retained there as evidence; its imports refer to its original
`scripts/temp/` location. The earlier rehearsal remains intact.

![Verified card layout](../data/draft-results/choice-ui-fixes-20260906/screens/cards.png)
