# Agents Guidelines

This document codifies conventions for building features and agents in this repo. It complements the Repository Guidelines and applies across UI, data fetching, validation, and state management.

Start by reading `docs/project-context.md` for product context, current architecture, known data-source issues, and revamp priorities.
For draft-assistant work, also read `docs/draft-assistant-runbook.md` before testing Sleeper mocks.

## UI Components

- Use shadcn/ui components for all UI primitives and common patterns.
- Keep shadcn components under `src/components/ui` and prefer composition over custom styling.
- Extend via variants/slot props rather than forking base components.

## Forms

- Use `react-hook-form` with shadcn form patterns for all forms.
- Co-locate form schema with the component or export from `src/lib/schemas.ts`.
- Use Zod + `zodResolver` for validation; derive TS types from schemas.
- Prefer uncontrolled inputs. Use `Controller` only when a component cannot be uncontrolled.
- Use shadcn’s `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` wrappers.

Example:

```tsx
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const schema = z.object({
  email: z.string().email(),
  age: z.number().int().min(13),
});

type FormValues = z.infer<typeof schema>;

export function ProfileForm() {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", age: 18 },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => {
          /* submit */
        })}
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="age"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Age</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Save</Button>
      </form>
    </Form>
  );
}
```

## Async/Data Fetching

- Use React Query for all async calls (HTTP requests, mutations, background refresh).
- Define query/mutation keys in a central module (e.g., `src/lib/queryKeys.ts`).
- Co-locate query hooks with features (e.g., `src/hooks/usePlayers.ts`) and reuse across components.
- Prefer `useQuery`/`useInfiniteQuery` for reads and `useMutation` for writes; invalidate/prefetch as needed.

Example:

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

const Player = z.object({ id: z.string(), name: z.string() });
const Players = z.array(Player);

type Player = z.infer<typeof Player>;

export function usePlayers() {
  return useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const res = await fetch("/api/players");
      const json = await res.json();
      return Players.parse(json);
    },
    staleTime: 60_000,
  });
}

