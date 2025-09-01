import type { DraftDetails } from "./draftDetails";
import type { DraftPick } from "./schemas";
import type {
  DraftedPlayer,
  RankedPlayer,
  RosterSlot,
  Position,
} from "./schemas";
import {
  calculateTeamNeedsAndCountsForSingleTeam,
  ZERO_POSITION_COUNTS,
  calculateTotalRemainingNeeds,
  getDraftRecommendations,
} from "./draftHelpers";

export type PlayerWithDraftMeta = DraftedPlayer & {
  drafted: boolean;
  pick_no?: number;
  round?: number;
  pick_in_round?: number;
  draft_slot?: number;
};

export function computeRoundPick(pickNo: number, teams: number) {
  if (!teams || teams <= 0) return { round: 0, pick_in_round: 0 };
  const round = Math.ceil(pickNo / teams);
  const pick_in_round = ((pickNo - 1) % teams) + 1;
  return { round, pick_in_round };
}

export function buildDraftState(args: {
  playersMap: Record<string, DraftedPlayer>;
  draft: DraftDetails;
  picks: DraftPick[];
}) {
  const { playersMap, draft, picks } = args;
  const teams = draft?.settings?.teams ?? 0;

  // Index picks by player_id for quick lookup
  const pickByPlayerId = new Map<string, DraftPick>();
  for (const p of picks) {
    if (p && p.player_id) pickByPlayerId.set(String(p.player_id), p);
  }

  const playersWithDraft: Record<string, PlayerWithDraftMeta> = {};
  const drafted: PlayerWithDraftMeta[] = [];
  const available: RankedPlayer[] = [];

  for (const [id, player] of Object.entries(playersMap)) {
    const pick = pickByPlayerId.get(id);
    if (pick) {
      const { round, pick_in_round } = computeRoundPick(pick.pick_no, teams);
      const merged: PlayerWithDraftMeta = {
        ...(player as DraftedPlayer),
        drafted: true,
        pick_no: pick.pick_no,
        round,
        pick_in_round,
        draft_slot: pick.draft_slot,
      };
      playersWithDraft[id] = merged;
      drafted.push(merged);
    } else {
      const merged: PlayerWithDraftMeta = {
        ...(player as DraftedPlayer),
        drafted: false,
      };
      playersWithDraft[id] = merged;
      if (merged.rank != null && merged.tier != null) {
        available.push(merged as unknown as RankedPlayer);
      }
    }
  }

  drafted.sort((a, b) => (a.pick_no ?? 0) - (b.pick_no ?? 0));
  available.sort((a, b) => a.rank - b.rank);

  const draftedIds = new Set(drafted.map((p) => p.player_id));

  return {
    players: playersWithDraft,
    drafted,
    available,
    draftedIds,
    teams,
  };
}

export function groupAvailableByPosition(available: RankedPlayer[]) {
  const out: Record<string, RankedPlayer[]> = {};
  for (const p of available) {
    if (!out[p.position]) out[p.position] = [];
    out[p.position]!.push(p);
  }
  for (const k of Object.keys(out)) {
    if (out[k]) {
      out[k].sort((a, b) => a.rank - b.rank);
    }
  }
  return out;
}

export function topAvailableByPosition(
  availableByPosition: Record<string, RankedPlayer[]>,
  limit: number
) {
  const out: Record<string, RankedPlayer[]> = {};
  for (const [pos, arr] of Object.entries(availableByPosition)) {
    out[pos] = arr.slice(0, Math.max(0, limit));
  }
  return out;
}

export type DraftViewModel = ReturnType<typeof buildDraftViewModel>;

