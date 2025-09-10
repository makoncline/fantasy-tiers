import type { Position } from "@/lib/schemas";

export type Player = {
  player_id: string;
  position: Position;
  borisChenRank: number | null;
  fantasyProsEcr: number | null;
};

export type LineupSlot = {
  position: Position | "-";
  slot: string;
  playerId: string;
};

export type LineupOutput = {
  fantasyPros: LineupSlot[];
  borisChen: LineupSlot[];
};

type RankingField = "fantasyProsEcr" | "borisChenRank";

const makeComparator = (primary: RankingField) => {
  const secondary: RankingField =
    primary === "fantasyProsEcr" ? "borisChenRank" : "fantasyProsEcr";
  return (a: Player, b: Player) => {
    const pa = a[primary] ?? Infinity;
    const pb = b[primary] ?? Infinity;
    if (pa !== pb) return pa - pb;
    const sa = a[secondary] ?? Infinity;
    const sb = b[secondary] ?? Infinity;
    if (sa !== sb) return sa - sb;
    return a.player_id.localeCompare(b.player_id);
  };
};

export const ELIGIBILITY = {
  QB: ["QB"],
  RB: ["RB"],
  WR: ["WR"],
  TE: ["TE"],
  K: ["K"],
  DEF: ["DEF"],
  FLEX: ["RB", "WR", "TE"],
  SUPERFLEX: ["QB", "RB", "WR", "TE"],
  WR_FLEX: ["WR", "RB"],
  TE_FLEX: ["TE", "WR", "RB"],
} as const;

export type SlotType = keyof typeof ELIGIBILITY;

/**
 * Determines the optimal starting lineup from a user's roster players.
 * Dedicated slots (eligibility of exactly one position) are always filled before FLEX-like slots.
 * Supports custom slots defined in ELIGIBILITY (e.g., SUPERFLEX, WR_FLEX).
 *
 * @param userPlayerIds - Array of the user's roster player IDs
 * @param allPlayers - Combined aggregate object with all players for all positions
 * @param rosterPositions - Array of slot types to fill
 * @returns Object with Fantasy Pros and Boris Chen lineups
 */
export function determineRecommendedRoster(
  userPlayerIds: string[],
  allPlayers: Record<string, Record<string, Player>>,
  rosterPositions: string[] = []
): LineupOutput {
  // Get user's players by position (typed, single pass)
  const userPlayersByPosition: Record<Position, Player[]> = {
    QB: [],
    RB: [],
    WR: [],
    TE: [],
    K: [],
    DEF: [],
  };
  for (const id of userPlayerIds) {
    if (allPlayers.QB?.[id]) {
      userPlayersByPosition.QB.push(allPlayers.QB[id]);
      continue;
    }
    if (allPlayers.RB?.[id]) {
      userPlayersByPosition.RB.push(allPlayers.RB[id]);
      continue;
    }
    if (allPlayers.WR?.[id]) {
      userPlayersByPosition.WR.push(allPlayers.WR[id]);
      continue;
    }
    if (allPlayers.TE?.[id]) {
      userPlayersByPosition.TE.push(allPlayers.TE[id]);
      continue;
    }
    if (allPlayers.K?.[id]) {
      userPlayersByPosition.K.push(allPlayers.K[id]);
      continue;
    }
    if (allPlayers.DEF?.[id]) {
      userPlayersByPosition.DEF.push(allPlayers.DEF[id]);
    }
    // Unknown ids are ignored by design.
  }

  // Helper function to create lineup for a specific ranking system
  const createLineup = (rankingField: RankingField) => {
    const lineup: LineupSlot[] = [];
    const usedPlayers = new Set<string>();

    // Per-slot-type counters for human-friendly labels (RB1, RB2, WR1, ...)
    const slotCounters: Record<string, number> = {};
    const nextSlotIndex = (slotType: string) =>
      (slotCounters[slotType] = (slotCounters[slotType] ?? 0) + 1);

    // Allocate positions in roster order, but with all dedicated slots first,
    // then any FLEX-like slots (eligibility > 1).
    const isFlexish = (s: string) =>
      (ELIGIBILITY[s as keyof typeof ELIGIBILITY]?.length ?? 0) > 1;
    const orderedSlots = [
      ...rosterPositions.filter((s) => !isFlexish(s)),
      ...rosterPositions.filter(isFlexish),
    ];

    // Allocate using eligibility mapping
    orderedSlots.forEach((slotType) => {
      const slotNum = nextSlotIndex(slotType);
      const eligiblePositions =
        ELIGIBILITY[slotType as keyof typeof ELIGIBILITY];
      if (!eligiblePositions) {
        // Unknown slot type: still emit a placeholder to keep lengths aligned
        lineup.push({
          position: "-",
          slot: `${slotType}${slotNum}`,
          playerId: `empty-${slotType}-${slotNum}`,
        });
        return;
      }

      // Get all players eligible for this slot
      const eligiblePlayers = eligiblePositions
        .flatMap((pos: Position) => userPlayersByPosition[pos])
        .filter((player: Player) => !usedPlayers.has(player.player_id));

      // Sort with deterministic tie-breaking
      const sortedPlayers = eligiblePlayers
        .slice()
        .sort(makeComparator(rankingField));

      // Take the best available player
      const bestPlayer = sortedPlayers[0];
      if (bestPlayer) {
        usedPlayers.add(bestPlayer.player_id);
        lineup.push({
          position: bestPlayer.position,
          slot: `${slotType}${slotNum}`,
          playerId: bestPlayer.player_id,
        });
      } else {
        // If no eligible player found, create empty slot
        lineup.push({
          position: "-",
          slot: `${slotType}${slotNum}`,
          playerId: `empty-${slotType}-${slotNum}`,
        });
      }
    });

    return lineup;
  };

  return {
    fantasyPros: createLineup("fantasyProsEcr"),
    borisChen: createLineup("borisChenRank"),
  };
}
