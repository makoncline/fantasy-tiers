import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  SaveDraftResultRequestSchema,
  draftResultDirectoryName,
} from "@/lib/draftResults";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = SaveDraftResultRequestSchema.parse(await request.json());
    const resultDir = path.join(
      process.cwd(),
      "data",
      "draft-results",
      draftResultDirectoryName(body.artifact)
    );
    await mkdir(resultDir, { recursive: true });

    const artifactPath = path.join(resultDir, "draft-result.json");
    await writeFile(
      artifactPath,
      JSON.stringify(body.artifact, null, 2),
      "utf8"
    );

    const files = [artifactPath];
    const reportMetadata = [];
    for (const report of body.analysisReports) {
      const reportPath = path.join(resultDir, report.fileName);
      await writeFile(reportPath, report.content, "utf8");
      files.push(reportPath);
      reportMetadata.push({
        provider: report.provider,
        fetchedAt: report.fetchedAt,
        sourceUrl: report.sourceUrl,
        format: report.format,
        fileName: report.fileName,
        summary: report.summary,
      });
    }

    if (reportMetadata.length > 0) {
      const metadataPath = path.join(resultDir, "analysis-reports.json");
      await writeFile(
        metadataPath,
        JSON.stringify(reportMetadata, null, 2),
        "utf8"
      );
      files.push(metadataPath);
    }

    return NextResponse.json({
      ok: true,
      resultDir,
      files,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save draft result";
    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
