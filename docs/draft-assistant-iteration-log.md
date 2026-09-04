# Draft Assistant Iteration Log

Use this log to preserve what we learned from mock drafts, analyzer reports, and UI changes. Keep the generated artifacts in ignored `data/draft-results/<run>/`; this file should only hold the durable conclusions.

## 2026-07-01 - Iteration 1

- Run: `data/draft-results/20260701052024-sim-iter-01-slot-2-2026-slot-2`
- Setup: 10 teams, 15 rounds, slot 2, seed `iter-01-slot-2-2026`.
- Process: used the live `/mock-draft` UI and the shared draft assistant overall board for every user pick.
- Historical external grade: `A+`.
- Bot field: mostly `C` range, with one `B-`; the user team beat the bots, but bot quality should still improve over time.
- User position grades: QB starters `A-`, RB starters `A+`, RB depth `A+`, WR starters `C+`, WR depth `A+`, TE starters `C+`.

Most useful signals:

- `VAL` to identify real value falls.
- `Back?`/comeback to decide whether a player was likely gone before the next pick.
- Position and tier-cliff flags when deciding between similar value.
- Roster counters and human roster-balance judgment when raw value favored too many RBs or backup QB/TE.

Signals ignored or downweighted:

- Backup QB/TE value after filling the starter slot.
- K/DEF before the final rounds.
- Raw value when it conflicted with open WR/TE starter needs or useful RB/WR bench depth.

Durable product lessons:

- The assistant can produce an `A+` team with the current overall board, but it still leaves starter balance too implicit. This run again produced weaker WR and TE starter grades despite the overall result.
- The overall board needs draft-clock context directly beside the table: open core starters, FLEX status, bench RB/WR mix, and warnings.
- A suspicious high-value unfamiliar player should eventually get a confidence/fringe-player warning before a real draft pick.
- Late in the draft, K/DEF should become easier to access without polluting the early combined board.

Implemented after this iteration:

- Added a compact pick-focus strip above the overall value table. It reuses existing `rosterConstruction` and `draftContext` data to show the current phase, open starter positions, FLEX status, bench RB/WR mix, and top warnings without changing ranking math.

## 2026-07-01 - Iteration 2

- Run: `data/draft-results/20260701053440-sim-iter-02-slot-9-2026-slot-9`
- Setup: 10 teams, 15 rounds, slot 9, seed `iter-02-slot-9-2026`.
- Process: used the live `/mock-draft` UI and the shared draft assistant overall board for every user pick.
- Historical external grade: `A+`.
- Bot field: `D+` to `C+`; the user team beat every bot again, but bot teams still have large position holes.
- User position grades: QB starters `A+`, RB starters `A+`, RB depth `C`, WR starters `B-`, WR depth `A+`, TE starters `A+`.

Most useful signals:

- `VAL` for extreme fallers such as Gibbs, Bijan, and Saquon.
- Pick-focus strip for open starters, FLEX, bench mix, and the WR starter fragility warning.
- `Back?`/comeback to decide when top-tier QB/TE and tier-cliff players would not return.

Signals ignored or downweighted:

- Backup QB/TE rows after Josh Allen and Brock Bowers were drafted.
- Saquon raw value at 4.02 while WR starter slots were still open.
- K/DEF before the final three rounds.

Durable product lessons:

- The focus strip helped directly on the A.J. Brown and DeVonta Smith decisions by making WR starter balance visible.
- The focus strip also exposed bugs: bye warnings could duplicate, and `Finish K/DEF` remained after both special-teams slots were filled.
- K/DEF data was present, but special-teams targets were buried in the combined board. Late-round special-teams filtering should be one click.
- Jadarian Price again exposed a source-confidence/fringe-player gap. The app needs to distinguish a legitimate value from a low-confidence or odd player row.

Implemented after this iteration:

- Dedupe focus-strip warnings.
- Only show `Finish K/DEF` while K or DEF is actually still open.
- Add a `SPECIAL` position preset that filters the combined board to K/DEF.

## 2026-07-01 - Iteration 3

- Run: `data/draft-results/20260701054842-sim-iter-03-slot-1-2026-slot-1`
- Setup: 10 teams, 15 rounds, slot 1, seed `iter-03-slot-1-2026`.
- Process: used the live `/mock-draft` UI and the shared draft assistant overall board for every user pick.
- Historical external grade: `A+`.
- Bot field: `D+` to `B`; this was stronger pressure than iteration 2, with slots 2 and 9 both reaching `B`.
- User position grades: QB starters `B`, RB starters `A+`, RB depth `C+`, WR starters `B-`, WR depth `A+`, TE starters `C+`.

Most useful signals:

- `VAL` for extreme fallers such as Gibbs, Bijan, Jadarian Price, Rico Dowdle, and Chuba Hubbard.
- Pick-focus strip for RB/WR starter balance after an RB-heavy start.
- `No backup QB` and `Backup TE only` flags after the one-start positions were filled.
- SPECIAL filter for the final K/DEF turn.

Signals ignored or downweighted:

- Backup QB/TE value after Jalen Hurts and Colston Loveland were drafted.
- K/DEF before the final two picks.
- K/DEF `ADPΔ +85 rd` and `likely 100%` comeback labels, which came from placeholder Sleeper ADP and were not meaningful.

Durable product lessons:

- The assistant produced another `A+`, now from slot 1, and beat a bot field that included two `B` teams.
- The same weakness persisted: overall result was elite, but WR starters stayed `B-` and TE starter was `C+`. Future iterations should keep testing whether stronger WR/TE starter pressure improves position grades without lowering overall grade.
- The SPECIAL filter is valuable, but special-teams timing data must be cleaner than core-position timing data because Sleeper ADP can be placeholder-like for K/DEF.
- `Finish K/DEF` should be reserved for the point where every remaining pick is needed for K/DEF; if there is still a spare bench slot, the UI should keep recommending RB/WR upside while showing K/DEF is open.
- Jadarian Price again highlighted the need for a source-confidence/fringe-player warning.

Implemented after this iteration:

- Treat Sleeper placeholder ADP values `>= 900` as missing draft timing data so K/DEF rows no longer show fake `ADPΔ +85 rd` or fake comeback certainty.
- Only show the `Finish K/DEF` focus when remaining user slots are no more than the open K/DEF slots; otherwise show `RB/WR bench upside` while still surfacing `Open K/DEF`.

## 2026-07-01 - Iteration 4

- Run: `data/draft-results/20260701060317-sim-iter-04-slot-6-2026-slot-6`
- Setup: 10 teams, 15 rounds, slot 6, seed `iter-04-slot-6-2026`.
- Process: used the live `/mock-draft` UI and the shared draft assistant overall board for every user pick. Pick-by-pick notes are saved beside the ignored run artifact.
- Historical external grade: `A+`.
- Bot field: `D+` to `A-`; this was the strongest pressure so far because slot 10 reached `A-`, but the user still had the top grade.
- User position grades: QB starters `A+`, RB starters `A+`, RB depth `C`, WR starters `B`, WR depth `A+`, TE starters `A+`.

Most useful signals:

- `VAL` plus tier cliff for the early core picks: Jahmyr Gibbs, Amon-Ra St. Brown, Brock Bowers, and Josh Allen.
- Pick-focus strip for starter balance; it directly supported taking Amon-Ra over more RB value and Travis Etienne when RB starter quality got fragile.
- `Back?` for deciding when Josh Allen and Rashee Rice were unlikely to return.
- Bench RB/WR counts for Rome Odunze, Jordan Addison, Rachaad White, and Jayden Reed.
- Bye warnings were useful context after the roster clustered around Weeks 6 and 11.
- SPECIAL preset made the final K/DEF turn understandable once selected.

Signals ignored or downweighted:

- Backup QB rows after Josh Allen, even when they appeared near the top by value.
- Backup TE rows after Brock Bowers.
- K/DEF before the final two picks.
- Raw value on unfamiliar or thin-confidence players until the opportunity cost fell.

Durable product lessons:

- The balanced middle-slot strategy produced the best position-grade shape so far: elite QB/RB/TE starters, `B` WR starters, and `A+` WR depth.
- The app still needs better inline context for `Questionable` and `News risk`; Rashee Rice was a value pick, but the UI did not explain the injury/news issue enough under draft-clock pressure.
- High-value unfamiliar rows like Jadarian Price and Bhayshul Tuten need source/confidence/fringe context so a user can tell whether the value is real.
- When the focus says `Finish K/DEF`, the table itself should reduce noise. In this run, after drafting DEF, backup DEF rows still appeared above the only open K slot.
- The save-result action successfully wrote the artifact but visually landed on a not-found-like payload; future polish should make save confirmation cleaner.

Implemented after this iteration:

- When every remaining user pick must fill open K/DEF slots, automatically scope the combined board to the open special-teams positions.
- If DEF is filled and K is still open, the table now shows kicker rows only instead of backup DEF rows above the needed kicker.
- Verified in Chrome with a two-team, two-round K/DEF-only mock: after drafting DEF, the final user pick showed `Open K` and only kicker rows.

## 2026-07-01 - Iteration 5

- Run: `data/draft-results/20260701061647-sim-iter-05-slot-10-2026-slot-10`
- Setup: 10 teams, 15 rounds, slot 10, seed `iter-05-slot-10-2026`.
- Process: used the live `/mock-draft` UI and the shared draft assistant overall board for every user pick. Pick-by-pick notes are saved beside the ignored run artifact.
- Historical external grade: `A-`.
- Bot field: `C-` to `B+`; the user beat every bot but missed the working target of consistent `A` or better grades.
- User position grades: QB starters `A-`, RB starters `A`, RB depth `D+`, WR starters `A-`, WR depth `A+`, TE starters `C+`.

Most useful signals:

