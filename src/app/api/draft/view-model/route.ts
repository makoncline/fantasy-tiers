import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchDraftDetails } from "../../../../lib/draftDetails";
import { fetchDraftPicks } from "../../../../lib/draftPicks";
import { buildDraftViewModel } from "../../../../lib/draftState";
import { buildAggregateBundle } from "../../../../lib/aggregateBundle";
import { draftCandidateMapFromBundle } from "../../../../lib/draftCandidate";
import { buildRosterRequirementsFromDraftSettings } from "../../../../lib/draftHelpers";
import { parseSleeperScoringType } from "../../../../lib/scoring";

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
    const scoring = parseSleeperScoringType(draft.metadata?.scoring_type);
    const requirements = buildRosterRequirementsFromDraftSettings(draft.settings);
    const bundle = buildAggregateBundle({
      scoring,
      teams: draft.settings?.teams ?? 0,
      rosterSlots: {
        QB: requirements.QB,
        RB: requirements.RB,
        WR: requirements.WR,
        TE: requirements.TE,
        K: requirements.K,
        DEF: requirements.DEF,
        FLEX: requirements.FLEX,
        BENCH: requirements.BN,
      },
    });
    const playersMap = draftCandidateMapFromBundle(bundle);
    const vm = buildDraftViewModel({
      playersMap,
      draft,
      picks,
      userId,
      sourceWarnings: bundle.sourceHealth?.warnings ?? [],
    });
    return NextResponse.json(vm);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "internal error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
