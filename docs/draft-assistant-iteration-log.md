# Draft Assistant Iteration Log

Use this log to preserve what we learned from mock drafts, analyzer reports, and UI changes. Keep the generated artifacts in ignored `data/draft-results/<run>/`; this file should only hold the durable conclusions.

## 2026-07-01 - Iteration 1

- Run: `data/draft-results/20260701052024-sim-iter-01-slot-2-2026-slot-2`
- Setup: 10 teams, 15 rounds, slot 2, seed `iter-01-slot-2-2026`.
- Process: used the live `/mock-draft` UI and the shared draft assistant overall board for every user pick.
- User result: Footballguys overall grade `A+`.
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
- User result: Footballguys overall grade `A+`.
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
- User result: Footballguys overall grade `A+`.
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
- User result: Footballguys overall grade `A+`.
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
- Process: used the live `/mock-draft` UI and the shared draft assistant overall board for every user pick. Pick-by-pick notes and all Footballguys reports are saved beside the ignored run artifact.
- User result: Footballguys overall grade `A-`.
- Bot field: `C-` to `B+`; the user beat every bot but missed the working target of consistent `A` or better grades.
- User position grades: QB starters `A-`, RB starters `A`, RB depth `D+`, WR starters `A-`, WR depth `A+`, TE starters `C+`.

Most useful signals:

- `VAL` still found strong early value at the turn: Amon-Ra St. Brown, Derrick Henry, De'Von Achane, and A.J. Brown.
- The pick-focus strip kept RB/WR starter balance visible; this run produced `A`/`A-` starters at RB and WR.
- SPECIAL filtering and the late K/DEF workflow worked as intended.
- The saved run plus all-team Footballguys summaries made the failure mode obvious after the draft.

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
- Process: used the live `/mock-draft` UI and the shared draft assistant overall board for every user pick. Pick notes, all Footballguys reports, and a retrospective are saved beside the ignored run artifact.
- User result: Footballguys overall grade `A+`.
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
- Process: used the live `/mock-draft` UI and the shared draft assistant overall board for every user pick. Pick notes, all Footballguys reports, and a retrospective are saved beside the ignored run artifact.
- User result: Footballguys overall grade `A+`.
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
- Process: continued the live `/mock-draft` UI run from pick 13.02, saved the completed app artifact, analyzed all teams with Footballguys, and generated a slot-2 retrospective.
- User result: Footballguys overall grade `B+`, below the target.
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
- Process: used the rebuilt `/mock-draft` UI with the new `WR starter` signal, saved the app artifact, analyzed all teams with Footballguys, and generated a slot-4 retrospective.
- User result: Footballguys overall grade `A`.
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
- Process: used the `/mock-draft` UI with the new `WR2 anchor` signal, saved the completed app artifact, analyzed all teams with Footballguys, and generated a slot-7 retrospective. The initial Chrome-controlled page could not be reclaimed after extension control failed, so the same seed and decisions were rerun through the rendered UI with Playwright driving Google Chrome.
- User result: Footballguys overall grade `A+`.
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
- Process: a subagent with no full conversation context used only the two quick-guide docs and the live `/mock-draft` UI, then saved the app artifact, analyzed all teams with Footballguys, and generated a slot-6 retrospective.
- User result: Footballguys overall grade `B+`, best in the room but below the `A-` target.
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
- Process: a subagent used the quick-guide docs and the live `/mock-draft` UI after the pre-ADP QB policy and single-`VAL` UI cleanup, then saved the app artifact, analyzed all teams with Footballguys, and generated a slot-9 retrospective.
- User result: Footballguys overall grade `A+`.
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
- The bot field remains too easy in some seeds. Continue using Footballguys all-team reports, but future simulator work should make bots less likely to finish with obvious position holes.

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
- Process: `pnpm run draft:algo-mocks -- --runs 3 --slot 5 --analyze --fbg-env data/footballguys-session.env`. Each run saved `draft-result.json`, `algorithm-decisions.json`, and the Footballguys report HTML/summary under ignored `data/draft-results/...`.

Most useful signals:

- The script loop is much faster than UI drafting for ranking-model calibration. It makes deterministic seeds, pick logs, and analyzer reports available without opening Sleeper or the mock UI.
- The per-pick `algorithm-decisions.json` is the key review artifact. It shows the selected player, top alternatives, recommendation scores, reason chips, score components, comeback labels, roster counts, and needs before each user pick.
- Elite TE remains a strong scarce-starter signal. In the weak slot-5 seed, switching from Josh Allen at 4.06 to Brock Bowers improved TE from `C` to `A+`, but only after adding late-QB urgency did the build avoid falling to Matthew Stafford at QB.
- First-WR-anchor pressure improved the weak seed's shape: the algorithm took Jaxon Smith-Njigba at 2.06 over a near-tied RB, improving WR starters from `C` to `B` while preserving `A+` TE and `B-` QB.

Signals downweighted after testing:

