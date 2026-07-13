# Simulated Draft Testing Plan

Last updated: 2026-07-01

## Goal

Build a local programmatic mock-draft room that can replace live Sleeper mock drafts for most draft-assistant testing. The room should create Sleeper-shaped draft detail and picks state, advance bot teams through a draft, pause on the user's turns, render a draft board, and show the draft assistant below the board with first-class pick and undo controls.

This does not need to replace final live Sleeper validation. It should replace the slow inner loop: testing draft positions, roster settings, bot tendencies, position runs, source freshness, and recommendation usefulness.

## Viability

This is highly viable because the app already has a clean read-model seam:

- The draft assistant uses Sleeper draft details and picks as the live state inputs.
- The shared `buildDraftViewModel` path already converts draft details, picks, aggregate rows, roster settings, and user id into the UI/agent model.
- The UI now has `draftContext`, Decision Board, source health, player preview, and position tables, so a paused simulated state is enough for a human or agent to judge whether the assistant is useful.

The best first product surface is a new UI, not a hidden mock layer under the existing live assistant. The simulator should still be a deterministic library underneath, but the primary workflow should be a local mock-draft room where an agent can run a full draft without opening Sleeper.

MSW is useful for browser-level network mocking, but the simulator itself should be independent so it can be used by Vitest, Playwright, scripts, and future backtests.

## Preferred Product Shape

Add a dedicated mock draft route, for example:

```text
/mock-draft
```

The page should support this flow:

1. Enter a Sleeper username or user id.
2. Choose a Sleeper league to import settings from, or use defaults if no league exists yet.
3. Pick a draft slot.
4. Start the local mock.
5. Watch a Sleeper-like draft board fill as bot teams pick.
6. When the user's turn arrives, pause automatically.
7. Use the embedded draft-assistant data below the board to choose a player.
8. Click a `Pick` action on a player row/card.
9. Continue to the next user turn.
10. Undo one or more picks when testing alternate choices.

Success means a future agent can use only this local UI to run a realistic mock draft and judge the draft assistant. Live Sleeper should remain a final compatibility check, not the default inner loop.

## Minimum Useful Version

Build the minimum version in five layers.

### 1. Simulator Core

Create `src/lib/simDraft/`.

Core types:

- `SimDraftConfig`: teams, rounds, userSlot, scoring, roster settings, draft type, seed, bot strategy.
- `SimDraftState`: draft details, picks, currentPick, status, rosters, availablePlayerIds.
- `SimBotStrategy`: function that receives available players, bot roster needs, draft context, and returns a player id.
- `SimPause`: a snapshot when the simulator stops before the user's pick.

Core functions:

- `createSimDraft(config)`
- `advanceUntilUserTurn(state)`
- `makeUserPick(state, playerId)`
- `advanceToEnd(state)`
- `toSleeperDraftDetails(state)`
- `toSleeperDraftPicks(state)`

The simulator output should intentionally match the shapes consumed by `fetchDraftDetails`, `fetchDraftPicks`, and `buildDraftViewModel`.

The adapter functions must parse their outputs through the same Zod schemas as the live Sleeper fetchers: `DraftDetailsSchema` for draft details and `DraftPicksSchema` for picks. This makes schema drift visible in Vitest before the mock draft room diverges from the live draft assistant.

### 2. Basic Bot Strategy

The first bot does not need to be smart. It should be predictable and good enough to pressure the assistant.

Inputs available to bots:

- Sleeper-style ADP/rank/projection fields from aggregate rows.
- The bot's remaining starter slots.
- The bot's current roster by position.
- A seeded random number generator.

Version 1 behavior:

- Prefer filling open starter slots before bench slots.
- For RB/WR/TE, account for FLEX as a real starter need.
- Pick from the top 3 viable players by Sleeper ADP or Sleeper projected points.
- Use seeded randomness among the top 3 so repeated scenarios can be stable but not always identical.
- Avoid K/DEF until late rounds unless starter slots remain and the draft is near the end.
- Once starters are mostly full, prefer RB/WR bench depth over backup QB/K/DEF.

This intentionally mirrors simple Sleeper-room behavior, not expert strategy.