- `VAL` still found strong early value at the turn: Amon-Ra St. Brown, Derrick Henry, De'Von Achane, and A.J. Brown.
- The pick-focus strip kept RB/WR starter balance visible; this run produced `A`/`A-` starters at RB and WR.
- SPECIAL filtering and the late K/DEF workflow worked as intended.
- The saved run and retrospective made the failure mode obvious after the draft.

Signals ignored or downweighted:

- The top TE window was too implicit. Brock Bowers and Trey McBride were available at the 1.10/2.01 turn, but the table did not make the elite starter tier feel meaningfully different from generic tier-cliff value.
- Raw RB value on Derrick Henry and Achane looked strong enough that TE starter quality was deferred to Colston Loveland in round 6.
- Backup QB/TE value was still correctly ignored after Drake Maye and Loveland were rostered.
- High-value unfamiliar rows and player-risk rows still need better context before a draft-clock decision.

Durable product lessons:

- Beating mediocre bots is not enough. The external analyzer target is still `A` or better, and this run shows the assistant can win the room while failing the product bar.
- A slot-10 turn creates a long wait after the first two picks, so the app needs to call out scarce elite starter windows before they close. TE is the clearest example: missing Bowers/McBride likely drove the `C+` TE starter grade and lowered the overall grade to `A-`.
- The UI should treat top-tier one-start positions as a soft review signal, not an automatic rule. Elite TE should be visible while TE is open; backup TE should remain de-emphasized after TE is filled.
- The retrospective flow is valuable: compare selected picks against who was visible at each turn, then convert repeated misses into one small UI or value-model improvement.

Implemented after this iteration:

- Added an `Elite TE` draft-value reason and a small recommendation boost for top-two FantasyPros positional TEs while the user's TE starter slot is open.
- Ordered `Elite TE` ahead of generic `Tier cliff`/`Roster need` flags so it appears in the compact table's first two displayed flags.
- Added a regression test that top-two TEs are flagged and that the flag is visible in the first two displayed reasons.
- Verified in Chrome at pick 1.10 with seed `verify-elite-te-2026-c`: Brock Bowers and Trey McBride rows show `Elite TE, Tier cliff` in the compact table.
- Screenshot: `/private/tmp/fantasy-tiers-screenshots/iteration-5-elite-te-label.png`.

## 2026-07-01 - Iteration 6

- Run: `data/draft-results/20260701063431-sim-iter-06-slot-3-2026-slot-3`
- Setup: 10 teams, 15 rounds, slot 3, seed `iter-06-slot-3-2026`.
- Process: used the live `/mock-draft` UI and the shared draft assistant overall board for every user pick. Pick notes and a retrospective are saved beside the ignored run artifact.
- Historical external grade: `A+`.
- Bot field: `C-` to `B`; the user beat every bot and cleared the target comfortably.
- User position grades: QB starters `A-`, RB starters `A`, RB depth `A+`, WR starters `A+`, WR depth `A+`, TE starters `A+`.

Most useful signals:

- The new `Elite TE` flag directly affected the draft: Brock Bowers was taken at 3.03 after being passed once at 2.08, and TE starters graded `A+`.
- Pick-focus starter balance kept the build from becoming RB-only or WR-only: Chase/Henry/Bowers/Jacobs/London produced no weak starter group.
- `Best value` plus `Tier cliff` worked well for Henry, Bowers, Jacobs, and Maye.
- `No backup QB` and `Backup TE only` helped ignore Purdy/Kelce/Goedert style rows after starters were filled.
- Automatic K/DEF scoping worked again in a full draft.

Signals ignored or downweighted:

- Bowers at 2.08 because the board still showed a likely comeback and Derrick Henry filled a more fragile open RB starter slot.
- Backup QB/TE rows after Maye and Bowers.
- Questionable/news-risk rows when there was a cleaner similar option, except Drake London where the value gap was too large.
- High-value unfamiliar RB rows until later rounds, when the opportunity cost was lower.

Durable product lessons:

- This was the clearest validation so far that a small, visible scarce-starter signal can change decisions and improve the final analyzer grade.
- The successful shape was not pure value-only: it combined elite WR, elite TE, two strong RB starters, one good QB, and then RB/WR depth.
- The app should preserve the separation between starter-window warnings and backup onesie warnings. `Elite TE` while TE is open is useful; backup TE values after Bowers are noise.
- The remaining biggest gap is still trust context for unfamiliar values and risk flags. The UI needs to explain why a player like Jadarian Price is ranked high or why a `Questionable` player is still worth taking.

Implemented after this iteration:

- No code change yet. The current `Elite TE` change produced an `A+` from slot 3 and should be tested in more slots before changing the value model again.

## 2026-07-01 - Iteration 7

- Run: `data/draft-results/20260701064059-sim-iter-07-slot-8-2026-slot-8`
- Setup: 10 teams, 15 rounds, slot 8, seed `iter-07-slot-8-2026`.
- Process: used the live `/mock-draft` UI and the shared draft assistant overall board for every user pick. Pick notes and a retrospective are saved beside the ignored run artifact.
- Historical external grade: `A+`.
- Bot field: `C-` to `B`; the user again beat every bot and cleared the target.
- User position grades: QB starters `B`, RB starters `A+`, RB depth `A+`, WR starters `A-`, WR depth `A+`, TE starters `A+`.

Most useful signals:

- `Elite TE` again worked: Brock Bowers at 3.08 created an `A+` TE starter grade.
- Starter balance was critical. Passing Bijan at 2.03 for Amon-Ra St. Brown still produced `A+` overall and avoided the known RB-heavy/weak-WR failure mode.
- RB/WR depth mode worked well from rounds 7-13: David Montgomery, DeVonta Smith, Jadarian Price, Marvin Harrison, Jaylen Warren, Jayden Reed, and Rachaad White.
- Automatic K/DEF scoping worked for a third full run.

Signals ignored or downweighted:

- Bijan Robinson's raw value at 2.03 because the build already had Jahmyr Gibbs and needed a WR anchor.
- Backup QB and backup TE rows after Jayden Daniels and Brock Bowers.
- Questionable WR rows when a cleaner bench option was close.

Durable product lessons:

- Two straight `A+` runs after the `Elite TE` change suggest the signal is valuable and should remain.
- The next UI gap is explaining cross-position tradeoffs. The Amon-Ra-over-Bijan decision was correct in this run, but the UI did not explicitly say "second elite RB would leave WR starter pressure."
- QB can be only `B` and still produce an `A+` team when RB/WR/TE are strong. Do not overcorrect toward early QB based only on a non-elite QB grade.
- Source-confidence and risk context remain the largest unresolved usability gaps.

Implemented after this iteration:

- No code change yet. The next candidate improvement is a compact balance/tradeoff cue for taking a second RB/WR before the other core starter side is stable.

## 2026-07-01 - Iteration 8

- Run: `data/draft-results/20260701065236-sim-iter-08-slot-2-2026-slot-2`
- Setup: 10 teams, 15 rounds, slot 2, seed `iter-08-slot-2-2026`.
- Process: continued the live `/mock-draft` UI run from pick 13.02, saved the completed app artifact, and generated a slot-2 retrospective.
- Historical external grade: `B+`, below the former target.
- Bot field: `C-` to `A+`; slot 10 beat the user with an `A+`.
- User position grades: QB starters `B`, RB starters `A+`, RB depth `C`, WR starters `C+`, WR depth `A+`, TE starters `A+`.

Most useful signals:

- The new RB/WR balance warning helped avoid a second RB at 2.09 and supported Nico Collins after Jahmyr Gibbs.
- `Elite TE` continued to work: Brock Bowers at 3.02 produced an `A+` TE starter grade.
- Automatic special-teams scoping worked in the final rounds. Brandon Aubrey was visible as K1 at 14.09, and after drafting him the 15.02 board narrowed to DEF only.

Signals ignored or downweighted:

- Backup QB/TE rows were correctly ignored after Jalen Hurts and Brock Bowers.
- The generic `WR starter quality is getting fragile` warning was too weak; it did not change the round 5-8 decisions enough.
- RB depth value on D'Andre Swift, Chuba Hubbard, Jadarian Price, and Rachaad White was too easy to accept while WR starter quality stayed weak.

Durable product lessons:

- This was the first clear post-`Elite TE` failure and it exposed the next strategy gap: WR2/WR3 quality can collapse even when the app nominally says WR is fragile.
- The critical missed window was rounds 4-8. Ladd McConkey stayed available through multiple turns and disappeared before pick 9; Waddle, Davante Adams, Terry McLaurin, DJ Moore, Mike Evans, Courtland Sutton, and similar WR options also came off while the roster accepted QB/RB value.
- A top TE plus strong RB can still fail the product bar if WR starter quality is not protected. The assistant needs to treat the third useful WR/FLEX piece as part of the core build, not just bench depth.
- The slot-10 bot `A+` is useful pressure: the bots are still uneven, but they can punish a weak build, so the evaluation loop is doing real work.

Implemented after this iteration:

- Added a `WR starter` draft-value reason and a modest recommendation boost for WRs while the roster has fewer than three WRs, starter/FLEX quality is still open, and the player is unlikely to return, near a tier cliff, or inside a meaningful positional range.
- Added a regression test that a starter-window WR outranks non-elite QB/RB-depth choices in the iteration-8 shape.

## 2026-07-01 - Iteration 9

- Run: `data/draft-results/20260701070436-sim-iter-09-slot-4-2026-slot-4`
- Setup: 10 teams, 15 rounds, slot 4, seed `iter-09-slot-4-2026`.
- Process: used the rebuilt `/mock-draft` UI with the new `WR starter` signal, saved the app artifact, and generated a slot-4 retrospective.
- Historical external grade: `A`.
- Bot field: `C-` to `B+`; the user beat every bot and cleared the target.
- User position grades: QB starters `A-`, RB starters `A+`, RB depth `A+`, WR starters `C+`, WR depth `A+`, TE starters `A+`.

