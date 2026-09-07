# Rehearsal fix plan

Implement UI changes only; retain scoring and owner policy.

1. Keep up to three user-selected players in a shared comparison tray across position tabs. Use current canonical scores. Retain picked members as unavailable. Show pair differences and roster eligibility. Allow a selected opponent in preview.
2. Read direct starter and shared FLEX counts from the canonical room totals. Do not add FLEX slots to every position label.
3. Reuse the roster-allocation helper to show open slots for each shared bye, with current bench players included. State the ordinary open slots separately so unfinished drafting is not attributed to byes. This is a coverage check, not a projection.
4. Collapse the full roster by default. Keep status and player pool close together.
5. Give each table explicit base-Val and context-Adj sort controls. Show the largest non-value component in player details.
6. Use 'Eligible for' instead of 'Fills' and label depth-chart role as source data, not proof of a starting workload.

Acceptance: selected comparisons persist across tabs and draft updates; direct need plus FLEX is labelled separately; bye coverage uses each roster player once; scoring is unchanged. Run integration tests, typecheck, lint and build, then check the finished UI in Chrome against Sleeper. Preserve parallel ESPN edits and use an isolated server.

## Implementation and verification

All six UI changes are implemented. No active scoring or opponent policy changed.

- Added `DraftSelectedComparison`: select up to three players across position tabs; retain selected players through live picks; remove obsolete numerical comparisons when drafted. A new draft clears the tray.
- Preview now lets the user select the other member from the tray and reports that exact pair.
- Added `DraftDemand`: direct slots and shared FLEX slots come from the canonical room totals. No combined positional demand is presented as a direct starter count.
- Added `draftTableReview` and updated the facts strip: existing roster allocation computes additional uncovered slots during shared byes, including the bench. Undrafted slots remain separate.
- Collapsed the full roster by default and reduced pool spacing.
- Added explicit Val/Adj sort buttons and the largest non-value component in player rows. Header sorting and independent tab state remain available.
- Changed slot text to eligibility and labelled depth information as source data. No claim of weekly starter quality or calibrated confidence is made.

Automated evidence: 509 tests passed across 80 files, lint passed, and the isolated source copy passed typecheck and a production build. The shared repo typecheck still reports an unrelated in-progress ESPN `relayStore.ts` optional-token error. The isolated copy retains the previously verified ESPN source, so its build is not proof that the concurrent ESPN revision is ready.

## Browser repeat

Used the same paused Sleeper room after all UI changes. This was a targeted live regression check at the recorded roster, not a second eight-round draft or an outcome experiment.

1. Confirmed the full roster was collapsed, the exact pick distance was visible, and bye 11 showed `1 QB, 1 TE, 2 FLEX` as additional uncovered slots.
2. Selected Gainwell from Overall, Pittman from WR, and Croskey-Merritt from RB. All three stayed in the tray across tabs.
3. Pittman's preview compared him with Gainwell: +3.6 Val / -14.7 Adj. Changed Gainwell's selected comparison to Croskey-Merritt and verified -2.2 Val / +0.5 Adj, with the actual component difference.
4. Confirmed direct RB/WR need and shared FLEX need were displayed separately. All direct offensive starter slots were filled on this board.
5. Manually drafted Gainwell in Sleeper at #100. Bots selected Croskey-Merritt at #101 and Pittman at #105. All three remained in the tray marked drafted, without stale score comparisons.
6. Verified the WR tab retained Val sorting through the live update. The pick strip changed to #117 with six intervening selections until #124.
7. The new bench RB reduced the bye-11 uncovered FLEX count from two to one. Bye 10 correctly showed an RB hole when Swift and Gainwell are both absent.
8. Paused Sleeper at #117 after 116 completed picks. No pick was made at #117.

Evidence is in `data/draft-results/sleeper-ui-fixes-repeat-20260906/`: before/after rendered text, actual comparison preview, screenshots, and public picks. The original eight-pick evidence remains unchanged.

No scoring tune, push, or deployment was performed. Manual comparison remains an aid to judgment. The test does not establish better fantasy outcomes, player equivalence, or validated availability probabilities.

The final isolated production build was started on port 3009 and checked in Chrome. It showed Data ready, the correct paused pick #117, the corrected bye coverage, and working base-Val sorting. `production-final.txt` and `production-final.png` record this built surface. The recommendations-hidden flag is local to the isolated experiment; the source repo keeps recommendations enabled by default.
