# Live draft release candidate — September 6, 2026

## Scope

This candidate integrates the v2 live-feed reliability work into the compact
choice assistant. It retains the exact-turn correction and the scenario FLEX
demand fix. It adds no scoring weights and does not activate the experimental
availability model. The owner declined the offline aid; no offline exporter is
included. The parallel ESPN aid is outside this candidate.

Changes:

- Reject failed or malformed pick responses as a whole. Retain the known board.
- Allow missing-resource empty responses only for confirmed pre-draft context
  with no cached picks. Accept valid shorter responses for commissioner undo.
- Pass query cancellation signals and reject cancelled late responses.
- Show pick-response age and update errors separately from provider data age.
- Keep scenarios on demand, reject outdated results, and isolate optional errors.
- Preserve room-wide FLEX demand and recheck first-pick eligibility at the
  simulated upcoming turn. No active recommendation uses a scenario result.
- Keep source-gap and newer-news warnings visible on comparison cards.

## Verification

- Full checkout: 502 tests passed in 76 files. This includes tests from the
  parallel ESPN work that existed when the run started.
- Clean TypeScript check: `tsc --noEmit --incremental false` passed.
- Repository lint and diff whitespace checks passed.
- Isolated production build: `next build --webpack` passed. The copied release
  tree excluded uncommitted ESPN additions. Build location:
  `/private/tmp/fantasy-v2-release-build`.
- Chrome, local mock, slot 4, 12 teams, 14 rounds, 0.69 reception scoring:
  current cards render without a scenario; explicit request shows a scenario;
  first wait has 16 opponent picks and next wait has 6; drafting invalidates the
  old scenario; Undo restores pick 1.04 and three prior picks. Offline export
  button is absent in the final version.
- Fetch/query integration tests cover HTTP failure, malformed prefixes,
  pre-draft cache protection, valid shorter responses, and cancellation.
- The 13 staged aggregate files match merge parent `185bc607` byte for byte.
  There are no unresolved index entries. No data refresh was performed here.

## Limits and release boundary

The tests establish correctness and local behavior, not improved fantasy
outcomes. The scenario is a market-order what-if, not a validated availability
forecast. The exact real draft identity and its settings were not verified in
this work. No picks or settings were changed in a real draft.

The local-file browser policy blocked direct verification of the downloaded
reference. The owner reported marking players, then declined that feature.
The downloaded file and its marks were left in place; it is not part of release.

Publishing PR #23, its remote CI, merge, deployment, and production SHA/health
verification remain pending owner approval. A local build is not deployment
proof.