Most useful signals:

- `WR starter` changed the build: Justin Jefferson over James Cook at 2.07 and Emeka Egbuka at 7.04 were directly supported by the new chip.
- `Elite TE` remained useful; Brock Bowers produced an `A+` TE starter grade.
- `No backup QB` and `Backup TE only` kept backup onesies from becoming picks.
- Automatic K/DEF scoping made the final two rounds straightforward again.

Signals ignored or downweighted:

- Backup QB/TE rows still required manual discipline because some remained visually high by raw value.
- High-value unfamiliar RB rows were still taken without enough confidence context, especially Jadarian Price and Jacory Croskey-Merritt.
- The generic `WR starter` label was too broad; it did not separate the urgent second-WR anchor from later third-WR/FLEX/depth picks.

Durable product lessons:

- The `WR starter` signal appears directionally valuable: the result recovered from iteration 8's `B+` to an `A`.
- The persistent weak spot is WR starter grade, not WR depth. The final team had `A+` WR depth but only `C+` WR starters.
- The app should make "WR2 anchor" a separate review state while exactly one WR is rostered in rounds 3-6. The user/agent should see that this is more important than generic bench WR depth.
- This iteration supports keeping the current overall/simple UI approach, but with sharper reason labels rather than more columns.

Implemented after this iteration:

- Added a `WR2 anchor` reason and modest boost when exactly one WR is rostered, the draft is still in rounds 3-6, and an actionable WR is available.
- Added a regression test that `WR2 anchor` appears in the first two reason chips during the second-WR window and disappears once three WRs are rostered.

## 2026-07-01 - Iteration 10

- Run: `data/draft-results/20260701071901-sim-iter-10-slot-7-2026-slot-7`
- Setup: 10 teams, 15 rounds, slot 7, seed `iter-10-slot-7-2026`.
- Process: used the `/mock-draft` UI with the new `WR2 anchor` signal, saved the completed app artifact, and generated a slot-7 retrospective. The initial Chrome-controlled page could not be reclaimed after extension control failed, so the same seed and decisions were rerun through the rendered UI with Playwright driving Google Chrome.
- Historical external grade: `A+`.
- Bot field: `C-` to `B+`; the user beat every bot and cleared the target.
- User position grades: QB starters `A-`, RB starters `A+`, RB depth `C`, WR starters `B-`, WR depth `A+`, TE starters `A`.

Most useful signals:

- `WR2 anchor` directly supported Tee Higgins at 4.04 and kept the second-WR window explicit.
- RB/WR balance supported Amon-Ra St. Brown at 2.04 over a second RB; Bijan Robinson still fell to 3.07, so the balanced pick preserved upside.
- `Elite TE` remained useful for Trey McBride at 5.07.
- `No backup QB` and `Backup TE only` made it easy to ignore backup onesie value in rounds 12-13.
- Automatic K/DEF scoping made the final two picks straightforward: Denver DEF, then Cameron Dicker after the board narrowed to K only.

Signals ignored or downweighted:

- Backup QB/TE rows after Joe Burrow and Trey McBride.
- Early K/DEF value until every remaining pick had to fill special teams.
- Raw value without confidence context on unfamiliar late RB/WR names.

Durable product lessons:

- The 10-cycle loop ended with another `A+`, and 4 of the last 5 post-change runs cleared `A` or better. The only miss was the pre-`WR starter` slot-2 run.
- The most valuable surface is still the simple combined board plus compact reason chips, not extra columns. Keep `VAL`, `Back?`, position rank/tier, open starter/FLEX context, and reason chips visible.
- WR quality remains the main weakness: even the `A+` slot-7 team had only `B-` WR starters. Future work should make WR tier quality and missed WR windows easier to compare, not just add a stronger generic WR boost.
- The least useful recurring information was backup onesie value, early K/DEF timing, and unqualified raw value on low-confidence players. These should be visually quieter.
- Source confidence, risk/news context, and player trust explanations are now the biggest remaining gap for draft-clock decisions.

Implemented after this iteration:

- No further ranking-model change. The `WR2 anchor` change produced an `A+` from slot 7 and should be kept while the next pass focuses on UI simplification and trust/risk context.

## 2026-07-01 - Blind Subagent Slot 6

- Run: `data/draft-results/20260701174555-sim-blind-orbit-706-slot-6`
- Setup: 10 teams, 15 rounds, slot 6, seed `blind-orbit-706`.
- Process: a subagent with no full conversation context used only the two quick-guide docs and the live `/mock-draft` UI, then saved the app artifact and generated a slot-6 retrospective.
- Historical external grade: `B+`, best in the room but below the former target.
- Bot field: `C` to `B-`.
- User position grades: QB starters `A+`, RB starters `B+`, RB depth `A+`, WR starters `A-`, WR depth `A`, TE starters `C`.

Most useful signals:

- Pick Insights plus reason chips were enough for the subagent to complete the draft without using the position tables.
- `WR2 anchor`, `QB done`, `TE done`, `K last`, and final K/DEF scoping materially changed decisions.
- League Demand/FLEX context helped the agent preserve WR/FLEX quality early and delay K/DEF until the last two rounds.

Signals ignored or downweighted:

- Position tables were not used; the combined board plus insights carried the workflow.
- Backup QB/TE rows were correctly ignored after starters were filled.
- High-value `FA` or low-trust player rows still felt confusing under draft-clock conditions.

Durable product lessons:

- This was a clean failure case for one-start-position prioritization. At 3.06, the recomputed assistant board ranked Josh Allen #1 with `Best value | Elite QB`, while Brock Bowers was #5 with `Elite TE`. The subagent followed the UI, but missing Bowers left TE starters at `C`.
- The issue is not RB/WR/FLEX demand; that part worked well enough to produce `A-` WR starters and useful depth. The failure was that `Elite TE` was visible but not forceful enough when competing with `Elite QB`.
- Future UI/ranking work should make "elite TE while TE is open" a stronger cross-position review state, especially when the next TE tier is much weaker and all elite TEs are unlikely to return.
- The quick guide needs to explicitly tell future agents to compare elite TE before accepting elite QB when both are available.
- Late K suggestions still appear before K is forced, and the app can keep showing generic `Best value` after the user roster is complete. These are lower-priority noise issues.

Implemented after this iteration:

- Updated `docs/draft-pick-procedure-quick-guide.md` to call out the elite QB versus elite TE comparison explicitly.
- Encoded the user's preference to avoid pre-ADP QB reaches: QBs before ADP now get `QB wait` instead of `Elite QB` and receive a recommendation penalty.

## 2026-07-01 - Blind Subagent Slot 9

- Run: `data/draft-results/20260701190908-sim-blind-slot9-july1-slot-9`
- Setup: 10 teams, 15 rounds, slot 9, seed `blind-slot9-july1`.
- Process: a subagent used the quick-guide docs and the live `/mock-draft` UI after the pre-ADP QB policy and single-`VAL` UI cleanup, then saved the app artifact and generated a slot-9 retrospective.
- Historical external grade: `A+`.
- Bot field: `D+` to `C+`; the user beat every bot, though the bot field was still weak.
- User position grades: QB starters `A+`, RB starters `A+`, RB depth `C`, WR starters `A-`, WR depth `A+`, TE starters `A+`.

Most useful signals:

- The pre-ADP QB rule behaved correctly. At pick 3.09, Josh Allen showed `QB wait`, and the agent took Bijan Robinson; the team still landed Josh Allen at 7.09 and earned an `A+` QB starter grade.
- The elite TE procedure worked. At pick 4.02, Josh Allen had higher raw `VAL`, but Brock Bowers was taken while TE was open, producing an `A+` TE starter grade.
- The simple single `VAL` surface was enough for the subagent to complete an `A+` draft without needing parallel BEER/BEER+/raw-value columns.
- RB/WR starter balance was good enough in this run: Gibbs, Amon-Ra, Bijan, Bowers, A.J. Brown, and DeVonta Smith created no weak core starter group.

Signals ignored or downweighted:

- Josh Allen stayed visually high for several rounds after ADP, but the agent correctly prioritized open elite TE and WR starter/FLEX quality first.
- Backup QB/TE remained irrelevant after Josh Allen and Bowers were rostered.
- K/DEF rows were visible before they were truly forced and should stay visually quieter until the final picks.

Durable product lessons:

- This is the best blind-agent validation so far for the current concise strategy: protect RB/WR balance, take elite TE while open, avoid pre-ADP QB reaches, then take elite QB value if it falls.
- The remaining draft-clock weakness is not the core strategy; it is trust context on late bench rows. Jadarian Price, Stefon Diggs, Rachaad White, and Deebo Samuel all surfaced as high-`VAL` or plausible bench picks despite odd team/free-agent/source context.
- Bye overlap should move into post-draft review rather than blocking picks. This roster had a Week 11 RB/WR cluster with Bijan Robinson, A.J. Brown, and Jadarian Price, but the analyzer still graded the team `A+`.
- The bot field remains too easy in some seeds. Future simulator work should make bots less likely to finish with obvious position holes.

Implemented after this iteration:

- No code change yet. The next product pass should focus on compact trust/risk context for late bench candidates and on keeping early K/DEF noise quieter without changing the successful core ranking policy.

## 2026-07-01 - Algorithm Batch Loop, Slot 5

- Runs:
  - `data/draft-results/algo-batch-20260701211518`: baseline script batch after the algorithm runner was added. Grades: `A+`, `A-`, `A`.
  - `data/draft-results/algo-batch-20260701211842`: failed stronger RB/WR bench-balance experiment. Grades: `A`, `B+`, `A-`.
  - `data/draft-results/algo-batch-20260701212124`: elite-TE-over-elite-QB calibration plus softer QB value. Grades: `A+`, `A-`, `A`.
  - `data/draft-results/algo-batch-20260701212315`: added late-QB starter urgency. Grades: `A+`, `A-`, `A`.
  - `data/draft-results/algo-batch-20260701212427`: added first-WR-anchor tie-breaker. Grades: `A+`, `A-`, `A`.
