import { NextResponse } from "next/server";
import { getAggregatesLastModifiedServer } from "@/lib/combinedAggregates";

export const runtime = "nodejs";

export async function GET() {
  try {
    const timestamp = getAggregatesLastModifiedServer();
    return NextResponse.json({
      timestamp,
      formatted: timestamp ? new Date(timestamp).toLocaleString() : null,
    });
  } catch (error) {
    console.error("Error getting aggregates last modified:", error);
    return NextResponse.json(
      { error: "Failed to get last modified timestamp" },
      { status: 500 }
    );
  }
}
