import { NextRequest, NextResponse } from "next/server";
import { fetchDraftDetails } from "@/lib/draftDetails";
import {
  calculateTotalRemainingNeeds,
  getDraftRecommendations,
  getTopPlayersByPosition,
  calculatePositionNeeds,
  calculatePositionCounts,
  ZERO_POSITION_COUNTS,
} from "@/lib/draftHelpers";
import { fetchDraftPicks } from "@/lib/draftPicks";
import { getErrorMessage } from "@/lib/util";
import { getRankingLastUpdatedDate } from "@/lib/parseRankingData";
import { DraftedPlayer, RosterSlot } from "@/lib/schemas";
import { isRankedPlayer } from "@/lib/getPlayers";
import { getPlayersByScoringTypeServer } from "@/lib/getPlayersServer";

// Configurable limits
const TOP_PLAYERS_BY_POSITION_LIMIT = 3; // Limit for top players by position

export async function GET(req: NextRequest) {
  const draftId = req.nextUrl.searchParams.get("draft_id");
  const userId = req.nextUrl.searchParams.get("user_id");

  if (!draftId || !userId) {
    return NextResponse.json(
      { error: "draft_id, and user_id parameters are required" },
      { status: 400 }
    );
  }

  try {
    // Fetch draft details
    const draftDetails = await fetchDraftDetails(draftId);

    const rosterRequirements: Record<RosterSlot, number> = {
      QB: draftDetails.settings.slots_qb,
      RB: draftDetails.settings.slots_rb,
      WR: draftDetails.settings.slots_wr,
      TE: draftDetails.settings.slots_te,
      K: draftDetails.settings.slots_k,
      DEF: draftDetails.settings.slots_def,
      FLEX: draftDetails.settings.slots_flex,
    };

    const scoring = draftDetails.metadata.scoring_type;
    const playersMap = getPlayersByScoringTypeServer(scoring);
    const draftPicks = await fetchDraftPicks(draftId);
    const draftedPlayers = draftPicks.map((pick) => ({
      ...pick,
      ...playersMap[pick.player_id],
    }));
    const draftedPlayerIds = draftedPlayers.map((player) => player.player_id);

    const rankedPlayers = Object.values(playersMap).filter(isRankedPlayer);
    const availableRankedPlayers = rankedPlayers.filter(
      (player) => !draftedPlayerIds.includes(player.player_id)
    );

    const draftSlots = Array.from(
      { length: draftDetails.settings.teams },
      (_, i) => i + 1
    );
    const emptyRoster = {
      players: [] as DraftedPlayer[],
      remainingPositionRequirements: { ...rosterRequirements },
      rosterPositionCounts: { ...ZERO_POSITION_COUNTS },
    };
    const currentRosters: Record<string, typeof emptyRoster> = {};
    draftSlots.forEach((draftSlot) => {
      const rosteredPlayers = draftedPlayers.filter(
        (player) => player.draft_slot === draftSlot
      );
      const remainingPositionRequirements = calculatePositionNeeds(
        rosterRequirements,
        rosteredPlayers
      );
      const rosterPositionCounts = calculatePositionCounts(rosteredPlayers);
      currentRosters[draftSlot] = {
        players: rosteredPlayers,
        remainingPositionRequirements,
        rosterPositionCounts,
      };
    });

    const draftSlot = draftDetails.draft_order?.[userId];
    const userRoster = draftSlot ? currentRosters[draftSlot] : null;
    const nextPickRecommendations = userRoster
      ? getDraftRecommendations(
          availableRankedPlayers,
          userRoster.rosterPositionCounts,
          userRoster.remainingPositionRequirements
        )
      : null;

    // // Get top players by position with the configured limit
    const topAvailablePlayersByPosition = getTopPlayersByPosition(
      availableRankedPlayers,
      TOP_PLAYERS_BY_POSITION_LIMIT
    );

    const totalRemainingNeeds = calculateTotalRemainingNeeds(currentRosters);

    const rankingsLastUpdated = getRankingLastUpdatedDate(scoring);

    // // Build and return the response
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
      tiersLastModified: rankingsLastUpdated,
      nextPickRecommendations,
      userRoster: userRoster,
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
