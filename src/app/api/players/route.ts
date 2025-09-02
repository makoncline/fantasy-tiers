import fs from "fs";
import path from "path";
import { CombinedShard } from "../../../lib/schemas-aggregates";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { scoringTypeSchema } from "../../../lib/schemas";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const scoringParam = req.nextUrl.searchParams.get("scoring");

  // Default to 'std' if no scoring parameter is provided
  const scoring = scoringParam || "std";

  // Validate the scoring parameter
  const parsed = scoringTypeSchema.safeParse(scoring.toLowerCase());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid scoring param (std|ppr|half)" },
      { status: 400 }
    );
  }

  // Note: scoring param is accepted but not used in current implementation
  // Could be used for filtering in the future

  // Load the ALL file directly for the all player table
  const dir = path.resolve(process.cwd(), "public/data/aggregate");
  const allFile = path.join(dir, "ALL-combined-aggregate.json");

  try {
    // Check if file exists first
    if (!fs.existsSync(allFile)) {
      console.error("ALL file does not exist:", allFile);
      return NextResponse.json(
        {
          error: {
            code: "FILE_NOT_FOUND",
            message: "ALL combined aggregates file not found",
          },
        },
        { status: 404 }
      );
    }

    const fileContent = fs.readFileSync(allFile, "utf-8");

    // Check if file is empty
    if (!fileContent.trim()) {
      console.error("ALL file is empty:", allFile);
      return NextResponse.json(
        {
          error: {
            code: "FILE_EMPTY",
            message: "ALL combined aggregates file is empty",
          },
        },
        { status: 500 }
      );
    }

    const allData = JSON.parse(fileContent);
    const validatedData = CombinedShard.parse(allData);

    // Return typed aggregate data structure that UI components expect
    return new NextResponse(JSON.stringify(validatedData), {
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=60",
      },
    });
  } catch (error) {
    console.error("Error loading ALL file:", error);
    return NextResponse.json(
      {
        error: {
          code: "FILE_LOAD_ERROR",
          message: "Failed to load ALL combined aggregates",
        },
      },
      { status: 500 }
    );
  }
}
