import { DraftCandidateSchema } from "./draftCandidate";
import { buildStarterAwareValues } from "./beerPlusStrategy";
import type { DraftChoiceSnapshot } from "./draftChoices";
import { DEFAULT_DRAFT_ROSTER_SLOTS, DEFAULT_DRAFT_SCORING_RULES } from "./draftLeagueConfig";
/** Synthetic players: checks state handling, not fantasy quality or outcomes. */
export function draftChoiceFixture(): DraftChoiceSnapshot {
  const positions = ["RB", "WR", "QB", "TE"] as const;
  const players = Array.from({ length: 96 }, (_, index) => DraftCandidateSchema.parse({
    player_id: `test-${index}`, name: `Test player ${index}`,
    position: positions[index % positions.length], team: null, bye_week: null,
    rank: index + 1, tier: Math.floor(index / 12) + 1, tier_rank: index + 1,
    tier_level: Math.floor(index / 12) + 1, position_tier_level: Math.floor(index / 16) + 1,
    sleeper_tier_level: null, fp_rank_ave: index + 1, fp_rank_pos: Math.floor(index / 4) + 1,
    sleeper_adp: index + 1, sleeper_board_rank: index + 1, sleeper_board_value: null,
    sleeper_injury_status: null, sleeper_injury_notes: null, sleeper_depth_chart_position: null,
    sleeper_depth_chart_order: null, fp_rank_updated_at: null, sleeper_projection: null,
  }));
  const values = buildStarterAwareValues({ teams: 12, rosterSlots: DEFAULT_DRAFT_ROSTER_SLOTS,
    players: players.map((p, index) => ({ playerId: p.player_id, position: p.position, projectedPoints: 300 - index })) });
  const requirements = { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2, K: 0, DEF: 1, BN: 5 };
  return { draftId: "synthetic-ui-test", scoringRules: DEFAULT_DRAFT_SCORING_RULES,
    projectionUpdatedAt: null, rosterSlots: DEFAULT_DRAFT_ROSTER_SLOTS, values,
    boardInput: { players, teams: 12, rounds: 14, draftType: "snake", currentPick: 4, userSlot: 4,
      rosterRequirements: requirements, userPositionCounts: {}, userPositionNeeds: requirements,
      userRosterPlayers: [],
      teamRosterStates: Array.from({ length: 12 }, (_, index) => ({ draftSlot: index + 1,
        positionCounts: {}, starterNeeds: { ...requirements }, benchSlotsRemaining: 5 })),
      staticValuesByPlayerId: Object.fromEntries(Object.entries(values.valuesByPlayerId).map(([id, value]) => [id, value.value])),
    } };
}

