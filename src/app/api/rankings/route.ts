import { NextRequest, NextResponse } from "next/server";
import { fetchRankings, suffixForScoring } from "@/lib/rankings";
import { getErrorMessage } from "@/lib/util";

export async function GET(req: NextRequest) {
  const scoring = req.nextUrl.searchParams.get("scoring")?.toUpperCase();

  if (scoring === undefined || !(scoring in suffixForScoring)) {
    return NextResponse.json(
      { error: "Invalid scoring type" },
      { status: 400 }
    );
  }

  try {
    // Use the shared fetchRankings function
    const rankings = await fetchRankings(scoring);
    return NextResponse.json(rankings);
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
