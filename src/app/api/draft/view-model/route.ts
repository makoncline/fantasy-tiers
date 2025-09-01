import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchDraftDetails } from "../../../../lib/draftDetails";
import { fetchDraftPicks } from "../../../../lib/draftPicks";
import { scoringTypeSchema } from "../../../../lib/schemas";
import { loadMergedCombinedAggregates } from "../../../../lib/combinedAggregates";
import { buildPlayersMapFromCombined } from "../../../../lib/playersFromCombined";
import { buildDraftViewModel } from "../../../../lib/draftState";

export async function GET(req: NextRequest) {
  const draftId = req.nextUrl.searchParams.get("draft_id");
  const userId = req.nextUrl.searchParams.get("user_id");
  if (!draftId || !userId) {
    return NextResponse.json(
      { error: "draft_id and user_id are required" },
      { status: 400 }
    );
  }

  try {
    const draft = await fetchDraftDetails(draftId);
    const picks = await fetchDraftPicks(draftId);
    const scoringRaw = draft?.metadata?.scoring_type || "";
    const scoringParsed = scoringTypeSchema.safeParse(
      String(scoringRaw).toLowerCase()
    );
    const scoring = scoringParsed.success ? scoringParsed.data : "ppr";

    const merged = loadMergedCombinedAggregates();
    if (!merged || Object.keys(merged).length === 0) {
      return NextResponse.json(
        { error: "no combined aggregates found; build aggregates first" },
        { status: 500 }
      );
    }
    const playersMap = buildPlayersMapFromCombined(merged, scoring);
    const vm = buildDraftViewModel({
      playersMap,
      draft,
      picks,
      userId,
    });
    return NextResponse.json(vm);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "internal error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