- Setup: 10 teams, 15 rounds, slot 5, standard scoring, script-only drafts where the user slot always took `topRecommendation`.
- Process: three algorithm mocks from slot 5. Each run saved `draft-result.json` and `algorithm-decisions.json` under ignored `data/draft-results/...`.

Most useful signals:

- The script loop is much faster than UI drafting for ranking-model calibration. It makes deterministic seeds, pick logs, and analyzer reports available without opening Sleeper or the mock UI.
- The per-pick `algorithm-decisions.json` is the key review artifact. It shows the selected player, top alternatives, recommendation scores, reason chips, score components, comeback labels, roster counts, and needs before each user pick.
- Elite TE remains a strong scarce-starter signal. In the weak slot-5 seed, switching from Josh Allen at 4.06 to Brock Bowers improved TE from `C` to `A+`, but only after adding late-QB urgency did the build avoid falling to Matthew Stafford at QB.
- First-WR-anchor pressure improved the weak seed's shape: the algorithm took Jaxon Smith-Njigba at 2.06 over a near-tied RB, improving WR starters from `C` to `B` while preserving `A+` TE and `B-` QB.

Signals downweighted after testing:

- Forcing RB/WR bench balance too hard was harmful. Moving from 7 RB / 4 WR to 6 RB / 5 WR looked cleaner but reduced the historical external results in these seeds.
- Do not overcorrect from a `B-` QB grade. Runs with Brock Purdy still reached `A+` when RB/WR/TE were strong.
- Do not force elite TE over every high-value RB3. At 3.05 in the third seed, Brock Bowers was unlikely to return, but the RB value gap was large enough that the team still reached `A` with Kyle Pitts.

Durable product lessons:

- The current algorithm is good but not yet consistently `A+` from slot 5; the repeated result is closer to `A+`, `A-`, `A`.
- The highest-leverage remaining work is not more roster-ratio pressure. It is better calibration of starter point ceiling and clearer trust/risk context for odd late values.
- The retired analyzer included room variance and playoff-chance estimates, not only position grades. These results were not stable enough to remain part of the evaluation contract.

Implemented after this iteration:

- Added script-only algorithm mock drafts via `pnpm run draft:algo-mocks`.
- Added `algorithm-decisions.json` artifacts for every scripted run.
- Calibrated 1QB value so elite TE can beat elite QB when both scarce-starter windows are live.
- Added a late-QB timing component so a usable QB is drafted before K/DEF or extra bench depth once RB/WR/FLEX/TE starters are done.
- Added a first-WR-anchor tie-breaker for close early choices before the roster has any WR.

## 2026-07-01 - Five-Iteration Algorithm Loop, Mixed Slots

- Runs:
  - Iteration 1, `data/draft-results/algo-batch-20260701213329`, slots `2,5,9`: `A`, `A`, `A+`.
  - Iteration 2, `data/draft-results/algo-batch-20260701213438`, slots `1,6,10`: `A+`, `A+`, `A+`.
  - Iteration 3, `data/draft-results/algo-batch-20260701213534`, slots `3,4,8`: `A-`, `B`, `A`.
  - Iteration 4, `data/draft-results/algo-batch-20260701213659`, slots `4,7,10`: `A+`, `A`, `A+`.
  - Iteration 5, `data/draft-results/algo-batch-20260701213817`, slots `2,3,5`: `A+`, `A-`, `A-`.
  - Post-tweak stress validation, `data/draft-results/algo-batch-20260701214023`, slots `2,3,5`: `A+`, `A-`, `A+`.
- Setup: 10 teams, 15 rounds, standard scoring, script-only drafts where the user slot always took the single top recommendation.
- Process: one run with three mixed slots per iteration.

Aggregate result before the final tweak:

- 15 graded drafts.
- `A+`: 7
- `A`: 4
- `A-`: 3
- `B`: 1
- `A-` or better: 14/15.
- `A` or better: 11/15.

Most useful signals:

- The mixed-slot script loop is now the fastest useful ranking-model calibration path. It catches slot-specific failures without needing Sleeper or the mock UI.
- The single `VAL` recommendation plus reason chips is sufficient for batch drafting; the logs are more useful for tuning than adding UI columns.
- RB ceiling is carrying many strong grades. Several `A+` teams had mediocre WR or TE subgrades because the analyzer strongly rewarded elite RB starters/depth.
- Repeating a bad-looking slot matters. The iteration-3 slot-4 team graded `B`, but the repeated slot-4 run in iteration 4 graded `A+`, so the first result was not a stable slot-4 defect.

Signals downweighted after testing:

- Do not add a hard backup-QB rule. Most good teams still had no backup QB, and the retired external grader did not provide a reliable reason to change that policy.
- Do not force RB/WR roster ratio. RB-heavy builds frequently graded `A+`; stronger balance only helped when the player-value gap was close.

Durable product lessons:

- The algorithm is now reliably above the old failure line, but it is not yet consistently `A+`.
- The clearest remaining misses were not generic position balance; they were scarce elite-TE windows around round 3. The repeated `A-` teams often passed Bowers/McBride in a close enough range, then landed a `D+` or `C` TE later.
- A massive RB value gap should still beat elite TE. The accepted change only strengthens round-three elite TE when the gap is close; it does not force TE over an obvious RB hammer.
- The next modeling gap is player trust/risk context for odd late-round values, especially rookies, free agents, questionable players, and projection-vs-market mismatches.

Implemented after this iteration:

- Increased open elite-TE urgency from round 3 onward so Bowers/McBride can beat close core-position value before the tier closes.
- Added a regression test for round-three elite TE beating a close core-player option.
- Validated on the weak slots `2,3,5`: post-tweak stress grades were `A+`, `A-`, `A+`, improving the prior slot-5 stress result from `A-` to `A+` while keeping the difficult slot-3 run at `A-`.

## 2026-07-02 - Early WR Anchor Experiment

- Baseline sample from `data/draft-results/algo-batch-20260702031332`:
  - Slot 1: `RB,RB,TE,WR,WR,RB,WR,RB,WR,QB,RB,WR,RB,K,DEF`.
  - Slot 3: `RB,RB,TE,RB,WR,WR,RB,QB,RB,RB,WR,WR,WR,K,DEF`.
  - Slot 10: `RB,WR,RB,WR,RB,TE,WR,QB,RB,WR,RB,WR,RB,K,DEF`.
- Hypothesis tested: force stronger WR1 anchoring by round 3 to improve WR starter grades in RB/TE-heavy builds.
- Local-only result: a WR1-by-round-3 gate made all 10 slots look cleaner by internal gates.
- A later slot-1 run changed to `RB,RB,WR,WR,RB,TE,WR,RB,RB,QB,RB,WR,WR,K,DEF`. The result did not supply independent proof that the tuning improved roster quality.
- Decision: reverted the WR1 anchor scoring change and removed the stricter WR1-by-round-3 gate. Do not optimize against early-WR timing alone; the analyzer is still rewarding elite RB and elite TE value enough that low WR subgrades can coexist with strong overall teams.

Historical external grading for `data/draft-results/algo-batch-20260702031332`:

- Slot 1: `A`; `RB,RB,TE,WR,WR,RB,WR,RB,WR,QB,RB,WR,RB,K,DEF`; QB starters `B-`, RB starters/depth `A+`/`A+`, WR starters/depth `C`/`A-`, TE starters `A`.
- Slot 2: `A`; `RB,RB,WR,WR,RB,QB,TE,WR,RB,RB,WR,WR,RB,K,DEF`; QB starters `A+`, RB `A+`/`A+`, WR `C+`/`C-`, TE `C`.
- Slot 3: `A+`; `RB,RB,TE,RB,WR,WR,RB,QB,RB,RB,WR,WR,WR,K,DEF`; QB `A-`, RB `A+`/`A+`, WR `C`/`F`, TE `A+`.
- Slot 4: `A+`; `RB,RB,TE,WR,WR,RB,WR,RB,WR,QB,RB,WR,RB,K,DEF`; QB `B-`, RB `A+`/`A+`, WR `C+`/`A`, TE `A+`.
- Slot 5: `A-`; `WR,RB,RB,TE,WR,RB,WR,RB,QB,WR,RB,WR,RB,K,DEF`; QB `C+`, RB `A`/`A+`, WR `A-`/`A`, TE `A+`.
- Slot 6: `A-`; `RB,WR,TE,WR,RB,RB,WR,RB,QB,RB,WR,WR,RB,K,DEF`; QB `C+`, RB `A+`/`A+`, WR `B`/`C`, TE `A+`.
- Slot 7: `B+`; `RB,WR,TE,RB,WR,RB,WR,RB,RB,QB,WR,WR,RB,K,DEF`; QB `D+`, RB `A+`/`A+`, WR `B-`/`C`, TE `A`.
- Slot 8: `A+`; `RB,RB,TE,WR,WR,QB,RB,WR,RB,WR,WR,RB,WR,K,DEF`; QB `A-`, RB `A+`/`C`, WR `B-`/`A+`, TE `A+`.
- Slot 9: `A+`; `RB,RB,TE,WR,WR,RB,QB,WR,RB,WR,RB,WR,RB,K,DEF`; QB `A-`, RB `A+`/`A+`, WR `C`/`A-`, TE `A+`.
- Slot 10: `A-`; `RB,WR,RB,WR,RB,TE,WR,QB,RB,WR,RB,WR,RB,K,DEF`; QB `A-`, RB `A+`/`A+`, WR `B`/`A+`, TE `C+`.

