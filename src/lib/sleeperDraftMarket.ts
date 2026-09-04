import { z } from "zod";

import { scoringTypeSchema, type ScoringType } from "@/lib/schemas";

const finiteNumber = z.number().finite();

export const SleeperDraftBoardValuesSchema = z.record(z.string(), finiteNumber);

export const SleeperActivePlayerSchema = z.object({
  player_id: z.string().min(1),
  first_name: z.string().nullable().optional().default(null),
  last_name: z.string().nullable().optional().default(null),
  position: z.string().nullable(),
  team: z.string().nullable(),
  depth_chart_position: z.string().nullable(),
  depth_chart_order: z.number().int().positive().nullable(),
});

export const SleeperInjurySchema = z.object({
  injury_body_part: z.string().nullable().optional(),
  injury_notes: z.string().nullable().optional(),
  injury_start_date: z.union([z.string(), z.number()]).nullable().optional(),
  injury_status: z.string().nullable().optional(),
});

export const SleeperDraftMarketArtifactSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.literal("Sleeper draft market"),
  season: z.string().min(4),
  fetchedAt: z.string().datetime(),
  boardValues: z.object({
    std: SleeperDraftBoardValuesSchema,
    half: SleeperDraftBoardValuesSchema,
    ppr: SleeperDraftBoardValuesSchema,
  }),
  activePlayers: z.record(z.string(), SleeperActivePlayerSchema),
  injuries: z.record(z.string(), SleeperInjurySchema),
});

export type SleeperDraftMarketArtifact = z.infer<
  typeof SleeperDraftMarketArtifactSchema
>;

const ActivePlayersResponseSchema = z.object({
  data: z.object({
    get_active_players: z.array(SleeperActivePlayerSchema),
  }),
});

const BOARD_SCORING_PATH = {
  std: "std",
  half: "half_ppr",
  ppr: "ppr",
} as const satisfies Record<ScoringType, string>;

export async function fetchSleeperDraftMarket(
  season: string,
  now = new Date()
): Promise<SleeperDraftMarketArtifact> {
  const [std, half, ppr, activePlayers, injuries] = await Promise.all([
    fetchBoardValues(season, "std"),
    fetchBoardValues(season, "half"),
    fetchBoardValues(season, "ppr"),
    fetchActivePlayers(),
    fetchInjuries(),
  ]);

  return SleeperDraftMarketArtifactSchema.parse({
    schemaVersion: 1,
    source: "Sleeper draft market",
    season,
    fetchedAt: now.toISOString(),
    boardValues: { std, half, ppr },
    activePlayers: Object.fromEntries(
      activePlayers.map((player) => [player.player_id, player])
    ),
    injuries,
  });
}

export function getSleeperBoardValue(
  artifact: SleeperDraftMarketArtifact,
  scoring: ScoringType,
  playerId: string
) {
  return artifact.boardValues[scoring][playerId] ?? null;
}

async function fetchBoardValues(season: string, scoring: ScoringType) {
  const path = BOARD_SCORING_PATH[scoringTypeSchema.parse(scoring)];
  const response = await fetch(
    `https://api.sleeper.com/players/nfl/values/regular/${encodeURIComponent(season)}/${path}?idp=false&is_dynasty=false`
  );
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Sleeper ${scoring} draft values: ${response.status}`
    );
  }
  return SleeperDraftBoardValuesSchema.parse(await response.json());
}

async function fetchActivePlayers() {
  const response = await fetch("https://sleeper.app/graphql", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-sleeper-graphql-op": "get_active_players",
    },
    body: JSON.stringify({
      operationName: "get_active_players",
      query:
        "query get_active_players { get_active_players(sport: \"nfl\") { player_id first_name last_name position team depth_chart_position depth_chart_order } }",
      variables: {},
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch Sleeper active players: ${response.status}`);
  }
  return ActivePlayersResponseSchema.parse(await response.json()).data
    .get_active_players;
}

async function fetchInjuries() {
  const response = await fetch("https://api.sleeper.app/players/nfl/injuries");
  if (!response.ok) {
    throw new Error(`Failed to fetch Sleeper injuries: ${response.status}`);
  }
  return z.record(z.string(), SleeperInjurySchema).parse(await response.json());
}
