import fs from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { buildDataHealthResponse } from "@/lib/dataHealth";
import { DraftDataQualityReportSchema } from "@/lib/draftDataQuality";

export const dynamic = "force-dynamic";

function loadQualityReport() {
  const filePath = path.join(
    process.cwd(),
    "public/data/aggregate/quality-report.json"
  );
  return DraftDataQualityReportSchema.parse(
    JSON.parse(fs.readFileSync(filePath, "utf8"))
  );
}

export async function GET(request: NextRequest) {
  const expectedCommitSha =
    request.nextUrl.searchParams.get("expectedCommit") || null;
  const commitSha =
    process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? null;
  try {
    const quality = loadQualityReport();
    const response = buildDataHealthResponse({
      commitSha,
      expectedCommitSha,
      quality,
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