Result: `A+` 4, `A` 2, `A-` 3, `B+` 1. The only below-`A-` failure was slot 7, driven by a `D+` QB starter after waiting until round 10 for Aaron Rodgers. Next useful tuning target is not WR timing; it is avoiding low-ceiling late QB outcomes while preserving the no-early-QB preference.

Implemented after this review:

- Added a viable-QB starter floor to the draft-value model. In 1QB builds, QB deadline and timing bonuses now distinguish viable starters from low-ceiling options instead of treating every open-QB deadline the same.
- Viable QB signals can pull a QB forward in rounds 7-8 once RB/WR/FLEX/TE starter quality is stable, but pre-ADP QB reaches still carry the user's preferred wait penalty.
- Low-ceiling QB signals now penalize negative-value or deep positional-rank QBs before the endgame. This is intended to avoid the slot-7 failure mode where deadline pressure made Aaron Rodgers look draftable in round 10.
- The script batch summary now records the drafted QB's name, scoring value, and recommendation-time positional rank, and adds a quality gate for "QB starter clears usable floor."

## 2026-07-02 - Elite TE Cliff Update

- Trigger: after the QB-floor fix, the next 10-slot batch still exposed a weak TE result at slot 7 after passing Brock Bowers at 3.07 and later settling for Tyler Warren in round 6.
- Diagnosis: in the weak slots, Bowers was already the #2 recommendation in round 3 but lost to high RB value by roughly 10-25 recommendation points. When Bowers/McBride were taken in round 3, TE usually graded `A` or `A+`; when the draft waited until the Warren/Pitts/Loveland tier, TE often graded `C`/`C+`.
- Change: strengthened the `eliteTe` component specifically for top-two TE starters in rounds 3-4. This is not a generic TE boost and does not affect backup TE.
- Added TE starter quality fields to script batch summaries: `teStarterName`, `teStarterValue`, and `teStarterPosRank`.
- Added a `TE starter clears quality floor` internal gate. This catches the prior blind spot where "TE by round 7" passed even though the actual starter was in the Tyler Warren/Kyle Pitts tier.

Validation:

- Focused tests passed: `pnpm exec vitest run tests/lib/draftValue.test.ts tests/lib/algoMockDraft.test.ts tests/lib/simDraft.test.ts`.
- Lint passed: `pnpm run lint`.
- Internal batch `data/draft-results/algo-batch-20260702042341`:
  - Slots 1-9 all secured a TE quality floor except no TE issues.
  - The previous weak middle slots now took Brock Bowers in round 3.
  - Slot 10 still failed TE quality and QB timing because Bowers was already gone by 3.10 and the available TE pool was weak by the next turn. Treat this as a different edge case, not proof that every weak TE should be forced over a massive RB value.

## 2026-09-03 - 0.69 PPR Two-FLEX Baseline

Purpose: establish a fixed baseline for the user's current league before more
strategy tuning.

Configuration:

- 12 teams, snake draft, all 12 draft slots, and three fixed seeds per slot.
- 14 rounds with 1 QB, 2 RB, 2 WR, 1 TE, 2 FLEX, 0 K, 1 DEF, and 5 bench.
- 0.69 points per reception. IR was configured but not drafted.
- The evaluated team used the canonical recommendation board. Other teams used
  the Sleeper-market bot strategy.

Results from 36 drafts:

- Average local starter-ECR finish: 1.42 of 12.
- First: 28 of 36. Top three: 35 of 36. Top half: 35 of 36.
- Slot 4 finished first, second, and first, for a 1.33 average finish.
- All rosters were legal and had the required position counts.
- Only 6 of 36 rosters passed every local quality gate.
- TE quality failed in 19 drafts. Fourteen of those teams selected Travis Kelce
  at the current TE9 value.
- DEF was selected before the final two rounds in 23 drafts: two in round 8,
  nine in round 11, and twelve in round 12.
- Slot 8 was least stable, with seventh-, first-, and third-place finishes.

Independent check:

- A retired external analyzer graded all 12 teams from the representative slot-4 run.
- The assistant team received `A-` and ranked first by the analyzer's average-
  management playoff chance. Its local starter-ECR rank was second.
- Position grades were QB `A-`, RB starters `A+`, RB depth `A+`, WR starters
  `C`, WR depth `D+`, and TE starter `C`.
- The retired analyzer could not represent 0.69 reception scoring. The report used 1.0
  PPR, so this is directional evidence rather than an exact league forecast.

Interpretation:

- Local starter ECR is an internal regression signal because FantasyPros ECR
  also drives the recommendation model. It is not independent proof.
- The new roster configuration works end to end and performs well from slot 4.
- The stable next targets are evaluation reliability, TE quality versus
  opportunity cost, and a hard DEF endgame rule.
- Preserve player names in artifacts for diagnosis, but express algorithm
  changes through position value, tiers, timing, roster needs, and quality
  floors.

## 2026-09-03 - TE Quality And Return Window

Purpose: replace round-only TE pressure with a quality signal while preserving
the late roster-completion safeguard.

Method:

- Used the same current data snapshot, 12 draft slots, three fixed seeds per
  slot, Sleeper-market bots, and the owner's 0.69 PPR two-FLEX configuration.
- Saved the pre-change baseline at
  `data/draft-results/algo-batch-20260903181953`.
- Rejected an intermediate version at
  `data/draft-results/algo-batch-20260903182610`. A blanket weak-TE penalty
  delayed TE until rounds 9-10 and caused earlier D/ST picks.
- Saved the accepted version at
  `data/draft-results/algo-batch-20260903183345`.

Implemented behavior:

- Keep the existing elite-TE rule.
- Treat TE1-TE6 with sufficient ECR value as acceptable starters.
- Add `TE starter window` to `ADJ` only when an acceptable TE is at or after
  ECR, direct RB/WR starter slots are filled, its tier has no safe fallback,
  and Sleeper timing says it is unlikely to reach the next turn.
- Keep the round-six and round-seven TE completion fallback. The failed
  intermediate version showed that removing this safeguard lets an already
  weak TE pool get worse without improving another starter.
- Keep `VAL` unchanged.

Fixed-seed comparison:

- Acceptable TE starters: 11 of 36 to 20 of 36.
- TE quality failures under the corrected gate: 25 to 16.
- Median TE rank: TE10 to TE6.
- Average TE rank: 7.81 to 6.75.
- Average core-starter ECR score: 337.46 to 332.44, where lower is better.
- Core-starter ECR finish stayed at 1.25 of 12. First-place results stayed at
  33 of 36, and top-three results stayed at 34 of 36.
- All ten rosters changed by the TE rule improved their core-starter ECR score.
- D/ST timing remained the main unrelated failure: 27 early selections before
  the change and 28 after it.

Interpretation:

- The change materially improved TE starter quality without reducing the
  whole-team internal regression result.
- Core-starter ECR is not independent proof because FantasyPros ECR also feeds
  the recommendation model. It is suitable for a fixed-input regression
  comparison only.
- The next strategy change should hard-block D/ST before the configured
  endgame window.

## 2026-09-03: Starter-aware value experiment

Research contract:

- Custom scoring uses one projection set and projected receptions. It does not interpolate rank numbers, and it is available only when the scoring-capability contract passes.
- The starter-aware baseline follows the published VOLS and man-games blend concept. The public inputs are incomplete, so the UI calls this strategy experimental rather than exact BEER+.
- FantasyPros ECR remains the control strategy and an internal regression signal. It is not independent evidence because ECR also contributes to recommendations.

Implementation:

- `current` remains the default and keeps the existing ECR/tier `Val` and draft-state `Adj` calculation.
- `beer_plus` uses raw Sleeper season statistics, capability-checked league scoring, direct starter demand, greedy FLEX allocation after direct starters, VOLS, and a documented man-games blend.
- The strategy is unavailable when the projection source is older than 72 hours, required-stat coverage is below the threshold, a required position is absent, or scoring includes an unsupported points-per-carry rule.
- Live, mock, API, saved results, and algorithm runs use the canonical draft view-model and recommendation board.

Matched target-preset evaluation:

- Seeds: `beer-plus-refreshed-20260903-run-1..3-slot-1..12` after a live FantasyPros ECR refresh and local tier regeneration.
- Current: 36 runs, 5 full quality passes, 23 acceptable TE starters, 28 early D/ST picks, mean core-starter ECR 336.25, mean ECR finish 1.50, 28 first-place finishes, and 33 top-three finishes.
- Experimental: 36 runs, 0 full quality passes, 0 acceptable TE starters, 34 early D/ST picks, mean core-starter ECR 357.01, mean ECR finish 2.50, 23 first-place finishes, and 28 top-three finishes.
- The experimental strategy increased mean projected starter points from 1763.31 to 1784.84 under the same Sleeper projections that it optimized. This measure is circular and does not outweigh the ECR-based and roster-quality regressions.

Decision: keep `current` as the default. Keep starter-aware value available as an experimental diagnostic. Do not promote it until D/ST timing and TE quality improve on held-out boards without reducing roster quality. These internal signals are not an independent outcome grade.

## 2026-09-03: Starter-aware value tuning

Problems found:

- The shared QB and TE policies used raw ECR-era `Val` thresholds. Starter-aware
  `Val` uses another unit, so Bowers and McBride could fail the TE-quality rule
  despite elite position ranks.
- The evaluator repeated the same unit error.
- A soft D/ST penalty was not sufficient when D/ST projection value was high.
- Raw Sleeper projections supplied a useful scoring curve but produced less
  reliable player ordering than FantasyPros ECR within some positions.

Changes:

- Keep raw starter-aware `Val` for display and normalize it only inside `Adj`.
- Use strategy-independent FantasyPros position rank for QB and TE quality when
  the experimental strategy is active.
- Preserve each capability-checked Sleeper projected-points curve by position, but
  assign the curve according to FantasyPros order within that position.
