"use client";

import React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  RosteredPlayer,
  UpgradeOption,
  useLeagueData,
} from "@/hooks/useLeagueData";
import { DraftedPlayer, ROSTER_SLOTS, RosterSlot } from "@/lib/schemas";

const formSchema = z.object({
  leagueId: z.string().min(1, "League ID is required"),
  userId: z.string().min(1, "User ID is required"),
});

type FormData = z.infer<typeof formSchema>;

const LeagueManagerContent: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const leagueId = searchParams.get("leagueId") || "";
  const userId = searchParams.get("userId") || "";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      leagueId,
      userId,
    },
  });

  const {
    rosters,
    rosteredPlayerIds,
    scoringType,
    rankedAvailablePlayersByPosition,
    worstRankedUserPlayersByPosition,
    currentRoster,
    recommendedRoster,
    leagueDetails,
    upgradeOptions,
    isLoading,
    error,
    flexPlayerMap,
  } = useLeagueData(leagueId, userId);

  const onSubmit = (data: FormData) => {
    router.push(
      `/league-manager?leagueId=${data.leagueId}&userId=${data.userId}`
    );
  };

  if (isLoading) return <p>Loading league data...</p>;
  if (error) return <p className="text-red-500">Error: {error.message}</p>;

  return (
    <div className="p-6">
      <h1 className="text-4xl font-bold mb-6">League Manager</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="mb-8">
        <div className="mb-4">
          <label htmlFor="leagueId" className="block mb-2">
            League ID
          </label>
          <input
            id="leagueId"
            {...register("leagueId")}
            className="border p-2 rounded w-full mb-2 text-black"
          />
          {errors.leagueId && (
            <p className="text-red-500">{errors.leagueId.message}</p>
          )}
        </div>
        <div className="mb-4">
          <label htmlFor="userId" className="block mb-2">
            User ID
          </label>
          <input
            id="userId"
            {...register("userId")}
            className="border p-2 rounded w-full mb-2 text-black"
          />
          {errors.userId && (
            <p className="text-red-500">{errors.userId.message}</p>
          )}
        </div>
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Submit
        </button>
      </form>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">League Information</h2>
        <p>Total rosters: {rosters.length}</p>
        <p>Total rostered players: {rosteredPlayerIds.length}</p>
        {scoringType && <p>Scoring Type: {scoringType.toUpperCase()}</p>}
        {leagueDetails?.roster_positions && (
          <div>
            <p>Roster Positions:</p>
            <ul className="list-disc pl-5">
              {Object.entries(
                leagueDetails.roster_positions.reduce((acc, pos) => {
                  acc[pos] = (acc[pos] || 0) + 1;
                  return acc as Record<RosterSlot, number>;
                }, {} as Record<RosterSlot, number>)
              ).map(([position, count]) => (
                <li key={position}>
                  {position}: {count}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {currentRoster.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Who should I start?</h2>
          <RosterTable
            currentRoster={currentRoster}
            rosterPositions={leagueDetails?.roster_positions}
          />
        </section>
      )}

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Who should I pick up?</h2>
        {upgradeOptions ? (
          Object.entries(upgradeOptions).map(([position, upgrades]) => (
            <div key={position} className="mb-8">
              <h3 className="text-xl font-semibold mb-2">{position}</h3>
              {upgrades.length > 0 ? (
                upgrades.map((upgrade, index) => (
                  <UpgradeOptionDisplay key={index} upgrade={upgrade} />
                ))
              ) : (
                <p>No upgrades available for this position.</p>
              )}
            </div>
          ))
        ) : (
          <p>No upgrade opportunities available.</p>
        )}
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">
          Ranked Available Players
        </h2>
        {ROSTER_SLOTS.filter((position) => position !== "BN").map(
          (position) => (
            <div key={position} className="mb-8">
              <h3 className="text-xl font-semibold mb-2">
                {position === "FLEX" ? "FLEX (RB/WR/TE)" : position}
              </h3>
              {["RB", "WR", "TE", "QB", "K", "DEF"].includes(position) &&
                worstRankedUserPlayersByPosition[position] && (
                  <div className="mb-4">
                    <p className="font-semibold mb-2">
                      Your worst ranked {position}:
                    </p>
                    <PlayerTable
                      player={worstRankedUserPlayersByPosition[position]}
                    />
                  </div>
                )}
              <p className="font-semibold mb-2">
                Available {position} Players:
              </p>
              <AvailablePlayersTable
                players={rankedAvailablePlayersByPosition[position] || []}
              />
            </div>
          )
        )}
      </section>
    </div>
  );
};

const RosterTable: React.FC<{
  currentRoster: RosteredPlayer[];
  rosterPositions?: RosterSlot[];
}> = ({ currentRoster, rosterPositions }) => {
  const getSlotLabel = (slot: string) => slot;

  return (
    <div className="overflow-x-auto">
      <table className="w-full bg-gray-800 text-white">
        <thead className="bg-gray-700">
          <tr>
            <th className="px-4 py-2 text-left">Current Slot</th>
            <th className="px-4 py-2 text-left">Recommended Slot</th>
            <th className="px-4 py-2 text-left">Name</th>
            <th className="px-4 py-2 text-left">Position</th>
            <th className="px-4 py-2 text-left">Team</th>
            <th className="px-4 py-2 text-left">Tier</th>
            <th className="px-4 py-2 text-left">Rank</th>
          </tr>
        </thead>
        <tbody>
          {currentRoster.map((player) => {
            const shouldHighlight = player.slot !== player.recommendedSlot;
            const rowColor = shouldHighlight ? "bg-yellow-600" : "";

            return (
              <tr
                key={player.player_id}
                className={`border-b border-gray-700 ${rowColor}`}
              >
                <td className="px-4 py-2">{getSlotLabel(player.slot)}</td>
                <td className="px-4 py-2">
                  {getSlotLabel(player.recommendedSlot)}
                </td>
                <td className="px-4 py-2 font-medium">{player.name}</td>
                <td className="px-4 py-2">{player.position}</td>
                <td className="px-4 py-2">{player.team || "FA"}</td>
                <td className="px-4 py-2">{player.tier || "N/A"}</td>
                <td className="px-4 py-2">{player.rank || "N/A"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const UpgradeOptionDisplay: React.FC<{
  upgrade: UpgradeOption;
}> = ({ upgrade }) => (
  <div className="mb-4">
    <h4 className="text-lg font-semibold mb-2">Current Player:</h4>
    <table className="w-full bg-gray-800 text-white mb-2">
      <thead className="bg-gray-700">
        <tr>
          <th className="px-4 py-2 text-left">Name</th>
          <th className="px-4 py-2 text-left">Position</th>
          <th className="px-4 py-2 text-left">Team</th>
          <th className="px-4 py-2 text-left">Tier</th>
          <th className="px-4 py-2 text-left">Rank</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="px-4 py-2">{upgrade.currentPlayer.name}</td>
          <td className="px-4 py-2">{upgrade.currentPlayer.position}</td>
          <td className="px-4 py-2">{upgrade.currentPlayer.team || "FA"}</td>
          <td className="px-4 py-2">{upgrade.currentPlayer.tier || "N/A"}</td>
          <td className="px-4 py-2">{upgrade.currentPlayer.rank || "N/A"}</td>
        </tr>
      </tbody>
    </table>
    <h4 className="text-lg font-semibold mb-2">Better Players Available:</h4>
    <AvailablePlayersTable players={upgrade.betterPlayers} />
  </div>
);

const PlayerTable: React.FC<{ player: RosteredPlayer | DraftedPlayer }> = ({
  player,
}) => (
  <table className="w-full bg-gray-800 text-white mb-4">
    <thead className="bg-gray-700">
      <tr>
        <th className="px-4 py-2 text-left">Name</th>
        <th className="px-4 py-2 text-left">Position</th>
        <th className="px-4 py-2 text-left">Team</th>
        <th className="px-4 py-2 text-left">Tier</th>
        <th className="px-4 py-2 text-left">Rank</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td className="px-4 py-2">{player.name}</td>
        <td className="px-4 py-2">{player.position}</td>
        <td className="px-4 py-2">{player.team || "FA"}</td>
        <td className="px-4 py-2">{player.tier || "N/A"}</td>
        <td className="px-4 py-2">{player.rank || "N/A"}</td>
      </tr>
    </tbody>
  </table>
);

const AvailablePlayersTable: React.FC<{ players: DraftedPlayer[] }> = ({
  players,
}) => (
  <table className="w-full bg-gray-800 text-white">
    <thead className="bg-gray-700">
      <tr>
        <th className="px-4 py-2 text-left">Name</th>
        <th className="px-4 py-2 text-left">Position</th>
        <th className="px-4 py-2 text-left">Team</th>
        <th className="px-4 py-2 text-left">Tier</th>
        <th className="px-4 py-2 text-left">Rank</th>
      </tr>
    </thead>
    <tbody>
      {players.map((player) => (
        <tr key={player.player_id} className="border-b border-gray-700">
          <td className="px-4 py-2">{player.name}</td>
          <td className="px-4 py-2">{player.position}</td>
          <td className="px-4 py-2">{player.team || "FA"}</td>
          <td className="px-4 py-2">{player.tier || "N/A"}</td>
          <td className="px-4 py-2">{player.rank || "N/A"}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

export default LeagueManagerContent;
