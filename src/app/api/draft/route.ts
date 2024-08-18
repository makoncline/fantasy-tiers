import { NextRequest, NextResponse } from "next/server";
import { fetchDraftDetails } from "@/lib/draftDetails";
import {
  calculatePositionTierCounts,
  calculateTeamNeedsAndCountsForSingleTeam,
  calculateTotalRemainingNeeds,
  getDraftedTeams,
  getLimitedAvailablePlayers,
  getTopPlayersByPosition,
  initializeRosters,
} from "@/lib/draftHelpers";
import { fetchRankings } from "@/lib/rankings";
import { fetchDraftedPlayers, Position } from "@/lib/draftPicks";
import { getErrorMessage } from "@/lib/util";

// Configurable limits
const AVAILABLE_PLAYERS_LIMIT = 10; // Limit for remaining available players
const TOP_PLAYERS_BY_POSITION_LIMIT = 3; // Limit for top players by position

export async function GET(req: NextRequest) {
  const draftId = req.nextUrl.searchParams.get("draft_id");
  const scoring = req.nextUrl.searchParams.get("scoring");
  const userId = req.nextUrl.searchParams.get("user_id");

  if (!draftId || !scoring || !userId) {
    return NextResponse.json(
      { error: "draft_id, scoring, and user_id parameters are required" },
      { status: 400 }
    );
  }

  try {
    // Fetch draft details
    const draftDetails = await fetchDraftDetails(draftId);

    const rosterRequirements: Record<Position | "FLEX", number> = {
      QB: draftDetails.settings.slots_qb,
      RB: draftDetails.settings.slots_rb,
      WR: draftDetails.settings.slots_wr,
      TE: draftDetails.settings.slots_te,
      K: draftDetails.settings.slots_k,
      DEF: draftDetails.settings.slots_def,
      FLEX: draftDetails.settings.slots_flex,
    };

    // Determine your draft slot and roster ID
    const draftSlot = draftDetails.draft_order[userId];
    const yourRosterId = draftDetails.slot_to_roster_id[draftSlot];

    // Handle pre-draft status gracefully
    if (draftDetails.status === "pre_draft") {
      const availableRankings = await fetchRankings(scoring); // Pre-fetch rankings

      return NextResponse.json({
        status: "pre_draft",
        message: "The draft has not started yet.",
        draft_start_time: draftDetails.start_time,
        user_team_info: {
          draft_slot: draftSlot,
          roster_id: yourRosterId,
        },
        team_roster_requirements: rosterRequirements,
        draft_settings: {
          rounds: draftDetails.settings.rounds,
          pick_timer: draftDetails.settings.pick_timer,
          teams: draftDetails.settings.teams,
        },
        available_rankings: availableRankings,
        draft_order_preview: draftDetails.draft_order,
        league_metadata: {
          name: draftDetails.metadata.name,
          description: draftDetails.metadata.description,
          scoring_type: draftDetails.metadata.scoring_type,
        },
      });
    }

    // Fetch drafted players
    const draftedPlayers = await fetchDraftedPlayers(draftId);

    // If no picks have been made yet
    if (draftedPlayers.length === 0) {
      return NextResponse.json({
        message: "No picks have been made yet.",
        status: "pre_draft",
        draft_id: draftDetails.draft_id,
        remainingPositionNeeds: {},
        totalRemainingNeeds: {},
      });
    }

    // Initialize currentRosters with all teams, even if they haven’t picked yet
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

    // Calculate total remaining needs across all teams
    const totalRemainingNeeds = calculateTotalRemainingNeeds(currentRosters);

    // Build and return the response
    return NextResponse.json({
      topAvailablePlayers,
      availablePlayersPerPositionPerTier,
      topAvailablePlayersByPosition,
      currentRosters,
      userRoster: currentRosters[yourRosterId],
      rosterNeeds: totalRemainingNeeds,
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
