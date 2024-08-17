import { NextRequest, NextResponse } from "next/server";
import { fetchDraftedPlayers } from "@/lib/draft";
import { fetchRankings } from "@/lib/rankings";
import { getErrorMessage } from "@/lib/util";
import {
  calculatePositionTierCounts,
  getTopPlayersByPosition,
  getLimitedAvailablePlayers,
  getDraftedTeams,
} from "@/lib/draftHelpers";
import { fetchDraftDetails } from "@/lib/draftDetails";

// Set the limits as constants
const AVAILABLE_PLAYERS_LIMIT = 10;
const TOP_PLAYERS_BY_POSITION_LIMIT = 3;

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
    // Fetch draft details to get the mappings
    const draftDetails = await fetchDraftDetails(draftId);

    // Fetch the drafted players
    const draftedPlayers = await fetchDraftedPlayers(draftId);
    const draftedPlayerNames = draftedPlayers.map(
      (pick) => pick.normalized_name
    );

    // Get the list of players each team has drafted using the utility function
    const draftedTeams = getDraftedTeams(draftId, draftedPlayers, draftDetails);

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

    // Get limited available players using the constant limit
    const limitedAvailablePlayers = getLimitedAvailablePlayers(
      availablePlayers,
      AVAILABLE_PLAYERS_LIMIT
    );

    // Calculate number of players left in each position for each tier
    const positionTierCounts = calculatePositionTierCounts(availablePlayers);

    // Get top players remaining for each position with tier data, using the constant limit
    const topPlayersByPosition = getTopPlayersByPosition(
      availablePlayers,
      TOP_PLAYERS_BY_POSITION_LIMIT
    );

    return NextResponse.json({
      remainingAvailablePlayers: limitedAvailablePlayers,
      positionTierCountsForRemainingAvailablePlayers: positionTierCounts,
      topRemainingPlayersByPosition: topPlayersByPosition,
      draftedTeams,
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