export function useUpdatePlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Player) => {
      const res = await fetch(`/api/players/${p.id}`, {
        method: "PUT",
        body: JSON.stringify(p),
      });
      return Player.parse(await res.json());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["players"] }),
  });
}
```

## Types & Validation

- Use Zod for all runtime validation and type derivation.
- Define schemas in `src/lib/schemas.ts` or feature-specific files; export named schemas.
- Derive types via `z.infer<typeof Schema>`; avoid duplicating interfaces/types.
- Validate all external boundaries: network responses, persisted storage, env vars, URL params.

## Casting

- Never use TypeScript casts unless absolutely necessary.
- If a cast is unavoidable, isolate it, document why, and keep it narrow (never `any`). Prefer `satisfies` and type guards instead.

Bad:

```ts
const data = (await res.json()) as Player[];
```

Good:

```ts
const data = Players.parse(await res.json());
```

## useEffect

- Do not use `useEffect` for derived state, data fetching, or pure computations.
- Only use `useEffect` when syncing with something external to React (subscriptions, DOM APIs, storage, URL/location, timers, imperative focus/measure).
- Prefer event handlers, derived values, and React Query for data lifecycles.

## Additional Conventions

- Keep utilities and schemas in `src/lib/*`; prefer named exports.
- Prefer `satisfies` to enforce object shapes without widening:

```ts
const columns = [
  /* ... */
] as const satisfies ReadonlyArray<ColumnDef<Row>>;
```

- Keep Tailwind classes readable and grouped logically; extend via component props rather than ad-hoc class names.
- Organize tests next to source as `*.test.ts` using Vitest.

## Data Sources

- Position tables **MUST** use their own shard files, not derive from ALL:
  - QB → `QB-combined-aggregate.json`
  - RB → `RB-combined-aggregate.json`
  - WR → `WR-combined-aggregate.json`
  - TE → `TE-combined-aggregate.json`
  - K → `K-combined-aggregate.json`
  - DEF → `DEF-combined-aggregate.json`
  - FLEX → `FLEX-combined-aggregate.json`
  - ALL → `ALL-combined-aggregate.json`

## Checklist (PR Review)

- Uses shadcn components; no bespoke primitives without reason.
- Forms use react-hook-form with shadcn wrappers and Zod resolver.
- All async calls use React Query with typed keys and Zod-validated results.
- Position tables use their own shard files (not derived from ALL data).
- No unnecessary casts; any required cast is isolated and justified.
- No `useEffect` unless syncing external systems.
- [2026-06-30] Corepack cache sandbox: Running pnpm can fail in the sandbox because Corepack tries to create `$HOME/.cache/node/corepack/...`. When a pnpm command fails with Corepack EPERM, rerun the same command with escalation rather than debugging project dependencies.
- [2026-06-30] Playwright output and Next dev watcher: Running Playwright with default output under `test-results` while `next dev` watches the repo can trigger repeated recompiles and flaky navigation checks. For focused browser verification, prefer `pnpm run build` plus `pnpm run start`, or pass Playwright `--output=/private/tmp/...`.
- [2026-06-30] Sleeper draft API cache: Live draft detail and picks endpoints can return stale pre-draft data through Cloudflare (`s-maxage`, `stale-while-revalidate`). When testing or implementing live draft polling, cache-bust the URL and use `cache: "no-store"` before assuming the assistant selected the wrong draft.
- [2026-06-30] Sleeper draft tab recovery: If a live Sleeper draft page freezes or Chrome reports the page is unresponsive, kill/reopen that exact draft URL instead of fighting the frozen tab. For live draft testing, keep the draft URL handy and resume from the reopened tab.
- [2026-06-30] Sleeper mock auto-pick: After starting or resuming a Sleeper mock, click the pink `TURN OFF AUTO-PICK` banner before any clock-sensitive research. Clicking the `AUTO` badge over the team avatar is not a reliable substitute.
- [2026-07-02] Sleeper start confirmation hang: Starting a Sleeper mock can open a confirmation dialog that causes Chrome control to hang/reset after accepting it, even after fresh-tab recovery. When this happens, stop and ask the user to manually start and pause the draft, then continue only after the live room is visible and auto-pick is confirmed off.
- [2026-06-30] Sleeper row drafting: Use the purple queue icon to queue acceptable candidates before the turn, then double-click the left row action on the clock to draft. A single click may only focus/change the row state.
- [2026-06-30] Chrome live-draft control: Computer Use can report `cgWindowNotFound` when Chrome is not visible or the Mac is locked, and this Chrome profile has JavaScript-from-Apple-Events disabled. During live Sleeper drafts, keep Chrome visible/unlocked or ask the user to unlock before continuing.
- [2026-06-30] Chrome plugin CDP fallback: The Chrome plugin can claim an existing Sleeper draft tab and exposes a tab-scoped `cdp` capability even when `$HOME/.agents/skills/chrome-cdp/scripts/cdp.mjs list` cannot connect to a DevToolsActivePort file. For live draft control, try the Chrome plugin first and filter `browser.user.openTabs()` to Sleeper/local draft URLs before claiming a tab.
- [2026-06-30] FantasyPros projection fencing: FantasyPros projection pages can show full 2026 tables in the user's Chrome session while unauthenticated scheduled fetches receive short registration-fenced responses. When refreshing FP data, trust draft ECR first, keep projections optional/quality-gated, and do not overwrite raw projection cache with short row counts.
- [2026-06-30] FantasyPros cookie env: The FP fetch helpers support `FP_COOKIE`/`FANTASYPROS_COOKIE` for session-backed projection scraping. Use env vars or secret stores only, never commit cookies, and verify row counts for every position/scoring before marking projections current.
- [2026-06-30] Tiers local generation: Upstream `borisachen/fftiers` builds tiers from FantasyPros data with R `mclust`, while the old public S3 CSVs can lag the new season. For seasonal refreshes, run `pnpm run fetch:fp` before `pnpm run fetch:tiers`; use `pnpm run fetch:borischen:remote` only for manual comparison.
- [2026-06-30] Rating history DB: Local rating history uses Drizzle with libSQL/SQLite and defaults to ignored `data/fantasy-history.db`. When testing source history or bye-week/drop behavior, run `pnpm run history:migrate` then `pnpm run history:ingest:aggregates`; repeated identical ingests should add `source_runs` but no `player_rating_versions`. Use `FANTASY_HISTORY_DATABASE_URL` and optional `FANTASY_HISTORY_DATABASE_AUTH_TOKEN` for Turso later.
- [2026-06-30] tsx sandbox IPC: `npx tsx ...` can fail in Codex sandbox with `listen EPERM ... /T/tsx-501/*.pipe`, while `node --import=tsx ...` works for the same script. Prefer `node --import=tsx` in package scripts and rerun older `npx tsx` commands with escalation if needed.
- [2026-06-30] FantasyPros expert metadata: Raw FP ECR payloads include `filters`, `total_experts`, and `experts_available.included/excluded` expert IDs. Preserve these in source metadata so early-week thin expert samples can be flagged without first scraping expert names.
- [2026-06-30] Draft data GitHub Action: The scheduled `fetch-data` workflow must set `DRAFT=true`; otherwise `pnpm run fetch:fp` runs weekly ECR mode and will not refresh season-long draft assistant ratings. Keep `FP_FETCH_PROJECTIONS=false` unless intentionally testing cookie-backed projections, and run rating-history ingest in Actions only when a persistent libSQL/Turso URL secret exists.
- [2026-06-30] tsx eval import quirk: `node --import=tsx -e` can expose local TS module named exports under `default`/`module.exports` even though the same module imports normally from a script file. When one-off probing a local TS module with `-e`, use `const mod = await import("./path")` and read `mod.default` if named imports appear missing.
- [2026-06-30] Playwright screenshot sandbox: `pnpm exec playwright screenshot ...` can fail in the Codex sandbox on this Mac with `MachPortRendezvousServer ... Permission denied`. When browser screenshots are needed for local UI verification, rerun the same Playwright command with sandbox escalation instead of changing app code.
- [2026-06-30] Sleeper player news: Sleeper docs do not list a REST player-news endpoint, but the current Sleeper web bundle calls GraphQL `get_player_news` at `https://api.sleeper.app/graphql` with `X-Sleeper-GraphQL-Op: get_player_news`. For click-to-fetch draft research, use this on demand by player id and avoid bulk-fetching news for every player.
- [2026-06-30] Chrome screenshots for draft UI: When validating draft-assistant UI in Chrome, save screenshots to `/private/tmp/fantasy-tiers-screenshots` and include them in the final response with Markdown image links. The Chrome Playwright wrapper may not support `networkidle`, so wait for a concrete element such as `[data-testid="decision-board"]` instead.
- [2026-06-30] Sleeper filtered-row drafting: In a one-player filtered Sleeper search result, the row action can move higher than in the normal table. When drafting from search, inspect the screenshot and double-click the visible left `+`; do not reuse a fixed y-coordinate from a previous table state.
- [2026-06-30] Sleeper pause verification: The commish pause click can miss or leave the menu open while the draft keeps running. Before terminal research, verify the top paused banner or cache-busted `/v1/draft/<draft-id>` status; if it still says `drafting`, make the pick immediately or pause again.
- [2026-06-30] Next dev port argument: `pnpm run dev -- -p <port>` passes `-p` to Next as a project directory in this repo. When starting a dev server on a custom port, use `pnpm exec next dev -p <port>` instead.
- [2026-06-30] Mock draft start guard: The `/mock-draft` setup form can render before React Query finishes the aggregate bundle. Keep Start disabled until the simulated player pool is non-empty; otherwise the simulator may throw `No players are available for the simulated pick` from a stale empty array.
- [2026-07-01] Mock draft schema boundary: Simulated Sleeper details and picks must parse through the same Zod schemas as live fetchers (`DraftDetailsSchema`, `DraftPicksSchema`). When changing Sleeper draft shapes, update shared schemas first and keep mock adapters on those schemas so mock and real draft paths drift together.
- [2026-07-01] Footballguys Rate My Team shortcut: Player IDs can be resolved with `GET /staff/players/autocomplete?term=...`, and manual rosters validate with multipart `POST /rate-my-team/validate-manual-entry`. When using Footballguys for mock-draft evaluation, use those endpoints and the hidden `roster-players[]`/`teamRoster` fields instead of clicking every typeahead row.
- [2026-07-01] Footballguys authenticated reports: Logged-in Rate My Team report fragments include the full `#breakdown`, `#by-position`, and `#game-plan` sections, while anonymous fragments are server-gated to `#overview`. Keep `FBG_COOKIE` only in ignored local env such as `data/footballguys-session.env`, then use `pnpm run fbg:rate-team -- --existing` or a request JSON for another draft.
- [2026-07-01] Mock draft result artifacts: Store generated mock draft runs and external analyzer reports under ignored `data/draft-results/<run>/`. When reviewing a draft later, keep `draft-result.json`, analyzer HTML, and analyzer summary JSON in the same run directory instead of committing or scattering generated outputs.
- [2026-07-01] Footballguys team defense autocomplete: Bare team names like `seattle seahawks` resolve to PK/QB/TD units, and the first result can be PK. When generating analyzer requests, include player position and prefer `(TD, ...)` for `DEF` and `(PK, ...)` for `K`.
- [2026-07-01] Footballguys ID cache: Seed ignored `data/footballguys-player-ids.json` from `mayscopeland/ffb_ids` with `pnpm run fbg:seed-player-ids` before batch reports. The analyzer resolves by Sleeper ID first, then falls back to Footballguys autocomplete and writes discovered IDs back into the cache.
- [2026-07-01] Draft assistant evaluation bar: Mock bots should be adequate enough to create real pressure, and the assistant should help the user consistently beat them from any draft slot, ideally with an `A-` or better external analyzer grade. After all-team reports, run `pnpm run draft:retrospective -- --result-dir data/draft-results/<run>` to turn pick-level misses/waits into Decision Board improvements.
- [2026-07-01] Mock K/DEF player pool: The mock simulator can render K/DEF rows from position shards that are not draftable if the simulator pool is built only from the ALL shard slice. When a visible position-table Pick button does nothing, verify the player is in `bundleToSimPlayers`; keep top K/DEF shard rows included so final roster slots can be drafted.
- [2026-07-01] Draft recommendation views: Do not collapse draft advice into one blended best-available list. Show/compare best overall, by-position, and FLEX pools separately; treat post-starter QB/TE value spikes as soft review signals that need a clear reason, not as automatic backup-QB/TE recommendations.
- [2026-07-01] Mock draft UI parity: The local mock room is only useful for live-draft practice if it reuses the same draft-assistant pick surface the user already trusts. Keep simulator controls and board separate, but render the shared assistant components for pick review; avoid custom mini decision boards that change the workflow being tested.
- [2026-07-01] Source-health relevance denominator: Sleeper aggregate rows include thousands of historical/fringe `ADP 999` players that will never be drafted. When adding source coverage checks, use a draft-relevant denominator such as real ADP, FantasyPros coverage, active scoring tiers, or visible draft-board rows; label the coverage basis and do not warn on full-universe gaps alone.
- [2026-07-01] Restored UI draft result: The original draft-assistant pick surface in `/mock-draft` scored `A+` from slot 5 in Footballguys, but WR starters graded `C` after an RB-heavy early build. When improving strategy, keep RB/WR starter balance visible alongside best-overall value instead of optimizing a single blended list.
- [2026-07-01] Compact table sorting: Position cards show a compact top-N slice, so sortable headers must sort the full eligible position pool before applying the row limit. If sorting only reorders the visible slice, `VAL`/`DV` sorting is misleading during draft-clock decisions.
- [2026-07-01] TapThatDraft research notes: Subvertadown's TapThatDraft docs are summarized in `docs/tapthatdraft-research-notes.md`. When improving the draft assistant, compare proposed recommendation math and UI changes against its reference-list, Snake Value, ranking-calibration, compact delta-ADP, and target/avoid-marker ideas.
- [2026-07-01] Chrome draft UI recovery: The Chrome extension can become unavailable after a Node REPL timeout/reset, and standalone CDP may still fail if Chrome lacks a debugging target. When the live page cannot be reclaimed, rerun the same `/mock-draft` slot and seed through the rendered UI with Playwright launching Google Chrome, save the artifact, and clearly document that recovery path in the iteration notes.
- [2026-07-01] Draft comeback pick boundary: The status card needs the inclusive next user pick so it can show `0 picks till your turn` while the user is on the clock, but `Back?` odds must use the next user pick after the current pick resolves. When changing comeback math, test the current-pick-equals-user-slot case, e.g. slot 5 at pick 1.05 should evaluate return odds against pick 2.06, not 1.05.
- [2026-07-01] Footballguys analyzer prose: Rate My Team reports can recommend backup QB/TE or impossible free-agent upgrades even when the no-backup strategy produces `A`/`A+` grades. When tuning the draft algorithm, use repeated overall grades, position grades, playoff-chance signals, and pick logs instead of treating every prose recommendation as a draft rule.
- [2026-07-01] Playwright base URL for mock UI: `e2e.config.ts` is pinned to `http://localhost:3000`, so focused screenshots against a temporary port need either a small absolute-URL Playwright script or a temporary config override. When verifying `/mock-draft` on another port, wait for `[data-testid="mock-start"]` to become enabled before clicking because aggregate loading gates the simulator pool.
- [2026-07-02] Footballguys cookie refresh: Scripted Rate My Team requests can fail while the logged-in Chrome UI still works if ignored `data/footballguys-session.env` is stale. Refresh `FBG_COOKIE`/`FBG_USER_AGENT` from the current Chrome Footballguys tab, keep a local ignored backup, and verify with one read-only report-fragment fetch before running batch analyzer jobs.
- [2026-07-02] QB floor tuning: Late-QB deadline bonuses can turn bad QBs into false recommendations if they ignore player quality. When tuning 1QB draft scoring, keep QB timing separate from a usable-starter floor and flag negative-value or deep positional-rank QBs before spending Footballguys analyzer requests.
- [2026-07-02] TE quality gate: A draft can satisfy "TE by round 7" and still grade poorly if the starter is from the Warren/Pitts/Goedert tier. When tuning draft strategy, track TE starter value/rank separately from TE timing, and treat Bowers/McBride round-3 misses differently from drafts where elite TE was already gone.
- [2026-07-02] Footballguys batch grading collision: Fast sequential Rate My Team grading works with a fresh cookie, but parallel report creation can collide on Footballguys league/report slugs and poison one slot with repeated 400 report-fragment errors. When batch grading, prefer one-at-a-time requests with a small delay; if one slot is stuck, regenerate only that request with unique `leagueName`/`teamName` and save it as a retry artifact.
- [2026-07-02] Draft ECR-only value: Draft assistant `VAL` should require FantasyPros ECR average (`rank_ave`) plus tier/position-rank context, not FantasyPros or Sleeper projected points. When working on draft scoring or source health, do not reintroduce fallback scoring from `rank_ecr`, `fp_value`, projections, BEER/VORP/VOLS, or aggregate `val`; missing `rank_ave` should surface as missing draft data. Projections belong to league-manager or optional context.
- [2026-07-02] Broken mock rosters are algorithm bugs: Do not rely on the Footballguys analyzer to skip malformed lineups. The draft algorithm and local quality gates should produce complete 1QB/1TE/1K/1DEF rosters with starter and FLEX coverage before grading; if a saved result is broken, tune the algorithm/tests first, then grade normally.
- [2026-07-02] RB anchor tuning: Slot-5 standard mocks can pass roster-count gates but grade poorly if the assistant starts WR/WR/TE or waits too long on RB. When a draft opens WR, prefer a close RB anchor in round 2 or 3 before adding another WR/TE unless the value gap is truly decisive, then validate with a saved UI mock plus one sequential Footballguys grade.
- [2026-07-02] No player-specific draft tuning: Mock artifacts and Footballguys reports may name players, but algorithm changes must not branch on specific player names or IDs. Convert lessons into generic score components such as position value, roster needs, league demand, tier timing, ADP timing, quality floors, and RB/WR balance.
- [2026-07-02] Footballguys request throttle: Several paced 10-slot grading batches in one session can still return `400 Too many report generation requests` on report fragments. When this appears, stop external grading, keep the saved request/error artifacts, continue with local mock analysis, and wait before retrying individual missing slots.
- [2026-07-02] Algo mock analyzer delay: `draft:algo-mocks --analyze-delay-ms` must delay between outer mock-run analyzer calls, not only inside `analyze-draft-result`, because normal user-team grading passes one slot per subprocess. If Footballguys throttles unexpectedly, verify the runner sleeps between slots before increasing the delay.
- [2026-07-02] Draft tier semantics: The ALL shard tier is an overall draft-board tier, while position shards carry position tiers; a player can be QB/TE tier 1 by position and tier 4+ overall. When scoring elite QB/TE windows, pass an explicit position-tier field from position shards instead of reading the combined-board tier.
- [2026-07-10] Canonical draft board: Live UI, mock UI, algorithm scripts, saved artifacts, and `/api/draft/view-model` must build from `DraftCandidateSchema` and consume the same `recommendationBoard`. Do not reconstruct or rescore reduced player shapes in individual surfaces.
- [2026-07-10] Missing ECR eligibility: Players without FantasyPros `rank_ave` remain visible for diagnostics but are not eligible for recommendation. Never convert missing ECR to zero and then let roster-policy bonuses select the player.
- [2026-07-10] Live draft build freshness: Port `3006` may be serving a production build that does not hot-reload scoring changes. During a paused Sleeper validation, rebuild and restart the server, reload the assistant, and verify the recommendation changed before resuming the clock.
- [2026-07-10] Bounded Sleeper automation: A full 15-round Chrome-control call can exceed the five-minute tool timeout. Run at most about eight rounds per control segment, keep Sleeper paused at each user turn, and recover from the cache-busted pick count plus the exact draft URL if control resets.
- [2026-07-10] Sleeper live-turn authority: During a live mock, use cache-busted `GET /v1/draft/<id>` plus `GET /v1/draft/<id>/picks` as the source of truth. `picks.length + 1` is the active pick; derive its snake-order slot from team count and pause only when it equals the user's slot. Do not pause during bot picks or infer the active turn from board color alone.
- [2026-07-10] Pre-draft freshness gate: Draft recommendations can materially change within days because FantasyPros ECR and Sleeper ADP react to player news. Before a live evaluation draft, run `DRAFT=true FP_FETCH_PROJECTIONS=false pnpm run fetch:all`, then `pnpm run agg:all`, `pnpm run validate:aggregates`, and `pnpm run validate:aggregates:ci`; verify current source timestamps and expert counts before starting Sleeper.
- [2026-07-10] Sleeper start order: Sleeper can force auto-pick on when a mock starts, and browser-control debugging can consume the first user clock. Immediately pause after accepting `START DRAFT`, verify the paused banner, turn off auto-pick, verify it is off, and only then inspect recommendations. If the user's pick arrives before both states are verified, stop the draft as a failed test.
- [2026-07-11] Footballguys rankings transport: The rankings page reloads an HTML component from `/rankings` with explicit league and `adpSource` query parameters; it is not a JSON API. The full table currently works without cookies or `userId`. Parse and validate the HTML, retain the request settings, and track rank coverage separately from ADP coverage because listed providers can return zero ADP values.
- [2026-07-11] Sleeper board import: Complete live Sleeper pick arrays include player name, position, and team under each pick's `metadata`. Use `pnpm run draft:import-sleeper -- --input <result-dir>/sleeper-picks.json`; it validates picks with the shared live `DraftPicksSchema` and writes the canonical ignored `draft-result.json` for replay and analysis.
- [2026-07-11] Footballguys membership boundary: An authenticated non-member can use Rate My Team reports, but custom rankings return a 15-row `data-roadblocked="1"` fragment. Ingest only the complete public-default 12-team PPR rankings, label their settings, and never imply they are customized to the active league.
- [2026-07-11] Sleeper strategy replay: `pnpm run draft:evaluate-sleeper-strategies` ranks every actual pick using only prior board state and a fixed holdout split. Count picks excluded by a strategy's hard filter as misses rather than dropping them, or the strict strategy's metrics will be biased upward.
- [2026-07-11] Footballguys experiment pacing: Use `pnpm run fbg:run-experiment -- --manifest <file>` for synthetic roster comparisons. Manifests require at least 15 seconds between cases; the runner creates unique report names, persists each result immediately, and skips completed cases on resume.
- [2026-07-11] Mock artifact ranking fields: `SimDraftPlayer` must preserve FantasyPros ECR/position rank/tier and Footballguys diagnostic ranks from the aggregate bundle. Retrospective tooling reads saved rosters, so dropping these fields silently turns ECR features into sentinel values and makes historical grade analysis misleading.
- [2026-07-11] Sleeper authenticated draft actions: The loaded Sleeper web bundle exposes authenticated GraphQL actions for `update_draft_status`, `remove_user_from_autopick`, and `draft_pick_player` at same-origin `/graphql`. When the start dialog freezes Chrome, invoke the logged-in page's own action module without reading cookies, then verify every state transition through cache-busted public REST. Keep control segments short because long page actions may continue after browser control stops returning.
- [2026-07-11] Sleeper one-turn control loop: The reliable live validation loop is one bounded browser action per user turn: resume, derive the active snake slot from cache-busted `picks.length + 1`, pause only on the user's slot, read `/api/draft/view-model`, submit the top recommendation, and verify that exact REST pick. Use a timeout that pauses before throwing; this completed three consecutive 15-round mocks without auto-pick or unbounded browser calls.
- [2026-07-13] Turso provisioning safety: This app owns the dedicated `fantasy-tiers` group and `fantasy-tiers-history` database. Never put its database in `default` or reuse another group's credentials. Give GitHub Actions a group-scoped write token and Vercel a separate group-scoped read-only token; use a fail-fast shell and verify every generated value before writing a secret.
- [2026-07-13] Vercel sensitive env verification: `vercel env ls` confirms sensitive variables exist, but `vercel env pull` can return empty values for them. Do not treat an empty pulled sensitive value as proof the stored secret is empty; verify the credential through `/api/health/data` after a deployment instead.
- [2026-07-14] Draft value normalization: Absolute clipping flattened the best available players to the same `100` ECR-value component, allowing tiny timing bonuses to rank a lower-overall-tier player first. Anchor the best available static value at `100` and preserve each player's relative gap; keep tiers as scarcity and cliff context rather than a substitute for the ECR value difference.