- Make K/D/ST ineligible before the final two rounds for the experimental
  strategy while any non-special roster slot remains.
- Keep TE quality as a separate result. Do not force every roster to TE6 because
  a weaker TE can be acceptable when the rest of the starting lineup is better.

Matched 36-draft target result:

- Current control: 5 full quality passes, 23 acceptable TE starters, 28 early
  D/ST picks, mean core-starter ECR 336.25, mean finish 1.50, 28 first-place
  finishes, and 33 top-three finishes.
- Tuned experimental: 25 full quality passes, 25 acceptable TE starters, zero
  early D/ST picks, mean core-starter ECR 336.16, mean finish 1.39, 30
  first-place finishes, and 34 top-three finishes.
- The tuned strategy improved 7 paired ECR scores, tied 8, and reduced 21. The
  mean gain came mostly from two large slot-4 improvements, so an unseen slot-4
  holdout was required.

Ten-draft slot-4 holdout:

- Current: 1 full quality pass, 7 acceptable TE starters, 9 early D/ST picks,
  mean core-starter ECR 308.60, mean finish 1.50, and 7 first-place finishes.
- Tuned experimental: 8 full quality passes, 8 acceptable TE starters, zero
  early D/ST picks, mean core-starter ECR 306.60, mean finish 1.10, and 9
  first-place finishes.
- The experimental strategy improved 4 paired ECR scores, tied 4, and reduced
  2. The two reductions did not share a generic policy defect. They were valid
  cross-position replacement-value decisions, so no player-specific rule was
  added.

Format smoke checks:

- Standard, half-PPR, full-PPR, and one-FLEX variants each completed all 12
  draft slots with legal rosters.
- The experimental strategy had zero early D/ST picks in all four formats.
- The current strategy retained a small ECR advantage in the three two-FLEX
  one-seed checks. The experimental strategy had a small ECR-score advantage in
  the one-FLEX check. These are smoke checks, not enough evidence for a broad
  all-format claim.

Decision: keep `current` as the product default because the experiment is not
yet broadly proven. The tuned starter-aware strategy is now a credible option
for the owner's 12-team, slot-4, 0.69-PPR, two-FLEX draft.

## 2026-09-03: Strategy-neutral evaluation contract

Problem:

- The batch evaluator combined roster validity, construction timing, D/ST
  timing, QB quality, and a top-six TE preference into one
  `fullQualityPassCount`.
- A TE outside the top six could make an otherwise complete roster fail the
  full batch gate. This did not match the product decision that a weaker TE can
  be acceptable when the rest of the roster is stronger.
- QB and TE evaluation preferred recommendation-time value ranks. These ranks
  can have different units under the current and starter-aware strategies.

Change:

- Added one shared evaluator that reads only the completed, validated draft
  artifact.
- Separated mandatory roster validity, K/D/ST endgame policy, core construction,
  and QB/TE quality diagnostics.
- QB and TE quality now use the saved FantasyPros position rank for both
  strategies. Strategy-specific `Val`, `Adj`, and value ranks are not grading
  inputs.
- Replaced the opaque full-quality batch count with named counts and QB/TE rank
  distributions. A top-six TE is a diagnostic and cannot by itself fail roster
  validity.

Verification:

- Focused evaluator tests cover TE7 validity, current/Beer+ parity, incomplete
  rosters, special-team counts, and early D/ST.
- The current-strategy slot-4 smoke result is saved at
  `data/draft-results/evaluation-contract/algo-batch-20260903223931`.
- The matched Beer+ slot-4 smoke result is saved at
  `data/draft-results/evaluation-contract-beer/algo-batch-20260903224001`.
- That roster passed mandatory validity, roster completion, endgame timing, and
  core construction. Its TE10 result remained visible as a separate diagnostic.

Measurement note:

- Historical `fullQualityPassCount` values are not comparable with the new
  `mandatoryPassCount`. This change improves measurement. It does not prove
  that either recommendation strategy improved.

## 2026-09-03: Shared special-team endgame policy

Problem:

- The experimental strategy blocked K and D/ST before the final two rounds
  while normal roster capacity remained. The current strategy used only a soft
  penalty.
- This strategy-specific roster rule made the comparison unfair. The previous
  36-draft current control selected D/ST early in 28 drafts.

Change:

- Both strategies now use one K and D/ST eligibility rule.
- K and D/ST remain unavailable before the final two rounds while an offensive
  or bench slot is open.
- The rule yields if roster completion requires the special-team position.

Matched verification:

| Measure | Current | Beer+ |
| --- | ---: | ---: |
| Drafts | 36 | 36 |
| Mandatory passes | 36 | 36 |
| Complete rosters | 36 | 36 |
| Endgame passes | 36 | 36 |
| Early D/ST selections | 0 | 0 |
| Core-construction passes | 35 | 36 |
| Mean core-starter ECR score | 323.75 | 334.83 |
| Mean ECR finish | 1.31 | 1.58 |

- Both batches used seed prefix `shared-endgame`, three runs, all 12 slots, the
  same aggregate snapshot, and the same opponent model.
- Current results are in
  `data/draft-results/shared-endgame-current/algo-batch-20260903224234`.
- Beer+ results are in
  `data/draft-results/shared-endgame-beer/algo-batch-20260903224234`.

Decision:

- Keep the shared endgame rule. It removes a known policy asymmetry and gives
  both strategies complete legal rosters in the matched batch.
- Do not use this result to declare a strategy winner. The ECR measure is an
  internal regression signal, and opponent boards can diverge after each
  strategy makes a different selection.

## 2026-09-03: Paired value-strategy comparison

Measurement change:

- Added one command that builds the data snapshot once and runs `current` and
  `beer_plus` with the same league configuration, slot, opponent model, player
  pool, and random seed.
- Each pair saves both complete draft artifacts, both canonical decision logs,
  source identity, structured quality evaluation, internal ECR metrics, and
  every divergent user pick with both recommendation explanations.
- Renamed the old Sleeper strategy evaluator to make clear that it compares
  simulated bot pick models, not recommendation value methods.
- Removed the hard-coded 10-team standard configuration from Sleeper replay.
  All 23 old boards were excluded honestly: 15 have no saved configuration,
  and 8 use schema v1 without exact scoring rules. No board was assigned
  fabricated settings.

Paired target batch:

| Measure | Current | Beer+ |
| --- | ---: | ---: |
| Drafts | 36 | 36 |
| Mandatory passes | 36 | 36 |
| Complete rosters | 36 | 36 |
| Endgame passes | 36 | 36 |
| Core-construction passes | 36 | 36 |
| Mean core-starter ECR total, lower is better | 325.73 | 328.21 |
| Mean ECR finish, lower is better | 1.28 | 1.67 |

- Beer+ won 6 ECR-total pairs, tied 10, and lost 20.
- The output is
  `data/draft-results/paired-target/paired-batch-20260903225338`.

Unseen slot-4 holdout:

| Measure | Current | Beer+ |
| --- | ---: | ---: |
| Drafts | 10 | 10 |
| Mandatory passes | 10 | 10 |
| Complete rosters | 10 | 10 |
| Endgame passes | 10 | 10 |
| Core-construction passes | 10 | 10 |
| Mean core-starter ECR total, lower is better | 344.62 | 349.68 |
| Mean ECR finish, lower is better | 1.70 | 1.70 |

- Beer+ won 3 ECR-total pairs, tied 1, and lost 6.
- The output is
  `data/draft-results/paired-holdout/paired-batch-20260903225338`.
- No recommendation tuning was done after this holdout was viewed.

Decision:

- Both methods now receive a fair, reproducible comparison and satisfy the
  shared roster rules in these batches.
- Keep `current` as the default. It has the stronger internal ECR regression
  signal in both evidence sets. Beer+ remains a valid experimental method, not
  a failed method. This comparison still lacks an independent outcome grade.

## 2026-09-03: Canonical decision retrospectives

Problem:

- Retrospectives called the top FantasyPros ECR player “best available” for
  both value methods. A Beer+ choice could therefore be graded against a board
  that Beer+ did not use.

Change:

- Added a versioned runtime schema for saved algorithm decisions. It includes
  the strategy, exact league identity, source timestamps, player-pool size,
  shortlist, Val, Adj, score gap, and explanation at each pick.
- Algorithm retrospectives now require that log and verify that its strategy,
  league identity, source identity, pick number, and selected player match the
  draft artifact.
- Reports use `strategyBestAvailable` for the saved recommendation and
  `marketBestAvailable` for FantasyPros ECR context. Live drafts without a
  recorded decision are labeled market-only.

Verification:

- The proof pair is in
  `data/draft-results/retrospective-proof/paired-batch-20260903230111`.
- At pick 1.04, Beer+ saved Jonathan Taylor as its strategy-best player while
  the market context showed Puka Nacua. Current saved Jaxon Smith-Njigba while
  the same market context showed Puka Nacua.
- Re-running the Beer+ retrospective produced the same canonical decision hash:
  `a1d0b99b95c816f57f547f6a4f2f28aed528e096165d206a9c6db584567f5ef0`.

## 2026-09-03: Starter-aware scoring capability

Problem:

- Beer+ described all league scoring as exact while missing projection fields
  could become zero.
- Sleeper kicker projections include 40-49 and 50-plus made field goals but do
  not include made field goals under 40 yards.
- Sleeper standard projected points can include two-point conversions and, for
  a hybrid offensive/IDP player, defensive statistics outside the supported
  offensive formula.

Change:

- Added an explicit 2026 Sleeper scoring-capability contract.
- Material primary-position yardage and touchdown fields are required when the
  matching league scoring value is nonzero.
- Beer+ is unavailable in kicker formats that score under-50 field goals. It
  does not estimate missing under-40 makes.
- Raw Sleeper two-point rules and the kicker projection gap use the existing
  limited-format notice. D/ST is labeled as Sleeper standard projected points,
  not a reconstruction of arbitrary defense rules.
