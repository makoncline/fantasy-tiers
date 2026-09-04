import fs from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { buildAggregateBundle } from "@/lib/aggregateBundle";
import { buildDataHealthResponse } from "@/lib/dataHealth";
import { draftCandidateMapFromBundle } from "@/lib/draftCandidate";
import {
  DEFAULT_DRAFT_ROSTER_SLOTS,
  DEFAULT_DRAFT_SCORING_RULES,
  calculateDraftRounds,
  rankingScoringFromRules,
} from "@/lib/draftLeagueConfig";
import {
  assessDraftReadiness,
  draftReadinessShardCountsFromBundle,
  DraftReadinessReportSchema,
} from "@/lib/draftReadiness";

export const dynamic = "force-dynamic";

function loadReadinessReport() {
  const filePath = path.join(
    process.cwd(),
    "public/data/aggregate/quality-report.json"
  );
  return DraftReadinessReportSchema.parse(
    JSON.parse(fs.readFileSync(filePath, "utf8"))
  );
}

export async function GET(request: NextRequest) {
  const expectedCommitSha =
    request.nextUrl.searchParams.get("expectedCommit") || null;
  const commitSha =
    process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? null;
  try {
    const savedReadiness = loadReadinessReport();
    const teams = 12;
    const scoring = rankingScoringFromRules(DEFAULT_DRAFT_SCORING_RULES);
    const bundle = buildAggregateBundle({
      scoring,
      teams,
      rosterSlots: DEFAULT_DRAFT_ROSTER_SLOTS,
    });
    const readiness = assessDraftReadiness({
      candidates: Object.values(draftCandidateMapFromBundle(bundle)),
      sourceHealth: bundle.sourceHealth ?? null,
      projectionArtifact: bundle.draftProjections,
      teams,
      rounds: calculateDraftRounds(DEFAULT_DRAFT_ROSTER_SLOTS),
      scoring,
      scoringRules: DEFAULT_DRAFT_SCORING_RULES,
      rosterSlots: DEFAULT_DRAFT_ROSTER_SLOTS,
      mode: savedReadiness.mode,
      season: savedReadiness.season,
      shardCounts: draftReadinessShardCountsFromBundle(bundle),
      previous: savedReadiness,
      requireAllShards: true,
    }).report;
    const response = buildDataHealthResponse({
      commitSha,
      expectedCommitSha,
      readiness,
    });
    return NextResponse.json(response, {
      status: response.status === "healthy" ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Data health check failed", error);
    return NextResponse.json(
      { status: "unhealthy", error: "Data health is unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
