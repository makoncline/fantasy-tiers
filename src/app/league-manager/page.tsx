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
    upgradeOptions,
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

  const combinedRoster = currentRoster.map((player) => {
    const recommendedPlayer = recommendedRoster.find(
      (rp) => rp.player_id === player.player_id
    );
    return {
      ...player,
      recommendedSlot: recommendedPlayer ? recommendedPlayer.slot : "BN",
    };
  });

  const positions = ["QB", "RB", "WR", "TE", "K", "DEF", "FLEX"];

  return (
    <div className="p-6">
      <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl mb-6">
        League Manager
      </h1>

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

      {isLoading && <p>Loading league data...</p>}
      {error && <p className="text-red-500">Error: {error.message}</p>}

      <section className="mb-12">
        <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight transition-colors first:mt-0 mb-4">
          League Information
        </h2>
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
      </section>

      {combinedRoster.length > 0 && (
        <section className="mb-12">
          <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight transition-colors first:mt-0 mb-4">
            Who Should You Start?
          </h2>
          <RosterTable
            players={combinedRoster}
            rosterPositions={leagueDetails?.roster_positions}
          />
        </section>
      )}

      <section className="mb-12">
        <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight transition-colors first:mt-0 mb-4">
          Who Should You Pick Up?
        </h2>
        {positions.map((position) => (
          <div key={position} className="mb-8">
            <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight mb-4">
              {position === "FLEX" ? "FLEX (RB/WR/TE)" : position}
            </h3>

            <div className="mb-6">
              <h4 className="scroll-m-20 text-xl font-semibold tracking-tight mb-2">
                Potential Upgrades
              </h4>
              {upgradeOptions[position] &&
              upgradeOptions[position].length > 0 ? (
                Object.values(
                  upgradeOptions[position].reduce((acc, option) => {
                    if (!acc[option.currentPlayer.player_id]) {
                      acc[option.currentPlayer.player_id] = {
                        currentPlayer: option.currentPlayer,
                        replacements: [],
                      };
                    }
                    acc[option.currentPlayer.player_id].replacements.push(
                      option.availablePlayer
                    );
                    return acc;
                  }, {} as Record<string, { currentPlayer: DraftedPlayer; replacements: DraftedPlayer[] }>)
                ).map((group, index) => (
                  <div key={index} className="mb-4">
                    <h5 className="scroll-m-20 text-lg font-semibold tracking-tight mb-2">
                      Current Player
                    </h5>
                    <table className="min-w-full bg-gray-800 text-white mb-2">
                      <thead className="bg-gray-700">
                        <tr>
                          <th className="px-4 py-2 text-left">Name</th>
                          <th className="px-4 py-2 text-left">Position</th>
                          <th className="px-4 py-2 text-left">Team</th>
                          <th className="px-4 py-2 text-left">Rank</th>
                          <th className="px-4 py-2 text-left">Tier</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="px-4 py-2">
                            {group.currentPlayer.name}
                          </td>
                          <td className="px-4 py-2">
                            {group.currentPlayer.position}
                          </td>
                          <td className="px-4 py-2">
                            {group.currentPlayer.team || "FA"}
                          </td>
                          <td className="px-4 py-2">
                            {group.currentPlayer.rank || "N/A"}
                          </td>
                          <td className="px-4 py-2">
                            {group.currentPlayer.tier || "N/A"}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <h5 className="scroll-m-20 text-lg font-semibold tracking-tight mb-2">
                      Replacement Options
                    </h5>
                    <table className="min-w-full bg-gray-800 text-white">
                      <thead className="bg-gray-700">
                        <tr>
                          <th className="px-4 py-2 text-left">Name</th>
                          <th className="px-4 py-2 text-left">Position</th>
                          <th className="px-4 py-2 text-left">Team</th>
                          <th className="px-4 py-2 text-left">Rank</th>
                          <th className="px-4 py-2 text-left">Tier</th>
                          <th className="px-4 py-2 text-left">
                            Rank Improvement
                          </th>
                          <th className="px-4 py-2 text-left">
                            Tier Improvement
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.replacements.map((replacement, repIndex) => (
                          <tr key={repIndex}>
                            <td className="px-4 py-2">{replacement.name}</td>
                            <td className="px-4 py-2">
                              {replacement.position}
                            </td>
                            <td className="px-4 py-2">
                              {replacement.team || "FA"}
                            </td>
                            <td className="px-4 py-2">
                              {replacement.rank || "N/A"}
                            </td>
                            <td className="px-4 py-2">
                              {replacement.tier || "N/A"}
                            </td>
                            <td className="px-4 py-2">
                              {(group.currentPlayer.rank || 0) -
                                (replacement.rank || 0)}
                            </td>
                            <td className="px-4 py-2">
                              {(group.currentPlayer.tier || 0) -
                                (replacement.tier || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              ) : (
                <p>No potential upgrades available for this position.</p>
              )}
            </div>

            <h4 className="scroll-m-20 text-xl font-semibold tracking-tight mb-2">
              Best Available Players
            </h4>
            {topAvailablePlayersByPosition[position] &&
            topAvailablePlayersByPosition[position].length > 0 ? (
              <table className="min-w-full bg-gray-800 text-white">
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
                  {topAvailablePlayersByPosition[position].map((player) => (
                    <tr
                      key={player.player_id}
                      className="border-b border-gray-700"
                    >
                      <td className="px-4 py-2">{player.name}</td>
                      <td className="px-4 py-2">{player.position}</td>
                      <td className="px-4 py-2">{player.team || "FA"}</td>
                      <td className="px-4 py-2">{player.tier || "N/A"}</td>
                      <td className="px-4 py-2">{player.rank || "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No available ranked players for this position.</p>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

interface RosterPlayer extends DraftedPlayer {
  slot: string;
  recommendedSlot: string;
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

  const sortedPlayers = players.sort((a, b) => {
    // Sort by current slot first, following the order in rosterPositions
    const aIndex = rosterPositions?.indexOf(a.slot) ?? -1;
    const bIndex = rosterPositions?.indexOf(b.slot) ?? -1;
    if (aIndex !== bIndex) {
      // If one is BN and the other isn't, put BN at the end
      if (a.slot === "BN") return 1;
      if (b.slot === "BN") return -1;
      return aIndex - bIndex;
    }

    // If slots are the same, sort by rank (lower rank is better)
    return (a.rank || Infinity) - (b.rank || Infinity);
  });

  const currentSlotCounts: Record<string, number> = {};
  const recommendedSlotCounts: Record<string, number> = {};

  // Pre-sort players for recommended slots
  const playersByRecommendedSlot = sortedPlayers.reduce((acc, player) => {
    if (!acc[player.recommendedSlot]) {
      acc[player.recommendedSlot] = [];
    }
    acc[player.recommendedSlot].push(player);
    return acc;
  }, {} as Record<string, RosterPlayer[]>);

  // Sort players within each recommended slot by rank
  Object.values(playersByRecommendedSlot).forEach((players) => {
    players.sort((a, b) => (a.rank || Infinity) - (b.rank || Infinity));
  });

  const getSlotBase = (slot: string) => slot.split(" ")[0];

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-gray-800 text-white">
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
          {sortedPlayers.map((player) => {
            currentSlotCounts[player.slot] =
              (currentSlotCounts[player.slot] || 0) + 1;

            // Find the index of this player in its recommended slot group
            const recommendedSlotIndex = playersByRecommendedSlot[
              player.recommendedSlot
            ].findIndex((p) => p.player_id === player.player_id);
            recommendedSlotCounts[player.recommendedSlot] =
              recommendedSlotIndex + 1;

            const currentSlotLabel = getSlotLabel(
              player.slot,
              currentSlotCounts[player.slot],
              slotCounts
            );
            const recommendedSlotLabel = getSlotLabel(
              player.recommendedSlot,
              recommendedSlotCounts[player.recommendedSlot],
              slotCounts
            );

            const shouldHighlight =
              getSlotBase(currentSlotLabel) !==
                getSlotBase(recommendedSlotLabel) ||
              currentSlotLabel !== recommendedSlotLabel;
            const rowColor = shouldHighlight ? "bg-yellow-600" : "";

            return (
              <tr
                key={player.player_id}
                className={`border-b border-gray-700 ${rowColor}`}
              >
                <td className="px-4 py-2">{currentSlotLabel}</td>
                <td className="px-4 py-2">{recommendedSlotLabel}</td>
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
}

export default function LeagueManagerPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <LeagueManagerContent />
    </QueryClientProvider>
  );
}
