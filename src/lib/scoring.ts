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

// Position to scoring types mapping for Tiers data
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

// Scoring type suffix mappings for Tiers files
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
    // Tiers keys in combined aggregates are "std" | "ppr" | "half"
    tierKey: scoring,
  } as const satisfies {
    sleeperSuffix: "ppr" | "half_ppr" | "std";
    fpKey: "ppr" | "half" | "standard";
    tierKey: ScoringType;
  };
}

export function scoringTypeFromReceptionPoints(recPoints: number): ScoringType {
  if (recPoints <= 0) return "std";
  if (recPoints === 0.5) return "half";
  if (recPoints === 1) return "ppr";
  return recPoints > 0.5 ? "ppr" : "half";
}

export function parseSleeperScoringType(value: unknown): ScoringType {
  const normalized = String(value ?? "").trim().toLowerCase();
  switch (normalized) {
    case "ppr":
    case "full_ppr":
      return "ppr";
    case "half":
    case "half_ppr":
      return "half";
    case "std":
    case "standard":
    case "non_ppr":
      return "std";
    default:
      throw new Error(`Unsupported Sleeper scoring type: ${normalized || "missing"}`);
  }
}
