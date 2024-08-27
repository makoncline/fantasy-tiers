import { DraftedPlayer } from "@/lib/schemas";

interface UserRosterProps {
  players: DraftedPlayer[];
}

export default function UserRoster({ players }: UserRosterProps) {
  return (
    <div className="mt-6">
      {players.length === 0 ? (
        <p>You haven&apos;t drafted any players yet.</p>
      ) : (
        <table className="min-w-full bg-white border text-black">
          <thead>
            <tr>
              <th className="py-2 px-4 border">Position</th>
              <th className="py-2 px-4 border">Player</th>
              <th className="py-2 px-4 border">Rank</th>
              <th className="py-2 px-4 border">Tier</th>
              <th className="py-2 px-4 border">Team</th>
              <th className="py-2 px-4 border">Bye Week</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.player_id} className="border">
                <td className="py-2 px-4 border">{player.position}</td>
                <td className="py-2 px-4 border">{player.name}</td>
                <td className="py-2 px-4 border">{player.rank}</td>
                <td className="py-2 px-4 border">{player.tier}</td>
                <td className="py-2 px-4 border">{player.team}</td>
                <td className="py-2 px-4 border">{player.bye_week}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