### 3. Local API Adapter

Add a local simulated draft API namespace, for example:

- `POST /api/sim-draft/create`
- `POST /api/sim-draft/:id/advance`
- `POST /api/sim-draft/:id/pick`
- `GET /api/sim-draft/:id/sleeper/draft`
- `GET /api/sim-draft/:id/sleeper/picks`
- `GET /api/sim-draft/:id/view-model`

The first implementation can keep state in memory for local dev and tests. Persisting scenarios can come later.

The easiest UI integration is a `mockSource=sim` query param:

```text
/draft-assistant?mockSource=sim&simDraftId=<id>&userId=<sim-user-id>
```

When `mockSource=sim`, the draft assistant should call the simulated endpoints instead of live Sleeper for draft details and picks. Aggregate data should still come from the normal local aggregate bundle.

### 4. Mock Draft Room UI

Create a dedicated route:

```text
src/app/mock-draft/page.tsx
```

The minimum UI should include:

- Setup panel:
  - Sleeper username/user id input.
  - League/settings selector.
  - Team count, rounds, scoring, roster slots, and draft type preview.
  - Draft slot picker.
  - Seed input or generated seed display.
- Draft header:
  - Current pick, round, pick in round, on-clock team, and user's next pick.
  - Controls: `Start`, `Advance to my pick`, `Continue`, `Undo`, `Reset`.
- Draft board:
  - Columns by team/draft slot.
  - Rows by round.
  - Snake/linear pick order.
  - Pick cell with player name, position, team, bye, and source rank/ADP when available.
  - User team visually distinct.
- Assistant panel:
  - Reuse the current draft-assistant components where practical: status, roster slots, Draft Context, Decision Board, position outlook, and position tables.
  - Add a `Pick` button beside eligible player rows/cards when the mock is on the user's turn.
  - Disable `Pick` when the player is already drafted or it is not the user's turn.
- Event log:
  - Recent picks.
  - Bot strategy notes such as `Team 3 filled RB starter` or `Team 7 waited on QB`.
  - Undo target visibility.

This page does not need to mimic Sleeper's exact visuals. It should mimic the draft state, pick flow, roster pressure, and agent decision environment.

### 5. E2E/Test Adapter

Use two test modes:

1. Library-level tests: directly call `createSimDraft`, `advanceUntilUserTurn`, `makeUserPick`, and `buildDraftViewModel`.
2. Browser-level tests: render `/mock-draft`, start a scenario, advance to the user's turn, make a pick from the assistant panel, undo it, and make a different pick.

MSW is a good fit when the real app code still calls external URLs, because it can intercept requests in both browser and Node contexts. For this app, a local `mockSource=sim` adapter may be simpler for the first pass because the app already owns the local draft data hooks. MSW can be added after the core exists if we want network-level replacement of `https://api.sleeper.app/v1/draft/...`.

## Sleeper Settings Import

The mock room should be able to import enough league context to feel like the user's real draft:

- League name and season.
- Team count.
- Roster positions.
- Scoring settings, especially reception value.
- Draft type when available.
- Number of rounds, derived from roster slots when draft settings are absent.

Use the existing Sleeper user and league hooks where practical. The imported settings should be editable before starting the local mock so agents can test alternate league shapes without creating new Sleeper mocks.

The first version can work with:

- A hard-coded standard 10-team config.
- Manual draft slot selection.
- League settings import as a progressive enhancement.

But the implementation should keep settings in a config object from the start so the UI and simulator are not coupled to one league shape.

## State And Undo

The simulator should keep a complete pick log and derive state from it. This makes undo reliable.

Minimum state model:

- Immutable `config`.
- Ordered `picks`.
- `currentPickNo`.
- `availablePlayerIds`.
- Derived team rosters.
- Event log.

Undo should remove the most recent pick and rebuild derived state. For the first version, support undoing one pick at a time from the end of the draft. Later, allow jumping back to any previous user turn and replaying bot picks from that point with the same seed.

## Draft Result Artifacts

Saved mock draft runs belong under the local ignored directory:

```text
data/draft-results/
```

The mock room writes each run into a timestamped subdirectory with this core file:

```text
draft-result.json
```

