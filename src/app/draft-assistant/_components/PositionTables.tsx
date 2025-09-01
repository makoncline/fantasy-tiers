import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PreviewPickDialog from "./PreviewPickDialog";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { PlayerTable, type PlayerRow } from "./PlayerTable";
import { toPlayerRows, type Extras } from "@/lib/playerRows";
import { useShardAggregates, useFlexAggregates } from "../_lib/useDraftQueries";
import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";
import enrichPlayers from "@/lib/enrichPlayers";
import { normalizePlayerName, ecrToRoundPick } from "@/lib/util";
import { SEASON_WEEKS } from "@/lib/constants";

export default function PositionTables() {
  const { league, beerSheetsBoard, availablePlayers, userRosterSlots } =
    useDraftData() as any;
  const DEFAULT_POS_TABLE_LIMIT = 5;
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const toggleExpanded = (key: string) =>
    setExpanded((s) => ({ ...s, [key]: !s[key] }));
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewPlayer, setPreviewPlayer] = React.useState<any | null>(null);
  const onPreview = (row: PlayerRow) => {
    const found = (availablePlayers as any[]).find(
      (p: any) => p.player_id === row.player_id
    );
    if (found) {
      setPreviewPlayer(found);
      setPreviewOpen(true);
    }
  };

  // Fetch individual position shards from their respective files
  const { data: qbData } = useShardAggregates("QB");
  const { data: rbData } = useShardAggregates("RB");
  const { data: wrData } = useShardAggregates("WR");
  const { data: teData } = useShardAggregates("TE");
  const { data: flexData } = useFlexAggregates();

  const extras = React.useMemo(() => {
    const map: Record<
      string,
      { val?: number; ps?: number; ecr_round_pick?: string }
    > = {};
    (beerSheetsBoard || []).forEach((r: any) => {
      const value = {
        val: Number.isFinite(r.val)
          ? Number((r.val / SEASON_WEEKS).toFixed(1))
          : r.val,
        ps: Number.isFinite(r.ps) ? Number(Math.round(r.ps)) : r.ps,
        ecr_round_pick:
          r.adp != null && Number.isFinite(r.adp) ? String(r.adp) : undefined,
      } as const;
      map[r.player_id] = value;
      const nm = normalizePlayerName(r.name || "");
      if (nm) map[nm] = value;
    });
    return map;
  }, [beerSheetsBoard]);

  function buildRowsForPos(pos: "QB" | "RB" | "WR" | "TE" | "FLEX") {
    if (!league?.scoring) return [] as PlayerRow[];

    // Get players from their respective shard files
    const getPositionData = (pos: "QB" | "RB" | "WR" | "TE" | "FLEX") => {
      switch (pos) {
        case "QB":
          return qbData || [];
        case "RB":
          return rbData || [];
        case "WR":
          return wrData || [];
        case "TE":
          return teData || [];
        case "FLEX":
          return flexData || [];
        default:
          return [];
      }
    };

    const dataset = getPositionData(pos);
    try {
      const enriched = enrichPlayers(dataset, {
        teams: league.teams,
        scoring: league.scoring,
        roster: league.roster,
      } as any);
      const byId = new Map<string, any>();
      const byName = new Map<string, any>();
      for (const p of enriched) {
        const pid = String(p?.player_id || "");
        if (pid) byId.set(pid, p);
        const nm = normalizePlayerName(String(p?.name || ""));
        if (nm) byName.set(nm, p);
      }
      const base = toPlayerRows(enriched, extras, league.teams);
      const merged = base.map((r) => {
        const hit =
          byId.get(r.player_id) || byName.get(normalizePlayerName(r.name));
        if (!hit) return r;
        return {
          ...r,
          bc_rank: hit.bc_rank ?? r.rank ?? undefined,
          bc_tier: hit.bc_tier ?? r.tier ?? undefined,
          sleeper_pts: hit.sleeper_pts ?? undefined,
          sleeper_adp: hit.sleeper_adp ?? undefined,
          sleeper_rank_overall: hit.sleeper_rank_overall ?? undefined,
          fp_pts: hit.fp_pts ?? undefined,
          ecr_round_pick:
            hit.fp_rank_overall != null && league?.teams
              ? ecrToRoundPick(
                  Number(hit.fp_rank_overall),
                  Number(league.teams)
                )
              : undefined,
          fp_rank_overall: hit.fp_rank_overall ?? undefined,
          fp_rank_pos: hit.fp_rank_pos ?? undefined,
          fp_tier: hit.fp_tier ?? undefined,
          fp_baseline_pts: hit.fp_baseline_pts ?? undefined,
          fp_value: hit.fp_value ?? undefined,
          fp_positional_scarcity_slope:
            hit.fp_positional_scarcity_slope ?? undefined,
          fp_player_owned_avg: hit.fp_player_owned_avg ?? undefined,
          market_delta: hit.market_delta ?? undefined,
        } as PlayerRow;
      });
      return merged.sort(
        (a, b) =>
          (Number(a.bc_rank ?? 1e9) as number) -
          (Number(b.bc_rank ?? 1e9) as number)
      );
    } catch {
      return [] as PlayerRow[];
    }
  }

  const rowsQB = React.useMemo(
    () => buildRowsForPos("QB"),
    [qbData, league, extras, availablePlayers]
  );
  const rowsRB = React.useMemo(
    () => buildRowsForPos("RB"),
    [rbData, league, extras, availablePlayers]
  );
  const rowsWR = React.useMemo(
    () => buildRowsForPos("WR"),
    [wrData, league, extras, availablePlayers]
  );
  const rowsTE = React.useMemo(
    () => buildRowsForPos("TE"),
    [teData, league, extras, availablePlayers]
  );
  const rowsFLEX = React.useMemo(
    () => buildRowsForPos("FLEX"),
    [flexData, league, extras, availablePlayers]
  );

  return (
    <div className="grid grid-cols-1 gap-6">
      {(
        [
          ["QB", rowsQB],
          ["RB", rowsRB],
          ["WR", rowsWR],
          ["TE", rowsTE],
          ["FLEX", rowsFLEX],
        ] as const
      ).map(([label, rows]) => (
        <Card key={label}>
          <Collapsible defaultOpen>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle>{label}</CardTitle>
                <CollapsibleTrigger className="text-sm underline-offset-2 hover:underline">
                  Toggle
                </CollapsibleTrigger>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <PlayerTable
                  rows={
                    expanded[String(label)]
                      ? (rows as PlayerRow[])
                      : (rows as PlayerRow[]).slice(0, DEFAULT_POS_TABLE_LIMIT)
                  }
                  sortable
                  colorizeValuePs
                  renderActions={(r) => (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onPreview(r)}
                      aria-label="Preview"
                      title="Preview"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                      >
                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </Button>
                  )}
                />
                {(rows as PlayerRow[]).length > DEFAULT_POS_TABLE_LIMIT ? (
                  <div className="mt-3">
                    <Button
                      variant="ghost"
                      onClick={() => toggleExpanded(String(label))}
                      className="w-full"
                    >
                      {expanded[String(label)] ? "Show Less" : "Show More"}
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}
      <PreviewPickDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        baseSlots={userRosterSlots || []}
        player={previewPlayer}
      />
    </div>
  );
}
