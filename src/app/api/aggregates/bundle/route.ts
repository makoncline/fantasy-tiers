// src/app/api/aggregates/bundle/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { z } from "zod";

import {
  AggregatesBundleQueryParams,
  AggregatesBundleResponse,
  AggregatesBundlePlayer,
  AggregatesBundleShards,
  RosterSlotsSchema,
} from "@/lib/schemas-bundle";
import { CombinedShard, type CombinedEntryT } from "@/lib/schemas-aggregates";
import {
  enrichPlayers,
  type League,
  type EnrichedPlayer,
} from "@/lib/enrichPlayers";
import { getAggregatesLastModifiedServer } from "@/lib/combinedAggregates";
import { ecrToRoundPick } from "@/lib/util";

// Load a shard file
function loadShard(shardName: string) {
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
  const json = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return CombinedShard.parse(json);
}

// Convert enriched player to bundle format
function enrichedToBundlePlayer(
  player: EnrichedPlayer,
  league: League
): Record<string, unknown> {
  return {
    player_id: player.player_id,
    name: player.name,
    position: player.position,
    team: player.team,
    bye_week: player.bye_week,
    borischen: {
      rank: player.bc_rank,
      tier: player.bc_tier,
    },
    sleeper: {
      rank: player.sleeper_rank_overall,
      adp: player.sleeper_adp,
      pts: player.sleeper_pts,
    },
    fantasypros: {
      rank: player.fp_rank_overall,
      tier: player.fp_tier,
      pos_rank:
        player.fantasypros?.pos_rank ||
        `${player.position}${player.fp_rank_pos || ""}`,
      ecr: player.fp_rank_overall,
      ecr_round_pick:
        player.fp_rank_overall && league.teams
          ? ecrToRoundPick(player.fp_rank_overall, league.teams)
          : null,
      pts: player.fp_pts,
      baseline_pts: player.fp_baseline_pts,
      adp: player.fp_adp,
      player_owned_avg: player.fp_player_owned_avg,
    },
    calc: {
      value: player.fp_value,
      positional_scarcity: Math.round(player.fp_positional_scarcity_slope || 0),
      market_delta: player.market_delta,
    },
  };
}

// Process position shards (RB, WR, TE need union for FLEX)
function processPositionShards(league: League, _allData: CombinedEntryT[]) {
  // Load all relevant shards explicitly; RB/WR/TE must come from their own files
  const shards = {
    QB: loadShard("QB"),
    RB: loadShard("RB"),
    WR: loadShard("WR"),
    TE: loadShard("TE"),
    K: loadShard("K"),
    DEF: loadShard("DEF"),
    FLEX: loadShard("FLEX"),
    ALL: loadShard("ALL"),
  };

  // FLEX-aware enrichment pool: RB/WR/TE union (not ALL)
  const flexEligible = [
    ...Object.values(shards.RB),
    ...Object.values(shards.WR),
    ...Object.values(shards.TE),
  ];
  const enrichedFlex = enrichPlayers(flexEligible, league);

  const rbWrTe = enrichedFlex.reduce((acc, player) => {
    const pos = player.position;
    if (!acc[pos]) acc[pos] = [];
    acc[pos].push(player);
    return acc;
  }, {} as Record<string, EnrichedPlayer[]>);

  // Per-position enrichment for non-FLEX-eligible shards
  const enrichedQB = enrichPlayers(Object.values(shards.QB), league);
  const enrichedK = enrichPlayers(Object.values(shards.K), league);
  const enrichedDEF = enrichPlayers(Object.values(shards.DEF), league);
  const enrichedALL = enrichPlayers(Object.values(shards.ALL), league);
  const enrichedFLEX = enrichPlayers(Object.values(shards.FLEX), league);

  return {
    QB: enrichedQB.map((p) => enrichedToBundlePlayer(p, league)),
    RB: (rbWrTe.RB || []).map((p) => enrichedToBundlePlayer(p, league)),
    WR: (rbWrTe.WR || []).map((p) => enrichedToBundlePlayer(p, league)),
    TE: (rbWrTe.TE || []).map((p) => enrichedToBundlePlayer(p, league)),
    K: enrichedK.map((p) => enrichedToBundlePlayer(p, league)),
    DEF: enrichedDEF.map((p) => enrichedToBundlePlayer(p, league)),
    FLEX: enrichedFLEX.map((p) => enrichedToBundlePlayer(p, league)),
    ALL: enrichedALL.map((p) => enrichedToBundlePlayer(p, league)),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate query parameters
    const params = AggregatesBundleQueryParams.parse({
      scoring: searchParams.get("scoring"),
      teams: searchParams.get("teams"),
      slots_qb: searchParams.get("slots_qb"),
      slots_rb: searchParams.get("slots_rb"),
      slots_wr: searchParams.get("slots_wr"),
      slots_te: searchParams.get("slots_te"),
      slots_k: searchParams.get("slots_k"),
      slots_def: searchParams.get("slots_def"),
      slots_flex: searchParams.get("slots_flex"),
    });

    // Build league configuration
    const league: League = {
      teams: params.teams,
      scoring: params.scoring,
      roster: {
        QB: params.slots_qb ?? 1,
        RB: params.slots_rb ?? 2,
        WR: params.slots_wr ?? 2,
        TE: params.slots_te ?? 1,
        K: params.slots_k ?? 1,
        DEF: params.slots_def ?? 1,
        FLEX: params.slots_flex ?? 1,
        BENCH: 0,
      },
    };

    // Load ALL data for FLEX calculations
    const allShard = loadShard("ALL");
    const allData = Object.values(allShard);

    // Process all shards
    const processedShards = processPositionShards(league, allData);

    // Sort each shard by borischen rank
    Object.keys(processedShards).forEach((shardKey) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      processedShards[shardKey as keyof typeof processedShards].sort((a, b) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const aRank = (a as any).borischen?.rank ?? 999999;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bRank = (b as any).borischen?.rank ?? 999999;
        return aRank - bRank;
      });
    });

    // Build response
    const response = {
      lastModified: getAggregatesLastModifiedServer(),
      scoring: params.scoring,
      teams: params.teams,
      roster: league.roster,
      shards: processedShards,
    };

    // Validate response
    const validatedResponse = AggregatesBundleResponse.parse(response);

    return NextResponse.json(validatedResponse, {
      headers: {
        "cache-control": "public, max-age=60",
      },
    });
  } catch (error) {
    console.error("Bundle endpoint error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
