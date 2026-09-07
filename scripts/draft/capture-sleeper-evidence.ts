import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { buildAggregateBundle } from "../../src/lib/aggregateBundle";
import { draftCandidateMapFromBundle } from "../../src/lib/draftCandidate";
import { DraftDetailsSchema } from "../../src/lib/draftDetails";
import { draftLeagueConfigFromSleeperDraft, SleeperDraftLeagueConfigSchema } from "../../src/lib/draftLeagueConfig";
import { draftReadinessShardCountsFromBundle } from "../../src/lib/draftReadiness";
import { buildDraftViewModel } from "../../src/lib/draftState";
import { getNextPickForSlot } from "../../src/lib/draftValue";
import { DraftPicksSchema } from "../../src/lib/schemas";
import { AggregatesBundleResponse } from "../../src/lib/schemas-bundle";
import { bundleToSimPlayers, getDraftSlotForPick } from "../../src/lib/simDraft";
import { predictAvailability } from "./availability-model";

const ManifestSchema = z.object({
  draftId: z.string(), userId: z.string(), createdAt: z.string().datetime(),
  bundleHash: z.string(), codeHash: z.string(),
  leagueConfig: SleeperDraftLeagueConfigSchema,
});
const TurnSchema = z.object({
  capturedAt: z.string().datetime(), pickNo: z.number().int(), nextPick: z.number().int().nullable(),
  selectedId: z.string(), bundleHash: z.string(), codeHash: z.string(),
  picks: DraftPicksSchema,
  rows: z.array(z.object({
    playerId: z.string(), position: z.string(), current: z.number().min(0).max(1),
    platform: z.number().min(0).max(1), roster: z.number().min(0).max(1),
  })),
});
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
async function readJson(path: string): Promise<unknown> { return JSON.parse(await readFile(path, "utf8")); }
async function save(path: string, value: unknown) {
  await writeFile(path, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
}
async function live(draftId: string) {
  const get = async (suffix: string): Promise<unknown> => {
    const response = await fetch(`https://api.sleeper.app/v1/draft/${encodeURIComponent(draftId)}${suffix}?_=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Sleeper ${response.status}`);
    return response.json();
  };
  const [rawDraft, rawPicks] = await Promise.all([get(""), get("/picks")]);
  return { rawDraft, rawPicks, draft: DraftDetailsSchema.parse(rawDraft), picks: DraftPicksSchema.parse(rawPicks) };
}
async function codeHash() {
  const paths = execFileSync("rg", ["--files", "src/lib", "scripts/draft"], { encoding: "utf8" })
    .trim().split("\n").filter((path) => path.endsWith(".ts") && !path.endsWith(".test.ts")).sort();
  return hash((await Promise.all(paths.map(async (path) => `${path}\n${await readFile(path, "utf8")}`))).join("\n"));
}

async function main() {
  const [mode, directory, draftId, userId] = process.argv.slice(2);
  if (!directory || !["init", "turn", "finish"].includes(mode ?? "")) throw new Error("Usage: capture-sleeper-evidence.ts init DIR DRAFT_ID USER_ID | turn DIR | finish DIR");
  await mkdir(directory, { recursive: true });
  if (mode === "init") {
    if (!draftId || !userId) throw new Error("Draft and user IDs are required.");
    const state = await live(draftId);
    if (state.picks.length || state.draft.status !== "pre_draft") throw new Error("Freeze inputs before the draft starts.");
    if (state.draft.league_id || state.draft.metadata.league_id) throw new Error("This collector is for standalone mocks only.");
    const leagueConfig = draftLeagueConfigFromSleeperDraft(state.draft, userId);
    if (!leagueConfig.userSlot || leagueConfig.draftType !== "snake") throw new Error("Claim a snake draft slot first.");
    const bundle = buildAggregateBundle({ scoring: leagueConfig.scoring, teams: leagueConfig.teams, rosterSlots: leagueConfig.rosterSlots });
    const bundleText = JSON.stringify(bundle);
    await writeFile(join(directory, "bundle.json"), bundleText, { flag: "wx" });
    await save(join(directory, "initial-state.json"), state);
    const manifest = ManifestSchema.parse({ draftId, userId, leagueConfig, createdAt: new Date().toISOString(), bundleHash: hash(bundleText), codeHash: await codeHash() });
    await save(join(directory, "manifest.json"), manifest);
    console.log(JSON.stringify(manifest));
    return;
  }
  const manifest = ManifestSchema.parse(await readJson(join(directory, "manifest.json")));
  const bundleText = await readFile(join(directory, "bundle.json"), "utf8");
  if (hash(bundleText) !== manifest.bundleHash || await codeHash() !== manifest.codeHash) throw new Error("Frozen inputs or code changed.");
  const bundle = AggregatesBundleResponse.parse(JSON.parse(bundleText));
  const state = await live(manifest.draftId);
  const config = draftLeagueConfigFromSleeperDraft(state.draft, manifest.userId);
  if (JSON.stringify(config) !== JSON.stringify(manifest.leagueConfig)) throw new Error("Draft settings changed.");
  if (mode === "finish") {
    if (state.draft.status !== "complete" || state.picks.length !== config.teams * config.rounds) throw new Error("A complete board is required.");
    const files = (await readdir(directory)).filter((name) => /^turn-\d+\.json$/.test(name)).sort();
    const turns = await Promise.all(files.map(async (name) => TurnSchema.parse(await readJson(join(directory, name)))));
    if (turns.length !== config.rounds) throw new Error("Every own pick needs a pre-pick capture.");
    const ownPicks = state.picks.filter((pick) => pick.draft_slot === config.userSlot);
    if (turns.some((turn, index) => turn.pickNo !== ownPicks[index]?.pick_no ||
        (index > 0 && Date.parse(turn.capturedAt) <= Date.parse(turns[index - 1]!.capturedAt)))) {
      throw new Error("Captures must cover each own pick once, in time order.");
    }
    const rows = [];
    for (const turn of turns) {
      if (turn.bundleHash !== manifest.bundleHash || turn.codeHash !== manifest.codeHash ||
          JSON.stringify(state.picks.slice(0, turn.pickNo - 1)) !== JSON.stringify(turn.picks) ||
          state.picks[turn.pickNo - 1]?.player_id !== turn.selectedId) throw new Error("Saved prediction and actual draft differ.");
      if (turn.nextPick == null) continue;
      const gone = new Set(state.picks.filter((pick) => pick.pick_no > turn.pickNo && pick.pick_no < turn.nextPick!).map((pick) => pick.player_id));
      for (const row of turn.rows) rows.push({ ...row, board: manifest.draftId, slot: config.userSlot, pickNo: turn.pickNo,
        round: Math.ceil(turn.pickNo / config.teams), distance: turn.nextPick - turn.pickNo - 1, observed: Number(!gone.has(row.playerId)) });
    }
    await save(join(directory, "completed-state.json"), state);
    await save(join(directory, "predictions.json"), { method: "Prospective Sleeper mock predictions; fixed top-12 market players per position, excluding our selected player. These are Sleeper bots, not human managers. Mock scoring is recorded in the manifest.", samples: 128, inputs: [manifest], rows });
    console.log(JSON.stringify({ complete: true, decisions: turns.length, observations: rows.length }));
    return;
  }
  const pickNo = state.picks.length + 1;
  if (state.draft.status !== "paused" || getDraftSlotForPick(pickNo, config.teams, "snake") !== config.userSlot) throw new Error("Pause at our current pick before capture.");
  const viewModel = buildDraftViewModel({
    draft: state.draft, picks: state.picks, userId: manifest.userId, playersMap: draftCandidateMapFromBundle(bundle),
    scoringRules: config.scoringRules, projectionArtifact: bundle.draftProjections,
    sourceHealth: bundle.sourceHealth ?? null, shardCounts: draftReadinessShardCountsFromBundle(bundle),
  });
  const board = viewModel.recommendationBoard;
  if (viewModel.readiness?.status !== "ready" || !board?.topRecommendation) throw new Error(`Draft data not ready: ${JSON.stringify(viewModel.readiness)}`);
  const selectedId = board.topRecommendation.player.player_id;
  const nextPick = getNextPickForSlot({ currentPick: pickNo + 1, userSlot: config.userSlot, teams: config.teams, rounds: config.rounds, draftType: "snake" });
  const players = bundleToSimPlayers(bundle);
  const picked = new Set(state.picks.map((pick) => pick.player_id));
  const cohort = ["QB", "RB", "WR", "TE", "DEF"].flatMap((position) => players.filter((player) =>
    player.position === position && !picked.has(player.player_id) && player.player_id !== selectedId &&
    board.metricsByPlayerId[player.player_id]?.comebackProbability != null)
    .sort((a, b) => (a.sleeperAdp ?? a.sleeperRank ?? 9999) - (b.sleeperAdp ?? b.sleeperRank ?? 9999)).slice(0, 12));
  const probabilities = nextPick == null ? {} : predictAvailability({ draft: state.draft, picks: state.picks,
    selectedId, nextPick, players, candidateIds: cohort.map((player) => player.player_id), samples: 128, seed: manifest.draftId });
  const capture = { capturedAt: new Date().toISOString(), pickNo, nextPick, selectedId, bundleHash: manifest.bundleHash,
    codeHash: manifest.codeHash, ...state, viewModel,
    rows: nextPick == null ? [] : cohort.map((player) => ({ playerId: player.player_id, position: player.position,
      current: board.metricsByPlayerId[player.player_id]!.comebackProbability, ...probabilities[player.player_id] })),
  };
  TurnSchema.parse(capture);
  // A second public read rejects a moving board before the capture is committed.
  const confirmed = await live(manifest.draftId);
  if (confirmed.draft.status !== "paused" || JSON.stringify(confirmed.picks) !== JSON.stringify(state.picks)) throw new Error("Draft moved during capture.");
  await save(join(directory, `turn-${String(pickNo).padStart(3, "0")}.json`), capture);
  console.log(JSON.stringify({ pickNo, nextPick, selectedId, name: board.topRecommendation.player.name, predictions: capture.rows.length }));
}
void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
