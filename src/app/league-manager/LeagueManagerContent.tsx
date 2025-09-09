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
import {
  useSleeperUserByUsername,
  useSleeperLeaguesForYear,
  useSleeperUserById,
} from "@/hooks/useSleeper";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useQuery } from "@tanstack/react-query";
import { borischenSourceUrl } from "@/lib/borischen";

const LeagueManagerContent: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const leagueId = searchParams.get("leagueId") || "";
  const userId = searchParams.get("userId") || "";

  // Username lookup flow via submit
  const [submittedUsername, setSubmittedUsername] = React.useState<string>("");
  const currentYear = String(new Date().getFullYear());
  const userLookup = useSleeperUserByUsername(
    submittedUsername || undefined,
    Boolean(submittedUsername)
  );

  // Keep URL as source of truth for userId once we have a user result
  React.useEffect(() => {
    const newUserId = userLookup.data?.user_id;
    if (!newUserId) return;
    if (newUserId && newUserId !== userId) {
      const p = new URLSearchParams(Array.from(searchParams.entries()));
      p.set("userId", newUserId);
      router.push(`/league-manager?${p.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLookup.data?.user_id]);

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

      <LastUpdatedCard scoring={scoringType ?? "std"} />

      {/* User: show either input or selected card */}
      {!userId ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>User Input</CardTitle>
          </CardHeader>
          <CardContent>
            <UsernameCard
              loading={userLookup.isLoading}
              onSubmit={(u) => setSubmittedUsername(u)}
            />
          </CardContent>
        </Card>
      ) : (
        <SelectedUserCard
          userId={userId}
          onClear={() => {
            const p = new URLSearchParams(Array.from(searchParams.entries()));
            p.delete("userId");
            p.delete("leagueId");
            router.push(`/league-manager?${p.toString()}`);
            setSubmittedUsername("");
          }}
        />
      )}

      {/* League: show selection or selected card based on URL */}
      {userId && !leagueId && (
        <LeagueSelectionCard
          userId={userId}
          currentYear={currentYear}
          selectedLeagueId={leagueId}
          onSelect={(val) => {
            const p = new URLSearchParams(Array.from(searchParams.entries()));
            p.set("leagueId", val);
            p.set("userId", userId);
            // Update URL without causing a full navigation refresh
            router.replace(`/league-manager?${p.toString()}`);
          }}
        />
      )}
      {userId && leagueId && (
        <SelectedLeagueCard
          userId={userId}
          leagueId={leagueId}
          currentYear={currentYear}
          onClear={() => {
            const p = new URLSearchParams(Array.from(searchParams.entries()));
            p.delete("leagueId");
            router.push(`/league-manager?${p.toString()}`);
          }}
        />
      )}

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
              className={
                shouldHighlight ? "bg-yellow-50 dark:bg-yellow-900/30" : ""
              }
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
              <TableCell>
                {player.isEmpty ? "-" : player.tier || "N/A"}
              </TableCell>
              <TableCell>
                {player.isEmpty ? "-" : player.rank || "N/A"}
              </TableCell>
              <TableCell>
                {player.isEmpty ? "-" : player.flexTier || "N/A"}
              </TableCell>
              <TableCell>
                {player.isEmpty ? "-" : player.flexRank || "N/A"}
              </TableCell>
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
    <h4 className="text-base font-semibold mt-4 mb-2">
      Better Players Available
    </h4>
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
            <TableCell>
              {(player as RosteredPlayer).flexTier || "N/A"}
            </TableCell>
            <TableCell>
              {(player as RosteredPlayer).flexRank || "N/A"}
            </TableCell>
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

// --- Local UI helper components ---

function UsernameCard({
  onSubmit,
  loading,
}: {
  onSubmit: (username: string) => void;
  loading: boolean;
}) {
  const UsernameSchema = z.object({
    username: z.string().min(1, "Username is required"),
  });
  type UsernameForm = z.infer<typeof UsernameSchema>;
  const form = useForm<UsernameForm>({
    resolver: zodResolver(UsernameSchema),
    defaultValues: { username: "" },
  });
  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => onSubmit(data.username.trim()))}
        className="space-y-3"
      >
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="sleeper-username">Sleeper Username</FormLabel>
              <FormControl>
                <Input
                  id="sleeper-username"
                  placeholder="enter username"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Working..." : "Submit"}
        </Button>
      </form>
    </Form>
  );
}

function LastUpdatedCard({ scoring }: { scoring: "std" | "half" | "ppr" }) {
  const positions = ["QB", "RB", "WR", "TE", "FLEX", "K", "DEF"] as const;
  type Pos = (typeof positions)[number];
  const { data, isLoading } = useQuery<Record<Pos, number | null>, Error>({
    queryKey: ["borischen", "meta", scoring],
    queryFn: async () => {
      const entries = await Promise.all(
        positions.map(async (pos) => {
          try {
            // Kickers and DEF don't vary by scoring; fall back to std
            const metaScoring = pos === "K" || pos === "DEF" ? "std" : scoring;
            const res = await fetch(
              `/data/borischen/${pos}-${metaScoring}-metadata.json`,
              { cache: "no-store" }
            );
            if (!res.ok) return [pos, null] as const;
            const json = (await res.json()) as { lastModified?: string };
            const lm = json?.lastModified;
            if (!lm) return [pos, null] as const;
            const d = new Date(lm);
            return [pos, isNaN(d.getTime()) ? null : d.getTime()] as const;
          } catch {
            return [pos, null] as const;
          }
        })
      );
      return Object.fromEntries(entries) as Record<Pos, number | null>;
    },
    staleTime: 60 * 60 * 1000,
  });

  // Simple ticker to refresh relative time labels
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    const id = setInterval(() => force(), 60_000); // 1 minute
    return () => clearInterval(id);
  }, []);

  function formatAgo(ts: number | null): string {
    if (!ts) return "Unknown";
    const now = Date.now();
    const diffMs = Math.max(0, now - ts);
    const sec = Math.floor(diffMs / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    const day = Math.floor(hr / 24);
    const wk = Math.floor(day / 7);
    if (wk >= 1) return wk === 1 ? "1 week ago" : `${wk} weeks ago`;
    if (day >= 1) return day === 1 ? "1 day ago" : `${day} days ago`;
    if (hr >= 1) return hr === 1 ? "1 hour ago" : `${hr} hours ago`;
    if (min >= 1) return min === 1 ? "1 minute ago" : `${min} minutes ago`;
    return sec <= 1 ? "just now" : `${sec} seconds ago`;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Last Updated</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm space-y-1">
          <div className="font-medium">Boris Chen</div>
          {isLoading || !data ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : (
            <div className="grid grid-cols-2 gap-y-1 gap-x-4 md:grid-cols-7">
              {positions.map((pos) => {
                const metaScoring =
                  pos === "K" || pos === "DEF" ? "std" : scoring;
                const href = borischenSourceUrl(pos, metaScoring);
                return (
                  <div
                    key={pos}
                    className="flex items-center justify-between gap-3"
                  >
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground underline-offset-2 hover:underline"
                      title={`Open Boris Chen source for ${pos} (${metaScoring})`}
                    >
                      {pos}
                    </a>
                    <span>{formatAgo(data[pos] ?? null)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SelectedUserCard({
  userId,
  onClear,
}: {
  userId: string | null | undefined;
  onClear: () => void;
}) {
  const { data: user } = useSleeperUserById(
    userId || undefined,
    Boolean(userId)
  );
  if (!userId) return null;
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Selected User</CardTitle>
      </CardHeader>
      <CardContent className="flex items-start justify-between">
        <div>
          <div className="text-lg font-semibold">{user?.username || "—"}</div>
          <div className="text-sm text-muted-foreground">userId: {userId}</div>
        </div>
        <Button variant="default" onClick={onClear}>
          Clear user
        </Button>
      </CardContent>
    </Card>
  );
}

function LeagueSelectionCard({
  userId,
  currentYear,
  selectedLeagueId,
  onSelect,
}: {
  userId: string;
  currentYear: string;
  selectedLeagueId: string | null | undefined;
  onSelect: (leagueId: string) => void;
}) {
  const { data: leagues, isLoading } = useSleeperLeaguesForYear(
    userId,
    currentYear,
    true
  );
  const [selection, setSelection] = React.useState<string>(
    selectedLeagueId || ""
  );
  React.useEffect(() => {
    setSelection(selectedLeagueId || "");
  }, [selectedLeagueId]);
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>League Selection</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Select League</Label>
        </div>
        <RadioGroup
          value={selection}
          onValueChange={(val) => {
            setSelection(val);
            onSelect(val);
          }}
          className="space-y-3"
        >
          {(leagues || []).map((lg) => (
            <label
              key={lg.league_id}
              className="flex gap-3 rounded-md border p-3"
            >
              <RadioGroupItem value={lg.league_id} />
              <div className="flex flex-col">
                <div className="font-medium">{lg.name}</div>
                <div className="text-sm text-muted-foreground">
                  leagueId: {lg.league_id}
                </div>
              </div>
            </label>
          ))}
          {!isLoading && (leagues || []).length === 0 && (
            <div className="text-sm text-muted-foreground">
              No leagues found.
            </div>
          )}
        </RadioGroup>
        {/* No clear button in selection card; clear exists in SelectedLeagueCard */}
      </CardContent>
    </Card>
  );
}

function SelectedLeagueCard({
  userId,
  leagueId,
  currentYear,
  onClear,
}: {
  userId: string;
  leagueId: string;
  currentYear: string;
  onClear: () => void;
}) {
  // Reuse leagues query to get display info and find selected league
  const { data: leagues } = useSleeperLeaguesForYear(userId, currentYear, true);
  const lg = (leagues || []).find((l) => l.league_id === leagueId);
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Selected League</CardTitle>
      </CardHeader>
      <CardContent className="flex items-start justify-between">
        <div>
          <div className="text-lg font-semibold">{lg?.name || "—"}</div>
          <div className="text-sm text-muted-foreground">
            leagueId: {leagueId}
          </div>
        </div>
        <Button variant="default" onClick={onClear}>
          Clear league
        </Button>
      </CardContent>
    </Card>
  );
}
