// src/lib/scoring.ts
import type { ScoringType, Position } from "./schemas";

// Fantasy football positions only (exclude FB, CB, P, etc.)
export const FANTASY_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);

// Core positions for enrichment calculations
export const CORE_POSITIONS = [
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
  "DEF",
] as const satisfies readonly Position[];

// Position to scoring types mapping for Boris Chen data
export const POSITIONS_TO_SCORING_TYPES: Record<string, ScoringType[]> = {
  QB: ["std"],
  K: ["std"],
  DEF: ["std"],
  RB: ["std", "ppr", "half"],
  WR: ["std", "ppr", "half"],
  TE: ["std", "ppr", "half"],
  FLEX: ["std", "ppr", "half"],
  ALL: ["std", "ppr", "half"],
};

// Roster slot to ranking data abbreviation mapping
export const ROSTER_SLOT_TO_RANKING_DATA_ABBV: Record<string, string> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  K: "K",
  DEF: "DST",
  FLEX: "FLX",
  ALL: "ALL",
};

// Scoring type suffix mappings for Boris Chen files
export const SUFFIX_FOR_SCORING: Record<ScoringType, string> = {
  std: "",
  half: "-HALF",
  ppr: "-PPR",
};

// Special case for ALL position scoring suffixes
export const ALL_SUFFIX_FOR_SCORING: Record<ScoringType, string> = {
  std: "",
  half: "-HALF-PPR",
  ppr: "-PPR",
};

export function scoringKeys(scoring: ScoringType) {
  return {
    // Sleeper stats suffix used in combined aggregates: pts_<suffix>, adp_<suffix>
    sleeperSuffix:
      scoring === "ppr" ? "ppr" : scoring === "half" ? "half_ppr" : "std",
    // FantasyPros stats/rankings key group in combined aggregates
    fpKey: scoring === "ppr" ? "ppr" : scoring === "half" ? "half" : "standard",
    // Boris Chen keys in combined aggregates are "std" | "ppr" | "half"
    borisKey: scoring,
  } as const satisfies {
    sleeperSuffix: "ppr" | "half_ppr" | "std";
    fpKey: "ppr" | "half" | "standard";
    borisKey: ScoringType;
  };
}
