import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/util";
import { fetchRankings } from "@/lib/rankings";
import { scoringTypeSchema } from "@/lib/schemas";

export async function GET(req: NextRequest) {
  const scoringParam = req.nextUrl.searchParams.get("scoring");
  const scoring = scoringTypeSchema.safeParse(scoringParam);

  if (!scoring.success) {
    return NextResponse.json(
      { error: "Invalid scoring type" },
      { status: 400 }
    );
  }

  try {
    // Use the shared fetchRankings function
    const rankings = await fetchRankings(scoring.data);
    return NextResponse.json(rankings);
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
