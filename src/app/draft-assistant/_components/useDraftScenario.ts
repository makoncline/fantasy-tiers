"use client";
import { useEffect, useRef, useState } from "react";
import { createLatestDraftTask } from "@/lib/draftOptionalTask";
import { buildDraftLookahead, getLookaheadRoomFacts } from "@/lib/draftLookahead";
import { buildDraftChoices, type DraftChoiceSnapshot } from "@/lib/draftChoices";
import type { DraftValueBoard } from "@/lib/draftValue";
import type { DraftCandidate } from "@/lib/draftCandidate";

export type ScenarioPayload = {
  result: ReturnType<typeof buildDraftLookahead>;
  paths: { firstName: string; firstPosition: DraftCandidate["position"]; result: ReturnType<typeof buildDraftLookahead> }[];
  room: ReturnType<typeof getLookaheadRoomFacts>;
};
type Request = { snapshot: DraftChoiceSnapshot; board: DraftValueBoard<DraftCandidate>; id: string };
type Job = { request: Request; sequence: number } & (
  | { status: "pending" | "failed" }
  | { status: "ready"; payload: ScenarioPayload }
);

export function useDraftScenario(snapshot: DraftChoiceSnapshot, board: DraftValueBoard<DraftCandidate>) {
  const [task] = useState(createLatestDraftTask);
  const [job, setJob] = useState<Job | null>(null);
  const sequence = useRef(0);
  // Cancel pending external timers on data changes and unmount. Rendering also
  // checks identities, so an old completion never appears under a new heading.
  useEffect(() => () => task.cancel(), [task, snapshot, board]);
  const current = job?.request.snapshot === snapshot && job.request.board === board ? job : null;
  const start = (id: string) => {
    const request = { snapshot, board, id };
    const next = ++sequence.current;
    setJob({ request, sequence: next, status: "pending" });
    task.start(() => {
      const first = board.recommendations.find((p) => p.player_id === id);
      const choices = buildDraftChoices(board);
      const other = choices.find((c) => c.player.player_id !== id && c.player.position !== first?.position)
        ?? choices.find((c) => c.player.player_id !== id);
      const result = buildDraftLookahead(snapshot, id, board);
      const paths = first ? [{ firstName: first.name, firstPosition: first.position, result }] : [];
      if (other) paths.push({ firstName: other.player.name, firstPosition: other.player.position,
        result: buildDraftLookahead(snapshot, other.player.player_id, board) });
      return { result, paths, room: getLookaheadRoomFacts(snapshot) };
    },
      (payload) => setJob({ request, sequence: next, status: "ready", payload }),
      () => setJob({ request, sequence: next, status: "failed" }));
  };
  return { current, stale: job != null && current == null, start };
}
