import { NextRequest, NextResponse } from "next/server";
import { fetchDraftDetails } from "@/lib/draftDetails";
import {
  calculatePositionTierCounts,
  calculateTeamNeedsAndCountsForSingleTeam,
  calculateTotalRemainingNeeds,
  getDraftedTeams,
  getDraftRecommendations,
  getLimitedAvailablePlayers,
  getTopPlayersByPosition,
  initializeRosters,
} from "@/lib/draftHelpers";
import { fetchRankings } from "@/lib/rankings";
import { fetchDraftedPlayers, Position, RosterSlot } from "@/lib/draftPicks";
import { getErrorMessage } from "@/lib/util";

// Configurable limits
const AVAILABLE_PLAYERS_LIMIT = 10; // Limit for remaining available players
const TOP_PLAYERS_BY_POSITION_LIMIT = 3; // Limit for top players by position

const scoringMap: Record<string, string> = {
  std: "standard",
  ppr: "ppr",
  half_ppr: "half",
};

export async function GET(req: NextRequest) {
  const draftId = req.nextUrl.searchParams.get("draft_id");
  const userId = req.nextUrl.searchParams.get("user_id");

  if (!draftId || !userId) {
    return NextResponse.json(
      { error: "draft_id, scoring, and user_id parameters are required" },
      { status: 400 }
    );
  }

  try {
    // Fetch draft details
    const draftDetails = await fetchDraftDetails(draftId);
    const scoringType = draftDetails.metadata.scoring_type || "std";
    const scoring = scoringMap[scoringType];

    const rosterRequirements: Record<RosterSlot, number> = {
      QB: draftDetails.settings.slots_qb,
      RB: draftDetails.settings.slots_rb,
      WR: draftDetails.settings.slots_wr,
      TE: draftDetails.settings.slots_te,
      K: draftDetails.settings.slots_k,
      DEF: draftDetails.settings.slots_def,
      FLEX: draftDetails.settings.slots_flex,
    };

    // Determine your draft slot and roster ID
    const draftSlot = draftDetails.draft_order?.[userId];
    const userRosterId = draftSlot
      ? draftDetails.slot_to_roster_id[draftSlot]
      : null;

    // Fetch drafted players (empty if pre-draft)
    const draftedPlayers =
      draftDetails.status === "pre_draft"
        ? []
        : await fetchDraftedPlayers(draftId);

    // Initialize current rosters with all teams, even if they haven’t picked yet
    const currentRosters = initializeRosters(
      draftDetails,
      getDraftedTeams(draftId, draftedPlayers, draftDetails),
      rosterRequirements
    );

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

    console.log("Available Players", availablePlayers);

    // Limit available players to the top configured number
    const topAvailablePlayers = getLimitedAvailablePlayers(
      availablePlayers,
      AVAILABLE_PLAYERS_LIMIT
    );

    // Calculate position tier counts for remaining available players
    const availablePlayersPerPositionPerTier =
      calculatePositionTierCounts(availablePlayers);

    // Get top players by position with the configured limit
    const topAvailablePlayersByPosition = getTopPlayersByPosition(
      availablePlayers,
      TOP_PLAYERS_BY_POSITION_LIMIT
    );

    const totalRemainingNeeds = calculateTotalRemainingNeeds(currentRosters);

    const nextPickRecommendations = userRosterId
      ? getDraftRecommendations(
          availablePlayers,
          currentRosters[userRosterId].rosterPositionCounts,
          rosterRequirements
        )
      : null;

    // Build and return the response
    return NextResponse.json({
      draftInfo: {
        status: draftDetails.status,
        draft_settings: {
          rounds: draftDetails.settings.rounds,
          teams: draftDetails.settings.teams,
        },
        league_metadata: {
          scoring_type: draftDetails.metadata.scoring_type,
        },
      },
      nextPickRecommendations,
      userRoster: userRosterId ? currentRosters[userRosterId] : null,
      remainingPositionRequirements: totalRemainingNeeds,
      topAvailablePlayersByPosition,
      currentRosters,
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
