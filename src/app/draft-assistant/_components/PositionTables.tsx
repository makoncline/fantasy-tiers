import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { PlayerTable, mapToPlayerRow, type PlayerRow } from "./PlayerTable";
import { useCombinedAggregate } from "../_lib/useDraftQueries";
import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";
import enrichPlayers from "@/lib/enrichPlayers";
import { normalizePlayerName } from "@/lib/util";
import { SEASON_WEEKS } from "@/lib/constants";

export default function PositionTables() {
  const { league, beerSheetsBoard, availablePlayers } = useDraftData() as any;

  const { data: shardQB } = useCombinedAggregate("QB", true);
  const { data: shardRB } = useCombinedAggregate("RB", true);
  const { data: shardWR } = useCombinedAggregate("WR", true);
  const { data: shardTE } = useCombinedAggregate("TE", true);
  const { data: shardFLEX } = useCombinedAggregate("FLEX", true);

  const extras = React.useMemo(() => {
    const map: Record<string, { val?: number; ps?: number; ecr_round_pick?: string }> = {};
    (beerSheetsBoard || []).forEach((r: any) => {
      const value = {
        val: Number.isFinite(r.val) ? Number((r.val / SEASON_WEEKS).toFixed(1)) : r.val,
        ps: Number.isFinite(r.ps) ? Number(Math.round(r.ps)) : r.ps,
        ecr_round_pick: r.adp != null && Number.isFinite(r.adp) ? String(r.adp) : undefined,
      } as const;
      map[r.player_id] = value;
      const nm = normalizePlayerName(r.name || "");
      if (nm) map[nm] = value;
    });
    return map;
  }, [beerSheetsBoard]);

  function buildRowsForPos(pos: "QB" | "RB" | "WR" | "TE" | "FLEX") {
    const dataset = pos === "QB" ? shardQB : pos === "RB" ? shardRB : pos === "WR" ? shardWR : pos === "TE" ? shardTE : shardFLEX;
    if (!dataset || !league?.scoring) return [] as PlayerRow[];
    try {
      const enriched = enrichPlayers(Object.values(dataset), {
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
      const base = mapToPlayerRow(
        (availablePlayers as any[]).filter((p) =>
          pos === "FLEX" ? (["RB", "WR", "TE"] as const).includes((p as any).position) : (p as any).position === pos
        ),
        extras
      );
      const merged = base.map((r) => {
        const hit = byId.get(r.player_id) || byName.get(normalizePlayerName(r.name));
        if (!hit) return r;
        return {
          ...r,
          bc_rank: hit.bc_rank ?? r.rank ?? undefined,
          bc_tier: hit.bc_tier ?? r.tier ?? undefined,
          sleeper_pts: hit.sleeper_pts ?? undefined,
          sleeper_adp: hit.sleeper_adp ?? undefined,
          sleeper_rank_overall: hit.sleeper_rank_overall ?? undefined,
          fp_pts: hit.fp_pts ?? undefined,
          fp_rank_overall: hit.fp_rank_overall ?? undefined,
          fp_rank_pos: hit.fp_rank_pos ?? undefined,
          fp_tier: hit.fp_tier ?? undefined,
          fp_baseline_pts: hit.fp_baseline_pts ?? undefined,
          fp_value: hit.fp_value ?? undefined,
          fp_positional_scarcity_slope: hit.fp_positional_scarcity_slope ?? undefined,
          fp_player_owned_avg: hit.fp_player_owned_avg ?? undefined,
          market_delta: hit.market_delta ?? undefined,
        } as PlayerRow;
      });
      return merged.sort((a, b) => (Number(a.bc_rank ?? 1e9) as number) - (Number(b.bc_rank ?? 1e9) as number)).slice(0, 30);
    } catch {
      return [] as PlayerRow[];
    }
  }

  const rowsQB = React.useMemo(() => buildRowsForPos("QB"), [shardQB, league, extras, availablePlayers]);
  const rowsRB = React.useMemo(() => buildRowsForPos("RB"), [shardRB, league, extras, availablePlayers]);
  const rowsWR = React.useMemo(() => buildRowsForPos("WR"), [shardWR, league, extras, availablePlayers]);
  const rowsTE = React.useMemo(() => buildRowsForPos("TE"), [shardTE, league, extras, availablePlayers]);
  const rowsFLEX = React.useMemo(() => buildRowsForPos("FLEX"), [shardFLEX, league, extras, availablePlayers]);

  return (
    <div className="grid grid-cols-1 gap-6">
      {([
        ["QB", rowsQB],
        ["RB", rowsRB],
        ["WR", rowsWR],
        ["TE", rowsTE],
        ["FLEX", rowsFLEX],
      ] as const).map(([label, rows]) => (
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
                <PlayerTable rows={rows as PlayerRow[]} sortable />
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}
    </div>
  );
}
