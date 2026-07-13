import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  CalendarClock,
  Clock3,
  Database,
  History,
  ListFilter,
  Search,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createRatingHistoryDb,
  resolveRatingHistoryDatabaseConfig,
} from "@/lib/ratingHistory/db";
import {
  getPlayerRatingHistory,
  type PlayerRatingHistory,
  type RatingHistoryDashboard,
} from "@/lib/ratingHistory/dashboard";
import { readRatingHistoryDashboardSnapshot } from "@/lib/ratingHistory/dashboardSnapshot";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export const metadata: Metadata = {
  title: "Rating History | Fantasy Tiers",
  description: "Source freshness and player rating history dashboard",
};

type DashboardState =
  | {
      dashboard: RatingHistoryDashboard;
      playerHistory: PlayerRatingHistory;
      error: null;
    }
  | { dashboard: null; playerHistory: null; error: string };

type RatingHistoryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const numberFormatter = new Intl.NumberFormat("en-US");
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const scheduledUpdateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Denver",
  timeZoneName: "short",
});

async function loadDashboard(input: {
  query: string;
  playerId?: string;
}): Promise<DashboardState> {
  let dashboard: RatingHistoryDashboard;
  try {
    dashboard = readRatingHistoryDashboardSnapshot();
  } catch (error) {
    console.error("Rating history dashboard snapshot failed", error);
    return {
      dashboard: null,
      playerHistory: null,
      error: "Rating history is temporarily unavailable.",
    };
  }

  if (!input.query && !input.playerId) {
    return {
      dashboard,
      playerHistory: {
        query: "",
        searchResults: [],
        selectedPlayer: null,
        timeline: [],
      },
      error: null,
    };
  }

  const config = resolveRatingHistoryDatabaseConfig();
  if (!config.available) {
    return {
      dashboard: null,
      playerHistory: null,
      error: "Rating history is not configured for this deployment.",
    };
  }
  const db = createRatingHistoryDb(config.config);
  try {
    const playerHistory = await getPlayerRatingHistory(db, input);

    return {
      dashboard,
      playerHistory,
      error: null,
    };
  } catch (error) {
    console.error("Rating history dashboard query failed", error);
    return {
      dashboard: null,
      playerHistory: null,
      error: "Rating history is temporarily unavailable.",
    };
  } finally {
    db.$client.close();
  }
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function formatCount(value: number) {
  return numberFormatter.format(value);
}

function formatDate(value: string | null) {
  if (!value) return "None";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateFormatter.format(date);
}

function formatScope(input: {
  scoring: string | null;
  position: string | null;
}) {
  const scoring = input.scoring?.toUpperCase() ?? "ALL";
  const position = input.position ?? "ALL";
  return `${position} ${scoring}`;
}

function formatValue(value: number | null, label: string) {
  if (value == null) return null;
  return `${label} ${numberFormatter.format(value)}`;
}

function nextScheduledUpdate(now = new Date()) {
  const scheduleHoursUtc = [12, 21];
  const today = new Date(now);
  today.setUTCMinutes(0, 0, 0);

  for (let dayOffset = 0; dayOffset < 2; dayOffset += 1) {
    for (const hour of scheduleHoursUtc) {
      const candidate = new Date(today);
      candidate.setUTCDate(today.getUTCDate() + dayOffset);
      candidate.setUTCHours(hour, 0, 0, 0);
      if (candidate > now) return candidate;
    }
  }

  const fallback = new Date(today);
  fallback.setUTCDate(today.getUTCDate() + 1);
  fallback.setUTCHours(12, 0, 0, 0);
  return fallback;
}

function playerHref(query: string, playerId: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("playerId", playerId);
  return `/rating-history?${params.toString()}`;
}

function formatRatingValues(row: PlayerRatingHistory["timeline"][number]) {
  const values = [
    formatValue(row.rankOverall, "Ovr"),
    formatValue(row.rankPosition, "Pos"),
    formatValue(row.tier, "Tier"),
    formatValue(row.points, "Pts"),
    formatValue(row.adp, "ADP"),
    formatValue(row.rosterPct, "Own%"),
    formatValue(row.sleeperSearchRank, "Sleeper"),
  ].filter(Boolean);

  return values.length ? values.join(" / ") : "No tracked value";
}

function sourceClass(source: string) {
  if (source === "fantasypros") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (source === "sleeper") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (source === "tiers") {
    return "border-sky-200 bg-sky-50 text-sky-800";
  }
  return "border-border bg-muted text-foreground";
}

function sourceTextClass(source: string) {
  if (source === "fantasypros") return "text-emerald-500";
  if (source === "sleeper") return "text-amber-500";
  if (source === "tiers") return "text-sky-500";
  return "text-muted-foreground";
}

function statusClass(status: string) {
  if (status === "present") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (status === "absent") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-border bg-muted text-foreground";
}

type TimelineRow = PlayerRatingHistory["timeline"][number];

type PrimaryMetric = {
  label: string;
  value: number;
  lowerIsBetter: boolean;
};

type TrendPoint = PrimaryMetric & {
  effectiveFrom: string;
};

type SourceTrack = {
  key: string;
  source: string;
  mode: string;
  season: number | null;
  week: number | null;
  scoring: string | null;
  positionScope: string | null;
  firstRow: TimelineRow;
  latestRow: TimelineRow;
  rows: TimelineRow[];
  points: TrendPoint[];
};

function timestamp(value: string) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function primaryMetric(row: TimelineRow): PrimaryMetric | null {
  if (row.rankOverall != null) {
    return { label: "Ovr", value: row.rankOverall, lowerIsBetter: true };
  }
  if (row.rankPosition != null) {
    return { label: "Pos", value: row.rankPosition, lowerIsBetter: true };
  }
  if (row.tier != null) {
    return { label: "Tier", value: row.tier, lowerIsBetter: true };
  }
  if (row.points != null) {
    return { label: "Pts", value: row.points, lowerIsBetter: false };
  }
  if (row.adp != null) {
    return { label: "ADP", value: row.adp, lowerIsBetter: true };
  }
  if (row.rosterPct != null) {
    return { label: "Own%", value: row.rosterPct, lowerIsBetter: false };
  }
  if (row.sleeperSearchRank != null) {
    return {
      label: "Sleeper",
      value: row.sleeperSearchRank,
      lowerIsBetter: true,
    };
  }
  return null;
}

function sourceSortValue(source: string) {
  if (source === "fantasypros") return 0;
  if (source === "tiers") return 1;
  if (source === "sleeper") return 2;
  return 3;
}

function scoringSortValue(scoring: string | null) {
  if (scoring === "ppr") return 0;
  if (scoring === "half") return 1;
  if (scoring === "std") return 2;
  return 3;
}

function positionSortValue(position: string | null, playerPosition: string | null) {
  if (position === playerPosition) return 0;
  if (position === "FLEX") return 1;
  if (position === "ALL") return 2;
  if (position == null) return 3;
  return 4;
}

function sourceTrackKey(row: TimelineRow) {
  return [
    row.source,
    row.mode,
    row.season ?? "",
    row.week ?? "",
    row.scoring ?? "",
    row.positionScope ?? "",
  ].join("|");
}

function buildSourceTracks(
  timeline: TimelineRow[],
  playerPosition: string | null
) {
  const groups = new Map<string, TimelineRow[]>();

  for (const row of timeline) {
    const key = sourceTrackKey(row);
    const existing = groups.get(key);
    if (existing) {
      existing.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  const tracks: SourceTrack[] = [];

  for (const [key, rows] of groups) {
    const chronologicalRows = [...rows].sort(
      (a, b) => timestamp(a.effectiveFrom) - timestamp(b.effectiveFrom)
    );
    const firstRow = chronologicalRows[0];
    const latestRow = chronologicalRows[chronologicalRows.length - 1];
    if (!firstRow || !latestRow) continue;

    const metricEntries = chronologicalRows
      .map((row) => ({
        row,
        metric: primaryMetric(row),
      }))
      .filter(
        (
          entry
        ): entry is {
          row: TimelineRow;
          metric: PrimaryMetric;
        } => entry.metric !== null
      );
    const latestMetricEntry = metricEntries[metricEntries.length - 1];
    const primaryLabel = latestMetricEntry?.metric.label ?? null;
    const points = primaryLabel
      ? metricEntries
          .filter((entry) => entry.metric.label === primaryLabel)
          .map((entry) => ({
            ...entry.metric,
            effectiveFrom: entry.row.effectiveFrom,
          }))
      : [];

    tracks.push({
      key,
      source: latestRow.source,
      mode: latestRow.mode,
      season: latestRow.season,
      week: latestRow.week,
      scoring: latestRow.scoring,
      positionScope: latestRow.positionScope,
      firstRow,
      latestRow,
      rows: chronologicalRows,
      points,
    });
  }

  return tracks.sort((a, b) => {
    const sourceOrder = sourceSortValue(a.source) - sourceSortValue(b.source);
    if (sourceOrder !== 0) return sourceOrder;

    const positionOrder =
      positionSortValue(a.positionScope, playerPosition) -
      positionSortValue(b.positionScope, playerPosition);
    if (positionOrder !== 0) return positionOrder;

    const scoringOrder =
      scoringSortValue(a.scoring) - scoringSortValue(b.scoring);
    if (scoringOrder !== 0) return scoringOrder;

    return a.mode.localeCompare(b.mode);
  });
}

function sparklineCoordinates(points: TrendPoint[]) {
  const width = 172;
  const height = 42;
  const padding = 4;
  if (points.length === 0) return [];

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const latestPoint = points[points.length - 1];
  const lowerIsBetter = latestPoint?.lowerIsBetter ?? true;

  return points.map((point, index) => {
    const x =
      points.length === 1
        ? width / 2
        : padding +
          (index / (points.length - 1)) * (width - padding * 2);
    const normalized = span === 0 ? 0.5 : (point.value - min) / span;
    const goodness = lowerIsBetter ? 1 - normalized : normalized;
    const y = padding + (1 - goodness) * (height - padding * 2);
    return { x, y, value: point.value };
  });
}

function formatMetric(metric: PrimaryMetric | TrendPoint | null) {
  if (!metric) return "No numeric value";
  return `${metric.label} ${numberFormatter.format(metric.value)}`;
}

function formatDelta(points: TrendPoint[]) {
  const latest = points[points.length - 1];
  const prior = points[points.length - 2];
  if (!latest || !prior) return "Baseline only";

  const delta = latest.value - prior.value;
  if (delta === 0) return "Unchanged";

  const improved = latest.lowerIsBetter ? delta < 0 : delta > 0;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${numberFormatter.format(delta)} ${
    improved ? "better" : "worse"
  }`;
}

function Sparkline({ points, source }: { points: TrendPoint[]; source: string }) {
  const coordinates = sparklineCoordinates(points);
  const path = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return (
    <div className={cn("h-12 w-full min-w-40", sourceTextClass(source))}>
      {coordinates.length === 0 ? (
        <div className="flex h-full items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground">
          No numeric history
        </div>
      ) : (
        <svg
          viewBox="0 0 172 42"
          role="img"
          aria-label="Rating trend"
          className="h-full w-full overflow-visible"
        >
          <line
            x1="4"
            y1="21"
            x2="168"
            y2="21"
            className="stroke-border"
            strokeDasharray="3 4"
          />
          {coordinates.length === 1 ? (
            <circle
              cx={coordinates[0]?.x}
              cy={coordinates[0]?.y}
              r="4"
              fill="currentColor"
            />
          ) : (
            <path
              d={path}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {coordinates.map((point, index) => (
            <circle
              key={`${point.x}-${point.y}-${index}`}
              cx={point.x}
              cy={point.y}
              r={index === coordinates.length - 1 ? 3.5 : 2.5}
              className="fill-background"
              stroke="currentColor"
              strokeWidth="2"
            />
          ))}
        </svg>
      )}
    </div>
  );
}

function MetricCard({
  title,
  value,
  detail,
  Icon,
}: {
  title: string;
  value: string;
  detail: string;
  Icon: LucideIcon;
}) {
  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader className="grid grid-cols-[1fr_auto] items-start gap-4 space-y-0 pb-3">
        <div>
          <CardDescription>{title}</CardDescription>
          <CardTitle className="mt-2 text-2xl">{value}</CardTitle>
        </div>
        <div className="flex size-10 items-center justify-center rounded-lg border bg-muted">
          <Icon className="size-5" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {detail}
      </CardContent>
    </Card>
  );
}

function SchedulePanel({ nextRun }: { nextRun: Date }) {
  return (
    <Card className="rounded-lg shadow-sm">
      <CardContent className="grid gap-4 p-5 md:grid-cols-[auto_1fr_auto] md:items-center">
        <div className="flex size-10 items-center justify-center rounded-lg border bg-muted">
          <CalendarClock className="size-5" aria-hidden="true" />
        </div>
        <div>
          <div className="text-sm font-medium">Next scheduled update</div>
          <div className="mt-1 text-sm text-muted-foreground">
            GitHub Actions runs at 12:00 and 21:00 UTC. Current Mountain-time
            equivalent is 6:00 AM and 3:00 PM MDT.
          </div>
        </div>
        <div className="text-left md:text-right">
          <div className="text-base font-semibold">
            {scheduledUpdateFormatter.format(nextRun)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Manual local ingest adds source-run audit rows immediately.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SourceBadge({ source }: { source: string }) {
  return (
    <Badge variant="outline" className={cn("capitalize", sourceClass(source))}>
      {source}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("capitalize", statusClass(status))}>
      {status}
    </Badge>
  );
}

function CoverageBar({
  presentCount,
  currentCount,
}: {
  presentCount: number;
  currentCount: number;
}) {
  const percent =
    currentCount > 0 ? Math.round((presentCount / currentCount) * 100) : 0;
  return (
    <div className="min-w-32">
      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
        <span>{percent}% present</span>
        <span>{formatCount(currentCount)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className={cn(
            "h-2 rounded-full",
            percent === 100 ? "bg-emerald-500" : "bg-amber-500"
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function PlayerHistoryPanel({
  playerHistory,
}: {
  playerHistory: PlayerRatingHistory;
}) {
  const selectedPlayerId = playerHistory.selectedPlayer?.playerId;
  const sourceTracks = buildSourceTracks(
    playerHistory.timeline,
    playerHistory.selectedPlayer?.position ?? null
  );
  const changedTrackCount = sourceTracks.filter(
    (track) => track.rows.length > 1
  ).length;

  return (
    <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <Card className="rounded-lg shadow-sm">
        <CardHeader>
          <CardTitle>Player Search</CardTitle>
          <CardDescription>
            Search a player, then inspect every recorded source value over
            time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action="/rating-history"
            className="grid gap-3 sm:grid-cols-[1fr_auto]"
          >
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                name="q"
                defaultValue={playerHistory.query}
                placeholder="Search player, team, or Sleeper id"
                className="pl-9"
              />
            </div>
            <Button type="submit">
              <Search className="size-4" aria-hidden="true" />
              Search
            </Button>
          </form>

          {!playerHistory.query ? (
            <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
              Try a player name like Chase, Bijan, or McCaffrey.
            </div>
          ) : playerHistory.searchResults.length === 0 ? (
            <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
              No players matched that search.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">Absent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {playerHistory.searchResults.map((row) => (
                  <TableRow
                    key={row.playerId}
                    className={cn(
                      selectedPlayerId === row.playerId && "bg-muted/60"
                    )}
                  >
                    <TableCell>
                      <Link
                        href={playerHref(playerHistory.query, row.playerId)}
                        className="font-medium hover:underline"
                      >
                        {row.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {row.position ?? "NA"} / {row.team ?? "FA"} / Bye{" "}
                        {row.byeWeek ?? "NA"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCount(row.currentScopes)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCount(row.currentAbsentRatings)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-lg shadow-sm">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg border bg-muted">
              <UserRound className="size-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle>
                {playerHistory.selectedPlayer?.name ?? "Player History"}
              </CardTitle>
              <CardDescription className="mt-1">
                {playerHistory.selectedPlayer
                  ? `${playerHistory.selectedPlayer.position ?? "NA"} / ${
                      playerHistory.selectedPlayer.team ?? "FA"
                    } / Bye ${playerHistory.selectedPlayer.byeWeek ?? "NA"}`
                  : "Select a player result to see stored ratings."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!playerHistory.selectedPlayer ? (
            <div className="rounded-lg border bg-muted/40 p-6 text-sm text-muted-foreground">
              No player selected.
            </div>
          ) : playerHistory.timeline.length === 0 ? (
            <div className="rounded-lg border bg-muted/40 p-6 text-sm text-muted-foreground">
              This player has no rating history rows yet.
            </div>
          ) : (
            <div className="space-y-2">
              {changedTrackCount === 0 ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                  <div className="font-medium">No rating changes yet</div>
                  <p className="mt-1 text-muted-foreground">
                    These rows are the first baseline for this player. Repeated
                    identical ingests add source-run audit rows, but they do not
                    create extra history points until a source value or
                    present/absent status changes.
                  </p>
                </div>
              ) : null}
              <div className="hidden grid-cols-[0.75fr_0.75fr_1.25fr_1fr_0.8fr] gap-3 px-3 text-xs font-medium text-muted-foreground md:grid">
                <div>Source</div>
                <div>Scope</div>
                <div>Current</div>
                <div>Trend</div>
                <div>Range</div>
              </div>
              <div className="max-h-[42rem] space-y-2 overflow-y-auto pr-1">
                {sourceTracks.map((track) => {
                  const latestPoint = track.points[track.points.length - 1];
                  return (
                    <div
                      key={track.key}
                      className="grid gap-3 rounded-lg border bg-muted/20 p-3 md:grid-cols-[0.75fr_0.75fr_1.25fr_1fr_0.8fr] md:items-center"
                    >
                      <div>
                        <SourceBadge source={track.source} />
                        <div className="mt-1 text-xs text-muted-foreground">
                          {track.mode}
                          {track.week != null ? ` / Week ${track.week}` : ""}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">
                          {formatScope({
                            scoring: track.scoring,
                            position: track.positionScope,
                          })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {track.season ?? "Any season"}
                        </div>
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={track.latestRow.sourceStatus} />
                          <span className="text-sm font-medium">
                            {formatMetric(primaryMetric(track.latestRow))}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatRatingValues(track.latestRow)}
                        </div>
                      </div>
                      <div>
                        <Sparkline
                          points={track.points}
                          source={track.source}
                        />
                        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span>{formatMetric(latestPoint ?? null)}</span>
                          <span>{formatDelta(track.points)}</span>
                        </div>
                      </div>
                      <div className="text-sm">
                        <div className="font-medium">
                          {formatDate(track.firstRow.effectiveFrom)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          to {formatDate(track.latestRow.effectiveFrom)}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatCount(track.rows.length)} version
                          {track.rows.length === 1 ? "" : "s"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function EmptyPanel({ error }: { error: string }) {
  return (
    <Card className="rounded-lg border-amber-200 bg-amber-50/50 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg border border-amber-200 bg-amber-100 text-amber-900">
            <TriangleAlert className="size-5" aria-hidden="true" />
          </div>
          <div>
            <CardTitle>Rating history is not ready</CardTitle>
            <CardDescription className="mt-1">
              Historical rankings are unavailable right now.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">{error}</p>
        <pre className="overflow-x-auto rounded-lg border bg-background p-4 text-xs">
          pnpm run history:migrate{"\n"}pnpm run history:ingest:aggregates
        </pre>
      </CardContent>
    </Card>
  );
}

export default async function RatingHistoryPage({
  searchParams,
}: RatingHistoryPageProps) {
  const params = (await searchParams) ?? {};
  const query = firstParam(params.q);
  const playerId = firstParam(params.playerId) || undefined;
  const state = await loadDashboard(
    playerId === undefined ? { query } : { query, playerId }
  );
  const dashboard = state.dashboard;
  const playerHistory = state.playerHistory;
  const nextRun = nextScheduledUpdate();

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button variant="ghost" size="sm" asChild={true} className="-ml-3">
              <Link href="/">
                <ArrowLeft className="size-4" aria-hidden="true" />
                Home
              </Link>
            </Button>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-lg border bg-muted">
                <History className="size-5" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">
                  Rating History
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Source freshness, current coverage, and missing-rating
                  signals.
                </p>
              </div>
            </div>
          </div>
          <Button asChild={true}>
            <Link href="/rating-history">
              <Clock3 className="size-4" aria-hidden="true" />
              Refresh
            </Link>
          </Button>
        </header>

        {state.error || !dashboard ? (
          <EmptyPanel error={state.error ?? "Unable to load rating history."} />
        ) : (
          <>
            <SchedulePanel nextRun={nextRun} />

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Players"
                value={formatCount(dashboard.totals.totalPlayers)}
                detail="Current identity snapshots"
                Icon={Database}
              />
              <MetricCard
                title="Source Runs"
                value={formatCount(dashboard.totals.totalSourceRuns)}
                detail={`Latest ${formatDate(
                  dashboard.totals.latestFetchedAt
                )}`}
                Icon={Clock3}
              />
              <MetricCard
                title="Rating Versions"
                value={formatCount(
                  dashboard.totals.totalRatingVersions
                )}
                detail={`${formatCount(
                  dashboard.totals.changedRatingScopes
                )} changed tracks / ${formatCount(
                  dashboard.totals.closedRatingVersions
                )} closed rows`}
                Icon={Activity}
              />
              <MetricCard
                title="Current Absent"
                value={formatCount(
                  dashboard.totals.currentAbsentRatings
                )}
                detail="Current rows marked missing by a source"
                Icon={ListFilter}
              />
            </section>

            {playerHistory ? (
              <PlayerHistoryPanel playerHistory={playerHistory} />
            ) : null}

            <section className="grid gap-6 xl:grid-cols-[1fr_1.15fr]">
              <Card className="rounded-lg shadow-sm">
                <CardHeader>
                  <CardTitle>Current Coverage</CardTitle>
                  <CardDescription>
                    Present versus absent current rating rows by source scope.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead>Scope</TableHead>
                        <TableHead>Coverage</TableHead>
                        <TableHead className="text-right">Absent</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboard.coverage.map((row) => (
                        <TableRow
                          key={[
                            row.source,
                            row.mode,
                            row.scoring,
                            row.positionScope,
                          ].join(":")}
                        >
                          <TableCell>
                            <SourceBadge source={row.source} />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {formatScope({
                                scoring: row.scoring,
                                position: row.positionScope,
                              })}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {row.mode}
                            </div>
                          </TableCell>
                          <TableCell>
                            <CoverageBar
                              presentCount={row.presentCount}
                              currentCount={row.currentCount}
                            />
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCount(row.absentCount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card className="rounded-lg shadow-sm">
                <CardHeader>
                  <CardTitle>Latest Source Runs</CardTitle>
                  <CardDescription>
                    Most recent ingested source/scoring/position scopes.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead>Scope</TableHead>
                        <TableHead>Fetched</TableHead>
                        <TableHead>Rows</TableHead>
                        <TableHead>Hash</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboard.latestSourceRuns.map((run) => (
                        <TableRow key={run.id}>
                          <TableCell>
                            <SourceBadge source={run.source} />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {formatScope({
                                scoring: run.scoring,
                                position: run.position,
                              })}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {run.mode}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>{formatDate(run.fetchedAt)}</div>
                            <div className="text-xs text-muted-foreground">
                              Source {formatDate(run.sourceLastUpdated)}
                            </div>
                          </TableCell>
                          <TableCell>{formatCount(run.rowCount ?? 0)}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {run.contentHash.slice(0, 10)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </section>

            <Card className="rounded-lg shadow-sm">
              <CardHeader>
                <CardTitle>Missing Now, Ranked Before</CardTitle>
                <CardDescription>
                  Current absent rows that have a prior present rating in the
                  same source scope.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard.missingWithPrior.length === 0 ? (
                  <div className="rounded-lg border bg-muted/40 p-6 text-sm text-muted-foreground">
                    No current missing-with-prior rows found in the history DB.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Player</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Missing Since</TableHead>
                        <TableHead>Last Present</TableHead>
                        <TableHead>Prior Signal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboard.missingWithPrior.map((row) => {
                        const priorSignals = [
                          formatValue(row.lastRankOverall, "Ovr"),
                          formatValue(row.lastRankPosition, "Pos"),
                          formatValue(row.lastTier, "Tier"),
                          formatValue(row.lastPoints, "Pts"),
                          formatValue(row.lastAdp, "ADP"),
                        ].filter(Boolean);

                        return (
                          <TableRow key={row.id}>
                            <TableCell>
                              <div className="font-medium">{row.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {row.position ?? "NA"} / {row.team ?? "FA"} /
                                Bye {row.byeWeek ?? "NA"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <SourceBadge source={row.source} />
                              <div className="mt-1 text-xs text-muted-foreground">
                                {formatScope({
                                  scoring: row.scoring,
                                  position: row.positionScope,
                                })}
                              </div>
                            </TableCell>
                            <TableCell>{formatDate(row.effectiveFrom)}</TableCell>
                            <TableCell>{formatDate(row.lastPresentAt)}</TableCell>
                            <TableCell>
                              {priorSignals.length
                                ? priorSignals.join(" / ")
                                : "None"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </section>
    </main>
  );
}
