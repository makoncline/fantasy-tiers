import React from "react";
import PlayersTableBase from "./table/PlayersTableBase";
import { draftTableGroups } from "./table/presets";
import type { PlayerWithPick } from "@/lib/types.draft";

// Re-export for backward compatibility
export { mapToPlayerRow } from "@/lib/playerRowMapping";

export function PlayerTable({
  rows,
  source,
  onPlayerClick,
  renderActions,
  sortable = false,
  colorizeValuePs = false,
  hideDrafted = false,
  dimDrafted = false,
  defaultSortId,
  defaultSortDir,
  heatDomainRows,
  maxRows,
  preferenceKey,
}: {
  rows: PlayerWithPick[];
  source?: string | undefined;
  onPlayerClick?: ((row: PlayerWithPick) => void) | undefined;
  renderActions?: ((row: PlayerWithPick) => React.ReactNode) | undefined;
  sortable?: boolean;
  colorizeValuePs?: boolean;
  hideDrafted?: boolean;
  dimDrafted?: boolean;
  defaultSortId?: string;
  defaultSortDir?: "asc" | "desc";
  heatDomainRows?: PlayerWithPick[];
  maxRows?: number;
  preferenceKey?: string | undefined;
}) {
  return (
    <PlayersTableBase
      preferenceKey={preferenceKey}
      rows={rows}
      groups={draftTableGroups({ source, onOpen: onPlayerClick })}
      sortable={sortable}
      colorize={colorizeValuePs}
      hideDrafted={hideDrafted}
      dimDrafted={dimDrafted}
      defaultSortId={defaultSortId}
      defaultSortDir={defaultSortDir}
      heatDomainRows={heatDomainRows}
      maxRows={maxRows}
      {...(renderActions && { renderActions })}
    />
  );
}
