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
} from "@/lib/draftHelpers";
import { DraftedPlayer } from "@/lib/schemas";
import { isRankedPlayer } from "@/lib/getPlayerss";

export default function DraftAssistantPage() {
  const [userId, setUserId] = useState<string>("");
  const [draftId, setDraftId] = useState<string>("");
  const [recommendations, setRecommendations] =
    useState<Recommendations | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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

      const rankedPlayers = Object.values(playersMap).filter(isRankedPlayer);
      const availableRankedPlayers = rankedPlayers.filter(
        (player) => !draftedPlayerIds.includes(player.player_id)
      );

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
      const nextPickRecommendations = userRoster
        ? getDraftRecommendations(
            availableRankedPlayers,
            userRoster.rosterPositionCounts,
            userRoster.remainingPositionRequirements
          )
        : null;

      setRecommendations(nextPickRecommendations);
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

      <div className="mt-6">
        <h2 className="text-xl font-bold mb-4">Next Pick Recommendations</h2>
        {loading ? (
          <p>Loading recommendations...</p>
        ) : recommendations ? (
          Object.entries(recommendations).map(([category, players]) => (
            <div key={category} className="mb-6">
              <h3 className="text-lg font-semibold mb-2 capitalize">
                {category}
              </h3>
              <table className="min-w-full bg-white text-black">
                <thead>
                  <tr>
                    <th className="py-2 px-4 border">Player</th>
                    <th className="py-2 px-4 border">Position</th>
                    <th className="py-2 px-4 border">Rank</th>
                    <th className="py-2 px-4 border">Tier</th>
                    <th className="py-2 px-4 border">Team</th>
                    <th className="py-2 px-4 border">Bye Week</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player) => (
                    <tr key={player.name} className="border">
                      <td className="py-2 px-4 border">{player.name}</td>
                      <td className="py-2 px-4 border">{player.position}</td>
                      <td className="py-2 px-4 border">{player.rank}</td>
                      <td className="py-2 px-4 border">{player.tier}</td>
                      <td className="py-2 px-4 border">{player.team}</td>
                      <td className="py-2 px-4 border">{player.bye_week}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        ) : (
          <p>No recommendations available.</p>
        )}
      </div>
    </div>
  );
}
