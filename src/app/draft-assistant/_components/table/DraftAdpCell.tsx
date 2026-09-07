"use client";

import { useDraftData } from "../../_contexts/DraftDataContext";
import { getChoicePickWindow } from "@/lib/draftLookaheadCore";
import { DraftAdpValue } from "../DraftAdpValue";

export function DraftAdpCell({ playerId, adp, display }: {
  playerId: string; adp: number | null; display?: string | undefined;
}) {
  const { choiceSnapshot: snapshot, recommendationBoard: board } = useDraftData();
  // Metrics exist for available players only. Do not color a previously picked
  // row against a future turn, or invent timing when the board is not ready.
  const available = board?.metricsByPlayerId[playerId] != null;
  const window = snapshot && available ? getChoicePickWindow(snapshot.boardInput) : null;
  return <DraftAdpValue adp={adp} pick={window?.ownPick ?? null}
    teams={snapshot?.boardInput.teams ?? 0} display={display} compact />;
}
