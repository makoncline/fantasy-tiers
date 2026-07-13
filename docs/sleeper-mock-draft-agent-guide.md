# Sleeper Mock Draft Agent Guide

Use this when running a real Sleeper mock draft in Chrome while using our draft
assistant in another tab.

## Setup

1. Keep Chrome visible and the Mac unlocked.
2. Open Sleeper draftboards:
   `https://sleeper.com/draftboards`
3. Start a new NFL mock draft unless the user gives you an existing draft URL.
4. Use the user's league settings when known. Otherwise use:
   - 10 teams
   - 15 rounds
   - snake draft
   - standard scoring
5. Pick the requested draft slot. If no slot is requested, choose a random slot.
6. Copy the Sleeper draft URL and draft id.
7. Open the app in another tab:
   `http://localhost:<port>/draft-assistant?userId=<user-id>&draftId=<draft-id>`

## Before Starting

1. Confirm the app shows the same draft id and your claimed draft slot.
2. Confirm the app has available player rows and a recommendation.
3. Start the draft, then make pausing the room the first action. Do not inspect
   recommendations or search for a player while the clock is running.
4. Verify the paused banner, then turn off auto-pick with the pink
   `TURN OFF AUTO-PICK` banner and verify the auto-pick warning is gone.
5. If `START DRAFT` opens a confirmation dialog and Chrome control hangs or
   resets after accepting it, stop and ask the user to start the draft manually
   and pause it. Do not continue unless you can see the live room and verify
   auto-pick is off.
6. If the room advances to the user's pick before both controls are verified,
   pause immediately. Do not use that pick to debug browser controls.

## Per Pick

1. Let bot picks run. Poll cache-busted `/v1/draft/<draft-id>` and
   `/v1/draft/<draft-id>/picks`; `picks.length + 1` is the active pick.
2. Calculate the active snake-draft slot from the pick number and team count.
   Pause only when that slot equals your claimed slot. Do not pause early.
3. Verify both the paused banner and API `status: "paused"`.
4. Refresh and read the draft assistant recommendation in the app.
5. Use the app recommendation as the default pick.
6. If the recommendation is unclear, compare the top overall row with the best
   RB, WR, TE if open, QB if open, and FLEX-compatible option.
7. In Sleeper, search the selected player by name so only that row is visible.
8. Queue a fallback player if there is time.
9. Resume the draft.
10. Double-click the visible left row action (`+`) for the selected player.
11. Confirm the picks endpoint gained one row for the expected player and slot.
12. Let bots complete their picks before pausing at the next user turn.

## Recovery

- If the Sleeper tab freezes, times out, or becomes unresponsive, open the same
  draft URL in a new Chrome tab, confirm the room loads there, then close the
  stale tab and continue from the fresh tab.
- If this happens while starting the draft or before auto-pick can be verified,
  do not give up immediately. Open the draft URL in a fresh tab first; this
  start-of-draft timeout has happened before and usually recovers in the new
  tab. Continue only after auto-pick is confirmed off.
- If the fresh tab loads but the start confirmation causes Chrome control to
  hang/reset, stop and ask the user to start and pause the draft manually. This
  is safer than continuing without verified auto-pick state.
- If a pick does not appear in the app after a few seconds, refresh the app tab
  or verify the pick in Sleeper before making the next decision.
- If Chrome control stops working, ask the user to make Chrome visible/unlocked
  before continuing.
- Do not use memorized click coordinates. Search the player and click the
  visible row action because Sleeper row positions move.

## End

When the draft is complete, save or record the final roster if the user asks for
post-draft review.
