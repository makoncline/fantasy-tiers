"use client";

import { useState } from "react";
import { getPlayersByScoringTypeClient } from "@/lib/getPlayersClient";
import { fetchDraftDetails } from "@/lib/draftDetails";
import { fetchDraftPicks } from "@/lib/draftPicks";
import {
  getDraftRecommendations,
  calculatePositionNeeds,
  calculatePositionCounts,
  ZERO_POSITION_COUNTS,
  Recommendations,
  calculateTotalRemainingNeeds,
} from "@/lib/draftHelpers";
import { DraftedPlayer } from "@/lib/schemas";
import { isRankedPlayer } from "@/lib/getPlayerss";
import RecommendationsSection from "@/components/reccomendations";
import AvailablePlayers from "@/components/availablePlayers";
import PositionNeeds from "@/components/positionNeeds";
import UserRoster from "@/components/userRoster";

export default function DraftAssistantPage() {
  const [userId, setUserId] = useState<string>("");
  const [draftId, setDraftId] = useState<string>("");
  const [recommendations, setRecommendations] =
    useState<Recommendations | null>(null);
  const [availablePlayers, setAvailablePlayers] = useState<DraftedPlayer[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [userPositionNeeds, setUserPositionNeeds] = useState<
    Record<string, number>
  >({});
  const [userPositionCounts, setUserPositionCounts] = useState<
    Record<string, number>
  >({});
  const [draftWideNeeds, setDraftWideNeeds] = useState<Record<string, number>>(
    {}
  );
  const [userRoster, setUserRoster] = useState<DraftedPlayer[] | null>();

  const fetchDraftData = async () => {
    if (!userId || !draftId) {
      setError("User ID and Draft ID are required.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch draft details
      const draftDetails = await fetchDraftDetails(draftId);
      const scoringType = draftDetails?.metadata?.scoring_type;

      if (!scoringType) {
        setError("Failed to determine the scoring type.");
        return;
      }

      // Fetch player data
      const playersMap = await getPlayersByScoringTypeClient(scoringType);

      // Fetch draft picks
      const draftPicks = await fetchDraftPicks(draftId);
      const draftedPlayers = draftPicks.map((pick) => ({
        ...pick,
        ...playersMap[pick.player_id],
      }));
      const draftedPlayerIds = draftedPlayers.map((player) => player.player_id);

      const rankedPlayers = Object.values(playersMap)
        .filter(isRankedPlayer)
        .sort((a, b) => a.rank - b.rank);
      const availableRankedPlayers = rankedPlayers.filter(
        (player) => !draftedPlayerIds.includes(player.player_id)
      );
      setAvailablePlayers(availableRankedPlayers);

      // Generate rosters and recommendations
      const rosterRequirements = {
        QB: draftDetails.settings.slots_qb,
        RB: draftDetails.settings.slots_rb,
        WR: draftDetails.settings.slots_wr,
        TE: draftDetails.settings.slots_te,
        K: draftDetails.settings.slots_k,
        DEF: draftDetails.settings.slots_def,
        FLEX: draftDetails.settings.slots_flex,
      };

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
      const userRosterId = draftSlot
        ? draftDetails.slot_to_roster_id[draftSlot]
        : null;
      const userRoster = userRosterId ? currentRosters[userRosterId] : null;
      setUserRoster(userRoster?.players);
      const nextPickRecommendations = userRoster
        ? getDraftRecommendations(
            availableRankedPlayers,
            userRoster.rosterPositionCounts,
            userRoster.remainingPositionRequirements
          )
        : null;

      setRecommendations(nextPickRecommendations);

      if (userRoster) {
        setUserPositionNeeds(userRoster.remainingPositionRequirements);
        setUserPositionCounts(userRoster.rosterPositionCounts);
      }

      const totalRemainingNeeds = calculateTotalRemainingNeeds(currentRosters);
      setDraftWideNeeds(totalRemainingNeeds);
    } catch (error) {
      console.error("Error fetching draft data:", error);
      setError("Failed to load draft data.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Fantasy Draft Assistant</h1>
      <div className="mb-4">
        <label className="block mb-2">User ID</label>
        <input
          type="text"
          className="border p-2 rounded w-full mb-2 text-black"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
      </div>
      <div className="mb-4">
        <label className="block mb-2">Draft ID</label>
        <input
          type="text"
          className="border p-2 rounded w-full mb-2 text-black"
          value={draftId}
          onChange={(e) => setDraftId(e.target.value)}
        />
      </div>
      <button
        onClick={fetchDraftData}
        className="bg-blue-500 text-white px-4 py-2 rounded"
        disabled={loading}
      >
        {loading ? "Loading..." : "Fetch Draft Data"}
      </button>

      {error && <p className="text-red-500 mt-4">{error}</p>}

      <details open className="mt-6">
        <summary className="cursor-pointer text-xl font-bold mb-4">
          Position Needs
        </summary>
        <PositionNeeds
          userPositionNeeds={userPositionNeeds}
          userPositionCounts={userPositionCounts}
          draftWideNeeds={draftWideNeeds}
        />
      </details>
      <details open className="mt-6">
        <summary className="cursor-pointer text-xl font-bold mb-4">
          Your Roster
        </summary>
        <UserRoster players={userRoster || []} />
      </details>
      <details open className="mt-6">
        <summary className="cursor-pointer text-xl font-bold mb-4">
          Recommendations
        </summary>
        <RecommendationsSection
          recommendations={recommendations}
          loading={loading}
        />
      </details>
      <details className="mt-6">
        <summary className="cursor-pointer text-xl font-bold mb-4">
          Available Ranked Players
        </summary>
        <AvailablePlayers
          availablePlayers={availablePlayers}
          loading={loading}
        />
      </details>
    </div>
  );
}
