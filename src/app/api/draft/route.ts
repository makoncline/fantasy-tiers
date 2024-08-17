import { NextRequest, NextResponse } from "next/server";
import { fetchDraftedPlayers } from "@/lib/draft";
import { fetchRankings } from "@/lib/rankings"; // Correct import
import { getErrorMessage } from "@/lib/util";

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

    // Calculate number of players left in each position for each tier
    const positionTierCounts: Record<string, Record<string, number>> = {};

    Object.values(availablePlayers).forEach((player: any) => {
      const { tier, position } = player;

      if (!positionTierCounts[position]) {
        positionTierCounts[position] = {};
      }

      if (!positionTierCounts[position][tier]) {
        positionTierCounts[position][tier] = 0;
      }

      positionTierCounts[position][tier]++;
    });

    return NextResponse.json({
      availablePlayers,
      positionTierCounts, // Grouped by position first, then by tier
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