- Preserved two-point and hybrid-IDP fields only for reconciliation diagnostics.

Verification:

- The owner no-kicker 0.69-PPR format remains available and completed a paired
  slot-4 smoke draft at
  `data/draft-results/scoring-capability-smoke/paired-batch-20260903230603`.
- In the saved projection set, 494 standard-point rows matched the supported
  formula within tolerance, 57 differences were explained by two-point
  conversions, and the one hybrid WR/DB difference was explained by Sleeper
  IDP statistics. No difference remained unexplained.

## 2026-09-03: Final strategy and roster-policy audit

Problems found and fixed:

- Recommendation filters did not protect direct mock picks or every UI pick
  control. The shared state transition and both pick surfaces now enforce a
  maximum of one QB, one TE, one K, and one D/ST.
- Round-only QB and TE timing could reward a pick without measuring player
  quality or price. Timing is now neutral evaluation context. QB and TE reach
  are measured against both FantasyPros ECR and Sleeper ADP.
- The late TE completion rule could select a player well ahead of both market
  signals. It now yields to another position when the TE is a clear price
  reach. This rule applies to both value strategies.
- Saved result artifacts did not contain enough source identity to prove that a
  retrospective used the same rankings and projections. Results and decision
  logs now persist the complete source snapshot, and retrospectives require an
  exact match.
- Imported league setup could hide unsupported rules. It now preserves D/ST
  capability and shows the shared limitation notices for superflex, TE
  premium, IDP, custom D/ST scoring, and other unsupported rules.
- Mock Sleeper details now serialize the full standard D/ST scoring map. A
  round trip cannot misclassify the default mock as custom D/ST scoring.
- The source-snapshot helper imported Node crypto into the client mock page.
  Server scripts now use Node SHA-256, the browser uses Web Crypto, and a test
  proves that both produce the same player-pool signature.

Final matched evidence:

- Each format used three fixed seeds across all 12 slots. Current and Beer+
  shared the league, player pool, source snapshot, opponent model, and random
  seed within each pair.
- All 180 pairs and all 360 rosters passed mandatory validity, roster
  completion, K/D/ST endgame timing, core construction, and the usable-QB
  check.
- Every roster had at most one QB, one TE, one K, and one D/ST.
- No QB or TE was selected 12 or more picks ahead of Sleeper ADP in any of the
  360 rosters. FantasyPros and Sleeper can disagree more because the owner
  format uses the PPR ECR pool for 0.69 reception scoring; both signals remain
  visible in the result.

| Format | Current ECR | Beer+ ECR | Current/Beer+/tie wins |
| --- | ---: | ---: | ---: |
| Owner 0.69 PPR, two FLEX | 335.16 | 333.73 | 15/18/3 |
| Standard, two FLEX | 293.52 | 307.79 | 20/11/5 |
| Half PPR, two FLEX | 337.16 | 336.63 | 15/9/12 |
| Full PPR, two FLEX | 329.45 | 328.27 | 10/19/7 |
| Owner scoring, one FLEX | 251.27 | 248.29 | 14/12/10 |

The score is the internal core-starter ECR total; lower is better. It is not an
independent outcome grade. Result roots are:

- `data/draft-results/final-owner-v5/paired-batch-20260904001659`
- `data/draft-results/final-standard-v5/paired-batch-20260904001659`
- `data/draft-results/final-half-v5/paired-batch-20260904001659`
- `data/draft-results/final-full-v5/paired-batch-20260904001659`
- `data/draft-results/final-one-flex-v5/paired-batch-20260904001659`

Untouched holdout:

- Ten new slot-4 owner-format pairs all passed the same hard gates.
- Beer+ won five ECR-total pairs, current won four, and one tied. Mean ECR was
  342.82 for Beer+ and 347.02 for current. Both averaged a 1.40 ECR finish.
- No tuning was done after this holdout was viewed.
- Output:
  `data/draft-results/final-holdout-v6/paired-batch-20260904002052`.

Kicker and historical checks:

- A 12-slot current-strategy kicker batch produced exactly one QB, TE, K, and
  D/ST in every roster. K and D/ST were selected only in rounds 14 and 15.
  Output:
  `data/draft-results/final-kicker-cap-v6/algo-batch-20260904002052`.
- Historical Sleeper replay skipped 23 boards: 15 lacked a saved league config
  and eight had an unverified old config. It included zero boards and therefore
  provides no outcome evidence. No settings were fabricated.
- Current and Beer+ slot-4 retrospectives completed with identical source
  snapshots under the final owner batch.

Freshness and verification:

- FantasyPros draft ECR was fetched on 2026-09-03 at 21:42 UTC. The PPR source
  reported 115 included experts and a 2026-09-03 21:07 UTC update.
- Sleeper projections were fetched on 2026-09-03 at 21:26 UTC. The source
  reported a 2026-09-03 07:51 UTC update and 3,228 rows.
- Type checking, lint, all eight source-data quality tests, the full 373-test
  suite, and the Next.js webpack production build passed after the final
  client/server boundary fix.
- A production server smoke check returned 200 for `/draft-assistant` and its
  aggregate bundle. The bundle contained 3,228 ALL rows and 3,228 Sleeper
  projection rows.
- Two independent read-only reviews found no remaining actionable correctness,
  fairness, measurement, roster-quality, scoring, or repository-standard issue.

Decision:

- Keep current as the default. Beer+ is competitive in the owner-format target
  and untouched holdout, but it does not dominate across formats and still
  depends on an experimental projection and replacement-value model.
- Keep Beer+ as a first-class experimental option. The comparison is now fair,
  and both methods use the same team-specific and draft-specific policy.
- The initial baseline selected D/ST before the final two rounds in 23 of 36
  drafts. The final 360-roster matched set had zero early K/D/ST picks, complete
  rosters throughout, and hard one-player maximums at QB, TE, K, and D/ST. This
  is the primary meaningful improvement over the baseline.

## 2026-09-04: Raw-value preservation and post-change Sleeper validation

Plan:

1. Preserve the real Beer+ gap when Val becomes the value component of Adj.
2. Import a live Sleeper result only from the exact draft and league settings.
3. Compare the change with the unchanged current strategy on fixed local seeds.
4. Run the rebuilt assistant through a complete slot-4 Sleeper mock.
5. Fix any live-path defect found during the mock and verify it in the UI.

Changes:

- Beer+ now anchors the best available player at 100 and subtracts the real raw
  Val gap. It no longer compresses the board against the 180th player. Roster,
  timing, demand, and news modifiers still build Adj on top of Val.
- The Sleeper importer accepts the saved draft and league objects together. It
  marks the artifact as `sleeper-live` only when both objects are present and it
  preserves exact scoring, roster slots, timer, team count, and draft order.
- Sleeper `scoring_settings: null` now parses as an empty draft-level map. This
  lets the league scoring map remain authoritative for league mocks.
- This earlier manual-refresh behavior is superseded. Manual refresh now
  refetches the aggregate bundle, draft details, and picks. Any current data
  incident replaces the draft board with a named blocking message.

Local paired result:

- Output: `data/draft-results/paired-batch-20260904040958`.
- Format: 12 teams, 14 rounds, slot sweep, 0.69 receptions, one FLEX, one K,
  five bench, and three fixed seeds per slot.
- Current and Beer+ each passed roster validity, roster completion, endgame,
  core construction, and usable-QB checks in all 36 drafts.
- Across all slots, mean core-starter ECR was 263.53 for current and 263.56 for
  Beer+. Mean simulated finish was 1.92 for both. Beer+ drafted a top-six TE in
  22 drafts versus 18 for current.
- At the owner's slot 4, mean core-starter ECR was 254.19 for current and 236.81
  for Beer+. All three Beer+ teams had a top-six TE and passed all hard gates.

Sleeper evidence:

- Exact 0.69-PPR league replay:
  `data/draft-results/sleeper-live-beer-plus-slot-4-2026-09-04`.
  The verified replay now recommends Ja'Marr Chase at 1.04 instead of Jonathan
  Taylor. The prior live selection remains the top Beer+ recommendation at 13
  of the other 13 turns.
- Fresh live mock draft ID: `1401454154169200640`.
  Sleeper created this standalone room as 12-team full PPR, two FLEX, no K, and
  14 rounds. The assistant read those settings from the room and completed this
  roster from slot 4: Joe Burrow; Kenneth Walker, Bucky Irving; Ja'Marr Chase,
  Nico Collins; Harold Fannin; Marvin Harrison, Chris Godwin; Minnesota D/ST;
  Stefon Diggs, Wan'Dale Robinson, MarShawn Lloyd, Woody Marks, Dylan Sampson.
- The mock used one QB, one TE, one D/ST, no kicker, five RBs, and six WRs. It
  filled every starter, took a top-five TE at Sleeper ADP, and waited until round
  13 for D/ST.
- The completed raw Sleeper draft and pick files are under
  `data/draft-results/sleeper-live-beer-plus-slot-4-2026-09-04-post-normalization`.
- A manual refresh of the completed live draft kept the roster visible and did
  not show the blocking error after the refresh fix.

Decision:

- Keep the current strategy as the default. Beer+ remains experimental, but the
  target slot improved without a hard-gate regression.
- Keep the direct Beer+ gap. The live 1.04 decision now matches the rule that
  roster modifiers can break close choices but must not erase a clear Val gap.

## 2026-09-04: RB/WR depth market-price discipline

Objective:

- Reduce avoidable late RB/WR reaches without weakening starter quality,
  roster balance, or the hard roster gates.
- Apply the same team-specific and draft-specific adjustment to both Current
  and Beer+. Beer+ remains the source of Val; the shared rules still produce
  Adj.

Change:

