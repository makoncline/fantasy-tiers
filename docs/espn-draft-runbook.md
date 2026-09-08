# ESPN Reader

## User flow

Install the unpacked reader once. Open an ESPN draft and click **Open assistant**.
Keep the draft and assistant in the same Chrome profile. The reader makes no
picks. ESPN connection controls are at the top; the shared draft UI is unchanged.

See [the install steps](espn-reader-mac-setup.md).

## Transport

`main.ts` observes ESPN's existing WebSocket and decodes INIT, STATE, SELECTED,
UNDONE, and RESET. It reads ESPN league/player settings. It never creates another
socket or sends draft commands. Cookies, tokens, private queues, owners, and chat
are not forwarded. Schema validation removes unknown fields.

The ESPN content script assigns a document instance and increasing revision to
snapshots. The worker binds the source tab and league/season/team to one assistant
tab. An assistant content script on the exact build origin and `/espn-draft`
bridges validated updates to React. There is no external messaging API, hosted
relay, database, bearer key, share link, or HTTP draft polling. Normal ranking
requests still go to the app.

Worker messages check extension sender, main frame, current tab URL, identity,
revision, and the active source content-script instance. A page cannot select a
destination tab. The worker serializes storage updates. Four bindings and a
1,000,000-character snapshot limit bound session storage use. Closed bindings
are removed. Navigation invalidates source state. A source reload needs a fresh
snapshot from its current document. Undo is accepted with a newer revision.

`chrome.storage.session` holds sanitized snapshots and tab bindings across worker
suspension. It is not exposed to content scripts. Chrome clears it on browser
restart or extension reload/update/disable. After any of those events, click
**Open assistant** again; a fresh ESPN connection/INIT is required. Do not promise
automatic recovery across extension updates or browser restarts.

The UI checks both the ESPN source timestamp and delivery receipt time. Replaying
an old snapshot does not refresh source time. Either stale input or a source
close/disconnect stops recommendations. A cached snapshot only restores advice
while it is fresh. The page requests its current bound snapshot on load and on
**Check again**. Hash navigation is reserved for shared draft section links.

## Shared UI and mapping

`EspnAssistant.tsx` maps ESPN league rules, order, team identity, and picks into
the shared draft view model. The rankings, valuation engine, sidebar,
recommendations, tables, and player details are shared. ESPN's league-scored
projection totals use the engine's existing `ESPN league projections` contract.
This supports ESPN D/ST scoring without claiming it equals Sleeper scoring.
The ESPN header names this source; Sleeper/FP source controls are not shown on
this route. Sleeper's own source controls and code remain unchanged.

Only present ESPN projections enter the artifact. Missing totals remain missing
and stop advice through shared coverage checks. The artifact records when the
league snapshot was read, not an invented provider update time. Source data and
projection snapshot freshness still use the shared readiness checks. This follows
DS-01 in the strategy research contract: values must use the selected league's
scoring. No shared selection policy changes are part of this adapter fix.

Match players by normalized name and position; prefer a unique exact name when
normalization is ambiguous. Only confirmed matches remain in each position's
own shard. The adapter does not change the cached source bundle or player values.
Unknown drafted players and gaps stop advice. Position-specific scoring overrides
that differ from the base rate stop advice. Unsupported ESPN formats stop with a
clear message.

## Build and check

```sh
pnpm run espn:build-reader
pnpm run typecheck
pnpm run lint
pnpm test
pnpm exec next build --webpack
```

The release targets `https://fantasy-tiers.vercel.app`. For a local browser check:

```sh
ESPN_ASSISTANT_ORIGIN=http://localhost:3022 pnpm run espn:build-reader
ESPN_TEST_ORIGIN=http://localhost:3022 node scripts/espn/verify-reader.mjs
```

Rebuild without the override before release. `dist/espn-reader.zip` contains only
the extension and install guide. No database configuration is needed. Packaging
is not a GitHub release, deployment, or proof of a native Chrome installation.

Test worker suspension, assistant reload, source reload/navigation/closure,
wrong-tab/origin/frame messages, old snapshots, two independent drafts, and stale
advice gating. Verify a real ESPN practice pick after installing the candidate
before claiming live integration. Never make picks in the real league.

The old relay rehearsal and eight-pick reports are historical evidence. They do
not verify version 2.0. Keep raw ESPN HAR files outside Git: even sanitized exports
can contain WebSocket authentication frames. Use `espn:replay-har` only on private
local captures; do not print or publish raw headers, frames, or credentials.
