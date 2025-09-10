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
  useSleeperNflState,
  useSleeperLeagueUsers,
} from "@/hooks/useSleeper";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useQuery } from "@tanstack/react-query";
import { borischenSourceUrl } from "@/lib/borischen";
import { Badge } from "@/components/ui/badge";

// Toggle: always include the app user's own players in the All Players table
const ALWAYS_SHOW_MY_PLAYERS = true;
// Default number of rows to show per position table before expanding
const DEFAULT_VISIBLE_ROWS = 10;

const LeagueManagerContent: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const leagueId = searchParams.get("leagueId") || "";
  const userId = searchParams.get("userId") || "";

  // Username lookup flow via submit
  const [submittedUsername, setSubmittedUsername] = React.useState<string>("");
  const nflState = useSleeperNflState();
  const currentYear = nflState.data?.season ?? String(new Date().getFullYear());
  const userLookup = useSleeperUserByUsername(
    submittedUsername || undefined,
    Boolean(submittedUsername)
  );
  // Toggle to include rostered/unavailable players in the All Players table
  const [showUnavailable, setShowUnavailable] = React.useState<boolean>(false);
  // Toggle to show all rows by default in the All Players table
  const [showAll, setShowAll] = React.useState<boolean>(false);

  // Global sort state for all players tables
  const [globalSortKey, setGlobalSortKey] =
    React.useState<TableSortKey>("bc_rank");
  const [globalSortDir, setGlobalSortDir] = React.useState<"asc" | "desc">(
    "asc"
  );
  const onGlobalSort = React.useCallback(
    (key: TableSortKey) => {
      if (globalSortKey === key) {
        setGlobalSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setGlobalSortKey(key);
        // Default to descending for % owned and grade; ascending otherwise
        const initialDir: "asc" | "desc" =
          key === "fp_owned" || key === "fp_grade" ? "desc" : "asc";
        setGlobalSortDir(initialDir);
      }
    },
    [globalSortKey]
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

  // League users for owner display/team names
  const leagueUsers = useSleeperLeagueUsers(
    leagueId || undefined,
    Boolean(leagueId)
  );

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

  function buildOwnerMap(
    rostersIn: any[],
    users: Array<{
      user_id: string;
      display_name: string | undefined;
      metadata: { team_name: string | undefined } | undefined;
    }>
  ): Map<string, { name: string; userId: string }> {
    const map = new Map<string, { name: string; userId: string }>();
    const userName: Record<string, string> = {};
    for (const u of users || []) {
      const uid = String(u?.user_id || "");
      const tn =
        (u?.metadata?.team_name as string | undefined) ||
        (u?.display_name as string | undefined) ||
        uid ||
        "Unknown";
      if (uid) userName[uid] = tn;
    }
    for (const r of rostersIn || []) {
      const ownerUserId = String(r?.owner_id || r?.owner?.user_id || "");
      const ownerName =
        (r?.metadata?.team_name as string | undefined) ||
        userName[ownerUserId] ||
        ownerUserId ||
        "Unknown";
      const playerIds: string[] = Array.isArray(r?.players) ? r.players : [];
      for (const pid of playerIds) {
        const key = String(pid);
        if (!map.has(key))
          map.set(key, { name: ownerName, userId: ownerUserId });
      }
    }
    return map;
  }

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
            <p>Season: {currentYear}</p>
            <p>Week: {nflState.data?.week ?? "—"}</p>
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

      {/* Players by position controls and anchors */}
      <div className="sticky top-0 z-20 mb-2 border-b bg-background/95 pb-2 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <h2 className="text-2xl font-semibold mb-2">Players by position</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {["RB", "WR", "TE", "FLEX", "QB", "K", "DEF"].map((p) => (
            <a key={p} href={`#players-${p}`}>
              <Badge variant="secondary">{p}</Badge>
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id="show-unavailable"
            checked={showUnavailable}
            onCheckedChange={(v) => setShowUnavailable(Boolean(v))}
          />
          <Label htmlFor="show-unavailable">Show unavailable</Label>
          <Switch
            id="show-all"
            checked={showAll}
            onCheckedChange={(v) => setShowAll(Boolean(v))}
          />
          <Label htmlFor="show-all">Show all ranked</Label>
        </div>
      </div>

      {/* All Players by Position tables */}
      {["RB", "WR", "TE", "FLEX", "QB", "K", "DEF"].map((p) => (
        <div key={p} id={`players-${p}`} className="scroll-mt-24">
          <AllPlayersPositionTable
            pos={p as any}
            scoring={scoringType ?? "std"}
            rosteredIds={new Set(rosteredPlayerIds)}
            showUnavailable={showUnavailable}
            showAll={showAll}
            sortKey={globalSortKey}
            sortDir={globalSortDir}
            onSort={onGlobalSort}
            currentWeek={(nflState.data?.week as number | undefined) ?? null}
            ownerByPlayerId={buildOwnerMap(
              rosters,
              (leagueUsers.data || []).map((u) => ({
                user_id: String(u.user_id),
                display_name: u.display_name ?? undefined,
                metadata: { team_name: u.metadata?.team_name ?? undefined },
              }))
            )}
            currentUserId={userId}
          />
        </div>
      ))}
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

  // FantasyPros aggregated metadata (from combine step)
  const { data: fpData } = useQuery<
    Record<Pos, { last_scraped: number | null; url: string | null }>,
    Error
  >({
    queryKey: ["fantasypros", "meta", scoring],
    queryFn: async () => {
      try {
        const res = await fetch(`/data/aggregate/metadata.json`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("failed to load metadata");
        const meta = (await res.json()) as {
          fp?: Record<"STD" | "PPR" | "HALF", Record<string, any>>;
        };
        const upper = scoring.toUpperCase() as "STD" | "PPR" | "HALF";
        const out = Object.fromEntries(
          positions.map((pos) => {
            const key = pos === "K" || pos === "DEF" ? "STD" : upper;
            const posKey = pos === "DEF" ? "DST" : pos;
            const bucket = (meta?.fp?.[key] ?? {}) as Record<string, any>;
            const rec = bucket[posKey] as
              | { last_scraped?: string; url?: string }
              | undefined;
            const ls = rec?.last_scraped
              ? new Date(rec.last_scraped).getTime()
              : null;
            const url = (rec?.url as string | undefined) ?? null;
            return [pos, { last_scraped: ls, url }];
          })
        ) as Record<Pos, { last_scraped: number | null; url: string | null }>;
        return out;
      } catch {
        return Object.fromEntries(
          positions.map((p) => [p, { last_scraped: null, url: null }])
        ) as Record<Pos, { last_scraped: number | null; url: string | null }>;
      }
    },
    staleTime: 10 * 60 * 1000,
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
        <div className="text-sm space-y-4">
          <div>
            <div className="font-medium">Boris Chen</div>
            {isLoading || !data ? (
              <div className="text-muted-foreground">Loading…</div>
            ) : (
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {positions.map((pos) => {
                  const metaScoring =
                    pos === "K" || pos === "DEF" ? "std" : scoring;
                  const href = borischenSourceUrl(pos, metaScoring);
                  const ts = data[pos] ?? null;
                  const label = formatAgo(ts);
                  const isUnknown = ts == null;
                  return (
                    <div key={pos} className="flex items-center gap-2">
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline-offset-2 hover:underline"
                        title={`Open Boris Chen source for ${pos} (${metaScoring})`}
                      >
                        {pos}
                      </a>
                      <span className="text-muted-foreground">:</span>
                      <span
                        className={isUnknown ? "text-muted-foreground" : ""}
                      >
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="font-medium">FantasyPros</div>
            {!fpData ? (
              <div className="text-muted-foreground">Loading…</div>
            ) : (
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {positions.map((pos) => {
                  const rec = fpData[pos];
                  const label = formatAgo(rec?.last_scraped ?? null);
                  const href = rec?.url ?? undefined;
                  const isUnknown = !rec?.last_scraped;
                  return (
                    <div key={pos} className="flex items-center gap-2">
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline-offset-2 hover:underline"
                          title={`Open FantasyPros source for ${pos}`}
                        >
                          {pos}
                        </a>
                      ) : (
                        <span>{pos}</span>
                      )}
                      <span className="text-muted-foreground">:</span>
                      <span
                        className={isUnknown ? "text-muted-foreground" : ""}
                      >
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// --- All Players Table (by Position) ---
type ScoringKey = "std" | "half" | "ppr";
type FpRankKey = "standard" | "half" | "ppr";
type TableSortKey =
  | "bc_rank"
  | "fp_ecr"
  | "fp_pos_rank"
  | "fp_owned"
  | "fp_grade";

function AllPlayersPositionTable({
  pos,
  scoring,
  rosteredIds,
  showUnavailable,
  showAll,
  sortKey,
  sortDir,
  onSort,
  currentWeek,
  ownerByPlayerId,
  currentUserId,
}: {
  pos: "RB" | "WR" | "TE" | "QB" | "K" | "DEF" | "FLEX";
  scoring: ScoringKey;
  rosteredIds: Set<string>;
  showUnavailable: boolean;
  showAll: boolean;
  sortKey: TableSortKey;
  sortDir: "asc" | "desc";
  onSort: (key: TableSortKey) => void;
  currentWeek: number | null;
  ownerByPlayerId: Map<string, { name: string; userId: string }>;
  currentUserId: string;
}) {
  const [visibleCount, setVisibleCount] =
    React.useState<number>(DEFAULT_VISIBLE_ROWS);
  const { data, isLoading } = useQuery<Record<string, any>, Error>({
    queryKey: ["aggregates", "shard", pos],
    queryFn: async () => {
      const res = await fetch(
        `/api/aggregates/shard?pos=${encodeURIComponent(pos)}`,
        {
          cache: "no-store",
        }
      );
      if (!res.ok) throw new Error(`Failed to load ${pos} shard`);
      return (await res.json()) as Record<string, any>;
    },
    staleTime: 60 * 1000,
  });

  const rows = React.useMemo(() => {
    if (!data)
      return [] as Array<{
        id: string;
        name: string;
        position: string;
        team: string | null;
        bye_week: number | null;
        bc_rank: number | null;
        bc_tier: number | null;
        fp_ecr: number | null;
        fp_pos_rank: string | number | null;
        fp_owned: number | null;
        fp_grade: string | null;
        isUnavailable: boolean;
        ownerName: string | null;
        ownedByYou: boolean;
      }>;
    const fpRankKey: FpRankKey = scoring === "std" ? "standard" : scoring;
    const mapped = Object.entries(data).map(([id, e]) => {
      const bc = e?.borischen?.[scoring] ?? null;
      const fpr = e?.fantasypros ?? null;
      const fr = fpr?.rankings?.[fpRankKey] ?? null;
      const owner = ownerByPlayerId.get(String(id));
      return {
        id,
        name: String(e?.name ?? ""),
        position: String(e?.position ?? ""),
        team: (e?.team as string | null) ?? null,
        bye_week: (e?.bye_week as number | null) ?? null,
        bc_rank: bc?.rank ?? null,
        bc_tier: bc?.tier ?? null,
        fp_ecr: fr?.rank_ecr ?? null,
        fp_pos_rank: fpr?.pos_rank ?? null,
        fp_owned: fpr?.player_owned_avg ?? null,
        fp_grade: fpr?.start_sit_grade ?? null,
        isUnavailable: rosteredIds.has(String(id)),
        ownerName: owner?.name ?? null,
        ownedByYou: owner?.userId
          ? String(owner.userId) === String(currentUserId)
          : false,
      };
    });
    // Filter out any players without an FP positional rank
    const withFp = mapped.filter(
      (r) => r.fp_pos_rank !== null && r.fp_pos_rank !== ""
    );
    // Optionally filter unavailable players unless toggled on
    if (showUnavailable) return withFp;
    // When off, keep only available OR owned by the current user (if enabled)
    return withFp.filter(
      (r) => !r.isUnavailable || (ALWAYS_SHOW_MY_PLAYERS && r.ownedByYou)
    );
  }, [data, scoring, rosteredIds, showUnavailable]);

  const sorted = React.useMemo(() => {
    const gradeScore = (g: string | null) => {
      if (!g) return -1;
      const order = ["C-", "C", "C+", "B-", "B", "B+", "A-", "A", "A+"];
      const idx = order.indexOf(g);
      return idx >= 0 ? idx : -1;
    };
    const posRankNum = (pr: string | number | null) => {
      if (pr == null) return Number.POSITIVE_INFINITY;
      if (typeof pr === "number") return pr;
      const m = String(pr).match(/(\d+)/);
      return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
    };
    const keyVal = (r: (typeof rows)[number]) => {
      switch (sortKey) {
        case "bc_rank":
          return r.bc_rank ?? Number.POSITIVE_INFINITY;
        case "fp_ecr":
          return r.fp_ecr ?? Number.POSITIVE_INFINITY;
        case "fp_pos_rank":
          return posRankNum(r.fp_pos_rank);
        case "fp_owned":
          return r.fp_owned != null ? r.fp_owned : -1;
        case "fp_grade":
          return gradeScore(r.fp_grade);
      }
    };
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = keyVal(a);
      const bv = keyVal(b);
      if (av === bv) return 0;
      return av > bv ? dir : -dir;
    });
  }, [rows, sortKey, sortDir]);

  // Clamp visible rows when the data set size changes
  React.useEffect(() => {
    setVisibleCount((c) => Math.min(c, sorted.length));
  }, [sorted.length]);

  // Respond to external showAll toggle
  React.useEffect(() => {
    setVisibleCount(showAll ? sorted.length : DEFAULT_VISIBLE_ROWS);
  }, [showAll, sorted.length]);

  const title = `${pos} (${scoring.toUpperCase()})`;

  function prettyName(n: string) {
    if (!n) return n;
    return n
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead colSpan={2} className="w-[40%]">
                  Player
                </TableHead>
                <TableHead colSpan={2} className="w-[24%]">
                  Boris Chen
                </TableHead>
                <TableHead colSpan={4} className="w-[36%]">
                  FantasyPros
                </TableHead>
              </TableRow>
              <TableRow>
                <TableHead className="w-[28%] border-l border-border">
                  Player
                </TableHead>
                <TableHead className="w-[12%] border-r border-border">
                  Tm/Bye
                </TableHead>
                <TableHead
                  className="w-[12%] cursor-pointer select-none border-l border-border"
                  onClick={() => onSort("bc_rank")}
                  title="Sort by Boris Chen rank"
                >
                  Rnk{" "}
                  {sortKey === "bc_rank" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </TableHead>
                <TableHead className="w-[12%] border-r border-border">
                  Tier
                </TableHead>
                <TableHead
                  className="w-[12%] cursor-pointer select-none border-l border-border"
                  onClick={() => onSort("fp_ecr")}
                  title="Sort by FantasyPros ECR"
                >
                  ECR{" "}
                  {sortKey === "fp_ecr" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </TableHead>
                <TableHead
                  className="w-[12%] cursor-pointer select-none"
                  onClick={() => onSort("fp_pos_rank")}
                  title="Sort by FP position rank"
                >
                  Pos Rnk{" "}
                  {sortKey === "fp_pos_rank"
                    ? sortDir === "asc"
                      ? "▲"
                      : "▼"
                    : ""}
                </TableHead>
                <TableHead
                  className="w-[12%] cursor-pointer select-none"
                  onClick={() => onSort("fp_owned")}
                  title="Sort by FP % owned"
                >
                  %Own{" "}
                  {sortKey === "fp_owned"
                    ? sortDir === "asc"
                      ? "▲"
                      : "▼"
                    : ""}
                </TableHead>
                <TableHead
                  className="w-[8%] cursor-pointer select-none border-r border-border"
                  onClick={() => onSort("fp_grade")}
                  title="Sort by FP grade"
                >
                  Grade{" "}
                  {sortKey === "fp_grade"
                    ? sortDir === "asc"
                      ? "▲"
                      : "▼"
                    : ""}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.slice(0, visibleCount).map((r) => (
                <TableRow
                  key={r.id}
                  className={
                    r.ownedByYou
                      ? "bg-green-50 dark:bg-green-900/20"
                      : r.isUnavailable
                      ? "bg-muted/40 text-muted-foreground"
                      : ""
                  }
                >
                  <TableCell className="border-l border-border">
                    <div className="font-medium">
                      {prettyName(r.name)}{" "}
                      <span className="text-muted-foreground">
                        ({r.position})
                      </span>
                    </div>
                    {r.ownerName && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {r.ownerName}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="border-r border-border">
                    <div className="text-sm">
                      {r.team || "-"} /{" "}
                      {r.bye_week == null ? (
                        "-"
                      ) : (
                        <span
                          className={
                            currentWeek != null && r.bye_week === currentWeek
                              ? "text-red-600 font-semibold"
                              : ""
                          }
                        >
                          {r.bye_week}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="border-l border-border">
                    {r.bc_rank ?? "-"}
                  </TableCell>
                  <TableCell className="border-r border-border">
                    {r.bc_tier ?? "-"}
                  </TableCell>
                  <TableCell className="border-l border-border">
                    {r.fp_ecr ?? "-"}
                  </TableCell>
                  <TableCell>{r.fp_pos_rank ?? "-"}</TableCell>
                  <TableCell>
                    {r.fp_owned != null ? `${r.fp_owned.toFixed(1)}%` : "-"}
                  </TableCell>
                  <TableCell className="border-r border-border">
                    {r.fp_grade ?? "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!isLoading && sorted.length > DEFAULT_VISIBLE_ROWS && (
          <div className="mt-3 flex justify-center">
            <Button
              variant="outline"
              onClick={() =>
                setVisibleCount((c) =>
                  c >= sorted.length ? DEFAULT_VISIBLE_ROWS : sorted.length
                )
              }
            >
              {visibleCount >= sorted.length ? "Show less" : "Show more"}
            </Button>
          </div>
        )}
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