That JSON is validated by `DraftResultArtifactSchema` in `src/lib/draftResults.ts` and includes:

- simulator config, status, pick log, and bot/user event log
- Sleeper-shaped draft details and picks, using the same schemas as the live draft assistant
- the player pool used by the simulator
- drafted players, all team rosters, and the user's roster
- source-health metadata and the draft view model visible to the assistant UI

External analyzer reports should be stored beside the draft artifact. For Footballguys, prefer:

```text
footballguys-slot-1-report.html
footballguys-slot-1-summary.json
...
footballguys-all-teams-summary.json
```

This layout should make post-draft review straightforward: inspect the decisions that were visible during the draft, compare the final roster against an analyzer report, and decide whether a bad result came from the recommendation model, bot pressure, incomplete source data, or a human/agent pick.

## Evaluation Goal

The simulator should create adequate teams, not deliberately bad teams. Mediocre bot results are acceptable while the bot strategy is simple, but the test is only meaningful if the room applies enough roster and ADP pressure that a good user draft has to make real choices.

The target outcome for the draft assistant is:

- from any draft position, the user can use the app to beat the bot room by a clear margin
- the user team can repeatedly reach an `A-` or better Footballguys-style external grade
- the user team avoids obvious final-report holes such as missing starter quality at RB/WR/TE/QB or wasting too much draft capital on backup QB/K/DEF
- bot teams usually finish as plausible `C`-range competitors, not broken `F` teams, unless a scenario intentionally tests bad room behavior

## Retrospective Learning Loop

After each saved mock:

1. Run all-team analyzer reports:

   ```bash
   pnpm run fbg:seed-player-ids
   pnpm run fbg:analyze-draft -- --result-dir data/draft-results/<run>
   ```

2. Generate the user's pick retrospective:

   ```bash
   pnpm run draft:retrospective -- --result-dir data/draft-results/<run>
   ```

3. Review each user pick against the actual board at that pick:
   - selected player and selected available rank by Sleeper ADP
   - best available overall
   - top candidates by position
   - passed players who were gone before the user's next pick
   - passed players who were still available at the next pick
   - final team grade and position-grade weaknesses

4. Convert repeated retrospective findings into app improvements. Examples: stronger "can wait" labels, position-depth warnings, "next turn survivability" confidence, stronger starter-slot pressure, or late-round penalties for backup QB/K/DEF.

## Decision Surface Direction

The assistant should expose multiple draft views instead of asking one blended list to answer every question:

- `Best overall`: top remaining values by overall market/rank context.
- `By position`: top remaining QB/RB/WR/TE/K/DEF with starter gaps, tier cliffs, and next-turn risk.
- `FLEX`: RB/WR/TE-only pool for starter/flex/bench choices.

This separation matters because the best remaining player by a positional rank can be misleading across positions. Late in drafts, QB and TE often look efficient by raw projection or positional rank, but backup QB/TE picks are usually low priority once a starter is rostered. The app should surface the relevant context and question, not enforce a hard rule. Examples of acceptable reasons for another QB/TE include elite tier value, very late draft price, superflex/TE-premium settings, bye/injury contingency, or a lack of useful RB/WR/FLEX alternatives.

## Expansion Plan

After the minimum version works, add scenario controls:

- Draft slots: 1, middle, turn, late.
- Team counts: 8, 10, 12, 14.
- Rounds and bench sizes.
- Scoring: standard, half, PPR, custom reception values.
- Roster formats: 1QB, superflex, 2QB, 2 FLEX, no K/DEF, TE premium later.
- Bot styles:
  - Sleeper ADP follower.
  - Projection chaser.
  - RB-heavy room.
  - WR-heavy room.
  - Early-QB room.
  - Auto-draft K/DEF too early.
  - Sharp room that follows our blended ranks.
- Scenario events:
  - Positional run before user's pick.
  - Tier cliff about to disappear.
  - Bad source freshness.
  - Missing projections.
  - Bye-week cluster on user's roster.
  - Player news/injury override.
  - Market-implied disagreement once market data exists.

## Agent Evaluation Workflow

For each paused user turn, produce a compact evaluation packet:

