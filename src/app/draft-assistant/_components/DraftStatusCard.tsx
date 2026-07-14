import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircleIcon,
  RefreshCwIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react";
import { getNextPickForSlot } from "@/lib/draftValue";

function roundPickLabel(overall: number, teams: number) {
  if (!overall || !teams) return "—";
  const r = Math.ceil(overall / teams);
  const p = ((overall - 1) % teams) + 1;
  const width = String(teams).length;
  return `${r}.${String(p).padStart(width, "0")}`;
}

function shortDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function coverageLabel(
  coveragePct: number | null | undefined,
  coverageBasis: string | null | undefined
) {
  if (coveragePct == null) return null;
  return coverageBasis
    ? `${coveragePct}% ${coverageBasis} coverage`
    : `${coveragePct}% coverage`;
}

export default function DraftStatusCard() {
  const {
    user,
    draftDetails,
    picks,
    getRosterStatus,
    refetchData,
    loading,
    lastUpdatedAt,
    league,
    positionRows,
    sourceHealth,
  } = useDraftData();

  const teams = draftDetails?.settings?.teams ?? league?.teams ?? 0;
  const rounds = draftDetails?.settings?.rounds ?? 0;
  const totalPicks = teams && rounds ? teams * rounds : 0;
  const made = (picks || []).filter((p) => p && p.player_id).length;
  const isComplete =
    draftDetails?.status === "complete" || (totalPicks > 0 && made >= totalPicks);
  const nextOverall = totalPicks ? Math.min(made + 1, totalPicks) : 0;
  const nextLabel = teams ? roundPickLabel(nextOverall, teams) : "—";
  const currentRound = teams ? Math.ceil(nextOverall / (teams || 1)) : 0;

  const userSlot = user?.user_id
    ? draftDetails?.draft_order?.[user.user_id]
    : undefined;
  const userPicksMade = (picks || []).filter(
    (p) => p.draft_slot === userSlot
  ).length;
  const userPicksRemaining = rounds ? Math.max(0, rounds - userPicksMade) : 0;
  const nextUserPick = getNextPickForSlot({
    currentPick: nextOverall,
    userSlot,
    teams,
    rounds,
    draftType: draftDetails?.type,
  });
  const picksTillTurn =
    !isComplete && nextOverall && nextUserPick != null
      ? nextUserPick - nextOverall
      : null;

  const lastThree = React.useMemo(() => {
    const lst = (picks || [])
      .filter((p) => p && p.player_id)
      .sort((a, b) => (b.pick_no ?? 0) - (a.pick_no ?? 0))
      .slice(0, 3);
    return lst.map((p) => {
      // Look up player name from positionRows.ALL
      const playerData = positionRows?.ALL?.find(
        (player) => player.player_id === p.player_id
      );
      const nm = playerData?.name || String(p.player_id);
      const lbl = teams && p?.pick_no ? roundPickLabel(p.pick_no, teams) : "—";
      return `${lbl} ${nm}` as string;
    });
  }, [picks, teams, positionRows]);

  // Local ticker to keep the "Updated … ago" label fresh
  function useTicker(intervalMs: number = 1000) {
    const [, force] = React.useReducer((x) => x + 1, 0);
    React.useEffect(() => {
      const id = setInterval(force, intervalMs);
      return () => clearInterval(id);
    }, [intervalMs]);
  }

  function formatAgo(ms: number) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m ago`;
    if (m > 0) return `${m}m ${s % 60}s ago`;
    return `${s}s ago`;
  }

  function LastUpdatedLabel({ ts }: { ts: number | null }) {
    useTicker(1000);
    if (!ts)
      return <span className="text-xs text-muted-foreground">Updated —</span>;
    const diff = Date.now() - ts;
    return (
      <span className="text-xs text-muted-foreground">
        Updated {formatAgo(Math.max(0, diff))}
      </span>
    );
  }

  const [collapsed, setCollapsed] = React.useState(false);
  const draftSources = sourceHealth?.sources ?? [];
  const sourceWarnings = sourceHealth?.warnings ?? [];
  const sourceWarningCount = sourceWarnings.length;

  return (
    <Card
      id="draft-status-card"
      data-testid="draft-status-card"
      className="sticky top-0 z-40 bg-background p-2 shadow-md"
    >
      <CardHeader className="flex flex-row justify-between p-0 items-center">
        <CardTitle className="text-base font-semibold p-0 m-0">
          {isComplete ? "Draft Complete" : "Draft Status"}
        </CardTitle>
        <div className="flex items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={collapsed ? "Expand status" : "Collapse status"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? (
              <ChevronDownIcon className="h-3.5 w-3.5" />
            ) : (
              <ChevronUpIcon className="h-3.5 w-3.5" />
            )}
          </Button>
          <div className="flex items-center gap-2">
            <LastUpdatedLabel ts={lastUpdatedAt ?? null} />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Refresh draft data"
            onClick={typeof refetchData === "function" ? refetchData : () => {}}
            disabled={Boolean(
              loading &&
                (loading.draftDetails || loading.picks || loading.players)
            )}
          >
            <RefreshCwIcon className="h-2 w-2" />
          </Button>
        </div>
      </CardHeader>
      <CardContent
        className={`text-xs w-full p-0 ${collapsed ? "hidden md:block" : ""}`}
      >
        <div className="flex w-full flex-col justify-between gap-3 md:flex-row">
          <div className="space-y-2">
            <div className="font-medium leading-5">
              {isComplete
                ? `${made}${totalPicks ? `/${totalPicks}` : ""} picks`
                : picksTillTurn === 0
                  ? `On the clock · ${nextLabel}`
                  : `${picksTillTurn ?? "—"} picks away · ${nextLabel}`}
              <span className="ml-2 font-normal text-muted-foreground">
                {isComplete
                  ? `${teams || "—"} teams · ${rounds || "—"} rounds`
                  : `Round ${currentRound || "—"}/${rounds || "—"} · ${userPicksRemaining} picks left`}
              </span>
            </div>
            <div>
              <div className="flex gap-1.5 flex-wrap md:flex-nowrap">
                {(["QB", "RB", "WR", "TE", "FLEX", "K", "DEF"] as const).map(
                  (pos) => {
                    const {
                      count: have,
                      requirement: req,
                      met,
                    } = getRosterStatus(pos);
                    return (
                      <Badge
                        key={pos}
                        variant="secondary"
                        className="px-2 py-0.5 flex items-center gap-1"
                      >
                        <span className="text-muted-foreground">{pos}</span>
                        <span>
                          {have}/{req}
                        </span>
                        {met ? (
                          <CheckCircleIcon className=" h-3 w-3 text-green-500" />
                        ) : null}
                      </Badge>
                    );
                  }
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {draftSources.length ? (
                <details
                  aria-label="Draft source health"
                  className="relative"
                  data-testid="draft-source-health"
                >
                  <summary className="inline-flex cursor-pointer list-none items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                    Sources{" "}
                    {sourceWarningCount
                      ? `${sourceWarningCount} warning${
                          sourceWarningCount === 1 ? "" : "s"
                        }`
                      : "OK"}
                  </summary>
                  <div className="absolute left-0 top-7 z-50 w-[min(46rem,calc(100vw-2rem))] rounded-md border bg-background p-2 shadow-lg">
                    <div className="grid gap-1.5 md:grid-cols-3">
                      {draftSources.map((source) => {
                        const variant =
                          source.status === "ok"
                            ? "secondary"
                            : source.status === "warning"
                            ? "outline"
                            : "destructive";
                        const coverage = coverageLabel(
                          source.coveragePct,
                          source.coverageBasis
                        );
                        return (
                          <div
                            key={source.source}
                            className="rounded-md border bg-background px-2 py-1"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <Badge variant={variant}>{source.source}</Badge>
                              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                {source.status}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] leading-4 text-muted-foreground">
                              <span>
                                updated {shortDate(source.lastUpdated)}
                              </span>
                              <span>{source.rowCount ?? "—"} rows</span>
                              {source.relevantRowCount != null &&
                              source.relevantRowCount !== source.rowCount ? (
                                <span>{source.relevantRowCount} relevant</span>
                              ) : null}
                              {coverage ? (
                                <span>{coverage}</span>
                              ) : null}
                              {source.sampleSize ? (
                                <span>{source.sampleSize} sample</span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {sourceWarnings.length ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {sourceWarnings.slice(0, 4).map((warning) => (
                          <Badge
                            key={warning}
                            variant="outline"
                            className="border-amber-300 bg-amber-50 text-[11px] font-normal text-amber-900"
                          >
                            {warning}
                          </Badge>
                        ))}
                        {sourceWarnings.length > 4 ? (
                          <Badge variant="outline" className="text-[11px]">
                            +{sourceWarnings.length - 4} more
                          </Badge>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </details>
              ) : null}
            </div>
          </div>

          {/* Right column: previous picks */}
          <div className="flex gap-1">
            <div className=" text-muted-foreground">Prev Picks</div>
            <div className="text-xs leading-5 text-muted-foreground space-y-1">
              {lastThree && lastThree.length ? (
                [...lastThree].reverse().map((line, idx) => (
                  <div key={idx}>
                    <code className="whitespace-nowrap bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono">
                      {line}
                    </code>
                  </div>
                ))
              ) : (
                <div>—</div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
