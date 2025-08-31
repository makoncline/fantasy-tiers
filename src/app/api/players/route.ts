import { loadMergedCombinedAggregates } from "../../../lib/combinedAggregates";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildPlayersMapFromCombined } from "../../../lib/playersFromCombined";

const scoringSchema = z.enum(["std", "ppr", "half"]);

export async function GET(req: NextRequest) {
  const scoringParam = req.nextUrl.searchParams.get("scoring") || "";
  const parsed = scoringSchema.safeParse(scoringParam.toLowerCase());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid or missing scoring param (std|ppr|half)" },
      { status: 400 }
    );
  }
  const scoring = parsed.data;

  const merged: Record<string, any> = loadMergedCombinedAggregates();
  if (Object.keys(merged).length === 0) {
    return NextResponse.json(
      { error: "no combined aggregates found; build aggregates first" },
      { status: 500 }
    );
  }

  const out = buildPlayersMapFromCombined(merged, scoring);
  return NextResponse.json(out);
}
