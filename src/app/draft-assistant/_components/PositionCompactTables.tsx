import { useDraftTablePreferences } from "./DraftTablePreferences";
import React from "react";
import { DraftDemand } from "./DraftDemand";
import { DraftScarcity } from "./DraftScarcity";

import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";
import {
  DRAFT_BOARD_POSITIONS,
  draftBoardRows,
  isRosterLegalPlayer,
  isRosterLegalPosition,
  POSITION_PLAYER_LIMIT,
} from "@/app/draft-assistant/_lib/draftBoardDisplay";
import type { DraftPickAction } from "@/app/draft-assistant/_lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Position, RosterSlot } from "@/lib/schemas";
import type { PlayerWithPick } from "@/lib/types.draft";

import PreviewPickDialog, { type PreviewPickPlayer } from "./PreviewPickDialog";
import PlayersTableBase from "./table/PlayersTableBase";
import { draftTableGroups } from "./table/presets";

interface PositionCompactTablesProps {
  position?: Position | "FLEX" | undefined;
  pickAction?: DraftPickAction | undefined;
}

type PositionSection = {
  position: Position | "FLEX";
  rows: PlayerWithPick[];
  rosterCount: number;
  rosterRequirement: number;
};

function isConfiguredPosition(
  position: Position,
  requirements: Partial<Record<RosterSlot, number>>
) {
  if (position === "RB" || position === "WR" || position === "TE") {
    return (
      (requirements[position] ?? 0) > 0 || (requirements.FLEX ?? 0) > 0
    );
  }
  return (requirements[position] ?? 0) > 0;
}

function toPreviewPlayer(row: PlayerWithPick): PreviewPickPlayer {
  return {
    ...row,
    bye_week: row.bye_week != null ? String(row.bye_week) : null,
    rank: row.tier_rank ?? row.rank ?? 0,
    tier: row.tier_level ?? row.tier ?? 0,
  };
}


