"use client";

import React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { RosteredPlayer, UpgradeOption } from "@/hooks/useLeagueData";
import { useLeagueData } from "@/hooks/useLeagueData";
import type { DraftedPlayer, RosterSlot } from "@/lib/schemas";
import { ROSTER_SLOTS } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

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

  const form = useForm<FormData>({
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
    leagueDetails,
    upgradeOptions,
    isLoading,
    error,
  } = useLeagueData(leagueId, userId);

  const onSubmit = (data: FormData) => {
    router.push(
      `/league-manager?leagueId=${data.leagueId}&userId=${data.userId}`
    );
  };

  if (isLoading)
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-7 w-60" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-7 w-60" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  if (error)
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error.message || "There was a problem loading league data."}
          </AlertDescription>
        </Alert>
      </div>
    );

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">League Manager</h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>League Lookup</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="leagueId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>League ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter Sleeper league ID" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your Sleeper user ID" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-end">
                <Button type="submit" className="w-full">Load</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>League Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <p>Total rosters: {rosters.length}</p>
            <p>Total rostered players: {rosteredPlayerIds.length}</p>
            {scoringType && <p>Scoring Type: {scoringType.toUpperCase()}</p>}
          </div>
          {leagueDetails?.roster_positions && (
            <div className="mt-4">
              <p className="font-medium mb-2">Roster Positions</p>
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
        </CardContent>
      </Card>

      {currentRoster.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Who should I start?</CardTitle>
          </CardHeader>
          <CardContent>
            <RosterTable
              currentRoster={currentRoster}
              {...(leagueDetails?.roster_positions && {
                rosterPositions: leagueDetails.roster_positions,
              })}
            />
          </CardContent>
        </Card>
      )}

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Who should I pick up?</CardTitle>
        </CardHeader>
        <CardContent>
          {upgradeOptions ? (
            Object.entries(upgradeOptions).map(([position, upgrades]) => (
              <div key={position} className="mb-8">
                <h3 className="text-lg font-semibold mb-2">{position}</h3>
                {upgrades.length > 0 ? (
                  upgrades.map((upgrade, index) => (
                    <UpgradeOptionDisplay key={index} upgrade={upgrade} />
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No upgrades available for this position.
                  </p>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No upgrade opportunities available.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Ranked Available Players</CardTitle>
        </CardHeader>
        <CardContent>
          {ROSTER_SLOTS.filter((position) => position !== "BN").map(
            (position) => (
              <div key={position} className="mb-8">
                <h3 className="text-lg font-semibold mb-2">
                  {position === "FLEX" ? "FLEX (RB/WR/TE)" : position}
                </h3>
                {["RB", "WR", "TE", "QB", "K", "DEF", "FLEX"].includes(
                  position
                ) &&
                  worstRankedUserPlayersByPosition[position] && (
                    <div className="mb-4">
                      <p className="font-semibold mb-2">
                        Your worst ranked {position}:
                      </p>
                      <PlayerTable
                        player={worstRankedUserPlayersByPosition[position]}
                        isFlex={position === "FLEX"}
                      />
                    </div>
                  )}
                <p className="font-semibold mb-2">
                  Available {position} Players:
                </p>
                {rankedAvailablePlayersByPosition[position]?.length > 0 ? (
                  <AvailablePlayersTable
                    players={rankedAvailablePlayersByPosition[position] || []}
                    isFlex={position === "FLEX"}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No available players for this position.
                  </p>
                )}
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const RosterTable: React.FC<{
  currentRoster: RosteredPlayer[];
  rosterPositions?: RosterSlot[];
}> = ({ currentRoster }) => {
  const getSlotLabel = (slot: string) => slot;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Current Slot</TableHead>
          <TableHead>Recommended Slot</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Position</TableHead>
          <TableHead>Team</TableHead>
          <TableHead>Tier</TableHead>
          <TableHead>Rank</TableHead>
          <TableHead>FLEX Tier</TableHead>
          <TableHead>FLEX Rank</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {currentRoster.map((player) => {
          const shouldHighlight =
            player.slot !== player.recommendedSlot || player.isEmpty;
          return (
            <TableRow
              key={player.player_id}
              className={shouldHighlight ? "bg-yellow-50 dark:bg-yellow-900/30" : ""}
            >
              <TableCell>{getSlotLabel(player.slot)}</TableCell>
              <TableCell>
                {player.isEmpty
                  ? "-"
                  : getSlotLabel(player.recommendedSlot || player.slot)}
              </TableCell>
              <TableCell className="font-medium">
                {player.isEmpty ? "Empty Slot" : player.name}
              </TableCell>
              <TableCell>{player.isEmpty ? "-" : player.position}</TableCell>
              <TableCell>{player.isEmpty ? "-" : player.team || "-"}</TableCell>
              <TableCell>{player.isEmpty ? "-" : player.tier || "N/A"}</TableCell>
              <TableCell>{player.isEmpty ? "-" : player.rank || "N/A"}</TableCell>
              <TableCell>{player.isEmpty ? "-" : player.flexTier || "N/A"}</TableCell>
              <TableCell>{player.isEmpty ? "-" : player.flexRank || "N/A"}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

const UpgradeOptionDisplay: React.FC<{
  upgrade: UpgradeOption;
}> = ({ upgrade }) => (
  <div className="mb-4">
    <h4 className="text-base font-semibold mb-2">Current Player</h4>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Position</TableHead>
          <TableHead>Team</TableHead>
          <TableHead>Tier</TableHead>
          <TableHead>Rank</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>{upgrade.currentPlayer.name}</TableCell>
          <TableCell>{upgrade.currentPlayer.position}</TableCell>
          <TableCell>{upgrade.currentPlayer.team || "FA"}</TableCell>
          <TableCell>{upgrade.currentPlayer.tier || "N/A"}</TableCell>
          <TableCell>{upgrade.currentPlayer.rank || "N/A"}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
    <h4 className="text-base font-semibold mt-4 mb-2">Better Players Available</h4>
    <AvailablePlayersTable players={upgrade.betterPlayers} />
  </div>
);

const PlayerTable: React.FC<{
  player: RosteredPlayer | DraftedPlayer;
  isFlex?: boolean;
}> = ({ player, isFlex = false }) => (
  <Table className="mb-4">
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead>Position</TableHead>
        <TableHead>Team</TableHead>
        <TableHead>Tier</TableHead>
        <TableHead>Rank</TableHead>
        {isFlex && (
          <>
            <TableHead>FLEX Tier</TableHead>
            <TableHead>FLEX Rank</TableHead>
          </>
        )}
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell>{player.name}</TableCell>
        <TableCell>{player.position}</TableCell>
        <TableCell>{player.team || "FA"}</TableCell>
        <TableCell>{player.tier || "N/A"}</TableCell>
        <TableCell>{player.rank || "N/A"}</TableCell>
        {isFlex && (
          <>
            <TableCell>{(player as RosteredPlayer).flexTier || "N/A"}</TableCell>
            <TableCell>{(player as RosteredPlayer).flexRank || "N/A"}</TableCell>
          </>
        )}
      </TableRow>
    </TableBody>
  </Table>
);

const AvailablePlayersTable: React.FC<{
  players: DraftedPlayer[];
  isFlex?: boolean;
}> = ({ players, isFlex = false }) => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead>Position</TableHead>
        <TableHead>Team</TableHead>
        <TableHead>Tier</TableHead>
        <TableHead>Rank</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {players.length > 0 ? (
        players.map((player) => (
          <TableRow key={player.player_id}>
            <TableCell>{player.name}</TableCell>
            <TableCell>{player.position}</TableCell>
            <TableCell>{player.team || "FA"}</TableCell>
            <TableCell>{player.tier || "N/A"}</TableCell>
            <TableCell>{player.rank || "N/A"}</TableCell>
          </TableRow>
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={isFlex ? 7 : 5} className="text-center">
            No available players for this position.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  </Table>
);

export default LeagueManagerContent;
