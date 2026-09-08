# ESPN reader without a hosted relay

Status: implemented and tested locally. A live practice-draft check remains required before merge or deployment.

The two-tab flow does not need a database. The ESPN decoder and player mapping feed the shared draft UI and scoring.

## Accepted scope

Keep the ESPN draft and assistant in the same Chrome profile. Keep reading ESPN's existing socket. Do not send draft commands. The assistant still loads its normal cached rankings from the application.

Use Chrome runtime messaging between the reader, background worker, and a content script on the exact assistant origin and ESPN route. The background worker binds one ESPN tab to its assistant tab. Validate each snapshot with the existing schema before delivery. Do not expose broad tab control or ESPN credentials to the web page.

Keep the latest scoped snapshot in extension session storage so worker suspension and assistant reload can recover. On source-tab closure or stale input, stop advice and show disconnected state. Fresh transport receipt is not proof of a fresh ESPN snapshot; retain the source timestamp.

The candidate has no hosted relay routes, relay database storage, read/write bearer keys, share links, session expiry UI, or HTTP draft polling. Transport integration tests replace the relay tests.

## Acceptance

- Packaged extension reads one fixture socket and sends zero ESPN commands.
- Assistant opens for the selected draft and receives a pick update.
- Assistant reload and worker suspension recover the selected draft state.
- Wrong-tab and wrong-origin messages cannot change the active board.
- Source disconnect and stale snapshots stop advice; recovery restores it.
- Two draft tabs do not mix picks or settings.
- No relay HTTP requests or database configuration are required.
- Shared Sleeper tests, typecheck, lint, and production build pass.
- A real ESPN practice pick is observed read-only before claiming live integration.

## Current integration evidence

The isolated candidate is based on production `bad97c20`.

- 527 tests across 86 files passed. Typecheck, lint, and the production build passed.
- The packaged extension fixture passed: one observed ESPN socket, zero draft commands, zero relay HTTP requests, pick updates, assistant reload, and stale-state blocking.
- The worker integration test covers restart with retained session storage, source reload and closure, two separate drafts, and invalid messages. This is simulated worker restart evidence, not a native Chrome suspension test.
- A real ESPN practice pick with version 2.0 is still pending. Earlier live checks used the old relay reader.
- The release ZIP was rebuilt for `https://fantasy-tiers.vercel.app`; its manifest has no localhost permission. It is not published.
- Manual review found no remaining actionable issues after the identity-pool, scoring-override, and D/ST projection fixes. CLI review remains unavailable: installed Codex 0.146.0 cannot run its configured model.

## After the owner's draft

Keep the production release unchanged during the draft. Before merge, verify one
live ESPN practice pick with Reader 2.0 and the candidate assistant. Do not test
with a real league pick. Then confirm the staged diff still contains only this
candidate, commit `Add browser-only ESPN draft reader`, and review against the
current merge target. Do not carry unrelated root-checkout changes into this
release. Publish the production ZIP and verify the deployed `/espn-draft` page
only as part of the post-draft release.

The root checkout and tested production release remain unchanged.
