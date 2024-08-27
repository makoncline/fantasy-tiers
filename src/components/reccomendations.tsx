// src/components/Recommendations.tsx

import { Recommendations } from "@/lib/draftHelpers";
import { DraftedPlayer } from "@/lib/schemas";

interface RecommendationsProps {
  recommendations: Recommendations | null;
  loading: boolean;
}

export default function RecommendationsSection({
  recommendations,
  loading,
}: RecommendationsProps) {
  if (loading) {
    return <p>Loading recommendations...</p>;
  }

  if (!recommendations) {
    return <p>No recommendations available.</p>;
  }

  return (
    <div className="mt-6">
      {Object.entries(recommendations).map(([category, players]) => (
        <div key={category} className="mb-6">
          <h3 className="text-lg font-semibold mb-2 capitalize">{category}</h3>
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
              {(players as DraftedPlayer[]).map((player) => (
                <tr key={player.player_id} className="border">
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
      ))}
    </div>
  );
}
