import { describe, expect, it } from "vitest";
import { buildMarketOrderScenario, formatDraftPick, getChoicePickWindow, opponentWindowSlots, scenarioMarketOrder, type MarketScenarioPlayer } from "./draftLookaheadCore";
import { getAdpTiming, formatMetricDifference, tierDifference } from "./draftCardMetrics";

const turn = { currentPick: 4, userSlot: 4, teams: 12, rounds: 14, draftType: "snake" };
const players: MarketScenarioPlayer[] = Array.from({ length: 70 }, (_, index) => ({
  player_id: String(index + 1), name: `Player ${index + 1}`,
  position: index % 2 === 0 ? "RB" : "WR", sleeper_board_rank: index + 1,
}));

describe("exact next-two-pick windows", () => {
  it("separates the approach to pick four from the 16 picks after it", () => {
    expect(getChoicePickWindow({ ...turn, currentPick: 3 })).toMatchObject({ ownPick: 4, nextOwnPick: 21, beforeOwn: 1, betweenOwn: 16, onClock: false });
    expect(getChoicePickWindow(turn)).toMatchObject({ ownPick: 4, nextOwnPick: 21, beforeOwn: 0, betweenOwn: 16, onClock: true });
    expect(getChoicePickWindow({ ...turn, currentPick: 21 })).toMatchObject({ nextOwnPick: 28, betweenOwn: 6 });
  });
  it.each([[12, 12, 13], [1, 24, 25]])("handles slot %i at consecutive picks", (userSlot, currentPick, nextOwnPick) => {
    expect(getChoicePickWindow({ ...turn, userSlot, currentPick })).toMatchObject({ onClock: true, nextOwnPick, betweenOwn: 0 });
    const before = getChoicePickWindow({ ...turn, userSlot, currentPick: currentPick - 1 });
    expect(before.onClock).toBe(false);
    expect(before.beforeOwn).toBe(1);
    expect(before.betweenOwn).toBe(0);
  });
  it("distinguishes final, complete, unknown, and unsupported format", () => {
    expect(getChoicePickWindow({ ...turn, currentPick: 165 }).state).toBe("final");
    expect(getChoicePickWindow({ ...turn, currentPick: 169 }).state).toBe("complete");
    expect(getChoicePickWindow({ ...turn, rounds: undefined }).state).toBe("unknown");
    expect(getChoicePickWindow({ ...turn, userSlot: null }).state).toBe("unknown");
    expect(getChoicePickWindow({ ...turn, draftType: "auction" }).state).toBe("unknown");
    expect(formatDraftPick(21, 12)).toBe("2.09");
    expect(formatDraftPick(165, 12)).toBe("14.09");
  });
  it("counts managers once but counts both selections where a manager picks twice", () => {
    const visits = opponentWindowSlots(turn, getChoicePickWindow(turn));
    expect(visits.size).toBe(8);
    expect([...visits.values()].reduce((sum, n) => sum + n, 0)).toBe(16);
    expect([...visits.values()].every((n) => n === 2)).toBe(true);
    const short = opponentWindowSlots(turn, getChoicePickWindow({ ...turn, currentPick: 21 }));
    expect(short.size).toBe(3);
    expect([...short.values()].reduce((sum, n) => sum + n, 0)).toBe(6);
  });
});

