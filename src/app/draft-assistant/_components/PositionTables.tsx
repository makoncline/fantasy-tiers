import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PreviewPickDialog from "./PreviewPickDialog";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { PlayerTable } from "./PlayerTable";
import type { PlayerRow } from "@/lib/playerRows";
import { toPlayerRows } from "@/lib/playerRows";
import type { Extras } from "@/lib/playerRows";
import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";
import { normalizePlayerName } from "@/lib/util";
import { SEASON_WEEKS } from "@/lib/constants";
import type { RankedPlayer } from "@/lib/schemas";
import type { BeerRow } from "@/lib/beersheets";

export default function PositionTables() {
  const {
    positionRows,
    beerSheetsBoard,
    availablePlayers,
    userRosterSlots,
    loading,
    error,
  } = useDraftData();

  const DEFAULT_POS_TABLE_LIMIT = 5;
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const toggleExpanded = (key: string) =>
    setExpanded((s) => ({ ...s, [key]: !s[key] }));
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewPlayer, setPreviewPlayer] = React.useState<RankedPlayer | null>(
    null
  );
  const onPreview = (row: PlayerRow) => {
    const found = availablePlayers?.find((p) => p.player_id === row.player_id);
    if (found) {
      setPreviewPlayer(found);
      setPreviewOpen(true);
    }
  };

  // Component setup complete

  const extras = React.useMemo(() => {
    const map: Record<
      string,
      { val?: number; ps?: number; ecr_round_pick?: string }
    > = {};
    (beerSheetsBoard || []).forEach((r: BeerRow) => {
      const value: { val?: number; ps?: number; ecr_round_pick?: string } = {};
      if (r.val != null && Number.isFinite(r.val)) {
        value.val = Number((r.val / SEASON_WEEKS).toFixed(1));
      }
      if (r.ps != null && Number.isFinite(r.ps)) {
        value.ps = Number(Math.round(r.ps));
      }
      // ecr_round_pick remains undefined
      map[r.player_id] = value;
      const nm = normalizePlayerName(r.name || "");
      if (nm) map[nm] = value;
    });
    return map;
  }, [beerSheetsBoard]);

  // Use position rows from context instead of computing locally

  return (
    <div className="grid grid-cols-1 gap-6">
      {(
        [
          ["QB", positionRows?.QB ?? []],
          ["RB", positionRows?.RB ?? []],
          ["WR", positionRows?.WR ?? []],
          ["TE", positionRows?.TE ?? []],
          ["FLEX", positionRows?.FLEX ?? []],
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
