import type { ScoringType } from "./schemas";
import {
  ROSTER_SLOT_TO_RANKING_DATA_ABBV,
  SUFFIX_FOR_SCORING,
  ALL_SUFFIX_FOR_SCORING,
} from "./scoring";

// Build the public Boris Chen S3 source URL for a position + scoring type
export function borischenSourceUrl(
  position: keyof typeof ROSTER_SLOT_TO_RANKING_DATA_ABBV,
  scoring: ScoringType
): string {
  const abbr = ROSTER_SLOT_TO_RANKING_DATA_ABBV[position];
  const suffix =
    position === ("ALL" as unknown as typeof position)
      ? ALL_SUFFIX_FOR_SCORING[scoring]
      : SUFFIX_FOR_SCORING[scoring];
  return `https://s3-us-west-1.amazonaws.com/fftiers/out/weekly-${abbr}${suffix}.csv`;
}

