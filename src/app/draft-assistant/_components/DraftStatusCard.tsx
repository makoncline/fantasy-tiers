import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useSearchParams } from "next/navigation";
import {
  useDraftDetails,
  useDraftPicks,
  useSleeperPlayersMetaStatic,
} from "@/app/draft-assistant/_lib/useDraftQueries";
import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircleIcon,
  RefreshCwIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react";

function roundPickLabel(overall: number, teams: number) {
  if (!overall || !teams) return "—";
  const r = Math.ceil(overall / teams);
  const p = ((overall - 1) % teams) + 1;
  const width = String(teams).length;
  return `${r}.${String(p).padStart(width, "0")}`;
}

export default function DraftStatusCard() {
  const sp = useSearchParams();
  const draftId = sp.get("draftId") || "";
  const userId = sp.get("userId") || "";
  const { data: details } = useDraftDetails(draftId);
  const { data: picks } = useDraftPicks(draftId);
  const { data: sleeperMeta } = useSleeperPlayersMetaStatic(Boolean(draftId));
  const {
    userPositionCounts,
    userPositionNeeds,
    refetchData,
    loading,
    lastUpdatedAt,
  } = useDraftData();

  const teams = details?.settings?.teams ?? 0;
  const rounds = details?.settings?.rounds ?? 0;
  const totalPicks = teams && rounds ? teams * rounds : 0;
  const made = (picks || []).filter((p: any) => p && p.player_id).length;
  const nextOverall = totalPicks ? Math.min(made + 1, totalPicks) : 0;
  const nextLabel = teams ? roundPickLabel(nextOverall, teams) : "—";
  const currentRound = teams ? Math.ceil(nextOverall / (teams || 1)) : 0;
  const currentPos = teams ? ((nextOverall - 1) % teams) + 1 : 0;

  const userSlot = userId ? details?.draft_order?.[userId] : undefined;
  const userPicksMade = (picks || []).filter(
    (p: any) => p.draft_slot === userSlot
  ).length;
  const userPicksRemaining = rounds ? Math.max(0, rounds - userPicksMade) : 0;
  const picksTillTurn =
    teams && userSlot ? (userSlot - currentPos + teams) % teams : 0;

  const lastThree = React.useMemo(() => {
    const lst = (picks || [])
      .filter((p: any) => p && p.player_id)
      .sort((a: any, b: any) => (b.pick_no ?? 0) - (a.pick_no ?? 0))
      .slice(0, 3);
    return lst.map((p: any) => {
      const meta = sleeperMeta
        ? (sleeperMeta as any)[String(p.player_id)]
        : null;
      const nm = meta?.full_name || meta?.name || String(p.player_id);
      const lbl = teams && p?.pick_no ? roundPickLabel(p.pick_no, teams) : "—";
      return `${lbl} ${nm}` as string;
    });
  }, [picks, sleeperMeta, teams]);

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

  return (
    <Card
      id="draft-status-card"
      className="sticky top-0 z-40 bg-background/95 supports-[backdrop-filter]:bg-background/60 backdrop-blur p-2"
    >
      <CardHeader className="flex flex-row justify-between p-0 items-center">
        <CardTitle className="text-base font-semibold p-0 m-0">
          Draft Status
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
                (loading.draftDetails || loading.draftPicks || loading.players)
            )}
          >
            <RefreshCwIcon className="h-2 w-2" />
          </Button>
        </div>
      </CardHeader>
      <CardContent
        className={`text-xs w-full p-0 ${collapsed ? "hidden md:block" : ""}`}
      >
        <div className="w-full flex flex-col md:flex-row gap-3 justify-between">
          {/* Left column: summary + roster */}
          <div className="space-y-2">
            <div className="text-muted-foreground leading-5">
              {`${teams || "—"} teams - ${currentRound || "—"}/${
                rounds || "—"
              } rounds - draft slot ${userSlot ?? "—"} - ${made}${
                totalPicks ? `/${totalPicks}` : ""
              } picks - status ${details?.status || "—"}`}
            </div>
            <div className="text-muted-foreground leading-5">
              {`you have ${userPicksRemaining ?? "—"} picks remaining - ${
                userSlot ? picksTillTurn ?? 0 : "—"
              } picks till your turn - current pick ${nextLabel}`}
            </div>
            <div>
              <div className="flex gap-1.5 flex-wrap md:flex-nowrap">
                {(["QB", "RB", "WR", "TE", "FLEX", "K", "DEF"] as const).map(
                  (pos) => {
                    const have = (userPositionCounts?.[pos] ?? 0) as number;
                    const need = (userPositionNeeds?.[pos] ?? 0) as number;
                    const req = have + need;
                    const met = req > 0 && have >= req;
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
            {/* Quick links */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Quick links:
              </span>
              <Badge
                variant="secondary"
                className="cursor-pointer"
                onClick={() => {
                  const element = document.getElementById("roster-section");
                  if (element) {
                    const rect = element.getBoundingClientRect();
                    const offsetTop = window.pageYOffset + rect.top - 150;
                    window.scrollTo({ top: offsetTop, behavior: "smooth" });
                  }
                }}
              >
                Roster
              </Badge>
              <Badge
                variant="secondary"
                className="cursor-pointer"
                onClick={() => {
                  const element = document.getElementById("positions-section");
                  if (element) {
                    const rect = element.getBoundingClientRect();
                    const offsetTop = window.pageYOffset + rect.top - 150;
                    window.scrollTo({ top: offsetTop, behavior: "smooth" });
                  }
                }}
              >
                Positions
              </Badge>
              <Badge
                variant="secondary"
                className="cursor-pointer"
                onClick={() => {
                  const element = document.getElementById("available-section");
                  if (element) {
                    const rect = element.getBoundingClientRect();
                    const offsetTop = window.pageYOffset + rect.top - 150;
                    window.scrollTo({ top: offsetTop, behavior: "smooth" });
                  }
                }}
              >
                Available
              </Badge>
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
