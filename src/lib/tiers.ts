import type { Position, ScoringType } from "./schemas";

type TiersSourcePosition = Position | "FLEX" | "ALL";

const POSITION_SLUGS: Record<TiersSourcePosition, string> = {
  ALL: "consensus",
  QB: "qb",
  RB: "rb",
  WR: "wr",
  TE: "te",
  FLEX: "flex",
  K: "k",
  DEF: "dst",
};

function scoringPrefix(position: TiersSourcePosition, scoring: ScoringType) {
  if (
    scoring === "std" ||
    position === "QB" ||
    position === "K" ||
    position === "DEF"
  ) {
    return "";
  }
  return scoring === "ppr" ? "ppr-" : "half-point-ppr-";
}

export function tiersSourceUrl(
  position: TiersSourcePosition,
  scoring: ScoringType
): string {
  const slug = POSITION_SLUGS[position];
  const prefix = scoringPrefix(position, scoring);
  const allScoringSlug =
    position === "ALL" && scoring !== "std" ? `${prefix}cheatsheets` : null;
  const pageSlug = allScoringSlug ?? `${prefix}${slug}-cheatsheets`;
  return `https://www.fantasypros.com/nfl/rankings/${pageSlug}.php`;
}
