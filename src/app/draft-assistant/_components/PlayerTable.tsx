import React from "react";
import PlayersTableBase from "./table/PlayersTableBase";
import { GROUPS_FULL } from "./table/presets";
import type { PlayerWithPick } from "@/lib/types.draft";

// Re-export for backward compatibility
export { mapToPlayerRow } from "@/lib/playerRowMapping";

export function PlayerTable({
  rows,
  renderActions,
  sortable = false,
  colorizeValuePs = false,
  hideDrafted = false,
  dimDrafted = false,
  defaultSortId,
  defaultSortDir,
  heatDomainRows,
}: {
  rows: PlayerWithPick[];
  renderActions?: (row: PlayerWithPick) => React.ReactNode;
  sortable?: boolean;
  colorizeValuePs?: boolean;
  hideDrafted?: boolean;
  dimDrafted?: boolean;
  defaultSortId?: string;
  defaultSortDir?: "asc" | "desc";
  heatDomainRows?: PlayerWithPick[];
}) {
  return (
    <PlayersTableBase
      rows={rows}
      groups={GROUPS_FULL}
      sortable={sortable}
      colorize={colorizeValuePs}
      hideDrafted={hideDrafted}
      dimDrafted={dimDrafted}
      defaultSortId={defaultSortId}
      defaultSortDir={defaultSortDir}
      heatDomainRows={heatDomainRows}
      {...(renderActions && { renderActions })}
    />
  );
}
