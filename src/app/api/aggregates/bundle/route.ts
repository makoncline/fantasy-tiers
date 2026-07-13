// src/app/api/aggregates/bundle/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  AggregatesBundleQueryParams,
} from "@/lib/schemas-bundle";
import { buildAggregateBundle } from "@/lib/aggregateBundle";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryValue = (name: string, fallback: string) =>
      searchParams.get(name) ?? fallback;

    // Parse and validate query parameters
    const params = AggregatesBundleQueryParams.parse({
      scoring: queryValue("scoring", "std"),
      teams: queryValue("teams", "10"),
      slots_qb: queryValue("slots_qb", "1"),
      slots_rb: queryValue("slots_rb", "2"),
      slots_wr: queryValue("slots_wr", "2"),
      slots_te: queryValue("slots_te", "1"),
      slots_k: queryValue("slots_k", "1"),
      slots_def: queryValue("slots_def", "1"),
      slots_flex: queryValue("slots_flex", "1"),
      slots_bench: queryValue("slots_bench", "6"),
    });

    const response = buildAggregateBundle({
      scoring: params.scoring,
      teams: params.teams,
      rosterSlots: {
        QB: params.slots_qb,
        RB: params.slots_rb,
        WR: params.slots_wr,
        TE: params.slots_te,
        K: params.slots_k,
        DEF: params.slots_def,
        FLEX: params.slots_flex,
        BENCH: params.slots_bench,
      },
    });

    return NextResponse.json(response, {
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
