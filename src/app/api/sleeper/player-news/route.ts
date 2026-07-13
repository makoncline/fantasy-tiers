import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  fetchSleeperPlayerNews,
  SleeperPlayerNewsResponseSchema,
} from "@/lib/sleeperNews";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const playerId = req.nextUrl.searchParams.get("playerId") ?? "";
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  try {
    const items =
      typeof limit === "number" && Number.isFinite(limit)
        ? await fetchSleeperPlayerNews({ playerId, limit })
        : await fetchSleeperPlayerNews({ playerId });

    return NextResponse.json(
      SleeperPlayerNewsResponseSchema.parse({ items }),
      {
        headers: {
          "Cache-Control": "private, max-age=300",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch Sleeper player news",
      },
      { status: 400 }
    );
  }
}