export default function PositionCompactTables({
  pickAction,
  position: selectedPosition,
}: PositionCompactTablesProps = {}) {
  const {
    playersByPosition,
    valueSource,
    userRosterSlots,
    userPositionCounts,
    userPositionRequirements,
    getRosterStatus,
    showDiagnostics,
  } = useDraftData();
  const showDrafted = useDraftTablePreferences()?.showDrafted ?? false;
  const [openPosition, setOpenPosition] = React.useState<Position | "FLEX" | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewPlayer, setPreviewPlayer] =
    React.useState<PreviewPickPlayer | null>(null);

  const openPreview = React.useCallback((row: PlayerWithPick) => {
    setPreviewPlayer(toPreviewPlayer(row));
    setPreviewOpen(true);
  }, []);

  const sections = React.useMemo<PositionSection[]>(() => {
    if (!playersByPosition) return [];

    return (selectedPosition ? [selectedPosition] : DRAFT_BOARD_POSITIONS).flatMap((position) => {
      if (position !== "FLEX" && !isConfiguredPosition(position, userPositionRequirements)) return [];
      const rows = draftBoardRows({
        rows: playersByPosition[position],
        diagnostics: showDiagnostics,
        showDrafted,
        counts: userPositionCounts,
        requirements: userPositionRequirements,
      });

      const roster = position === "FLEX" ? { count: userRosterSlots.filter(s => s.slot === "FLEX" && s.player).length, requirement: userPositionRequirements.FLEX ?? 0 } : getRosterStatus(position);
      return [
        {
          position,
          rows,
          rosterCount: roster.count,
          rosterRequirement: roster.requirement,
        },
      ];
    });
  }, [
    getRosterStatus,
    playersByPosition,
    selectedPosition,
    userRosterSlots,
    showDiagnostics,
    showDrafted,
    userPositionCounts,
    userPositionRequirements,
  ]);

  const compactGroups = (position: Position | "FLEX") => draftTableGroups({ source: valueSource, position, onOpen: openPreview });

  const renderActions = React.useCallback(
    (row: PlayerWithPick) => (
      <div className="flex items-center justify-end gap-1">
        {pickAction ? (
          <Button
            type="button"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={
              pickAction.disabled ||
              Boolean(row.picked) ||
              !isRosterLegalPlayer(
                row,
                userPositionCounts,
                userPositionRequirements
              )
            }
            aria-label={`${pickAction.label ?? "Pick"} ${row.name}`}
            data-testid={`mock-pick-${row.player_id}`}
            onClick={() => pickAction.onPick(row)}
          >
            {pickAction.label ?? "Pick"}
          </Button>
        ) : null}
      </div>
    ),
    [
      pickAction,
      userPositionCounts,
      userPositionRequirements,
    ]
  );

  if (!playersByPosition) {
    return (
      <p className="py-8 text-center text-muted-foreground" aria-live="polite">
        Loading player data...
      </p>
    );
  }

  const openSection = sections.find(
    (section) => section.position === openPosition
  );

  return (
    <div className="space-y-2">
      {sections.length === 0 ? <p className="text-sm text-muted-foreground">No position slots are configured for this pool.</p> : null}
      {showDiagnostics ? (
        <p className="px-1 text-xs text-muted-foreground">
          Diagnostic rows only. Turn off Diagnostics above to return to the draft
          board.
        </p>
      ) : null}
      <div className={selectedPosition ? "grid grid-cols-1 gap-2" : "grid grid-cols-1 gap-2 md:grid-cols-2"}>
        {sections.map((section) => (
          <section
            key={section.position}
            className="min-w-0 space-y-2"
            data-testid={`pos-card-${section.position}`}
          >
            <header className="space-y-1">
              <h2 className="text-sm font-semibold">{section.position === "DEF" ? "D/ST" : section.position}</h2>
              <p className="text-xs text-muted-foreground">
                <DraftScarcity position={section.position} /> · <DraftDemand position={section.position} />
              </p>
            </header>
            <div>
              {section.rows.length === 0 ? <p className="text-xs text-muted-foreground">{section.position !== "FLEX" && !isRosterLegalPosition(section.position, userPositionCounts, userPositionRequirements) ? "Owner limit filled" : "No eligible undrafted players"}</p> : null}
              <div className="overflow-x-auto">
                <PlayersTableBase
                  rows={section.rows}
                  groups={compactGroups(section.position)}
                  sortable
                  maxRows={POSITION_PLAYER_LIMIT}
                  colorize
                  dimDrafted={showDiagnostics || showDrafted}
                  defaultSortId="adj"
                  defaultSortDir="desc"
                  heatDomainRows={section.rows}
                  renderActions={pickAction ? renderActions : undefined}
                />
              </div>
              {section.rows.filter(row => !row.picked).length > POSITION_PLAYER_LIMIT ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => setOpenPosition(section.position)}
                >
                  Show all {section.position === "DEF" ? "D/ST" : section.position}
                </Button>
              ) : null}
            </div>
          </section>
        ))}
      </div>

      <Dialog
        open={openSection != null}
        onOpenChange={(isOpen) => !isOpen && setOpenPosition(null)}
      >
        <DialogContent className="max-h-[90vh] w-[92vw] max-w-6xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>{openSection?.position} draft board</DialogTitle>
            <DialogDescription>
              {openSection ? <DraftDemand position={openSection.position} /> : null}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-auto pr-2">
            {openSection ? (
              <PlayersTableBase
                rows={openSection.rows}
                groups={compactGroups(openSection.position)}
                sortable
                colorize
                dimDrafted={showDiagnostics || showDrafted}
                defaultSortId="adj"
                defaultSortDir="desc"
                heatDomainRows={openSection.rows}
                renderActions={pickAction ? renderActions : undefined}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <PreviewPickDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        player={previewPlayer}
      />
    </div>
  );
}
