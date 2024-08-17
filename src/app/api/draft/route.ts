import { NextRequest, NextResponse } from "next/server";
import { fetchDraftedPlayers } from "@/lib/draft";
import { fetchDraftDetails } from "@/lib/draftDetails";
import {
  calculatePositionTierCounts,
  calculateRemainingPositionNeeds,
  getDraftedTeams,
  getLimitedAvailablePlayers,
  getTopPlayersByPosition,
} from "@/lib/draftHelpers";
import { fetchRankings } from "@/lib/rankings";
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
    // Fetch draft details and drafted players
    const draftDetails = await fetchDraftDetails(draftId);
    const draftedPlayers = await fetchDraftedPlayers(draftId);

    // Group drafted players by team
    const draftedTeams = getDraftedTeams(draftId, draftedPlayers, draftDetails);

    // Calculate remaining position needs
    const { remainingPositionNeeds, totalRemainingNeeds } =
      calculateRemainingPositionNeeds(draftedTeams, draftDetails);

    // Fetch and filter available players based on scoring
    const tiers = await fetchRankings(scoring);
    const draftedPlayerNames = draftedPlayers.map(
      (pick) => pick.normalized_name
    );
    const availablePlayers = Object.keys(tiers).reduce((result, playerName) => {
      if (!draftedPlayerNames.includes(playerName)) {
        result[playerName] = tiers[playerName];
      }
      return result;
    }, {} as Record<string, any>);

    // Limit available players to the top 10 (this can be configured)
    const limitedAvailablePlayers = getLimitedAvailablePlayers(
      availablePlayers,
      10
    );

    // Calculate position tier counts for remaining available players
    const positionTierCounts = calculatePositionTierCounts(availablePlayers);

    // Get top players by position
    const topPlayersByPosition = getTopPlayersByPosition(availablePlayers, 3); // 3 is the configurable limit

    // Build and return the response
    return NextResponse.json({
      remainingAvailablePlayers: limitedAvailablePlayers,
      positionTierCountsForRemainingAvailablePlayers: positionTierCounts,
      topRemainingPlayersByPosition: topPlayersByPosition,
      draftedTeams,
      remainingPositionNeeds, // Newly added
      totalRemainingNeeds, // Newly added
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
