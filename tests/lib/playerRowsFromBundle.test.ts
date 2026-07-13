import { describe, it, expect } from "vitest";
import {
  toPlayerRowFromBundle,
  toPlayerRowsFromBundle,
} from "@/lib/playerRows";
import type { AggregatesBundlePlayerT } from "@/lib/schemas-bundle";

describe("toPlayerRowFromBundle", () => {
  const mockBundlePlayer: AggregatesBundlePlayerT = {
    player_id: "1234",
    name: "John Doe",
    position: "RB",
    team: "SF",
    bye_week: 9,
    tiers: { rank: 4, tier: 1 },
    sleeper: { rank: 4, adp: 3.2, pts: 263.4 },
    fantasypros: {
      rank: 4,
      tier: 1,
      pos_rank: "RB1",
      ecr: 4,
      ecr_average: 4.7,
      ecr_std: 1.2,
      ecr_round_pick: "1.03",
      pts: 278.1,
      baseline_pts: 192.5,
      adp: null,
      player_owned_avg: 97.3,
    },
    calc: { value: 86, positional_scarcity: 62, market_delta: -1 },
  };

  it("maps complete bundle player to PlayerRow correctly", () => {
    const result = toPlayerRowFromBundle(mockBundlePlayer, 12);

    expect(result).toEqual({
      player_id: "1234",
      name: "John Doe",
      position: "RB",
      team: "SF",
      bye_week: 9,
      rank: 4,
      tier_rank: 4,
      tier_level: 1,
      tier: 1, // Added because tiers.tier exists
      fp_pts: 278.1,
      fp_tier: 1,
      fp_rank_overall: 4,
      fp_rank_ave: 4.7,
      fp_rank_std: 1.2,
      fp_rank_pos: 1, // Parsed from "RB1"
      fp_baseline_pts: 192.5,
      fp_value: 86,
      fp_remaining_value_pct: 62,
      fp_player_owned_avg: 97.3,
      sleeper_pts: 263.4,
      sleeper_adp: 3.2,
      sleeper_adp_round_pick: "1.03",
      sleeper_rank_overall: 4,
      fp_adp: null,
      market_delta: -1,
      ecr_round_pick: "1.03", // Uses provided value
    });
  });

  it("handles null/undefined values correctly", () => {
    const playerWithNulls: AggregatesBundlePlayerT = {
      ...mockBundlePlayer,
      team: null,
      bye_week: null,
      tiers: { rank: null, tier: null },
      sleeper: { rank: null, adp: null, pts: null },
      fantasypros: {
        ...mockBundlePlayer.fantasypros,
        pos_rank: null,
        ecr_average: null,
        ecr_std: null,
        ecr_round_pick: null,
        pts: null,
        baseline_pts: null,
        adp: null,
        player_owned_avg: null,
      },
      calc: { value: null, positional_scarcity: null, market_delta: null },
    };

    const result = toPlayerRowFromBundle(playerWithNulls, 12);

    expect(result.rank).toBeUndefined();
    expect(result.tier_rank).toBeUndefined();
    expect(result.tier_level).toBeUndefined();
    expect(result.tier).toBeUndefined();
    expect(result.fp_pts).toBeNull();
    expect(result.fp_value).toBeNull();
    expect(result.fp_remaining_value_pct).toBeNull();
    expect(result.market_delta).toBeNull();
    expect(result.team).toBeNull();
    expect(result.bye_week).toBeNull();
  });

  it("maps Footballguys comparison data without affecting draft value fields", () => {
    const result = toPlayerRowFromBundle({
      ...mockBundlePlayer,
      footballguys: {
        id: "DoeJo00",
        rank: 7,
        tier: 2,
        pos_rank: 3,
        fetched_at: "2026-07-11T12:00:00.000Z",
        settings: "12-team ppr public default",
        adp: { consensus: 8, sleeper: null },
      },
    });

    expect(result).toMatchObject({
      fbg_rank: 7,
      fbg_tier: 2,
      fbg_rank_pos: 3,
      fbg_adp_consensus: 8,
      fbg_settings: "12-team ppr public default",
      fp_rank_ave: 4.7,
    });
  });

  it("parses pos_rank correctly", () => {
    const playerWithPosRank = {
      ...mockBundlePlayer,
      fantasypros: {
        ...mockBundlePlayer.fantasypros,
        pos_rank: "QB15",
      },
    };

    const result = toPlayerRowFromBundle(playerWithPosRank, 12);
    expect(result.fp_rank_pos).toBe(15);
  });

  it("handles invalid pos_rank gracefully", () => {
    const playerWithInvalidPosRank = {
      ...mockBundlePlayer,
      fantasypros: {
        ...mockBundlePlayer.fantasypros,
        pos_rank: "INVALID",
      },
    };

    const result = toPlayerRowFromBundle(playerWithInvalidPosRank, 12);
    expect(result.fp_rank_pos).toBeNull();
  });

  it("computes ecr_round_pick when not provided", () => {
    const playerWithoutEcrRoundPick = {
      ...mockBundlePlayer,
      fantasypros: {
        ...mockBundlePlayer.fantasypros,
        ecr_round_pick: null,
        ecr: 5,
      },
    };

    const result = toPlayerRowFromBundle(playerWithoutEcrRoundPick, 12);
    expect(result.ecr_round_pick).toBe("1.05"); // Round 1, pick 5 for 12 teams
  });

  it("handles missing leagueTeams gracefully", () => {
    const result = toPlayerRowFromBundle(mockBundlePlayer, undefined);
    expect(result.ecr_round_pick).toBe("1.03"); // Uses provided value
    expect(result.sleeper_adp_round_pick).toBeUndefined();
  });

  it("handles null ecr values", () => {
    const playerWithNullEcr = {
      ...mockBundlePlayer,
      fantasypros: {
        ...mockBundlePlayer.fantasypros,
        ecr: null,
        ecr_average: null,
        ecr_round_pick: null,
      },
    };

    const result = toPlayerRowFromBundle(playerWithNullEcr, 12);
    expect(result.ecr_round_pick).toBeUndefined();
  });
});

