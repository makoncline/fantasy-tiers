import { z } from "zod";
import { buildStarterAwareValues, MAN_GAMES_ASSUMPTIONS } from "./beerPlusStrategy";
import { buildDraftValueBoard } from "./draftValue";
import { buildDraftChoices, choiceRosterFit, type DraftChoiceSnapshot } from "./draftChoices";
import { PositionEnum } from "./schemas";

export const DraftChoiceSensitivitySchema = z.object({
  status: z.enum(["Stable under tested assumptions", "Choice changes with assumptions", "Insufficient evidence"]),
  scenarios: z.array(z.object({
    assumption: z.string(),
    leanId: z.string().nullable(),
    leanName: z.string().nullable(),
    choiceIds: z.array(z.string()),
    addedNames: z.array(z.string()),
    removedNames: z.array(z.string()),
    adjustedGap: z.number().nullable(),
    path: z.string(),
    change: z.enum(["Same lean", "Exchange within initial choices", "Different roster path", "New choice; inspect"]),
  })),
  persistentChoiceNames: z.array(z.string()),
});
export type DraftChoiceSensitivity = z.infer<typeof DraftChoiceSensitivitySchema>;

/** Hand-set stress cases. Frequencies across these cases are not probabilities. */
export function analyzeDraftChoiceSensitivity(snapshot: DraftChoiceSnapshot): DraftChoiceSensitivity {
  const input = snapshot.boardInput;
  const baseline = buildDraftValueBoard(input);
  const initial = buildDraftChoices(baseline);
  const initialIds = new Set(initial.map((c) => c.player.player_id));
  const initialLean = baseline.topRecommendation?.player;
  if (!initialLean) return { status: "Insufficient evidence", scenarios: [], persistentChoiceNames: [] };
  const scenarios: DraftChoiceSensitivity["scenarios"] = [];
  const run = (assumption: string, changed: typeof input) => {
    const board = buildDraftValueBoard(changed);
    const choices = buildDraftChoices(board);
    const lean = board.topRecommendation;
    const ids = new Set(choices.map((c) => c.player.player_id));
    const samePath = lean && choiceRosterFit(lean.player, input.userPositionNeeds).purpose ===
      choiceRosterFit(initialLean, input.userPositionNeeds).purpose;
    scenarios.push({
      assumption,
      leanId: lean?.player.player_id ?? null,
      leanName: lean?.player.name ?? null,
      choiceIds: [...ids],
      addedNames: choices.filter((c) => !initialIds.has(c.player.player_id)).map((c) => c.player.name),
      removedNames: initial.filter((c) => !ids.has(c.player.player_id)).map((c) => c.player.name),
      adjustedGap: lean?.metrics.recommendationScoreGap ?? null,
      path: lean ? choiceRosterFit(lean.player, input.userPositionNeeds).purpose : "No eligible choice",
      change: lean?.player.player_id === initialLean.player_id ? "Same lean"
        : !samePath ? "Different roster path"
        : initialIds.has(lean?.player.player_id ?? "") ? "Exchange within initial choices" : "New choice; inspect",
    });
  };
  // Offset pairs cover both neighbours of an interior player. Values move with ECR
  // because the active model assigns the positional point curve in ECR order.
  for (const offset of [0, 1]) {
    const replacements = new Map<string, { ecr: number; value: number }>();
    for (const position of PositionEnum.options) {
      const players = input.players.filter((p) => p.position === position && p.fp_rank_ave != null &&
        input.staticValuesByPlayerId[p.player_id] != null).sort((a, b) => a.fp_rank_ave! - b.fp_rank_ave! || a.player_id.localeCompare(b.player_id));
      for (let index = offset; index + 1 < players.length; index += 2) {
        const a = players[index]!;
        const b = players[index + 1]!;
        replacements.set(a.player_id, { ecr: b.fp_rank_ave!, value: input.staticValuesByPlayerId[b.player_id]! });
        replacements.set(b.player_id, { ecr: a.fp_rank_ave!, value: input.staticValuesByPlayerId[a.player_id]! });
      }
    }
    run(`Swap adjacent ECR pairs, offset ${offset}; keep tiers and league rules fixed`, {
      ...input,
      players: input.players.map((p) => replacements.has(p.player_id) ? { ...p, fp_rank_ave: replacements.get(p.player_id)!.ecr } : p),
      staticValuesByPlayerId: { ...input.staticValuesByPlayerId, ...Object.fromEntries([...replacements].map(([id, p]) => [id, p.value])) },
    });
  }
  const valuePlayers = input.players.flatMap((p) => {
    const v = snapshot.values.valuesByPlayerId[p.player_id];
    return v ? [{ playerId: p.player_id, position: p.position, projectedPoints: v.projectedPoints }] : [];
  });
  for (const change of [-1, 1]) {
    const result = buildStarterAwareValues({
      teams: input.teams,
      rosterSlots: snapshot.rosterSlots,
      players: valuePlayers,
      expectedGames: {
        ...MAN_GAMES_ASSUMPTIONS.expectedGames,
        QB: MAN_GAMES_ASSUMPTIONS.expectedGames.QB + change,
        TE: MAN_GAMES_ASSUMPTIONS.expectedGames.TE + change,
      },
    });
    run(`QB and TE usable games ${change > 0 ? "+1" : "−1"}; recompute replacement depth`, {
      ...input,
      staticValuesByPlayerId: Object.fromEntries(Object.entries(result.valuesByPlayerId).map(([id, v]) => [id, v.value])),
    });
  }
  // These probe the existing timing heuristic, not a validated opponent model.
  for (const position of ["RB", "WR"] as const) {
    run(`${position} market prices one round earlier; existing timing heuristic only`, {
      ...input,
      players: input.players.map((p) => p.position === position ? {
        ...p,
        sleeper_adp: p.sleeper_adp == null ? null : Math.max(1, p.sleeper_adp - input.teams),
        sleeper_board_rank: p.sleeper_board_rank == null ? null : Math.max(1, p.sleeper_board_rank - input.teams),
      } : p),
    });
  }
  const incomplete = scenarios.some((s) => s.leanId == null);
  const changed = scenarios.some((s) => s.leanId !== initialLean.player_id || s.addedNames.length || s.removedNames.length);
  return {
    status: incomplete ? "Insufficient evidence" : changed ? "Choice changes with assumptions" : "Stable under tested assumptions",
    scenarios,
    persistentChoiceNames: initial.filter((c) => scenarios.every((s) => s.choiceIds.includes(c.player.player_id))).map((c) => c.player.name),
  };
}
