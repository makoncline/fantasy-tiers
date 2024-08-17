import { NextRequest, NextResponse } from "next/server";
import { fetchDraftedPlayers } from "@/lib/draft";
import { fetchRankings } from "@/lib/rankings"; // Correct import
import { getErrorMessage } from "@/lib/util";
import Fuse from "fuse.js";

export async function GET(req: NextRequest) {
  const draftId = req.nextUrl.searchParams.get("draft_id");
  const scoring = req.nextUrl.searchParams.get("scoring");

  if (!draftId || !scoring) {
    return NextResponse.json(
      { error: "draft_id and scoring parameters are required" },
      { status: 400 }
    );
  }

  try {
    // Fetch the drafted players
    const draftedPlayers = await fetchDraftedPlayers(draftId);
    const draftedPlayerNames = draftedPlayers.map(
      (pick) => pick.normalized_name
    );

    // Fetch the tier rankings
    const tiers = await fetchRankings(scoring);
    const tierPlayerNames = Object.keys(tiers);

    // Initialize Fuse.js for fuzzy searching
    const fuse = new Fuse(tierPlayerNames, {
      includeScore: true,
      threshold: 0.1, // Adjust this based on how strict the match should be
    });

    // Find players in the draft but not in the tiers
    const missingInTiers = draftedPlayerNames
      .map((name) => {
        if (!tierPlayerNames.includes(name)) {
          const result = fuse.search(name);
          if (result.length > 0) {
            return { name, suggestion: `Did you mean ${result[0].item}?` };
          } else {
            return { name, suggestion: "No close matches found" };
          }
        }
        return null;
      })
      .filter(Boolean);

    // Generate the errors array with suggestions
    const errors = [];
    if (missingInTiers.length > 0) {
      errors.push({
        type: "MISSING_IN_TIERS",
        message:
          "The following players are in the draft but missing in the tiers (after name normalization)",
        players: missingInTiers,
      });
    }

    // Filter out drafted players by their normalized name
    const availablePlayers = tierPlayerNames.reduce(
      (result: any, playerName: string) => {
        if (!draftedPlayerNames.includes(playerName)) {
          result[playerName] = tiers[playerName];
        }
        return result;
      },
      {}
    );

    return NextResponse.json({
      availablePlayers,
      errors,
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
