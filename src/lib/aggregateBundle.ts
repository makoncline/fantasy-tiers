import * as fs from "fs";
import * as path from "path";

import {
  CombinedShard,
  type CombinedEntryT,
} from "@/lib/schemas-aggregates";
import {
  AggregateSourceHealth,
  AggregatesBundlePlayer,
  AggregatesBundleResponse,
  type AggregatesBundlePlayerT,
  type AggregatesBundleResponseT,
} from "@/lib/schemas-bundle";
import { enrichPlayers, type League, type EnrichedPlayer } from "@/lib/enrichPlayers";
import { getAggregatesLastModifiedServer } from "@/lib/combinedAggregates";
import { ecrToRoundPick } from "@/lib/util";
import { getAggregateSourceHealth } from "@/lib/sourceHealth";
import type { ScoringType } from "@/lib/schemas";
import { FootballguysPublicRankingsSchema } from "@/lib/footballguysRankings";

type AggregateRosterSlots = {
  QB?: number | undefined;
  RB?: number | undefined;
  WR?: number | undefined;
  TE?: number | undefined;
  K?: number | undefined;
  DEF?: number | undefined;
  FLEX?: number | undefined;
  BENCH?: number | undefined;
};

export function buildAggregateBundle(input: {
  scoring: ScoringType;
  teams: number;
  rosterSlots: AggregateRosterSlots;
}): AggregatesBundleResponseT {
  const league: League = {
    teams: input.teams,
    scoring: input.scoring,
    roster: {
      QB: input.rosterSlots.QB ?? 1,
      RB: input.rosterSlots.RB ?? 2,
      WR: input.rosterSlots.WR ?? 2,
      TE: input.rosterSlots.TE ?? 1,
      K: input.rosterSlots.K ?? 1,
      DEF: input.rosterSlots.DEF ?? 1,
      FLEX: input.rosterSlots.FLEX ?? 1,
      BENCH: input.rosterSlots.BENCH ?? 0,
    },
  };

  const allShard = loadAggregateShard("ALL");
  const allData = Object.values(allShard);
  const processedShards = processPositionShards(league);

  for (const shardKey of Object.keys(processedShards) as Array<
    keyof typeof processedShards
  >) {
    processedShards[shardKey].sort(
      (a, b) => (a.tiers.rank ?? 999_999) - (b.tiers.rank ?? 999_999)
    );
  }

  return AggregatesBundleResponse.parse({
    lastModified: getAggregatesLastModifiedServer(),
    scoring: input.scoring,
    teams: input.teams,
    roster: league.roster,
    sourceHealth: AggregateSourceHealth.parse(
      getAggregateSourceHealth({
        scoring: input.scoring,
        players: allData,
        draftCapacity:
          input.teams *
          (Object.values(league.roster).reduce(
            (total, slots) => total + slots,
            0
          ) +
            3),
      })
    ),
    shards: processedShards,
  });
}

