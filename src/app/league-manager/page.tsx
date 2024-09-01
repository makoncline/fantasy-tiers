"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLeagueData } from "@/hooks/useLeagueData";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

const formSchema = z.object({
  leagueId: z.string().min(1, "League ID is required"),
  userId: z.string().min(1, "User ID is required"),
});

type FormData = z.infer<typeof formSchema>;

function LeagueManagerContent() {
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
    topAvailablePlayersByPosition,
    currentRoster,
    recommendedRoster,
    leagueDetails,
    isLoading,
    error,
  } = useLeagueData(leagueId, userId);

  const onSubmit = (data: FormData) => {
    console.log("Form submitted with data:", data);
    router.push(
      `/league-manager?leagueId=${data.leagueId}&userId=${data.userId}`
    );
  };

  const getSlotLabel = (
    slot: string,
    index: number,
    slotCounts: Record<string, number>
  ) => {
    if (slot === "BN" || slotCounts[slot] === 1) return slot;
    return `${slot} ${index}`;
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">League Manager</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="mb-4">
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

      {isLoading && <p>Loading league data...</p>}
      {error && <p className="text-red-500">Error: {error.message}</p>}

      {currentRoster.length > 0 && (
        <div className="mt-6">
          <h2 className="text-2xl font-bold mb-4">Your Current Roster</h2>
          <RosterTable
            players={currentRoster}
            rosterPositions={leagueDetails?.roster_positions}
          />
        </div>
      )}

      {recommendedRoster.length > 0 && (
        <div className="mt-6">
          <h2 className="text-2xl font-bold mb-4">Recommended Roster</h2>
          <RosterTable
            players={recommendedRoster}
            rosterPositions={leagueDetails?.roster_positions}
          />
        </div>
      )}

      <div className="mt-6">
        <h2 className="text-xl font-bold mb-2">League Information</h2>
        <p>Total rosters: {rosters.length}</p>
        <p>Total rostered players: {rosteredPlayerIds.length}</p>
        {scoringType && <p>Scoring Type: {scoringType.toUpperCase()}</p>}
        {leagueDetails?.roster_positions && (
          <div>
            <p>Roster Positions:</p>
            <ul className="list-disc pl-5">
              {leagueDetails.roster_positions
                .filter((pos) => pos !== "BN")
                .reduce((acc, pos) => {
                  const existingPos = acc.find((p) => p.position === pos);
                  if (existingPos) {
                    existingPos.count++;
                  } else {
                    acc.push({ position: pos, count: 1 });
                  }
                  return acc;
                }, [] as { position: string; count: number }[])
                .map(({ position, count }) => (
                  <li key={position}>
                    {position}: {count}
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>

      {topAvailablePlayersByPosition &&
        Object.keys(topAvailablePlayersByPosition).length > 0 && (
          <div className="mt-6">
            <h2 className="text-xl font-bold mb-2">
              Top Available Players by Position
            </h2>
            {Object.entries(topAvailablePlayersByPosition).map(
              ([position, players]) => (
                <div key={position} className="mb-4">
                  <h3 className="text-lg font-semibold">
                    {position === "FLEX" ? "FLEX (RB/WR/TE)" : position}
                  </h3>
                  <ul className="list-disc pl-5">
                    {players.map((player) => (
                      <li key={player.player_id} className="mb-1">
                        <strong>{player.name}</strong> ({player.position} -{" "}
                        {player.team || "FA"}) - Rank: {player.rank || "N/A"},
                        Tier: {player.tier || "N/A"}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            )}
          </div>
        )}
    </div>
  );
}

interface RosterTableProps {
  players: RosterPlayer[];
  rosterPositions?: string[];
}

function RosterTable({ players, rosterPositions }: RosterTableProps) {
  const getSlotLabel = (
    slot: string,
    index: number,
    slotCounts: Record<string, number>
  ) => {
    if (slot === "BN" || slotCounts[slot] === 1) return slot;
    return `${slot} ${index}`;
  };

  const slotCounts =
    rosterPositions?.reduce((acc, slot) => {
      acc[slot] = (acc[slot] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

  const currentSlotCounts: Record<string, number> = {};

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-gray-800 text-white">
        <thead className="bg-gray-700">
          <tr>
            <th className="px-4 py-2 text-left">Slot</th>
            <th className="px-4 py-2 text-left">Position</th>
            <th className="px-4 py-2 text-left">Name</th>
            <th className="px-4 py-2 text-left">Team</th>
            <th className="px-4 py-2 text-left">Tier</th>
            <th className="px-4 py-2 text-left">Rank</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => {
            currentSlotCounts[player.slot] =
              (currentSlotCounts[player.slot] || 0) + 1;
            const slotLabel = getSlotLabel(
              player.slot,
              currentSlotCounts[player.slot],
              slotCounts
            );

            return (
              <tr
                key={player.player_id}
                className="border-b border-gray-700 hover:bg-gray-600 transition-colors duration-150"
              >
                <td className="px-4 py-2">{slotLabel}</td>
                <td className="px-4 py-2">{player.position}</td>
                <td className="px-4 py-2 font-medium">{player.name}</td>
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
}

export default function LeagueManagerPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <LeagueManagerContent />
    </QueryClientProvider>
  );
}
