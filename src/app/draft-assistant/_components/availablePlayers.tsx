import { useDraftTablePreferences } from "./DraftTablePreferences";
import React from "react";

import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";
import {
  draftBoardRows,
  hasDraftEcr,
} from "@/app/draft-assistant/_lib/draftBoardDisplay";
import type { DraftPickAction } from "@/app/draft-assistant/_lib/types";
import { Button } from "@/components/ui/button";
import { canAddPositionToRoster } from "@/lib/draftRosterPolicy";
import type { PlayerWithPick } from "@/lib/types.draft";

import { PlayerTable } from "./PlayerTable";
import PreviewPickDialog, { type PreviewPickPlayer } from "./PreviewPickDialog";

interface AvailablePlayersProps {
  loading: boolean;
  excludedPositions?: readonly string[];
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
  excludedPositions = [],
}: AvailablePlayersProps) {
  const {
    playersAll,
    valueSource,
    userPositionCounts,
    userPositionRequirements,
    showDiagnostics,
  } = useDraftData();
  const showDrafted = useDraftTablePreferences()?.showDrafted ?? false;
  const [previewPlayer, setPreviewPlayer] =
    React.useState<PreviewPickPlayer | null>(null);
  const [visibleCount, setVisibleCount] = React.useState(20);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  const rows = React.useMemo(
    () =>
      draftBoardRows({
        rows: playersAll,
        diagnostics: showDiagnostics,
        showDrafted,
        counts: userPositionCounts,
        requirements: userPositionRequirements,
      }).filter(row => !excludedPositions.includes(row.position)),
    [
      playersAll,
      excludedPositions,
      showDiagnostics,
      showDrafted,
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

      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No players match these filters.</p> : null}
      <div className="overflow-x-auto">
        <PlayerTable
          rows={rows}
          source={valueSource}
          onPlayerClick={openPreview}
          sortable
          colorizeValuePs
          dimDrafted={showDiagnostics || showDrafted}
          defaultSortId="adj"
          defaultSortDir="desc"
          heatDomainRows={playersAll}
          maxRows={visibleCount}
          renderActions={pickAction ? (row) => (
            <div className="flex items-center justify-end gap-1">
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
          ) : undefined}
        />
      </div>

      {rows.filter(row => !row.picked).length > visibleCount ? <Button variant="outline" size="sm" onClick={() => setVisibleCount(count => count + 20)}>Show more</Button> : null}

      <PreviewPickDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        player={previewPlayer}
      />
    </>
  );
}
