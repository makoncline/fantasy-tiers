import { and, desc, eq, isNull } from "drizzle-orm";
import type { ScoringType } from "../schemas";
import type { RatingHistoryDatabase } from "./db";
import {
  historyPlayers,
  playerRatingVersions,
  type PlayerRatingVersion,
} from "./schema";

type RatingSummary = Pick<
  PlayerRatingVersion,
  | "id"
  | "playerId"
  | "source"
  | "mode"
  | "season"
  | "week"
  | "scoring"
  | "positionScope"
  | "effectiveFrom"
  | "effectiveTo"
  | "isCurrent"
  | "rankOverall"
  | "rankPosition"
  | "tier"
  | "points"
  | "adp"
  | "rosterPct"
  | "sleeperSearchRank"
  | "sourceStatus"
>;

function summarize(row: PlayerRatingVersion | undefined): RatingSummary | null {
  if (!row) return null;
  return {
    id: row.id,
    playerId: row.playerId,
    source: row.source,
    mode: row.mode,
    season: row.season,
    week: row.week,
    scoring: row.scoring,
    positionScope: row.positionScope,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    isCurrent: row.isCurrent,
    rankOverall: row.rankOverall,
    rankPosition: row.rankPosition,
    tier: row.tier,
    points: row.points,
    adp: row.adp,
    rosterPct: row.rosterPct,
    sleeperSearchRank: row.sleeperSearchRank,
    sourceStatus: row.sourceStatus,
  };
}

async function currentRating(
  db: RatingHistoryDatabase,
  input: {
    playerId: string;
    source: string;
    scoring: ScoringType;
    positionScope: string;
  }
) {
  const rows = await db
    .select()
    .from(playerRatingVersions)
    .where(
      and(
        eq(playerRatingVersions.playerId, input.playerId),
        eq(playerRatingVersions.source, input.source),
        eq(playerRatingVersions.scoring, input.scoring),
        eq(playerRatingVersions.positionScope, input.positionScope),
        eq(playerRatingVersions.isCurrent, true)
      )
    )
    .orderBy(
      desc(playerRatingVersions.effectiveFrom),
      desc(playerRatingVersions.id)
    )
    .limit(1);
  return rows[0];
}

async function lastPresentRating(
  db: RatingHistoryDatabase,
  input: {
    playerId: string;
    source: string;
    scoring: ScoringType;
    positionScope: string;
  }
) {
  const rows = await db
    .select()
    .from(playerRatingVersions)
    .where(
      and(
        eq(playerRatingVersions.playerId, input.playerId),
        eq(playerRatingVersions.source, input.source),
        eq(playerRatingVersions.scoring, input.scoring),
        eq(playerRatingVersions.positionScope, input.positionScope),
        eq(playerRatingVersions.sourceStatus, "present")
      )
    )
    .orderBy(
      desc(playerRatingVersions.effectiveFrom),
      desc(playerRatingVersions.id)
    )
    .limit(1);
  return rows[0];
}

export async function getPlayerRatingTimeline(
  db: RatingHistoryDatabase,
  playerId: string
) {
  return db
    .select()
    .from(playerRatingVersions)
    .where(eq(playerRatingVersions.playerId, playerId))
    .orderBy(
      desc(playerRatingVersions.effectiveFrom),
      desc(playerRatingVersions.id)
    );
}

export async function getDropDecisionSignals(
  db: RatingHistoryDatabase,
  input: {
    playerId: string;
    scoring: ScoringType;
    position: string;
  }
) {
  const playerRows = await db
    .select()
    .from(historyPlayers)
    .where(eq(historyPlayers.playerId, input.playerId))
    .limit(1);

  const tiersPrimary = await currentRating(db, {
    playerId: input.playerId,
    source: "tiers",
    scoring: input.scoring,
    positionScope: input.position,
  });
  const tiersAll = await currentRating(db, {
    playerId: input.playerId,
    source: "tiers",
    scoring: input.scoring,
    positionScope: "ALL",
  });
  const fantasyPros = await currentRating(db, {
    playerId: input.playerId,
    source: "fantasypros",
    scoring: input.scoring,
    positionScope: input.position,
  });
  const sleeper = await currentRating(db, {
    playerId: input.playerId,
    source: "sleeper",
    scoring: input.scoring,
    positionScope: input.position,
  });

  const lastPresentTiersPrimary = await lastPresentRating(db, {
    playerId: input.playerId,
    source: "tiers",
    scoring: input.scoring,
    positionScope: input.position,
  });
  const lastPresentFantasyPros = await lastPresentRating(db, {
    playerId: input.playerId,
    source: "fantasypros",
    scoring: input.scoring,
    positionScope: input.position,
  });

  const currentlyMissingPrimaryTier =
    tiersPrimary?.sourceStatus === "absent" &&
    lastPresentTiersPrimary != null &&
    lastPresentTiersPrimary.id !== tiersPrimary.id;
  const currentlyMissingFantasyPros =
    fantasyPros?.sourceStatus === "absent" &&
    lastPresentFantasyPros != null &&
    lastPresentFantasyPros.id !== fantasyPros.id;

  return {
    player: playerRows[0] ?? null,
    current: {
      tiersPrimary: summarize(tiersPrimary),
      tiersAll: summarize(tiersAll),
      fantasyPros: summarize(fantasyPros),
      sleeper: summarize(sleeper),
    },
    lastPresent: {
      tiersPrimary: summarize(lastPresentTiersPrimary),
      fantasyPros: summarize(lastPresentFantasyPros),
    },
    flags: {
      currentlyMissingPrimaryTier,
      currentlyMissingFantasyPros,
      hasDurableSleeperValue:
        sleeper?.adp != null ||
        sleeper?.points != null ||
        sleeper?.rankOverall != null,
      hasDurableFantasyProsValue:
        fantasyPros?.rankOverall != null ||
        fantasyPros?.rankPosition != null ||
        fantasyPros?.points != null ||
        lastPresentFantasyPros?.rankOverall != null ||
        lastPresentFantasyPros?.rankPosition != null,
    },
  };
}

export async function getCurrentAbsentRatings(db: RatingHistoryDatabase) {
  return db
    .select()
    .from(playerRatingVersions)
    .where(
      and(
        eq(playerRatingVersions.isCurrent, true),
        eq(playerRatingVersions.sourceStatus, "absent"),
        isNull(playerRatingVersions.effectiveTo)
      )
    )
    .orderBy(
      desc(playerRatingVersions.effectiveFrom),
      desc(playerRatingVersions.id)
    );
}
