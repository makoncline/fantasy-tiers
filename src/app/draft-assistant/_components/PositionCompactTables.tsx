import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";
import { normalizePosition } from "@/lib/util";
import { PlayerTable } from "./PlayerTable";

import type { PlayerWithPick } from "@/lib/types.draft";
import PlayersTableBase from "./table/PlayersTableBase";
import type { ColumnGroup } from "./table/columns";

import PreviewPickDialog, { type PreviewPickPlayer } from "./PreviewPickDialog";
import { CheckIcon, EyeIcon } from "lucide-react";
import type { DraftPickAction } from "@/app/draft-assistant/_lib/types";

// Compact position tables: fixed columns and non-sortable, grouped by Tiers tiers
interface PositionCompactTablesProps {
  showAll?: boolean;
  setShowAll?: (value: boolean) => void;
  showDrafted?: boolean;
  setShowDrafted?: (value: boolean) => void;
  showUnranked?: boolean;
  setShowUnranked?: (value: boolean) => void;
  pickAction?: DraftPickAction | undefined;
}

export default function PositionCompactTables({
  showAll: externalShowAll,
  setShowAll: externalSetShowAll,
  showDrafted: externalShowDrafted,
  setShowDrafted: externalSetShowDrafted,
  showUnranked: externalShowUnranked,
  setShowUnranked: externalSetShowUnranked,
  pickAction,
}: PositionCompactTablesProps = {}) {
  const {
    playersByPosition,
    userRosterSlots,
    getRosterStatus,
    showAll,
    setShowAll,
    showDrafted,
    setShowDrafted,
    showUnranked,
    setShowUnranked,
  } = useDraftData();
  const valueColorDomainRef = React.useRef<PlayerWithPick[]>([]);
  if (
    valueColorDomainRef.current.length === 0 &&
    playersByPosition?.ALL?.some(
      (player) => typeof player.draft_value_score === "number"
    )
  ) {
    valueColorDomainRef.current = playersByPosition.ALL;
  }

  // Use drafted lookups hook
  // Remove useDraftedLookups - using enriched data from context

  const DEFAULT_POS_TABLE_LIMIT = 10;
  const [openLabel, setOpenLabel] = React.useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewPlayer, setPreviewPlayer] =
    React.useState<PreviewPickPlayer | null>(null);

  // Use external state if provided, otherwise use context state
  const actualShowAll = externalShowAll ?? showAll;
  const actualSetShowAll = externalSetShowAll ?? setShowAll;
  const actualShowDrafted = externalShowDrafted ?? showDrafted;
  const actualSetShowDrafted = externalSetShowDrafted ?? setShowDrafted;
  const actualShowUnranked = externalShowUnranked ?? showUnranked;
  const actualSetShowUnranked = externalSetShowUnranked ?? setShowUnranked;

  const onPreview = React.useCallback(
    (row: PlayerWithPick) => {
      // Use the enriched row directly since it already has pick data
      let found = row;

      if (found && userRosterSlots && userRosterSlots.length > 0) {
        // Convert found player to RankedPlayer format
        const rankedPlayer: PreviewPickPlayer = {
          ...found,
          player_id: found.player_id,
          name: found.name,
          position: found.position,
          team: found.team,
          bye_week: found.bye_week != null ? String(found.bye_week) : null,
          rank: found.rank || 0,
          tier: found.tier || 0,
        };
        setPreviewPlayer(rankedPlayer);
        setPreviewOpen(true);
      } else {
        // If we can't find the player, try to create a basic player object for preview
        if (userRosterSlots && userRosterSlots.length > 0) {
          const fallbackPlayer: PreviewPickPlayer = {
            ...row,
            player_id: row.player_id,
            name: row.name,
            position: row.position,
            team: row.team,
            bye_week:
              typeof row.bye_week === "number"
                ? row.bye_week.toString()
                : row.bye_week,
            rank: row.rank || 0,
            tier: row.tier || 0,
          };
          setPreviewPlayer(fallbackPlayer);
          setPreviewOpen(true);
        }
      }
    },
    [userRosterSlots]
  );

  const sections: [string, PlayerWithPick[]][] = [
    ["QB", playersByPosition?.QB ?? []],
    ["RB", playersByPosition?.RB ?? []],
    ["WR", playersByPosition?.WR ?? []],
    ["FLEX", playersByPosition?.FLEX ?? []],
    ["TE", playersByPosition?.TE ?? []],
    ["DEF", playersByPosition?.DEF ?? []],
    ["K", playersByPosition?.K ?? []],
  ];

  const compactGroups: ColumnGroup<PlayerWithPick>[] = [
    {
      header: "Players",
      children: [
        {
          id: "name",
          header: "Name",
          accessor: (row) => row.name,
          sortable: true,
          sortAs: "string",
          width: "16ch",
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
          id: "val",
          header: "VAL",
          description: "Canonical pick value score.",
          accessor: (row) => row.draft_value_score ?? null,
          sortable: true,
          sortAs: "number",
          nulls: "last",
          defaultDir: "desc",
          heat: { scale: "val" },
          width: "6ch",
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
          id: "preview",
          header: "Preview",
          accessor: () => null,
          width: "5ch",
          render: (_, row) => (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onPreview(row)}
              aria-label={`Preview ${row.name}`}
              title="Preview"
            >
              <EyeIcon className="h-4 w-4" />
            </Button>
          ),
        },
      ],
    },
  ];

  const renderActions = React.useCallback(
    (row: PlayerWithPick) => (
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onPreview(row)}
          aria-label={`Preview ${row.name}`}
          title="Preview"
        >
          <EyeIcon className="h-4 w-4" />
        </Button>
        {pickAction ? (
          <Button
            type="button"
            size="sm"
            className="h-6 px-2 text-xs"
            disabled={pickAction.disabled || Boolean(row.picked)}
            aria-label={`${pickAction.label ?? "Pick"} ${row.name}`}
            data-testid={`mock-pick-${row.player_id}`}
            onClick={() => pickAction.onPick(row)}
          >
            {pickAction.label ?? "Pick"}
          </Button>
        ) : null}
      </div>
    ),
    [onPreview, pickAction]
  );

  const renderPickAction = React.useCallback(
    (row: PlayerWithPick) =>
      pickAction ? (
        <Button
          type="button"
          size="sm"
          className="h-6 px-2 text-xs"
          disabled={pickAction.disabled || Boolean(row.picked)}
          aria-label={`${pickAction.label ?? "Pick"} ${row.name}`}
          data-testid={`mock-pick-${row.player_id}`}
          onClick={() => pickAction.onPick(row)}
        >
          {pickAction.label ?? "Pick"}
        </Button>
      ) : null,
    [pickAction]
  );

  // Show loading state if bundle data is not loaded
  if (!playersByPosition) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-center py-8">
          <p className="text-muted-foreground" aria-live="polite">
            Loading player data...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center px-1 py-1">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch
            checked={actualShowAll}
            onCheckedChange={actualSetShowAll}
            data-testid="positions-toggle-show-all"
          />
          <span>Show all rows</span>
        </label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-1">
        {sections.map(([label, rows]) => {
          const limit = DEFAULT_POS_TABLE_LIMIT;
          const eligible = actualShowUnranked
            ? rows
            : rows.filter(
                (row) =>
                  typeof row.fp_rank_ave === "number" ||
                  typeof row.position_tier_level === "number"
              );
          const allRows = actualShowDrafted
            ? eligible
            : eligible.filter((r) => !r.picked);
          return (
            <div key={label}>
              <Card className="block w-full" data-testid={`pos-card-${label}`}>
                <CardHeader className="py-1 px-2">
                  <CardTitle className="text-sm flex items-baseline gap-2">
                    {label}
                  </CardTitle>
                  {(() => {
                    const pos = normalizePosition(label);
                    if (!pos) return null;
                    const {
                      count: rosterCount,
                      requirement: rosterReq,
                      met,
                    } = getRosterStatus(pos);
                    return (
                      <div className="text-xs text-muted-foreground flex flex-col gap-0.5 mt-0.5">
                        <div className="flex items-center gap-1">
                          <span>
                            roster {rosterCount}/{rosterReq}
                          </span>
                          {met ? (
                            <svg
                              aria-label="met"
                              className="h-3 w-3 text-green-500"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          ) : null}
                        </div>
                      </div>
                    );
                  })()}
                </CardHeader>
                <CardContent className="pt-0 px-2 pb-2">
                  <div className="overflow-x-auto">
                    <PlayersTableBase
                      rows={allRows}
                      groups={compactGroups}
                      sortable
                      maxRows={actualShowAll ? undefined : limit}
                      colorize={true}
                      dimDrafted={true}
                      tierRowColors={true}
                      defaultSortId="val"
                      defaultSortDir="desc"
                      heatDomainRows={valueColorDomainRef.current}
                      {...(pickAction
                        ? { renderActions: renderPickAction }
                        : {})}
                    />
                  </div>
                  {!actualShowAll && allRows.length > limit ? (
                    <div className="mt-3">
                      <button
                        type="button"
                        className="w-full text-sm underline-offset-2 hover:underline"
                        onClick={() => setOpenLabel(label)}
                      >
                        Show More
                      </button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
      <Dialog
        open={openLabel != null}
        onOpenChange={(o) => !o && setOpenLabel(null)}
      >
        <DialogContent className="max-w-6xl w-[92vw] max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-baseline gap-2">
              {openLabel}
            </DialogTitle>
            {(() => {
              const pos = openLabel ? normalizePosition(openLabel) : null;
              if (!pos) return null;
              const {
                count: rosterCount,
                requirement: rosterReq,
                met,
              } = getRosterStatus(pos);
              return (
                <div className="text-xs text-muted-foreground flex flex-col gap-1 mt-1">
                  <div className="flex items-center gap-1">
                    <span>
                      roster {rosterCount}/{rosterReq}
                    </span>
                    {met ? (
                      <CheckIcon className="h-3 w-3 text-green-500" />
                    ) : null}
                  </div>
                  {/* Dialog toggles - use global context switches */}
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2">
                      <Switch
                        checked={actualShowDrafted}
                        onCheckedChange={actualSetShowDrafted}
                      />{" "}
                      <span>Show drafted</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <Switch
                        checked={actualShowUnranked}
                        onCheckedChange={actualSetShowUnranked}
                      />{" "}
                      <span>Show unranked</span>
                    </label>
                  </div>
                </div>
              );
            })()}
            <DialogDescription>
              Compare {openLabel} draft value, position tier, and ADP.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto pr-2">
            {(() => {
              const tuple = sections.find(([lab]) => lab === openLabel);
              if (!tuple) return null;
              const [, fullRowsRaw] = tuple;
              // Respect dialog toggles in the dialog view
              const dlgEligible = (fullRowsRaw || []).filter((r) =>
                actualShowUnranked
                  ? true
                  : typeof r.fp_rank_ave === "number" ||
                    typeof r.position_tier_level === "number"
              );
              const fullRows = actualShowDrafted
                ? dlgEligible
                : dlgEligible.filter((r) => !r.picked);
              return (
                <PlayerTable
                  rows={fullRows}
                  sortable
                  colorizeValuePs
                  dimDrafted={actualShowDrafted}
                  hideDrafted={!actualShowDrafted}
                  defaultSortId="val"
                  defaultSortDir="desc"
                  heatDomainRows={valueColorDomainRef.current}
                  renderActions={renderActions}
                />
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Lineup preview modal */}
      <PreviewPickDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        baseSlots={userRosterSlots || []}
        player={previewPlayer}
      />
    </div>
  );
}
