import { z } from "zod";
import { readPublishedFantasyProsProjections } from "@/lib/fantasyProsProjectionSource";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchDraftDetails } from "../../../../lib/draftDetails";
import { fetchDraftPicks } from "../../../../lib/draftPicks";
import { buildDraftViewModel } from "../../../../lib/draftState";
import { buildAggregateBundle } from "../../../../lib/aggregateBundle";
import { draftCandidateMapFromBundle } from "../../../../lib/draftCandidate";
import { draftLeagueConfigFromSleeperDraft } from "../../../../lib/draftLeagueConfig";
import { fetchSleeperLeagueById } from "../../../../lib/sleeper";
import { draftReadinessShardCountsFromBundle } from "../../../../lib/draftReadiness";

export async function GET(req: NextRequest) {
  const source = z.enum(["sleeper", "fp"]).safeParse(req.nextUrl.searchParams.get("source") ?? "sleeper");
  if (!source.success) return NextResponse.json({ error: "source must be sleeper or fp" }, { status: 400 });
  const draftId = req.nextUrl.searchParams.get("draft_id");
  const userId = req.nextUrl.searchParams.get("user_id");
  const draftSlotParam = req.nextUrl.searchParams.get("draft_slot");
  if (!draftId || !userId) {
    return NextResponse.json(
      { error: "draft_id and user_id are required" },
      { status: 400 }
    );
  }
  const manualUserSlot =
    draftSlotParam == null ? undefined : Number(draftSlotParam);
  if (
    manualUserSlot != null &&
    (!Number.isInteger(manualUserSlot) || manualUserSlot < 1)
  ) {
    return NextResponse.json(
      { error: "draft_slot must be a positive integer" },
      { status: 400 }
    );
  }

  try {
    const draft = await fetchDraftDetails(draftId);
    if (manualUserSlot != null && manualUserSlot > draft.settings.teams) {
      return NextResponse.json(
        { error: `draft_slot must be between 1 and ${draft.settings.teams}` },
        { status: 400 }
      );
    }
    const picks = await fetchDraftPicks(draftId, {
      allowEmptyPreDraft: draft.status === "pre_draft",
    });
    const leagueId = draft.league_id ?? draft.metadata.league_id;
    const league = leagueId
      ? await fetchSleeperLeagueById(leagueId)
      : undefined;
    const leagueConfig = draftLeagueConfigFromSleeperDraft(
      draft,
      userId,
      league,
      manualUserSlot
    );
    const bundle = buildAggregateBundle({
      scoring: leagueConfig.scoring,
      teams: leagueConfig.teams,
      rosterSlots: {
        QB: leagueConfig.rosterSlots.QB,
        RB: leagueConfig.rosterSlots.RB,
        WR: leagueConfig.rosterSlots.WR,
        TE: leagueConfig.rosterSlots.TE,
        K: leagueConfig.rosterSlots.K,
        DEF: leagueConfig.rosterSlots.DEF,
        FLEX: leagueConfig.rosterSlots.FLEX,
        BENCH: leagueConfig.rosterSlots.BENCH,
      },
    });
    const playersMap = draftCandidateMapFromBundle(bundle);
    const vm = buildDraftViewModel({
      valueSource: source.data,
      fpSource: readPublishedFantasyProsProjections(),
      playersMap,
      draft,
      picks,
      userId,
      ...(manualUserSlot != null ? { userSlot: manualUserSlot } : {}),
      scoringRules: leagueConfig.scoringRules,
      projectionArtifact: bundle.draftProjections,
      sourceHealth: bundle.sourceHealth ?? null,
      shardCounts: draftReadinessShardCountsFromBundle(bundle),
    });
    if (vm.readiness?.status !== "ready" || !vm.draftValueStatus.available) {
      return NextResponse.json(
        {
          error: vm.draftValueStatus.reason ?? "Draft data is not ready.",
          readiness: vm.readiness,
          leagueConfig,
        },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json({ ...vm, leagueConfig });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "internal error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
