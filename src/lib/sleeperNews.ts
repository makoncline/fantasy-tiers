import { z } from "zod";

const SLEEPER_GRAPHQL_URL = "https://api.sleeper.app/graphql";

const SleeperNewsMetadataSchema = z
  .object({
    analysis: z.string().optional(),
    description: z.string().optional(),
    title: z.string().optional(),
    topic_id: z.string().optional(),
    url: z.string().url().optional(),
  })
  .passthrough();

export const SleeperPlayerNewsItemSchema = z.object({
  metadata: SleeperNewsMetadataSchema,
  player_id: z.string(),
  published: z.coerce.number(),
  source: z.string(),
  source_key: z.string().nullable().optional(),
  sport: z.string(),
});

export const SleeperPlayerNewsItemsSchema = z.array(
  SleeperPlayerNewsItemSchema
);

export const SleeperPlayerNewsResponseSchema = z.object({
  items: SleeperPlayerNewsItemsSchema,
});

const SleeperGraphqlNewsResponseSchema = z.object({
  data: z
    .object({
      get_player_news: SleeperPlayerNewsItemsSchema.default([]),
    })
    .optional(),
  errors: z.unknown().optional(),
});

export type SleeperPlayerNewsItem = z.infer<
  typeof SleeperPlayerNewsItemSchema
>;

function playerNewsQuery(sport: string, playerId: string, limit: number) {
  return `
    query get_player_news {
      get_player_news(
        sport: ${JSON.stringify(sport)},
        player_id: ${JSON.stringify(playerId)},
        limit: ${limit}
      ) {
        metadata
        player_id
        published
        source
        source_key
        sport
      }
    }
  `;
}

export async function fetchSleeperPlayerNews(input: {
  playerId: string;
  sport?: string;
  limit?: number;
}): Promise<SleeperPlayerNewsItem[]> {
  const playerId = input.playerId.trim();
  if (!/^[A-Za-z0-9_-]+$/.test(playerId)) {
    throw new Error("Invalid Sleeper player id");
  }

  const sport = input.sport ?? "nfl";
  if (!/^[A-Za-z0-9_-]+$/.test(sport)) {
    throw new Error("Invalid Sleeper sport");
  }

  const limit = Math.min(Math.max(input.limit ?? 5, 1), 10);
  const query = playerNewsQuery(sport, playerId, limit);
  const res = await fetch(SLEEPER_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Sleeper-GraphQL-Op": "get_player_news",
    },
    body: JSON.stringify({
      operationName: "get_player_news",
      variables: {},
      query,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Sleeper player news: ${res.status}`);
  }

  const parsed = SleeperGraphqlNewsResponseSchema.parse(await res.json());
  if (parsed.errors) {
    throw new Error("Sleeper returned an error for player news");
  }

  return parsed.data?.get_player_news ?? [];
}
