import { z } from "zod";

import { PositionEnum } from "@/lib/schemas";

export const MIN_SLEEPER_MARKET_PLAYERS = 100;
export const MIN_SLEEPER_MARKET_MATCH_PCT = 95;

export const FantasyProsDraftSourcePlayerSchema = z.object({
  sourcePlayerId: z.string().min(1),
  name: z.string().min(1),
  normalizedName: z.string().min(1),
  position: PositionEnum,
  rankAve: z.number().finite(),
  rankPos: z.number().finite().nullable(),
});

export const SleeperDraftSourcePlayerSchema = z.object({
  playerId: z.string().min(1),
  name: z.string().min(1),
  normalizedName: z.string().min(1),
  position: PositionEnum,
  marketRank: z.number().int().positive(),
});

const SleeperMarketBoardHealthSchema = z.object({
  rankedPlayerCount: z.number().int().nonnegative(),
  matchedPlayerCount: z.number().int().nonnegative(),
});

export const DraftSourceManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    generatedAt: z.string().datetime(),
    sleeperMarket: z.object({
      season: z.string().min(4),
      fetchedAt: z.string().datetime(),
      boards: z.object({
        std: SleeperMarketBoardHealthSchema,
        half: SleeperMarketBoardHealthSchema,
        ppr: SleeperMarketBoardHealthSchema,
      }),
    }),
    fantasyPros: z.object({
      std: z.array(FantasyProsDraftSourcePlayerSchema),
      half: z.array(FantasyProsDraftSourcePlayerSchema),
      ppr: z.array(FantasyProsDraftSourcePlayerSchema),
    }),
    sleeper: z.object({
      std: z.array(SleeperDraftSourcePlayerSchema),
      half: z.array(SleeperDraftSourcePlayerSchema),
      ppr: z.array(SleeperDraftSourcePlayerSchema),
    }),
  })
  .superRefine((manifest, context) => {
    for (const scoring of ["std", "half", "ppr"] as const) {
      const board = manifest.sleeperMarket.boards[scoring];
      const actualMatched = manifest.sleeper[scoring].length;
      const requiredTopCount = Math.min(120, board.rankedPlayerCount);
      const matchedTopCount = manifest.sleeper[scoring].filter(
        (player) => player.marketRank <= requiredTopCount
      ).length;
      const matchPct =
        board.rankedPlayerCount === 0
          ? 0
          : (actualMatched / board.rankedPlayerCount) * 100;
      if (
        board.rankedPlayerCount < MIN_SLEEPER_MARKET_PLAYERS ||
        actualMatched < MIN_SLEEPER_MARKET_PLAYERS ||
        matchedTopCount !== requiredTopCount ||
        matchPct < MIN_SLEEPER_MARKET_MATCH_PCT ||
        board.matchedPlayerCount !== actualMatched
      ) {
        context.addIssue({
          code: "custom",
          message: `Sleeper ${scoring} draft market is incomplete.`,
          path: ["sleeperMarket", "boards", scoring],
        });
      }
    }
  });

export type DraftSourceManifest = z.infer<typeof DraftSourceManifestSchema>;
