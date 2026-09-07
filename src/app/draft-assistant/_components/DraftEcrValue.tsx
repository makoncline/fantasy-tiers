"use client";

import { ecrToRoundPick } from "@/lib/util";
import { useDraftData } from "../_contexts/DraftDataContext";

export function DraftEcrValue({ rank }: { rank: number | null | undefined }) {
  const { league, choiceSnapshot, draftDetails } = useDraftData();
  const teams = choiceSnapshot?.boardInput.teams ?? league?.teams ?? draftDetails?.settings.teams;
  const validRank = rank != null && Number.isFinite(rank) && rank > 0 ? rank : null;
  const display = ecrToRoundPick(validRank, teams);
  return <span className="whitespace-nowrap tabular-nums" title={validRank == null
    ? "ECR unavailable" : `ECR rank ${validRank}. Round.pick rounds to the nearest pick.${display ? "" : " League size unavailable."}`}>
    {display ?? "—"}
  </span>;
}
