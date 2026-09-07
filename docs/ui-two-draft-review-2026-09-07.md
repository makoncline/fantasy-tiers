# Two Sleeper UI draft trials — September 7, 2026

Both trials completed 168 picks. All 14 owner picks in each trial were made through the Sleeper UI. CPU auto-pick filled the other teams. Public REST records confirm both rooms are complete.

Both used slot 4, 12 teams, half PPR, 14 rounds, 1 QB, 2 RB, 2 WR, 1 TE, 2 FLEX, 1 D/ST, and 5 bench slots. These were half-PPR mocks, not a verified 0.69-PPR league rehearsal. The existing owner practice room was left unchanged.

- A: https://sleeper.com/beta/draft/nfl/1402775244418076672 — take only the visible top Sleeper recommendation.
- B: https://sleeper.com/beta/draft/nfl/1402781077222760448 — hide Recommendations and its next-pick scenario; choose from tables and details. ADJ remained in the tables, so this was not an experiment without model influence.

During A, before round three, the draft was paused for the requested display correction. Position badges now use selected-source projection ranks. Tiers now say FP Tier. Scoring did not change. The round-three lead and its values were unchanged after the rebuild. B used that same build throughout.

## Picks

| Round | A: top recommendation | B: tables and judgment |
| --- | --- | --- |
| 1 | Christian McCaffrey | Jonathan Taylor |
| 2 | Nico Collins | Nico Collins |
| 3 | Chris Olave | Javonte Williams |
| 4 | Quinshon Judkins | Jaylen Waddle |
| 5 | Joe Burrow | Mike Evans |
| 6 | Tony Pollard | Christian Watson |
| 7 | Sam LaPorta | Harold Fannin |
| 8 | Jayden Reed | Brock Purdy |
| 9 | MarShawn Lloyd | Kenny Gainwell |
| 10 | Matthew Golden | Jalen Coker |
| 11 | Chris Rodriguez | Chris Rodriguez |
| 12 | Khalil Shakir | Khalil Shakir |
| 13 | Baltimore D/ST | Tyjae Spears |
| 14 | Denzel Boston | Detroit D/ST |

Both finished with 1 QB, 5 RB, 6 WR, 1 TE, 1 D/ST, all starters filled, and five bench players.

## What the roster estimates say

For each source, select the highest projected legal nine-player starting lineup from the final roster, including two FLEX slots. Sum season projections. This does not simulate weekly lineups, injuries, waivers, or actual results. Bench sums are inventory diagnostics, not points that can all enter the lineup. FantasyPros D/ST values in this model use Sleeper projections.

| Evaluation source | A starting projection | B starting projection | B minus A | A bench sum | B bench sum |
| --- | ---: | ---: | ---: | ---: | ---: |
| Sleeper | 1711.2 | 1741.7 | +30.5 | 646.4 | 622.0 |
| FantasyPros | 1779.5 | 1768.3 | -11.2 | 583.3 | 577.9 |

The sources disagree on the better starting roster. These small differences do not establish a better strategy. The CPU boards also differed. In A, LaPorta survived to round seven; in B, a CPU took him in round five. The tests support keeping a useful default plus accessible alternatives. They do not support new scoring weights.

## Findings to address before the real draft

1. **Score explanations need to identify policy triggers.** In A, LaPorta changed from -3.8 ADJ in round six to 139.7 in round seven with the same 158.5 PTS and 31.1 VAL. Burrow in round five gave up 34.9 VAL versus Evans. The label QB/TE policy does not explain the decision. In B, Purdy had -68.4 ADJ with the QB slot still empty. Trace these rules and show the actual dominant trigger. Do not tune weights from these two boards.
2. **Keep future and current scores distinct in player details.** The reported next-pick table/dialog mismatch remains pending. Route the scenario context into the dialog or clearly label the current-board scores. This is a prior code-inspection finding; B did not use the scenario.
3. **Preserve the source contract.** Projected ranks now follow the selected source; tiers are explicitly FP. FP mode still uses Sleeper D/ST, still has FP ECR eligibility rules, and replaces platform ADP with ECR. Make these distinctions clear. Keep platform ADP available in both modes. Do not change eligibility policy just before the draft without separate validation.
4. **Verify source persistence and stale-feed handling.** FP was observed when a new room opened; A also showed FP after round two. Cause is not established, and other tabs may share storage. Every decision was checked against Sleeper. In A, the assistant briefly stayed at 116 received picks while REST had 123; a yellow stale warning appeared and the page recovered before Retry could run. No pick was made while stale. Test source persistence with multiple tabs and make it hard to mistake stale advice for current advice.
5. **Keep position headings in empty states and use accurate terms.** After taking one QB or TE, the position table becomes an unlabeled message: No roster-legal players remain in this pool. This confuses owner policy with league rules and leaves repeated messages in the page. Keep the position heading and say the owner limit is filled, or hide the section cleanly.
6. **Do not round positive scarcity to zero.** In B round nine, RB Value left showed 0% with Gainwell at +4.3 VAL and Rodriguez at +0.5. Use less than 1% for a positive remainder below one percent; reserve 0% for zero.

## Useful improvements that can wait

- Add Week 1 opponent or matchup context to D/ST details. Both trials chose defense from season projections because streaming context was not shown.
- Give bench recommendations a short, supported purpose and at least one useful alternative. A rounds nine and twelve offered only one player, with no substantive decision reason. Do not add a generic upside score.
- Keep projection source, counts, and roster access easy to reach while scrolling. The sidebar helped, but lower roster slots and bench entries left the viewport as the roster grew.
- Consider how to expose the best base-value alternative when the Overall table is sorted by ADJ. Early in B, the first viewport showed almost only WRs. Sorting by VAL revealed the RB trade-off. This is expected sorting behavior, but it affects how much independent comparison the table workflow provides.
- Review name casing and extreme fringe-player ADP display. These did not block a pick.

## What worked

- Exact turn, short versus long wait, live pick count, and remaining selections were useful at every stage.
- Tables, source values, projected position ranks, team/bye, and status made close choices inspectable.
- The Evans dialog showed both source estimates and dated news. The news reduced the risk of treating Questionable as an automatic rejection.
- Separate position tables exposed remaining QB and TE depth. Navigation worked with Recommendations hidden.
- The final-turn warning identified the remaining D/ST slot; no future own pick was shown.
- Both workflows produced complete rosters. No scoring changes were made during either draft.

## Evidence and limits

Detailed pick notes, settings, all picks, final view models, and the projection evaluation are in `data/draft-results/ui-two-trials-20260907/` (ignored generated artifacts). `notes.md` records the displayed PTS, VAL, ADJ, alternatives, and judgments at each pick. The final evaluation was run only after both drafts were complete; it did not expose hidden recommendations during B.

Screenshots from the live controlled tabs confirmed completion. Saved local screenshots are separate read-only captures of the completed view, not decision-time images. The source-rank display change passed focused tests, typecheck, lint, and a production build. No production deployment was performed in this trial.
