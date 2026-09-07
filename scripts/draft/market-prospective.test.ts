import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { runMarketCapture } from "./market-prospective";

afterEach(() => vi.unstubAllGlobals());
it("freezes an independent pool and saves a conditional non-default forecast before outcomes", async () => {
  const root = await mkdtemp(join(tmpdir(), "market-prospective-"));
  try {
    const data = Object.fromEntries(Array.from({ length: 72 }, (_, i) => [String(i + 1), { full_name: `Player ${i}`, fantasy_positions: [i % 3 === 0 ? "DEF" : i % 3 === 1 ? "QB" : "TE"] }]));
    await writeFile(join(root, "players-source.json"), JSON.stringify({ data }));
    await writeFile(join(root, "market-source.json"), JSON.stringify({ data: Object.fromEntries(Object.keys(data).map((id) => [id, 100 - Number(id)])) }));
    await runMarketCapture("freeze", root);
    const draft = { draft_id: "123", type: "snake", status: "pre_draft", season: "2026", metadata: { scoring_type: "ppr" }, settings: { teams: 12, rounds: 14, slots_qb: 1, slots_rb: 2, slots_wr: 2, slots_te: 1, slots_flex: 2, slots_def: 1, slots_k: 0, slots_bn: 5 }, draft_order: { "456": 1 } };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(JSON.stringify(url.includes("/picks?") ? [] : draft))));
    await runMarketCapture("init", root, "123", "456");
    draft.status = "paused";
    await runMarketCapture("turn", root, "123", undefined, "1");
    const turn = JSON.parse(await readFile(join(root, "123/turn-001.json"), "utf8"));
    expect(turn.conditionedSelectionId).toBe("1");
    expect(turn.defaultId).not.toBe("1");
    expect(turn.picks).toEqual([]);
    expect(turn.nextOwnPick).toBe(24);
    expect(turn.rows).toHaveLength(36);
    expect(turn.rows.some((r: { current: unknown }) => r.current === null)).toBe(true);
    expect(turn.sampleSequences.every((s: string[]) => new Set(s).size === 22 && !s.includes("1"))).toBe(true);
    await writeFile(join(root, "pool.json"), "[]");
    await expect(runMarketCapture("turn", root, "123", undefined, "1")).rejects.toThrow("Frozen");
  } finally { await rm(root, { recursive: true, force: true }); }
}, 20_000);
