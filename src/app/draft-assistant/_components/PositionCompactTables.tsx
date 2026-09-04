import React from "react";
import { EyeIcon } from "lucide-react";

import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";
import {
  DRAFT_BOARD_POSITIONS,
  draftBoardRows,
  formatSleeperEcrEdge,
  isRosterLegalPlayer,
  isRosterLegalPosition,
  POSITION_PLAYER_LIMIT,
  sleeperEcrEdge,
} from "@/app/draft-assistant/_lib/draftBoardDisplay";
import type { DraftPickAction } from "@/app/draft-assistant/_lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Position, RosterSlot } from "@/lib/schemas";
import type { PlayerWithPick } from "@/lib/types.draft";

import { PlayerTable } from "./PlayerTable";
import PreviewPickDialog, { type PreviewPickPlayer } from "./PreviewPickDialog";
import PlayersTableBase from "./table/PlayersTableBase";
import { PlayerSummaryCell } from "./table/PlayerSummaryCell";
import type { ColumnGroup } from "./table/columns";
import {
  DRAFT_VALUE_DESCRIPTIONS,
  formatDraftValue,
} from "./table/presets";

interface PositionCompactTablesProps {
  pickAction?: DraftPickAction | undefined;
}

type PositionSection = {
  position: Position;
  rows: PlayerWithPick[];
  rosterCount: number;
  rosterRequirement: number;
  leagueNeeds: number;
  tierRemaining: number;
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

function tierRemaining(rows: readonly PlayerWithPick[]) {
  const sorted = [...rows].sort(
    (a, b) =>
      (b.draft_value_score ?? Number.NEGATIVE_INFINITY) -
      (a.draft_value_score ?? Number.NEGATIVE_INFINITY)
  );
  const tier = sorted[0]?.position_tier_level;
  if (tier == null) return 0;
  return sorted.filter((row) => row.position_tier_level === tier).length;
}

function toPreviewPlayer(row: PlayerWithPick): PreviewPickPlayer {
  return {
    ...row,
    bye_week: row.bye_week != null ? String(row.bye_week) : null,
    rank: row.tier_rank ?? row.rank ?? 0,
    tier: row.tier_level ?? row.tier ?? 0,
  };
}

function formatCount(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export default function PositionCompactTables({
  pickAction,
}: PositionCompactTablesProps = {}) {
  const {
    playersByPosition,
    userRosterSlots,
    userPositionCounts,
    userPositionRequirements,
    getRosterStatus,
    draftContext,
    showDiagnostics,
  } = useDraftData();
  const [openPosition, setOpenPosition] = React.useState<Position | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewPlayer, setPreviewPlayer] =
    React.useState<PreviewPickPlayer | null>(null);

  const openPreview = React.useCallback((row: PlayerWithPick) => {
    setPreviewPlayer(toPreviewPlayer(row));
    setPreviewOpen(true);
  }, []);

  const sections = React.useMemo<PositionSection[]>(() => {
    if (!playersByPosition) return [];

    return DRAFT_BOARD_POSITIONS.flatMap((position) => {
      if (!isConfiguredPosition(position, userPositionRequirements)) return [];
      if (
        !showDiagnostics &&
        !isRosterLegalPosition(
          position,
          userPositionCounts,
          userPositionRequirements
        )
      ) {
        return [];
      }

      const rows = draftBoardRows({
        rows: playersByPosition[position],
        diagnostics: showDiagnostics,
        counts: userPositionCounts,
        requirements: userPositionRequirements,
      });
      if (rows.length === 0) return [];

      const roster = getRosterStatus(position);
      const outlook = draftContext?.positionOutlook.find(
        (item) => item.position === position
      );
      return [
        {
          position,
          rows,
          rosterCount: roster.count,
          rosterRequirement: roster.requirement,
          leagueNeeds: outlook?.leagueStarterSlotsRemaining ?? 0,
          tierRemaining: tierRemaining(rows),
        },
      ];
    });
  }, [
    draftContext,
    getRosterStatus,
    playersByPosition,
    showDiagnostics,
    userPositionCounts,
    userPositionRequirements,
  ]);

  const compactGroups = React.useMemo<ColumnGroup<PlayerWithPick>[]>(
    () => [
      {
        header: "Position",
        children: [
          {
            id: "name",
            header: "Player",
            accessor: (row) => row.name,
            sortable: true,
            sortAs: "string",
            width: "18ch",
            render: (_, row) => <PlayerSummaryCell row={row} />,
          },
          {
            id: "position_tier",
            header: "Tier",
            description: "FantasyPros position tier.",
            accessor: (row) => row.position_tier_level ?? null,
            sortable: true,
            sortAs: "number",
            nulls: "last",
            width: "5ch",
          },
          {
            id: "raw",
            header: "VAL",
            description: DRAFT_VALUE_DESCRIPTIONS.raw,
            accessor: (row) => row.draft_raw_value_score ?? null,
            sortable: true,
            sortAs: "number",
            nulls: "last",
            width: "6ch",
            render: formatDraftValue,
          },
          {
            id: "adj",
            header: "ADJ",
            description: DRAFT_VALUE_DESCRIPTIONS.adjusted,
            accessor: (row) => row.draft_value_score ?? null,
            sortable: true,
            sortAs: "number",
            nulls: "last",
            defaultDir: "desc",
            heat: { scale: "val" },
            width: "6ch",
            render: formatDraftValue,
          },
          {
            id: "ecr",
            header: "ECR",
            description: "FantasyPros expert consensus rank.",
            accessor: (row) => row.fp_rank_ave ?? null,
            sortable: true,
            sortAs: "number",
            nulls: "last",
            width: "6ch",
            render: formatDraftValue,
          },
          {
            id: "adp",
            header: "ADP",
            description: "Sleeper average draft position.",
            accessor: (row) => row.sleeper_adp ?? null,
            sortable: true,
            sortAs: "number",
            nulls: "last",
            width: "6ch",
            render: (_, row) => row.sleeper_adp_round_pick ?? "—",
          },
          {
            id: "market_edge",
            header: "Edge",
            description:
              "Sleeper ADP minus FantasyPros ECR. Later can be a market value.",
            accessor: sleeperEcrEdge,
            sortable: true,
            sortAs: "number",
            nulls: "last",
            width: "9ch",
            render: (_, row) => formatSleeperEcrEdge(row),
          },
        ],
      },
    ],
    []
  );

  const renderActions = React.useCallback(
    (row: PlayerWithPick) => (
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
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
      openPreview,
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
      {showDiagnostics ? (
        <p className="px-1 text-xs text-muted-foreground">
          Diagnostic rows only. Turn off Diagnostics above to return to the draft
          board.
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {sections.map((section) => (
          <Card
            key={section.position}
            className="min-w-0"
            data-testid={`pos-card-${section.position}`}
          >
            <CardHeader className="px-3 py-2">
              <CardTitle className="text-sm">{section.position}</CardTitle>
              <p className="text-xs text-muted-foreground">
                You: {section.rosterCount}/{section.rosterRequirement}
                {" · "}
                League needs: {formatCount(section.leagueNeeds)}
                {" · "}
                {section.tierRemaining} left in tier
              </p>
            </CardHeader>
            <CardContent className="px-2 pb-2 pt-0">
              <div className="overflow-x-auto">
                <PlayersTableBase
                  rows={section.rows}
                  groups={compactGroups}
                  sortable
                  maxRows={POSITION_PLAYER_LIMIT}
                  colorize
                  dimDrafted={showDiagnostics}
                  tierRowColors
                  defaultSortId="adj"
                  defaultSortDir="desc"
                  heatDomainRows={section.rows}
                  renderActions={renderActions}
                />
              </div>
              {section.rows.length > POSITION_PLAYER_LIMIT ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => setOpenPosition(section.position)}
                >
                  Show all {section.position}
                </Button>
              ) : null}
            </CardContent>
          </Card>
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
              {openSection
                ? `You: ${openSection.rosterCount}/${openSection.rosterRequirement} · League needs: ${formatCount(openSection.leagueNeeds)} · ${openSection.tierRemaining} left in tier`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-auto pr-2">
            {openSection ? (
              <PlayerTable
                rows={openSection.rows}
                sortable
                colorizeValuePs
                dimDrafted={showDiagnostics}
                defaultSortId="adj"
                defaultSortDir="desc"
                heatDomainRows={openSection.rows}
                renderActions={renderActions}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <PreviewPickDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        baseSlots={userRosterSlots}
        player={previewPlayer}
      />
    </div>
  );
}
