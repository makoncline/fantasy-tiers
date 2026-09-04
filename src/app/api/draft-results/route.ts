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
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

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

    return NextResponse.json({
      ok: true,
      resultDir,
      files: [artifactPath],
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save draft result";
    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
