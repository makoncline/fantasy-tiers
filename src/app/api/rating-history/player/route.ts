import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { scoringTypeSchema } from "@/lib/schemas";
import {
  createRatingHistoryDb,
  resolveRatingHistoryDatabaseConfig,
} from "@/lib/ratingHistory/db";
import {
  getDropDecisionSignals,
  getPlayerRatingTimeline,
} from "@/lib/ratingHistory/queries";
import { RatingHistoryPlayerSignalResponseSchema } from "@/lib/ratingHistory/playerSignals";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  playerId: z.string().min(1),
  scoring: scoringTypeSchema.default("half"),
  position: z.string().min(1),
});

function unavailableSignal(reason: string) {
  return {
    signal: {
      available: false,
      reason,
      player: null,
      current: {},
      lastPresent: {},
      flags: {
        currentlyMissingPrimaryTier: false,
        currentlyMissingFantasyPros: false,
        hasDurableSleeperValue: false,
        hasDurableFantasyProsValue: false,
      },
      recentTimeline: [],
    },
  };
}

export async function GET(req: NextRequest) {
  const parsed = QuerySchema.safeParse({
    playerId: req.nextUrl.searchParams.get("playerId"),
    scoring: req.nextUrl.searchParams.get("scoring") ?? undefined,
    position: req.nextUrl.searchParams.get("position"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const config = resolveRatingHistoryDatabaseConfig();
  if (!config.available) {
    return NextResponse.json(
      unavailableSignal("Rating history is not configured for this deployment."),
      { status: 200 }
    );
  }

  const db = createRatingHistoryDb(config.config);
  try {
    const [signals, timeline] = await Promise.all([
      getDropDecisionSignals(db, parsed.data),
      getPlayerRatingTimeline(db, parsed.data.playerId),
    ]);

    return NextResponse.json(
      RatingHistoryPlayerSignalResponseSchema.parse({
        signal: {
          available: true,
          reason: null,
          player: signals.player,
          current: signals.current,
          lastPresent: signals.lastPresent,
          flags: signals.flags,
          recentTimeline: timeline.slice(0, 12),
        },
      }),
      {
        headers: {
          "Cache-Control": "private, max-age=300",
        },
      }
    );
  } catch (error) {
    console.error("Rating history player query failed", error);
    return NextResponse.json(
      unavailableSignal("Rating history is temporarily unavailable."),
      { status: 200 }
    );
  } finally {
    db.$client.close();
  }
}
