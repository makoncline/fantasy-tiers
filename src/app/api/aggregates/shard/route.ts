import fs from "fs";
import path from "path";
import { CombinedShard } from "../../../../lib/schemas-aggregates";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const pos = req.nextUrl.searchParams.get("pos");

  if (!pos) {
    return NextResponse.json(
      { error: "pos parameter is required" },
      { status: 400 }
    );
  }

  const validPositions = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF", "FLEX"];
  if (!validPositions.includes(pos)) {
    return NextResponse.json(
      { error: `invalid position: ${pos}` },
      { status: 400 }
    );
  }

  const dir = path.resolve(process.cwd(), "public/data/aggregate");
  const shardFile = path.join(dir, `${pos}-combined-aggregate.json`);

  try {
    const shardData = JSON.parse(fs.readFileSync(shardFile, "utf-8"));
    const validatedData = CombinedShard.parse(shardData);

    return new NextResponse(JSON.stringify(validatedData), {
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=300", // 5 minutes cache
      },
    });
  } catch (error) {
    console.error(`Error loading ${pos} shard:`, error);
    return NextResponse.json(
      {
        error: `failed to load ${pos} shard`,
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
