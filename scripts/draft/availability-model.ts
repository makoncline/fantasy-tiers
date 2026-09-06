import { createHash } from "node:crypto";
import type { DraftDetails } from "../../src/lib/draftDetails";
import type { DraftPick } from "../../src/lib/schemas";
import { buildRosterRequirementsFromDraftSettings, calculateTeamNeedsAndCountsForSingleTeam } from "../../src/lib/draftHelpers";
import { getDraftSlotForPick, type SimDraftPlayer } from "../../src/lib/simDraft";
import { getSimBotStrategy } from "../../src/lib/simDraft/botStrategies";

// Experimental availability only. This module does not choose our draft pick.
export function predictAvailability(input: {
  draft: DraftDetails;
  picks: DraftPick[];
  selectedId: string;
  nextPick: number;
  players: SimDraftPlayer[];
  candidateIds: string[];
  samples: number;
  seed: string;
}) {
  const { draft, picks, players, nextPick, samples } = input;
  const pickNo = picks.length + 1;
  if (draft.type !== "snake" || !Number.isInteger(samples) || samples < 1 || nextPick <= pickNo) {
    throw new Error("A snake draft, positive sample count, and future own pick are required.");
  }
  if (picks.some((pick, index) => pick.pick_no !== index + 1)) {
    throw new Error("Only the contiguous prior pick prefix is allowed.");
  }
  const ownSlot = getDraftSlotForPick(pickNo, draft.settings.teams, "snake");
  if (getDraftSlotForPick(nextPick, draft.settings.teams, "snake") !== ownSlot ||
      nextPick > draft.settings.teams * draft.settings.rounds) throw new Error("The target must be a future own pick.");
  const byId = new Map(players.map((player) => [player.player_id, player]));
  const alreadyPicked = new Set(picks.map((pick) => pick.player_id));
  if (alreadyPicked.has(input.selectedId) || !byId.has(input.selectedId)) throw new Error("Selected player is unavailable.");
  if (input.candidateIds.some((id) => alreadyPicked.has(id) || id === input.selectedId)) throw new Error("The candidate cohort must exclude selected players.");
  for (const id of [...alreadyPicked, ...input.candidateIds]) {
    if (!byId.has(id)) throw new Error(`Frozen player pool is missing ${id}.`);
  }
  const requirements = buildRosterRequirementsFromDraftSettings(draft.settings);
  const method = getSimBotStrategy("sleeper-market-v1");
  const counts = new Map(input.candidateIds.map((id) => [id, { platform: 0, roster: 0 }]));
  for (const mode of ["platform", "roster"] as const) {
    for (let sample = 0; sample < samples; sample += 1) {
      const rosters = new Map<number, SimDraftPlayer[]>();
      for (let slot = 1; slot <= draft.settings.teams; slot += 1) rosters.set(slot, []);
      for (const pick of picks) rosters.get(pick.draft_slot)!.push(byId.get(pick.player_id)!);
      rosters.get(getDraftSlotForPick(pickNo, draft.settings.teams, "snake"))!.push(byId.get(input.selectedId)!);
      const picked = new Set([...alreadyPicked, input.selectedId]);
      for (let futurePick = pickNo + 1; futurePick < nextPick; futurePick += 1) {
        const slot = getDraftSlotForPick(futurePick, draft.settings.teams, "snake");
        const roster = rosters.get(slot)!;
        const random = createHash("sha256").update(`availability-screen:${input.seed}:${pickNo}:${sample}:${futurePick}`)
          .digest().readUInt32LE(0) / 2 ** 32;
        const player = method.choosePlayer({
          roster, rosterRequirements: requirements,
          needs: calculateTeamNeedsAndCountsForSingleTeam(roster, requirements).positionNeeds,
          round: Math.ceil(futurePick / draft.settings.teams), rounds: draft.settings.rounds,
          // Our backup limits do not apply to opponents.
          available: players.filter((player) => !picked.has(player.player_id)), random,
          ...(mode === "platform" ? { roster: [], needs: {} } : {}),
        });
        roster.push(player);
        picked.add(player.player_id);
      }
      for (const id of input.candidateIds) if (!picked.has(id)) counts.get(id)![mode] += 1;
    }
  }
  return Object.fromEntries([...counts].map(([id, count]) => {
    const p = (n: number) => nextPick === pickNo + 1 ? 1 : (n + 0.5) / (samples + 1);
    return [id, { platform: p(count.platform), roster: p(count.roster) }];
  }));
}