export function buildDraftViewModel(args: {
  playersMap: Record<string, DraftedPlayer>;
  draft: DraftDetails;
  picks: DraftPick[];
  userId?: string;
  topLimit?: number;
}) {
  const { playersMap, draft, picks, userId, topLimit = 3 } = args;
  const base = buildDraftState({ playersMap, draft, picks });

  // Roster requirements from draft settings
  const rosterRequirements: Record<RosterSlot | "BN", number> = {
    QB: draft.settings?.slots_qb ?? 0,
    RB: draft.settings?.slots_rb ?? 0,
    WR: draft.settings?.slots_wr ?? 0,
    TE: draft.settings?.slots_te ?? 0,
    K: draft.settings?.slots_k ?? 0,
    DEF: draft.settings?.slots_def ?? 0,
    FLEX: draft.settings?.slots_flex ?? 0,
    BN: 0,
  } as const;

  // Build rosters for each draft slot
  const teams = draft.settings?.teams ?? 0;
  const draftSlots = Array.from({ length: teams }, (_, i) => i + 1);
  const rosters: Record<
    number,
    {
      players: (PlayerWithDraftMeta | DraftedPlayer)[];
      remainingPositionRequirements: Partial<Record<RosterSlot | "BN", number>>;
      rosterPositionCounts: Partial<Record<RosterSlot | "BN", number>>;
    }
  > = {};

  for (const slot of draftSlots) {
    const rosteredPlayers = base.drafted.filter((p) => p.draft_slot === slot);
    const rosterReqsWithoutBN: Record<RosterSlot, number> = {
      QB: rosterRequirements.QB,
      RB: rosterRequirements.RB,
      WR: rosterRequirements.WR,
      TE: rosterRequirements.TE,
      K: rosterRequirements.K,
      DEF: rosterRequirements.DEF,
      FLEX: rosterRequirements.FLEX,
      BN: rosterRequirements.BN,
    };
    const { positionNeeds, positionCounts } =
      calculateTeamNeedsAndCountsForSingleTeam(
        rosteredPlayers,
        rosterReqsWithoutBN
      );
    rosters[slot] = {
      players: rosteredPlayers,
      remainingPositionRequirements: positionNeeds,
      rosterPositionCounts: positionCounts,
    };
  }

  const userSlot = userId
    ? (draft.draft_order?.[userId] as number | undefined)
    : undefined;
  const userRoster = userSlot ? rosters[userSlot] : undefined;
  const availableByPosition = groupAvailableByPosition(base.available);
  const topAvailable = topAvailableByPosition(availableByPosition, topLimit);
  const draftWideNeeds = calculateTotalRemainingNeeds(
    Object.fromEntries(
      Object.entries(rosters).map(([k, v]) => {
        // Filter out "BN" and ensure all Position keys are present with defaults
        const {
          BN,
          QB = 0,
          RB = 0,
          WR = 0,
          TE = 0,
          K = 0,
          DEF = 0,
          FLEX = 0,
          ...others
        } = v.remainingPositionRequirements;
        const positionRequirements: Record<Position, number> = {
          QB,
          RB,
          WR,
          TE,
          K,
          DEF,
        };
        return [k, { remainingPositionRequirements: positionRequirements }];
      })
    )
  );
  const nextPickRecommendations = userRoster
    ? getDraftRecommendations(
        base.available,
        // Filter out "BN" and ensure all Position keys are present
        (() => {
          const {
            BN,
            QB = 0,
            RB = 0,
            WR = 0,
            TE = 0,
            K = 0,
            DEF = 0,
            FLEX = 0,
            ...others
          } = userRoster.rosterPositionCounts;
          return { QB, RB, WR, TE, K, DEF } as Record<Position, number>;
        })(),
        // Filter out "BN" from remainingPositionRequirements
        Object.fromEntries(
          Object.entries(userRoster.remainingPositionRequirements).filter(
            ([key]) => key !== "BN"
          )
        ) as Record<RosterSlot, number>
      )
    : null;

  return {
    ...base,
    availableByPosition,
    topAvailablePlayersByPosition: topAvailable,
    userRoster,
    draftWideNeeds,
    nextPickRecommendations,
    rosterRequirements,
  };
}