export function loadAggregateShard(shardName: string) {
  const filePath = path.resolve(
    process.cwd(),
    "public/data/aggregate",
    `${shardName}-combined-aggregate.json`
  );
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Shard file not found: ${shardName}-combined-aggregate.json`
    );
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  if (!fileContent.trim()) {
    throw new Error(
      `Shard file is empty: ${shardName}-combined-aggregate.json`
    );
  }

  return CombinedShard.parse(JSON.parse(fileContent)) as Record<
    string,
    CombinedEntryT
  >;
}

function processPositionShards(league: League) {
  const footballguys = loadFootballguysLookup();
  const shards = {
    QB: loadAggregateShard("QB"),
    RB: loadAggregateShard("RB"),
    WR: loadAggregateShard("WR"),
    TE: loadAggregateShard("TE"),
    K: loadAggregateShard("K"),
    DEF: loadAggregateShard("DEF"),
    FLEX: loadAggregateShard("FLEX"),
    ALL: loadAggregateShard("ALL"),
  };

  const flexEligible = [
    ...Object.values(shards.RB),
    ...Object.values(shards.WR),
    ...Object.values(shards.TE),
  ];
  const enrichedFlex = enrichPlayers(flexEligible, league);
  const rbWrTe = groupByPosition(enrichedFlex);

  return {
    QB: enrichPlayers(Object.values(shards.QB), league).map((player) =>
      enrichedToBundlePlayer(player, league, footballguys)
    ),
    RB: (rbWrTe.RB ?? []).map((player) => enrichedToBundlePlayer(player, league, footballguys)),
    WR: (rbWrTe.WR ?? []).map((player) => enrichedToBundlePlayer(player, league, footballguys)),
    TE: (rbWrTe.TE ?? []).map((player) => enrichedToBundlePlayer(player, league, footballguys)),
    K: enrichPlayers(Object.values(shards.K), league).map((player) =>
      enrichedToBundlePlayer(player, league, footballguys)
    ),
    DEF: enrichPlayers(Object.values(shards.DEF), league).map((player) =>
      enrichedToBundlePlayer(player, league, footballguys)
    ),
    FLEX: enrichPlayers(Object.values(shards.FLEX), league).map((player) =>
      enrichedToBundlePlayer(player, league, footballguys)
    ),
    ALL: enrichPlayers(Object.values(shards.ALL), league).map((player) =>
      enrichedToBundlePlayer(player, league, footballguys)
    ),
  };
}

function groupByPosition(players: readonly EnrichedPlayer[]) {
  return players.reduce<Record<string, EnrichedPlayer[]>>((acc, player) => {
    const pos = player.position;
    acc[pos] = [...(acc[pos] ?? []), player];
    return acc;
  }, {});
}

function enrichedToBundlePlayer(
  player: EnrichedPlayer,
  league: League,
  footballguys: FootballguysLookup
): AggregatesBundlePlayerT {
  const footballguysPlayer = footballguys.get(
    footballguysKey(player.name, player.position)
  );
  return AggregatesBundlePlayer.parse({
    player_id: player.player_id,
    name: player.name,
    position: player.position,
    team: player.team,
    bye_week: player.bye_week,
    tiers: {
      rank: player.tier_rank,
      tier: player.tier_level,
    },
    sleeper: {
      rank: player.sleeper_rank_overall,
      adp: player.sleeper_adp,
      pts: player.sleeper_pts,
      injuryStatus: player.sleeper.player.injury_status,
      injuryNotes: player.sleeper.player.injury_notes,
    },
    fantasypros: {
      rank: player.fp_rank_overall,
      tier: player.fp_tier,
      pos_rank:
        player.fantasypros?.pos_rank ||
        `${player.position}${player.fp_rank_pos || ""}`,
      ecr: player.fp_rank_overall,
      ecr_average: player.fp_rank_ave,
      ecr_std: player.fp_rank_std,
      ecr_round_pick:
        player.fp_rank_ave && league.teams
          ? ecrToRoundPick(player.fp_rank_ave, league.teams)
          : null,
      pts: player.fp_pts,
      baseline_pts: player.fp_baseline_pts,
      adp: player.fp_adp,
      player_owned_avg: player.fp_player_owned_avg,
    },
    footballguys: footballguysPlayer ?? null,
    calc: {
      value: player.fp_value,
      positional_scarcity: Math.round(player.fp_remaining_value_pct || 0),
      market_delta: player.market_delta,
    },
  });
}

type FootballguysLookupEntry = {
  id: string;
  rank: number;
  tier: number;
  pos_rank: number;
  fetched_at: string;
  settings: string;
  adp: Record<string, number | null>;
};

type FootballguysLookup = Map<string, FootballguysLookupEntry>;

function loadFootballguysLookup(): FootballguysLookup {
  const filePath = path.resolve(
    process.cwd(),
    "public/data/aggregate/footballguys-rankings.json"
  );
  if (!fs.existsSync(filePath)) return new Map();
  const data = FootballguysPublicRankingsSchema.parse(
    JSON.parse(fs.readFileSync(filePath, "utf8"))
  );

  return new Map(
    data.rows.map((row) => [
      footballguysKey(row.name, normalizeFootballguysPosition(row.position)),
      {
        id: row.id,
        rank: row.rank,
        tier: row.tier,
        pos_rank: row.posRank,
        fetched_at: data.fetchedAt,
        settings: data.settings,
        adp: row.adp,
      },
    ])
  );
}

function footballguysKey(name: string, position: string) {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${position}`;
}

function normalizeFootballguysPosition(position: string) {
  if (position === "PK") return "K";
  if (position === "TD") return "DEF";
  return position;
}
