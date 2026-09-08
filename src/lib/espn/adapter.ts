import { DraftDetailsSchema } from "@/lib/draftDetails";
import { DraftPicksSchema } from "@/lib/schemas";
import { DEFAULT_DRAFT_SCORING_RULES, DraftRosterSlotsSchema, DraftScoringRulesSchema, rankingScoringFromRules } from "@/lib/draftLeagueConfig";
import { type AggregatesBundleResponseT, type AggregatesBundlePlayerT } from "@/lib/schemas-bundle";
import { normalizePlayerName } from "@/lib/util";
import { DraftCandidateSchema, draftCandidateMapFromBundle, type DraftCandidate } from "@/lib/draftCandidate";
import { EspnRoomSchema, type EspnRoom } from "./schemas";

const positions: Record<number, string> = { 1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K", 16: "DEF" };
const slots: Record<number, string> = { 0: "QB", 2: "RB", 4: "WR", 6: "TE", 16: "DEF", 17: "K", 20: "BENCH", 23: "FLEX" };
const identity = (name: string, position: string) => `${position}:${normalizePlayerName(name.replace(/ D\/ST$/, ""))}`;

export function espnDraftConfig(input: EspnRoom) {
  const room = EspnRoomSchema.parse(input);
  const { data, live } = room;
  if (!data || !live) throw new Error("ESPN draft data is incomplete.");
  if (data.draftType !== "SNAKE" || live.draftType !== 1) throw new Error("Only ESPN snake drafts are supported.");
  // ESPN stores D/ST rates as position 16 overrides; D/ST uses labeled reference ranks.
  if (data.scoringItems.some((item) => Object.entries(item.pointsOverrides).some(([position, points]) => position !== "16" && points !== item.points))) {
    throw new Error("ESPN position-specific scoring is not supported. Recommendations are stopped.");
  }
  const counts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0, FLEX: 0, BENCH: 0, IR: 0 };
  for (const slot of live.slots) {
    const key = slots[slot.category];
    if (!key) throw new Error(`Unsupported ESPN roster slot: ${slot.category}`);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const rosterSlots = DraftRosterSlotsSchema.parse(counts);
  const points = (id: number) => data.scoringItems.find((s) => s.statId === id)?.points ?? 0;
  const scoringRules = DraftScoringRulesSchema.parse({
    reception: points(53), rushingYard: points(24), receivingYard: points(42),
    rushingTouchdown: points(25), receivingTouchdown: points(43), passingYard: points(3),
    passingTouchdown: points(4), interception: points(20), lostFumble: points(72), pointsPerCarry: points(23),
    defense: "unsupported-custom", fieldGoalUnder50: points(80), fieldGoal50Plus: points(198),
    extraPoint: points(86), missedFieldGoal: points(85), missedExtraPoint: points(88),
  });
  const teams = live.teams.length;
  const ordered = [...live.teams].sort((a, b) => a.draftPosition - b.draftPosition);
  if (teams < 2 || ordered.some((team, index) => team.draftPosition !== index)) throw new Error("ESPN draft order is incomplete.");
  const userTeam = live.teams.find((t) => t.id === live.teamId);
  if (!userTeam) throw new Error("Your ESPN draft team is missing.");
  const userId = `espn-team-${live.teamId}`;
  const rounds = live.picks.length / teams;
  if (!Number.isInteger(rounds) || rounds !== live.slots.length) throw new Error("ESPN draft rounds do not match the roster.");
  if (live.picks.some((p) => p.keeper)) throw new Error("ESPN keeper drafts are not supported yet.");
  const scoring = rankingScoringFromRules(scoringRules);
  const details = DraftDetailsSchema.parse({
    draft_id: `espn-${data.season}-${live.leagueId}`, league_id: String(live.leagueId), type: "snake", season: String(data.season),
    status: live.picks.every((p) => p.playerId !== -1) ? "complete" : live.state === 1 || live.state === 3 ? "drafting" : "pre_draft",
    metadata: { name: data.name, scoring_type: scoring },
    settings: { teams, rounds, slots_qb: counts.QB, slots_rb: counts.RB, slots_wr: counts.WR, slots_te: counts.TE, slots_k: counts.K, slots_def: counts.DEF, slots_flex: counts.FLEX, slots_bn: counts.BENCH, slots_ir: 0 },
    draft_order: Object.fromEntries(ordered.map((t) => [`espn-team-${t.id}`, t.draftPosition + 1])),
    slot_to_roster_id: Object.fromEntries(ordered.map((t) => [t.draftPosition + 1, t.id])),
  });
  // The owner selected standard Sleeper reference projections for D/ST and K.
  // Keep actual league rules separate from the projection model rules.
  const projectionScoringRules = { ...scoringRules,
    defense: DEFAULT_DRAFT_SCORING_RULES.defense,
    fieldGoalUnder50: DEFAULT_DRAFT_SCORING_RULES.fieldGoalUnder50,
    fieldGoal50Plus: DEFAULT_DRAFT_SCORING_RULES.fieldGoal50Plus,
    extraPoint: DEFAULT_DRAFT_SCORING_RULES.extraPoint,
    missedFieldGoal: DEFAULT_DRAFT_SCORING_RULES.missedFieldGoal,
    missedExtraPoint: DEFAULT_DRAFT_SCORING_RULES.missedExtraPoint,
  };
  return { teams, rounds, rosterSlots, scoringRules, projectionScoringRules, scoring, userId, userSlot: userTeam.draftPosition + 1, details };
}

/** Map identities once; each position keeps its own ranking shard. */
export function mapEspnDraft(input: EspnRoom, source: AggregatesBundleResponseT) {
  const room = EspnRoomSchema.parse(input);
  const config = espnDraftConfig(room);
  const { data, live } = room;
  if (!data || !live) throw new Error("ESPN draft data is incomplete.");
  const rows = new Map(Object.values(source.shards).flat().map((p) => [p.player_id, p]));
  const byIdentity = new Map<string, AggregatesBundlePlayerT[]>();
  for (const row of rows.values()) {
    // Defense names in the aggregate use the city plus mascot. ESPN uses mascot.
    const name = row.position === "DEF" ? row.name.split(" ").at(-1) ?? row.name : row.name;
    const key = identity(name, row.position);
    byIdentity.set(key, [...(byIdentity.get(key) ?? []), row]);
  }
  const idMap = new Map<number, string>();
  const matchedIds = new Set<string>();
  for (const player of data.players) {
    const position = positions[player.positionId];
    if (!position) continue;
    const candidates = byIdentity.get(identity(player.name, position)) ?? [];
    const exactName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const exact = candidates.filter((row) => exactName(row.name) === exactName(player.name));
    const matches = exact.length === 1 ? exact : candidates;
    if (matches.length > 1) continue; // Do not guess between duplicate identities.
    const row = matches[0];
    if (!row) continue;
    if (matchedIds.has(row.player_id)) throw new Error(`Duplicate ESPN player match: ${player.name}`);
    idMap.set(player.id, row.player_id);
    matchedIds.add(row.player_id);
  }
  const unrankedDraftedPlayers: Record<string, DraftCandidate> = {};
  const picks = DraftPicksSchema.parse(live.picks.filter((p) => p.playerId !== -1).map((p) => {
    let playerId = idMap.get(p.playerId);
    if (!playerId) {
      const player = data.players.find((player) => player.id === p.playerId);
      if (!player || !positions[player.positionId]) throw new Error(`A drafted ESPN player has no known identity (${p.playerId}). Recommendations are stopped.`);
      playerId = `espn-player-${player.id}`;
      // Draft bookkeeping only. No rankings or projections are assigned to this identity.
      unrankedDraftedPlayers[playerId] = DraftCandidateSchema.parse({
        player_id: playerId, name: player.name, position: positions[player.positionId], team: null, bye_week: null,
        rank: null, tier: null, tier_rank: null, tier_level: null, position_tier_level: null, sleeper_tier_level: null,
        fp_rank_ave: null, fp_rank_pos: null, sleeper_adp: null, sleeper_board_rank: null, sleeper_board_value: null,
        sleeper_injury_status: null, sleeper_injury_notes: null, sleeper_depth_chart_position: null,
        sleeper_depth_chart_order: null, fp_rank_updated_at: null, sleeper_projection: null,
      });
    }
    const team = live.teams.find((t) => t.id === p.teamId);
    if (!team) throw new Error("A pick has an unknown ESPN team.");
    return { player_id: playerId, pick_no: p.pickNumber, round: Math.ceil(p.pickNumber / config.teams), draft_slot: team.draftPosition + 1 };
  }).sort((a, b) => a.pick_no - b.pick_no));
  if (picks.some((p, index) => p.pick_no !== index + 1)) throw new Error("ESPN pick history has a gap. Reload the ESPN draft.");
  // Keep each source shard and its values, but only expose proven ESPN identities.
  // Do not mutate the cached bundle used by the shared assistant.
  const matched = (rows: AggregatesBundlePlayerT[]) => rows.filter((row) => matchedIds.has(row.player_id));
  const bundle: AggregatesBundleResponseT = { ...source, shards: {
    ALL: matched(source.shards.ALL), QB: matched(source.shards.QB),
    RB: matched(source.shards.RB), WR: matched(source.shards.WR),
    TE: matched(source.shards.TE), K: matched(source.shards.K),
    DEF: matched(source.shards.DEF), FLEX: matched(source.shards.FLEX),
  } };
  const playersMap = { ...draftCandidateMapFromBundle(bundle), ...unrankedDraftedPlayers };
  return { ...config, picks, bundle, playersMap, matchedPlayers: idMap.size, unmatchedPlayers: data.players.length - idMap.size };
}
