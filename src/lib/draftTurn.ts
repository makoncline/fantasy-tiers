/** Draft-order facts only. No player value or opponent policy belongs here. */
export type DraftTurnInput = {
  currentPick: number;
  userSlot?: number | null | undefined;
  teams: number;
  rounds?: number | undefined;
  draftType?: string | null | undefined;
};

// Kept identical to the existing scheduler so valid positive waits do not move.
export function pickSlot(overall: number, teams: number, draftType?: string | null) {
  if (!overall || !teams) return null;
  const pickInRound = ((overall - 1) % teams) + 1;
  const round = Math.ceil(overall / teams);
  if (String(draftType ?? "").toLowerCase() === "linear") return pickInRound;
  return round % 2 === 1 ? pickInRound : teams - pickInRound + 1;
}

export function getNextPickForSlot(args: DraftTurnInput) {
  const { currentPick, userSlot, teams, rounds, draftType } = args;
  if (!userSlot || !teams || teams <= 0) return null;
  const maxPick = teams * Math.max(rounds ?? 30, 1);
  for (let pick = Math.max(1, currentPick); pick <= maxPick; pick += 1) {
    if (pickSlot(pick, teams, draftType) === userSlot) return pick;
  }
  return null;
}

export function getDraftTurnContext(args: DraftTurnInput) {
  const unknown = {
    state: "unknown" as const,
    nextPick: null,
    comebackTargetPick: null,
    opponentPicksBeforeTarget: null,
  };
  const draftType = String(args.draftType ?? "snake").toLowerCase();
  if (
    !Number.isSafeInteger(args.teams) || args.teams < 1 ||
    !Number.isSafeInteger(args.currentPick) || args.currentPick < 1 ||
    args.userSlot == null || !Number.isSafeInteger(args.userSlot) ||
    args.userSlot < 1 || args.userSlot > args.teams ||
    !["", "snake", "linear"].includes(draftType) ||
    (args.rounds != null && (
      !Number.isSafeInteger(args.rounds) || args.rounds < 1 ||
      !Number.isSafeInteger(args.teams * args.rounds)
    ))
  ) {
    return unknown;
  }

  const nextPick = getNextPickForSlot(args);
  const comebackTargetPick = getNextPickForSlot({
    ...args,
    currentPick: args.currentPick + 1,
  });
  // Preserve the legacy estimated targets if the draft length is absent. They
  // must not establish a deterministic zero wait or a confirmed final pick.
  if (args.rounds == null) {
    return { ...unknown, nextPick, comebackTargetPick };
  }
  if (comebackTargetPick == null) {
    return {
      state: "no-future-pick" as const,
      nextPick,
      comebackTargetPick: null,
      opponentPicksBeforeTarget: null,
    };
  }

  // Skip the current selection only when it belongs to the owner. Off clock,
  // the current manager still has a selection to make before the next turn.
  const firstOpponentPick = args.currentPick + (nextPick === args.currentPick ? 1 : 0);
  const opponentPicksBeforeTarget = comebackTargetPick - firstOpponentPick;
  if (opponentPicksBeforeTarget < 0) return unknown;
  return {
    state: opponentPicksBeforeTarget === 0 ? "back-to-back" as const : "waiting" as const,
    nextPick,
    comebackTargetPick,
    opponentPicksBeforeTarget,
  };
}
