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
import { buildDraftChoices } from "../../src/lib/draftChoices";
import { DraftPicksSchema } from "../../src/lib/schemas";
import { AggregatesBundleResponse } from "../../src/lib/schemas-bundle";
import { MarketPoolSchema, marketForecast, snakeSlot, summarizeMarketGroup } from "./market-only-model";
import { ProspectiveBoundarySchema, verifyProspectiveBoundary } from "./prospective-integrity";

const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const json = async (p: string): Promise<unknown> => JSON.parse(await readFile(p, "utf8"));
const save = async (p: string, value: unknown) => writeFile(p, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
const FreezeSchema = z.object({ createdAt: z.string().datetime(), codeHash: z.string(), poolHash: z.string(), bundleHash: z.string(), protocolHash: z.string() });
const ManifestSchema = z.object({ draftId: z.string(), userId: z.string(), createdAt: z.string().datetime(), config: SleeperDraftLeagueConfigSchema, freeze: FreezeSchema });
const RowSchema = z.object({ playerId: z.string(), position: z.string(), marketRank: z.number(), broad: z.boolean(), decision: z.boolean(), candidate: z.number(), current: z.number().nullable() });
const GroupSchema = z.object({ position: z.string(), ids: z.array(z.string()), atLeastOne: z.number(), expectedRemaining: z.number(), remainingRange: z.array(z.number()), bestRemainingValRange: z.array(z.number()).nullable() });
const TurnSchema = ProspectiveBoundarySchema.extend({ rows: z.array(RowSchema), groups: z.array(GroupSchema), codeHash: z.string(), poolHash: z.string(), bundleHash: z.string(), expectedPositionPicks: z.record(z.string(), z.number()) });

async function codeHash() {
  const paths = execFileSync("rg", ["--files", "src/lib", "scripts/draft"], { encoding: "utf8" }).trim().split("\n").filter((p) => /\.(ts|py)$/.test(p) && !p.endsWith(".test.ts")).sort();
  return hash((await Promise.all(paths.map(async (p) => `${p}\n${await readFile(p, "utf8")}`))).join("\n"));
}
export async function liveMarketDraft(id: string) {
  const get = async (suffix: string): Promise<unknown> => {
    const response = await fetch(`https://api.sleeper.app/v1/draft/${encodeURIComponent(id)}${suffix}?_=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Sleeper ${response.status}`);
    return response.json();
  };
  const [rawDraft, rawPicks] = await Promise.all([get(""), get("/picks")]);
  const draft = DraftDetailsSchema.parse(rawDraft), picks = DraftPicksSchema.parse(rawPicks);
  if (picks.some((p, i) => p.pick_no !== i + 1)) throw new Error("Sleeper prefix is not contiguous.");
  return { draft, picks, rawDraft, rawPicks };
}

export async function runMarketCapture(mode: string, root: string, draftId?: string, userId?: string, selectedId?: string) {
  await mkdir(root, { recursive: true });
  if (mode === "freeze") {
    const players = z.object({ data: z.record(z.string(), z.object({ full_name: z.string().nullable().optional(), first_name: z.string().nullable().optional(), last_name: z.string().nullable().optional(), fantasy_positions: z.array(z.string()).nullable().optional(), position: z.string().nullable().optional() })) }).parse(await json(join(root, "players-source.json")));
    const market = z.object({ data: z.record(z.string(), z.number().finite()) }).parse(await json(join(root, "market-source.json")));
    const pool = MarketPoolSchema.parse(Object.entries(players.data).flatMap(([id, p]) => {
      const pos = (p.fantasy_positions ?? [p.position]).find((v) => ["QB", "RB", "WR", "TE", "DEF"].includes(v ?? ""));
      return pos ? [{ id, name: p.full_name ?? ([p.first_name, p.last_name].filter(Boolean).join(" ") || id), position: pos, value: market.data[id] ?? 0 }] : [];
    }).sort((a, b) => b.value - a.value || a.id.localeCompare(b.id)).map((p, i) => ({ ...p, rank: i + 1 })));
    const bundle = buildAggregateBundle({ scoring: "ppr", teams: 12, rosterSlots: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2, K: 0, DEF: 1, BENCH: 5 } });
    const poolText = JSON.stringify(pool), bundleText = JSON.stringify(bundle);
    await writeFile(join(root, "pool.json"), poolText, { flag: "wx" });
    await writeFile(join(root, "bundle.json"), bundleText, { flag: "wx" });
    const freeze = { createdAt: new Date().toISOString(), codeHash: await codeHash(), poolHash: hash(poolText), bundleHash: hash(bundleText), protocolHash: hash(await readFile("docs/market-only-prospective-protocol.md", "utf8")) };
    await save(join(root, "freeze.json"), freeze);
    return { ...freeze, players: pool.length };
  }
  const freeze = FreezeSchema.parse(await json(join(root, "freeze.json")));
  const poolText = await readFile(join(root, "pool.json"), "utf8"), bundleText = await readFile(join(root, "bundle.json"), "utf8");
  if (freeze.codeHash !== await codeHash() || freeze.poolHash !== hash(poolText) || freeze.bundleHash !== hash(bundleText) || freeze.protocolHash !== hash(await readFile("docs/market-only-prospective-protocol.md", "utf8"))) throw new Error("Frozen candidate, inputs, or protocol changed.");
  const pool = MarketPoolSchema.parse(JSON.parse(poolText));
  const byId = new Map(pool.map((p) => [p.id, p]));
  if (!draftId) throw new Error("Draft ID is required.");
  const directory = join(root, draftId);
  await mkdir(directory, { recursive: true });
  const state = await liveMarketDraft(draftId);
  if (mode === "init") {
    if (!userId || state.picks.length || state.draft.status !== "pre_draft" || state.draft.league_id || state.draft.metadata.league_id) throw new Error("Register a new standalone mock before any picks.");
    const config = draftLeagueConfigFromSleeperDraft(state.draft, userId);
    if (!config.userSlot || config.teams !== 12 || config.rounds !== 14 || config.scoring !== "ppr" || config.draftType !== "snake" || state.draft.settings.slots_flex !== 2 || state.draft.settings.slots_k !== 0 || state.draft.settings.slots_qb !== 1 || state.draft.settings.slots_rb !== 2 || state.draft.settings.slots_wr !== 2 || state.draft.settings.slots_te !== 1 || state.draft.settings.slots_def !== 1 || state.draft.settings.slots_bn !== 5) throw new Error("The board does not match the prospective format.");
    const manifest = { draftId, userId, createdAt: new Date().toISOString(), config, freeze };
    await save(join(directory, "manifest.json"), manifest);
    await save(join(directory, "initial-state.json"), state);
    return manifest;
  }
  const manifest = ManifestSchema.parse(await json(join(directory, "manifest.json")));
  const config = draftLeagueConfigFromSleeperDraft(state.draft, manifest.userId);
  if (JSON.stringify(config) !== JSON.stringify(manifest.config)) throw new Error("Draft settings changed.");
  if (mode === "finish") {
    if (state.draft.status !== "complete" || state.picks.length !== 168) throw new Error("Complete all 168 picks first.");
    const turns = await Promise.all((await readdir(directory)).filter((p) => /^turn-\d+\.json$/.test(p)).sort().map(async (p) => TurnSchema.parse(await json(join(directory, p)))));
    const ownPicks = state.picks.filter((p) => p.draft_slot === config.userSlot);
    if (turns.length !== 13 || turns.some((t, i) => t.picks.length + 1 !== ownPicks[i]?.pick_no || (i > 0 && t.capturedAt <= turns[i - 1]!.confirmedAt))) throw new Error("Need the first 13 prospective own-turn forecasts in time order.");
    const rows = [], groups = [], turnsSummary = [];
    for (const turn of turns) {
      if (turn.codeHash !== freeze.codeHash || turn.poolHash !== freeze.poolHash || turn.bundleHash !== freeze.bundleHash) throw new Error("Capture hash mismatch.");
      const integrity = verifyProspectiveBoundary(turn, state.picks);
      const pickNo = turn.picks.length + 1;
      const intervening = state.picks.filter((p) => p.pick_no > pickNo && p.pick_no < turn.nextOwnPick);
      const gone = new Set(intervening.map((p) => p.player_id));
      const shared = { board: draftId, slot: config.userSlot, pickNo, round: Math.ceil(pickNo / 12), distance: turn.nextOwnPick - pickNo - 1, ...integrity };
      rows.push(...turn.rows.map((r) => ({ ...r, ...shared, observed: Number(!gone.has(r.playerId)) })));
      groups.push(...turn.groups.map((g) => ({ ...g, ...shared, observed: Number(g.ids.some((id) => !gone.has(id))), observedRemaining: g.ids.filter((id) => !gone.has(id)).length })));
      turnsSummary.push({ ...shared, expectedPositionPicks: turn.expectedPositionPicks, observedPositionPicks: Object.fromEntries(["QB", "RB", "WR", "TE", "DEF"].map((pos) => [pos, intervening.filter((p) => byId.get(p.player_id)?.position === pos).length])) });
    }
    await save(join(directory, "completed-state.json"), state);
    const result = { environment: "Sleeper bot mock", manifest, rows, groups, turns: turnsSummary };
    await save(join(directory, "predictions.json"), result);
    return { complete: true, slot: config.userSlot, observations: rows.length, forecasts: turns.length, ownerFollowedDefault: turnsSummary.filter((t) => t.ownerFollowedDefault).length };
  }
  const pickNo = state.picks.length + 1;
  if (state.draft.status !== "paused" || snakeSlot(pickNo, 12) !== config.userSlot) throw new Error("Pause at the actual own turn first.");
  const bundle = AggregatesBundleResponse.parse(JSON.parse(bundleText));
  const view = buildDraftViewModel({ draft: state.draft, picks: state.picks, userId: manifest.userId, playersMap: draftCandidateMapFromBundle(bundle), scoringRules: config.scoringRules, projectionArtifact: bundle.draftProjections, sourceHealth: bundle.sourceHealth ?? null, shardCounts: draftReadinessShardCountsFromBundle(bundle), evaluationNow: new Date(freeze.createdAt) });
  const board = view.recommendationBoard;
  const defaultId = board?.topRecommendation?.player.player_id ?? null;
  const chosen = selectedId ?? defaultId;
  if (!chosen || !pool.some((p) => p.id === chosen) || state.picks.some((p) => p.player_id === chosen)) throw new Error("Specify an available platform player.");
  const nextPick = getNextPickForSlot({ currentPick: pickNo + 1, userSlot: config.userSlot, teams: 12, rounds: 14, draftType: "snake" });
  if (nextPick == null) return { finalPick: true, pickNo, selectedId: chosen, defaultId, name: pool.find((p) => p.id === chosen)!.name };
  const capturedAt = new Date().toISOString();
  const picked = new Set([...state.picks.map((p) => p.player_id), chosen]);
  const available = pool.filter((p) => !picked.has(p.id));
  const positions = ["QB", "RB", "WR", "TE", "DEF"];
  const broadIds = new Set(positions.flatMap((pos) => available.filter((p) => p.position === pos).slice(0, 12).map((p) => p.id)));
  const decisionIds = new Set(board ? [...buildDraftChoices(board).map((c) => c.player.player_id), ...positions.flatMap((pos) => board.recommendations.filter((p) => p.position === pos).sort((a, b) => (board.metricsByPlayerId[b.player_id]?.staticValue ?? -Infinity) - (board.metricsByPlayerId[a.player_id]?.staticValue ?? -Infinity)).slice(0, 3).map((p) => p.player_id))].filter((id) => !picked.has(id)) : []);
  const forecast = marketForecast({ players: pool, pickedIds: [...state.picks.map((p) => p.player_id), chosen], teams: 12, rounds: 14, ownerSlot: config.userSlot, nextOwnPick: nextPick, samples: 512, seed: `${draftId}:${pickNo}` });
  const groups = positions.flatMap((pos) => {
    const ids = available.filter((p) => p.position === pos && decisionIds.has(p.id)).map((p) => p.id);
    const group = summarizeMarketGroup(forecast, ids);
    if (!group) return [];
    const best = forecast.sequences.flatMap((seq) => {
      const values = ids.filter((id) => !seq.includes(id)).flatMap((id) => board?.metricsByPlayerId[id]?.staticValue == null ? [] : [board.metricsByPlayerId[id]!.staticValue!]);
      return values.length ? [Math.max(...values)] : [];
    });
    return [{ position: pos, ...group, bestRemainingValRange: best.length ? [Math.min(...best), Math.max(...best)] : null }];
  });
  const rows = available.filter((p) => broadIds.has(p.id) || decisionIds.has(p.id)).map((p) => ({ playerId: p.id, position: p.position, marketRank: p.rank, broad: broadIds.has(p.id), decision: decisionIds.has(p.id), candidate: forecast.survival[p.id], current: board?.metricsByPlayerId[p.id]?.comebackProbability ?? null }));
  const expectedPositionPicks = Object.fromEntries(positions.map((pos) => [pos, forecast.sequences.reduce((sum, seq) => sum + seq.filter((id) => byId.get(id)?.position === pos).length, 0) / 512]));
  const confirmed = await liveMarketDraft(draftId);
  if (confirmed.draft.status !== "paused" || JSON.stringify(state.picks) !== JSON.stringify(confirmed.picks)) throw new Error("Draft moved before prediction was saved.");
  const turn = TurnSchema.parse({ capturedAt, confirmedAt: new Date().toISOString(), picks: state.picks, nextOwnPick: nextPick, conditionedSelectionId: chosen, defaultId, rows, groups, expectedPositionPicks, ...freeze });
  await save(join(directory, `turn-${String(pickNo).padStart(3, "0")}.json`), { ...turn, draft: state.draft, defaultReadiness: view.readiness, sampleSequences: forecast.sequences.slice(0, 3) });
  return { pickNo, nextPick, selectedId: chosen, defaultId, name: pool.find((p) => p.id === chosen)!.name, forecasts: rows.length };
}
