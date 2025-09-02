import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  fetchSleeperProjections,
  SleeperProjectionSchema,
} from "@/lib/sleeper";

const QuerySchema = z.object({
  season: z.string(),
  season_type: z.string().optional().default("regular"),
  positions: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .default(["DEF", "K", "QB", "RB", "TE", "WR"]),
  order_by: z.string().optional().default("adp_half_ppr"),
  week: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const raw = {
    season: searchParams.get("season"),
    season_type: searchParams.get("season_type") ?? undefined,
    positions: searchParams.getAll("position[]").length
      ? searchParams.getAll("position[]")
      : searchParams.getAll("positions").length
      ? searchParams.getAll("positions")
      : undefined,
    order_by: searchParams.get("order_by") ?? undefined,
    week: searchParams.get("week") ?? undefined,
  };
  const parsed = QuerySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { season, season_type, positions, order_by, week } = parsed.data;
  const data = await fetchSleeperProjections(season, {
    seasonType: season_type,
    positions: Array.isArray(positions) ? positions : [positions],
    orderBy: order_by,
    ...(week !== undefined && { week }),
  });
  // Data already normalized/validated in library; return as-is
  return NextResponse.json(data);
}