describe("market-order what-if, not a forecast", () => {
  const run = (overrides: Partial<Parameters<typeof buildMarketOrderScenario>[0]> = {}) =>
    buildMarketOrderScenario({ turn, players, selectedNowId: "2", configuredPositions: ["RB", "WR", "QB", "TE", "DEF"], ...overrides });
  it("removes exactly the opponent count after removing our selected player", () => {
    const result = run();
    expect(result.status).toBe("ready");
    expect(result.selections).toHaveLength(17);
    expect(result.selections.filter((p) => p.kind === "opponent")).toHaveLength(16);
    expect(result.selections[0]).toMatchObject({ kind: "owner", playerId: "2", pick: 4 });
    expect(new Set(result.selections.map((p) => p.playerId)).size).toBe(17);
    expect(result.remainingIds).not.toContain("2");
  });
  it("does not reserve a player who is taken before our upcoming turn", () => {
    const result = run({ turn: { ...turn, currentPick: 3 }, selectedNowId: "1" });
    expect(result.status).toBe("blocked");
    expect(result.message).toContain("before your upcoming turn");
  });
  it("models no opponents at the back-to-back boundary", () => {
    const result = run({ turn: { ...turn, currentPick: 12, userSlot: 12 } });
    expect(result.status).toBe("ready");
    expect(result.selections).toHaveLength(1);
    expect(result.remainingIds).toHaveLength(players.length - 1);
  });
  it("does not import owner backup or ECR rules; defenses can go early", () => {
    const marketOnly: MarketScenarioPlayer[] = [
      { player_id: "qb1", name: "Quarterback", position: "QB", sleeper_board_rank: 0.1 },
      { player_id: "qb2", name: "Backup", position: "QB", sleeper_board_rank: 0.2 },
      { player_id: "dst", name: "Defense", position: "DEF", sleeper_board_rank: 0.3 },
      ...players,
    ];
    const result = run({ players: marketOnly });
    expect(result.selections.slice(1, 4).map((p) => p.playerId)).toEqual(["qb1", "qb2", "dst"]);
  });
  it("skips configured-out positions but not low-quality market players", () => {
    const kicker: MarketScenarioPlayer = { player_id: "k", name: "Kicker", position: "K", sleeper_board_rank: 0.1 };
    expect(run({ players: [kicker, ...players] }).selections.some((p) => p.playerId === "k")).toBe(false);
  });
  it("keeps missing market data unknown and never uses ECR as its replacement", () => {
    expect(scenarioMarketOrder({ player_id: "x", name: "X", position: "RB", sleeper_adp: 999 })).toBeNull();
    expect(scenarioMarketOrder({ player_id: "x", name: "X", position: "RB", sleeper_board_rank: 0, sleeper_adp: 12 })).toEqual({ source: "ADP", value: 12 });
    const unknown: MarketScenarioPlayer = { player_id: "unknown", name: "Unknown", position: "RB" };
    const result = run({ players: [unknown, ...players] });
    expect(result.unpricedCount).toBe(1);
    expect(result.remainingIds).toContain("unknown");
  });
  it("does not mutate inputs and rejects duplicate IDs or a short pool", () => {
    const before = JSON.stringify(players);
    run();
    expect(JSON.stringify(players)).toBe(before);
    expect(run({ players: [...players, players[0]!] }).status).toBe("blocked");
    expect(run({ players: players.slice(0, 3) }).status).toBe("blocked");
  });
  it("does not remove already drafted players again", () => {
    const result = run({ players: players.map((p) => p.player_id === "1" ? { ...p, drafted: true } : p) });
    expect(result.selections.some((p) => p.playerId === "1")).toBe(false);
    expect(result.remainingIds).not.toContain("1");
  });
});

describe("card comparison semantics", () => {
  it("colors timing against the actual upcoming overall pick", () => {
    expect(getAdpTiming(20, 4, 12)).toMatchObject({ tone: "early", label: "Early" });
    expect(getAdpTiming(20, 21, 12)).toMatchObject({ tone: "near", label: "Near ADP" });
    expect(getAdpTiming(12, 21, 12)).toMatchObject({ tone: "later", label: "Past ADP" });
    for (const adp of [null, undefined, NaN, -1, 0, 999]) expect(getAdpTiming(adp, 21, 12).tone).toBe("unknown");
    expect(getAdpTiming(12, null, 12).tone).toBe("unknown");
  });
  it("shows signed numeric gaps without declaring equivalence", () => {
    expect(formatMetricDifference(163.4, 170.2)).toBe("−6.8");
    expect(formatMetricDifference(134, 170.2)).toBe("−36.2");
    expect(formatMetricDifference(200, 170.2)).toBe("+29.8");
    expect(formatMetricDifference(null, 170.2)).toBe("—");
    expect(tierDifference(2, 1)).toBe("1 tier worse");
    expect(tierDifference(1, 1)).toBe("Same tier");
  });
});