- Sim config and seed.
- Current pick and next user pick.
- User roster and open slots.
- League-wide remaining starter slots.
- Recent positional run.
- Top Decision Board rows.
- Position Outlook rows.
- Candidate player facts.
- The app's recommendation and reason codes.

An agent can then answer:

- Is the top recommendation defensible?
- Is the UI exposing enough context?
- Did the assistant miss a roster construction issue?
- Did it overreact to raw value?
- Did it correctly identify a tier cliff or room run?
- Could a similar player come back?

## Suggested First Milestone

Build one reproducible local mock room:

- 10 teams.
- 15 rounds.
- Standard scoring.
- Slot 5.
- Sleeper-ADP bot strategy.
- Route: `/mock-draft`.
- Pause automatically at picks 1.05, 2.06, 3.05, 4.06.
- Render the draft board above the assistant panel.
- Pick from the Decision Board or position tables.
- Undo the last pick and replay from the same state.
- Assert that `draftContext`, Decision Board, user roster, and position outlook all render and change after each pick.

Once that works, the simulator becomes the faster testing loop. Live Sleeper mocks should then be reserved for final compatibility checks.

## Implementation Sequence

1. Extract a reusable assistant view that can receive draft details and picks from props or a source adapter instead of only live Sleeper query hooks.
2. Build `src/lib/simDraft/` with config, pick order, roster derivation, starter-slot accounting, basic bots, and Sleeper-shaped converters.
3. Add focused integration tests for pick order, bot advancement, user pause points, user pick, and undo.
4. Add local API routes or a client-side reducer for the first mock room. Prefer the simplest state owner that still lets Playwright drive the flow.
5. Build `/mock-draft` setup, board, controls, and event log.
6. Embed the assistant panel and wire `Pick` buttons to `makeUserPick`.
7. Add league-settings import from Sleeper user/league data.
8. Add Playwright coverage for start, advance, pick, undo, and replay.
9. Add optional MSW/network replacement only if tests need to prove the unmodified live assistant can consume simulated Sleeper endpoints.

## Acceptance Criteria

The first implementation is successful when:

- A user or agent can open `/mock-draft`, select slot 5, start a 10-team draft, and reach the user's first pick without opening Sleeper.
- Bot picks are deterministic for the same seed.
- The board shows all made picks in the correct snake order.
- The assistant panel hides drafted players and updates the user's roster after a pick.
- The `Pick` action is unavailable off-turn and for drafted players.
- `Undo` removes the latest pick, restores availability, and updates the assistant panel.
- A full mock can be completed from the local UI.
- A Playwright test proves at least one pick/undo/re-pick loop.

## Implementation Notes

Initial implementation added:

- Pure simulator core in `src/lib/simDraft/`.
- Local `/mock-draft` route.
- Aggregate-bundle backed player pool.
- Sleeper league settings import when a username/user id and active-season leagues are available.
- Seeded bot picks.
- Board state, user-turn pause, pick, undo, and continue controls.
- Compact assistant panel powered by the shared `buildDraftViewModel` path.
- Focused Vitest coverage in `tests/lib/simDraft.test.ts`.
- Focused Playwright coverage in `tests/e2e/mockDraft.spec.ts`.

Keep the setup `Start` action disabled until the aggregate bundle has loaded real players. React Query may finish after the form renders; starting with an empty player array throws `No players are available for the simulated pick` before the UI can enter draft state.

Verification from the first pass:

- `pnpm test tests/lib/simDraft.test.ts`
- `pnpm run build`
- `pnpm playwright test tests/e2e/mockDraft.spec.ts --config e2e.config.ts --output=/private/tmp/fantasy-tiers-playwright`
- Chrome manual pass at `http://localhost:3000/mock-draft`: start at slot 5, pause at 1.05, pick Jonathan Taylor, undo, pick Derrick Henry, verify the 1.05 board cell, advance to the 2.06 user turn, then complete all 15 user turns from the local UI. Screenshots were saved to `/private/tmp/fantasy-tiers-mock-draft-start.png`, `/private/tmp/fantasy-tiers-mock-draft-picked.png`, and `/private/tmp/fantasy-tiers-mock-draft-complete.png`.