- After direct RB/WR starter needs and FLEX needs are filled, a pick that is at
  least 1.5 rounds before Sleeper ADP gets a graduated timing penalty. The
  penalty is capped and remains soft, so a clear player-value edge can override
  it.
- A material RB/WR bench-balance need suppresses the penalty for the needed
  position. This prevents the timing rule from creating a worse roster shape.
- The Decision Board explains this adjustment as `MARKET_PRICE_REACH`.
- The evaluator now reports mean positive Sleeper-ADP reach for measured RB/WR
  depth picks. A mean is required because adaptive FLEX assignment can change
  how many picks qualify as bench depth.

Fixed-seed proof:

- Baseline: `data/draft-results/paired-batch-20260904050237`.
- Candidate: `data/draft-results/paired-batch-20260904050704`.
- Format: 12 teams, 14 rounds, all 12 slots, three fixed seeds per slot, 0.69
  receptions, two FLEX, no kicker, one D/ST, and five bench spots.
- Both versions and both strategies produced 36 of 36 legal, complete rosters.
  Core-starter ECR and simulated finish were unchanged.
- Current mean RB/WR depth reach fell from 27.70 picks to 26.22 picks, a 5.35%
  reduction. Beer+ fell from 30.38 picks to 27.48 picks, a 9.56% reduction.
- At slot 4, Current was unchanged. Beer+ fell from 36.92 picks to 33.48 picks,
  a 9.32% reduction, with unchanged starter ECR and simulated finish.

Live Sleeper proof:

- Completed draft ID `1401468334595162112` from slot 4. Sleeper reported 12
  teams, 14 rounds, full PPR, two FLEX, no kicker, one D/ST, and a 60-second
  timer. The local 0.69-PPR behavior was covered by the fixed-seed batch.
- The assistant selected one QB, five RBs, six WRs, one TE, and one D/ST. It
  passed roster completion, endgame, core construction, usable-QB, and top-six
  TE checks. D/ST was round 13.
- Mean RB/WR depth reach was 13.52 picks. The prior slot-4 Sleeper run was
  15.66 picks, so the live measure improved by 13.67% while all quality gates
  stayed green.
- The verified Sleeper draft, 168 picks, imported result, retrospective, and
  sanitized 21-entry HAR are in
  `data/draft-results/sleeper-live-beer-plus-slot-4-2026-09-04-market-price`.
  The HAR excludes headers, cookies, bodies, and query values.

Decision:

- Keep the change. It improves the targeted market-efficiency measure in both
  the fixed local comparison and the representative live Sleeper comparison,
  with no observed quality-gate regression.
- Keep Current as the default and Beer+ as experimental. This change makes the
  shared Adj layer more disciplined; it does not change which method supplies
  Val.

## 2026-09-04: Player availability and ranking-freshness gate

Objective:

- Prevent the assistant from recommending a confirmed season-long absence.
- Keep ordinary injury labels from forcing large reaches for weaker players.
- Show when Sleeper concern news is newer than the FantasyPros ECR snapshot.
- Keep `Val` independent from player availability. Apply availability only to
  `Adj` and recommendation confidence.

Change:

- Added one availability classifier with five states: healthy, short-term
  concern, material risk, unavailable, and unknown.
- Only explicit season-long absence, retirement, or death makes a player
  ineligible. IR, PUP, suspension, doubtful, and out remain eligible with a
  material-risk penalty. A late IR stash gets a smaller penalty when the league
  has an IR slot.
- A normal Questionable flag gets a small `Adj` penalty. If its saved news time
  is newer than FantasyPros ECR, the board adds a stale-ranking warning and
  lowers confidence.
- Saved mock artifacts now preserve status and source timestamps. The evaluator
  fails a draft that contains a confirmed-unavailable player.
- A failed detailed-news request now reports unknown status. Detailed news
  remains on demand and does not receive a sentiment score.

Fixed-seed proof:

- Baseline: `data/draft-results/paired-batch-20260904053200`.
- Candidate: `data/draft-results/paired-batch-20260904054216`.
- Format: 12 teams, 14 rounds, all 12 slots, three fixed seeds per slot, 0.69
  receptions, two FLEX, no kicker, one D/ST, five bench spots, and one IR slot.
- Both versions and both strategies passed roster validity, roster completion,
  endgame, core construction, and usable-QB checks in all 36 drafts.
- Current mean core-starter ECR improved from 331.959 to 329.019. It improved
  in 11 pairs, tied in 25, and regressed in none. Mean simulated finish improved
  from 1.472 to 1.417.
- Beer+ mean core-starter ECR improved from 326.656 to 324.989. It improved in
  12 pairs, tied in 23, and regressed in one. Mean simulated finish stayed at
  1.361.
- The candidate selected no confirmed-unavailable players. Current selected 65
  short-term concerns and one material-risk player across 504 picks. The one
  material-risk selection was a round-14 IR stash in a league with one IR slot.
  Beer+ selected 73 short-term concerns and no material-risk players.
- Scenario tests prove that a confirmed season-long absence loses eligibility
  even with the best raw value, while a clearly better Questionable player can
  remain the top recommendation.

Decision:

- Keep the change. The targeted safety behavior is proven, all hard draft gates
  remain green, and the fixed batch did not degrade either strategy in the
  aggregate.
- This is internal regression evidence. It is not an independent player-outcome
  grade, and detailed news still requires human review.

## 2026-09-04: One canonical starter-aware value model

Objective:

- Make the better-performing starter-aware model the only recommendation path.
- Keep `VAL` separate from the user's roster and current draft state. Keep all
  roster and room adjustments in `ADJ`.
- Remove runtime choices that can create different answers from the same draft.

Change:

- Removed the ECR-only recommendation model, value-model selector, URL option,
  mock option, CLI option, paired comparison command, and strategy fields from
  saved draft artifacts.
- `VAL` now always uses supported league scoring, calibrated Sleeper projection
  curves, and league-specific VOLS and man-games replacement baselines.
- `ADJ` continues to add roster need, draft timing, position demand, roster
  construction, endgame rules, and player availability.
- If scoring rules, projection capability, or required source data are
  unavailable, the app replaces the draft board with a named incident. It does
  not fall back to the removed model or a prior board.

Proof:

- The canonical board tests cover raw-versus-adjusted value, missing-ECR
  eligibility, QB/TE limits, endgame behavior, roster balance, and status risk.
- The full unit and integration suite passed after the switch.
- `data/draft-results/algo-batch-20260904160346` ran three fixed seeds from all
  12 slots in the owner format. All 36 drafts passed mandatory roster, complete
  roster, endgame, core construction, and usable-QB gates. D/ST was never early.
- The earlier accepted paired batch remains historical evidence for selecting
  the starter-aware model. The runtime comparison machinery is no longer part
  of the product.

Decision:

- Keep one starter-aware value model. This supersedes earlier notes that kept
  the ECR-only model as the default or described starter-aware value as
  experimental.

## 2026-09-04: Qualitative next-turn timing

Objective:

- Remove the low-value `Back?` column from the overall and position tables.
- Show useful next-turn timing without false percentage precision.
- Keep recommendation quality equal to the accepted baseline.

Change:

- The overall and position tables no longer show a persistent return estimate.
- The Decision Board shows `Likely gone`, `Toss-up`, or `Can wait` for the top
  recommendation and alternatives within five `Adj` points.
- The player detail shows the same qualitative timing label.
- The displayed estimate starts with Sleeper ADP. It normalizes QB, RB, WR,
  and TE demand for each team between the current pick and the next user pick.
  The demand adjustment is limited to 12 percentage points.
- The existing room-pressure urgency stays internal to `Adj`. The app does not
  present that heuristic as a probability.

Proof:

- Scenario tests cover the current-pick snake boundary, position demand, a
  realistic round-one return estimate, table column removal, and qualitative
  Decision Board and player-detail labels.
- Baseline: `/private/tmp/fantasy-tiers-comeback-baseline/algo-batch-20260904195339`.
- Candidate: `/private/tmp/fantasy-tiers-comeback-final/algo-batch-20260904200102`.
- The batch used the same three fixed seeds for all 12 slots in the 12-team,
  14-round, 0.69 PPR, two-FLEX, no-kicker format.
- All 36 candidate drafts matched the baseline roster exactly. All 36 passed
  roster validity, roster completion, endgame, and core-construction gates.
  Mean starter ECR, simulated finish, and top-six TE count were unchanged.

Decision:

- Keep the qualitative signal. It gives timing context where the user makes a
  decision and removes an uncalibrated percentage from scan-heavy tables.

## 2026-09-04: Publish data with reserve warnings

Objective:

- Keep the draft data current when only the reserve cohort is incomplete.
- Notify the owner about the exact reserve gaps without blocking publication.

Finding:

- Sleeper changed Travis Hunter's primary position from WR to DB while keeping
  WR in `fantasy_positions`. The source still supplied his receiving projection
  fields. This was a valid provider classification, not a failed fetch.
- The aggregate builder ignored the DB-primary row. Together with the existing
  Jayden Higgins gap, reserve coverage was 35/37, or 94.6%.
- Core coverage and expected-draft-pool coverage remained 100%. The previous
  policy failed the full refresh because reserve coverage was below 95%.

Change:

- Core and expected-draft cohort failures still block publication.
- A reserve cohort below 95% has `warning` status and does not change the full
  readiness report to an incident.
- The workflow now publishes the refreshed aggregates and then sends a
  `Fantasy Tiers data warning` message with reserve coverage and player details.
- A warning run does not also send the normal recovery message.

Proof:

- The readiness scenario test removes a ready reserve player's projection,
  confirms the reserve cohort is incomplete, and confirms the full report stays
  ready.
- The workflow contract test requires the warning subject and publication
  message.

Decision:

- Keep reserve coverage observable but non-blocking. Missing data for a likely
  drafted player remains blocking through the core and expected cohorts.
