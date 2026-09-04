import React from "react";
import { EyeIcon } from "lucide-react";

import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";
import {
  draftBoardRows,
  hasDraftEcr,
  OVERALL_PLAYER_LIMIT,
} from "@/app/draft-assistant/_lib/draftBoardDisplay";
import type { DraftPickAction } from "@/app/draft-assistant/_lib/types";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { canAddPositionToRoster } from "@/lib/draftRosterPolicy";
import type { PlayerWithPick } from "@/lib/types.draft";

import { PlayerTable } from "./PlayerTable";
import PreviewPickDialog, { type PreviewPickPlayer } from "./PreviewPickDialog";

interface AvailablePlayersProps {
  loading: boolean;
  pickAction?: DraftPickAction | undefined;
}

function toPreviewPlayer(row: PlayerWithPick): PreviewPickPlayer {
  return {
    ...row,
    bye_week: row.bye_week != null ? String(row.bye_week) : null,
    rank: row.tier_rank ?? row.rank ?? 0,
    tier: row.tier_level ?? row.tier ?? 0,
  };
}

export default function AvailablePlayers({
  loading,
  pickAction,
}: AvailablePlayersProps) {
  const {
    playersAll,
    userRosterSlots,
    userPositionCounts,
    userPositionRequirements,
    showDiagnostics,
    setShowDiagnostics,
  } = useDraftData();
  const [previewPlayer, setPreviewPlayer] =
    React.useState<PreviewPickPlayer | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  const rows = React.useMemo(
    () =>
      draftBoardRows({
        rows: playersAll,
        diagnostics: showDiagnostics,
        counts: userPositionCounts,
        requirements: userPositionRequirements,
      }),
    [
      playersAll,
      showDiagnostics,
      userPositionCounts,
      userPositionRequirements,
    ]
  );

  const openPreview = React.useCallback((row: PlayerWithPick) => {
    setPreviewPlayer(toPreviewPlayer(row));
    setPreviewOpen(true);
  }, []);

  if (loading) return <p aria-live="polite">Loading available players...</p>;

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {showDiagnostics
            ? "Drafted players and players without current FantasyPros ECR."
            : `Top ${Math.min(
                rows.length,
                OVERALL_PLAYER_LIMIT
              )} roster-legal players by Adj.`}
        </p>
        <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <Switch
            checked={showDiagnostics}
            onCheckedChange={setShowDiagnostics}
            data-testid="draft-diagnostics-toggle"
          />
          <span>Diagnostics</span>
        </label>
      </div>

      <div className="overflow-x-auto">
        <PlayerTable
          rows={rows}
          sortable
          colorizeValuePs
          dimDrafted={showDiagnostics}
          defaultSortId="adj"
          defaultSortDir="desc"
          heatDomainRows={playersAll}
          maxRows={OVERALL_PLAYER_LIMIT}
          renderActions={(row) => (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => openPreview(row)}
                aria-label={`Preview ${row.name}`}
                title="Preview"
              >
                <EyeIcon className="h-4 w-4" />
              </Button>
              {pickAction ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={
                    pickAction.disabled ||
                    Boolean(row.picked) ||
                    !hasDraftEcr(row) ||
                    !canAddPositionToRoster({
                      position: row.position,
                      counts: userPositionCounts,
                      requirements: userPositionRequirements,
                    })
                  }
                  aria-label={`${pickAction.label ?? "Pick"} ${row.name}`}
                  data-testid={`mock-pick-${row.player_id}`}
                  onClick={() => pickAction.onPick(row)}
                >
                  {pickAction.label ?? "Pick"}
                </Button>
              ) : null}
            </div>
          )}
        />
      </div>

      <PreviewPickDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        baseSlots={userRosterSlots}
        player={previewPlayer}
      />
    </>
  );
}
