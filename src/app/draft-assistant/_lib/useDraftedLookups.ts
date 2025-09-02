import { useMemo } from "react";
import { normalizePlayerName } from "@/lib/util";
import type { DraftPick } from "@/lib/schemas";
import type { SleeperPlayersMetaT } from "@/lib/schemas-sleeper";

export function useDraftedLookups(
  picks?: DraftPick[],
  sleeperMeta?: SleeperPlayersMetaT
) {
  const draftedIds = useMemo(
    () => new Set((picks ?? []).map((p) => String(p.player_id))),
    [picks]
  );

  const draftedNames = useMemo(() => {
    const set = new Set<string>();
    if (!picks || !sleeperMeta) return set;
    for (const p of picks) {
      const meta = sleeperMeta[String(p.player_id)];
      const full = String(meta?.full_name || meta?.name || "");
      const nm = normalizePlayerName(full);
      if (nm) set.add(nm);
    }
    return set;
  }, [picks, sleeperMeta]);

  return { draftedIds, draftedNames };
}