- Forcing RB/WR bench balance too hard was harmful. Moving from 7 RB / 4 WR to 6 RB / 5 WR looked cleaner but dropped grades to `A`, `B+`, `A-`; Footballguys preferred the stronger RB value in these seeds.
- Do not overcorrect from a `B-` QB grade. Runs with Brock Purdy still reached `A+` when RB/WR/TE were strong.
- Do not force elite TE over every high-value RB3. At 3.05 in the third seed, Brock Bowers was unlikely to return, but the RB value gap was large enough that the team still reached `A` with Kyle Pitts.

Durable product lessons:

- The current algorithm is good but not yet consistently `A+` from slot 5; the repeated result is closer to `A+`, `A-`, `A`.
- The highest-leverage remaining work is not more roster-ratio pressure. It is better calibration of starter point ceiling and clearer trust/risk context for odd late values.
- Analyzer grades include room variance and playoff-chance estimates, not just position grades. In the final weak seed, position grades were reasonable (`B-` QB, `A` RB starters, `B` WR starters, `A+` TE), but Footballguys still held the team to `A-`.

Implemented after this iteration:

- Added script-only algorithm mock drafts and Footballguys analysis via `pnpm run draft:algo-mocks`.
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
- Process: one run with three mixed slots per iteration, analyzed with Footballguys user-team reports only.

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

- Footballguys report prose can recommend backup QB/TE or free-agent upgrades that are not realistic draft-room advice. Use the overall grade, position grades, playoff-chance signal, and repeated pick logs; do not tune directly from every prose recommendation.
- Do not add a hard backup-QB rule. Most good teams still had no backup QB, and Footballguys' backup-QB criticism did not reliably predict the overall grade.
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
  - Slot 1: `RB,RB,TE,WR,WR,RB,WR,RB,WR,QB,RB,WR,RB,K,DEF`, Footballguys `A`; WR starters `C`, WR depth `A-`, TE starters `A`.
  - Slot 3: `RB,RB,TE,RB,WR,WR,RB,QB,RB,RB,WR,WR,WR,K,DEF`, Footballguys `A+`; WR starters `C`, WR depth `F`, TE starters `A+`.
  - Slot 10: `RB,WR,RB,WR,RB,TE,WR,QB,RB,WR,RB,WR,RB,K,DEF`, Footballguys `A-`; WR starters `B`, WR depth `A+`, TE starters `C+`.
- Hypothesis tested: force stronger WR1 anchoring by round 3 to improve WR starter grades in RB/TE-heavy builds.
- Local-only result: a WR1-by-round-3 gate made all 10 slots look cleaner by internal gates.
- External check disproved it: tuned slot 1 changed to `RB,RB,WR,WR,RB,TE,WR,RB,RB,QB,RB,WR,WR,K,DEF`, but Footballguys dropped from `A` to `A-`; WR starters stayed `C`, WR depth fell to `C-`, and TE starters fell from `A` to `C+`.
- Decision: reverted the WR1 anchor scoring change and removed the stricter WR1-by-round-3 gate. Do not optimize against early-WR timing alone; the analyzer is still rewarding elite RB and elite TE value enough that low WR subgrades can coexist with strong overall teams.

Full Footballguys grading for `data/draft-results/algo-batch-20260702031332`:

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
- The script batch summary now records the drafted QB's name, scoring value, and recommendation-time positional rank, and adds a quality gate for "QB starter clears usable floor" so this issue is visible before Footballguys grading.

## 2026-07-02 - Elite TE Cliff Update

- Trigger: after the QB-floor fix, Footballguys graded the next 10-slot batch as `A+` x6, `A` x1, `A-` x2, `B` x1. The remaining `B` came from slot 7 with TE starters `C` after passing Brock Bowers at 3.07 and later settling for Tyler Warren in round 6.
- Diagnosis: in the weak slots, Bowers was already the #2 recommendation in round 3 but lost to high RB value by roughly 10-25 recommendation points. When Bowers/McBride were taken in round 3, TE usually graded `A` or `A+`; when the draft waited until the Warren/Pitts/Loveland tier, TE often graded `C`/`C+`.
- Change: strengthened the `eliteTe` component specifically for top-two TE starters in rounds 3-4. This is not a generic TE boost and does not affect backup TE.
- Added TE starter quality fields to script batch summaries: `teStarterName`, `teStarterValue`, and `teStarterPosRank`.
- Added a `TE starter clears quality floor` internal gate. This catches the prior blind spot where "TE by round 7" passed even though the actual starter was Tyler Warren/Kyle Pitts tier and Footballguys graded it poorly.

Validation:

- Focused tests passed: `pnpm exec vitest run tests/lib/draftValue.test.ts tests/lib/algoMockDraft.test.ts tests/lib/simDraft.test.ts`.
- Lint passed: `pnpm run lint`.
- Internal batch `data/draft-results/algo-batch-20260702042341`:
  - Slots 1-9 all secured a TE quality floor except no TE issues.
  - The previous weak middle slots now took Brock Bowers in round 3.
  - Slot 10 still failed TE quality and QB timing because Bowers was already gone by 3.10 and the available TE pool was weak by the next turn. Treat this as a different edge case, not proof that every weak TE should be forced over a massive RB value.
