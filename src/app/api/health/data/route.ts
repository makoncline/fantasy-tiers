import fs from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { buildDataHealthResponse } from "@/lib/dataHealth";
import { DraftDataQualityReportSchema } from "@/lib/draftDataQuality";
import {
  createRatingHistoryDb,
  resolveRatingHistoryDatabaseConfig,
} from "@/lib/ratingHistory/db";

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

async function historyStatus() {
  const config = resolveRatingHistoryDatabaseConfig();
  if (!config.available) {
    return { configured: false, queryable: false };
  }
  const db = createRatingHistoryDb(config.config);
  try {
    await db.run(sql`SELECT 1`);
    return { configured: true, queryable: true };
  } catch (error) {
    console.error("Rating history health query failed", error);
    return { configured: true, queryable: false };
  } finally {
    db.$client.close();
  }
}

export async function GET(request: NextRequest) {
  const expectedCommitSha =
    request.nextUrl.searchParams.get("expectedCommit") || null;
  const commitSha =
    process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? null;
  try {
    const [quality, history] = await Promise.all([
      Promise.resolve(loadQualityReport()),
      historyStatus(),
    ]);
    const response = buildDataHealthResponse({
      commitSha,
      expectedCommitSha,
      quality,
      historyConfigured: history.configured,
      historyQueryable: history.queryable,
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