describe("toPlayerRowsFromBundle", () => {
  const mockPlayers: AggregatesBundlePlayerT[] = [
    {
      player_id: "1",
      name: "Player One",
      position: "RB",
      team: "SF",
      bye_week: 9,
      tiers: { rank: 1, tier: 1 },
      sleeper: { rank: 1, adp: 1.5, pts: 300 },
      fantasypros: {
        rank: 1,
        tier: 1,
        pos_rank: "RB1",
        ecr: 1,
        ecr_average: 1.2,
        ecr_std: 0.8,
        ecr_round_pick: "1.01",
        pts: 280,
        baseline_pts: 200,
        adp: null,
        player_owned_avg: 98,
      },
      calc: { value: 90, positional_scarcity: 70, market_delta: 0 },
    },
    {
      player_id: "2",
      name: "Player Two",
      position: "RB",
      team: "KC",
      bye_week: 10,
      tiers: { rank: 2, tier: 1 },
      sleeper: { rank: 2, adp: 2.1, pts: 290 },
      fantasypros: {
        rank: 2,
        tier: 1,
        pos_rank: "RB2",
        ecr: 2,
        ecr_average: 2.4,
        ecr_std: 1.1,
        ecr_round_pick: "1.02",
        pts: 270,
        baseline_pts: 195,
        adp: null,
        player_owned_avg: 95,
      },
      calc: { value: 85, positional_scarcity: 65, market_delta: 1 },
    },
  ];

  it("maps array of bundle players to PlayerRows and sorts by tier_rank", () => {
    const result = toPlayerRowsFromBundle(mockPlayers, 12);

    expect(result).toHaveLength(2);
    expect(result[0].player_id).toBe("1"); // Rank 1 should come first
    expect(result[1].player_id).toBe("2"); // Rank 2 should come second

    // Check that first player is mapped correctly
    expect(result[0]).toEqual({
      player_id: "1",
      name: "Player One",
      position: "RB",
      team: "SF",
      bye_week: 9,
      rank: 1,
      tier_rank: 1,
      tier_level: 1,
      tier: 1,
      fp_pts: 280,
      fp_tier: 1,
      fp_rank_overall: 1,
      fp_rank_ave: 1.2,
      fp_rank_std: 0.8,
      fp_rank_pos: 1,
      fp_baseline_pts: 200,
      fp_value: 90,
      fp_remaining_value_pct: 70,
      fp_player_owned_avg: 98,
      sleeper_pts: 300,
      sleeper_adp: 1.5,
      sleeper_adp_round_pick: "1.02",
      sleeper_rank_overall: 1,
      sleeper_rank_pos: 1,
      sleeper_tier_level: 1,
      sleeper_injury_status: undefined,
      sleeper_injury_notes: undefined,
      fp_adp: null,
      market_delta: 0,
      ecr_round_pick: "1.01",
    });
  });

  it("handles empty array", () => {
    const result = toPlayerRowsFromBundle([], 12);
    expect(result).toEqual([]);
  });

  it("sorts players with null ranks to the end", () => {
    const playersWithNullRanks: AggregatesBundlePlayerT[] = [
      {
        ...mockPlayers[0],
        tiers: { rank: null, tier: 1 },
      },
      {
        ...mockPlayers[1],
        tiers: { rank: 2, tier: 1 },
      },
    ];

    const result = toPlayerRowsFromBundle(playersWithNullRanks, 12);
    expect(result[0].player_id).toBe("2"); // Rank 2 comes first
    expect(result[1].player_id).toBe("1"); // Null rank comes last
  });

  it("derives Sleeper position tiers from Sleeper rank using FP tier sizes", () => {
    const players: AggregatesBundlePlayerT[] = [
      {
        ...mockPlayers[0],
        player_id: "tier-one",
        tiers: { rank: 1, tier: 1 },
        sleeper: { ...mockPlayers[0].sleeper, rank: 30 },
      },
      {
        ...mockPlayers[0],
        player_id: "tier-two-a",
        tiers: { rank: 2, tier: 2 },
        sleeper: { ...mockPlayers[0].sleeper, rank: 10 },
      },
      {
        ...mockPlayers[0],
        player_id: "tier-two-b",
        tiers: { rank: 3, tier: 2 },
        sleeper: { ...mockPlayers[0].sleeper, rank: 20 },
      },
    ];

    const result = toPlayerRowsFromBundle(players, 12);

    expect(result.find((row) => row.player_id === "tier-two-a")).toMatchObject({
      sleeper_rank_pos: 1,
      sleeper_tier_level: 1,
    });
    expect(result.find((row) => row.player_id === "tier-one")).toMatchObject({
      sleeper_rank_pos: 3,
      sleeper_tier_level: 2,
    });
  });
});
