// src/lib/queryKeys.ts
export const qk = {
  aggregates: {
    merged: ["aggregates", "merged"] as const,
    shard: (pos: string) => ["aggregates", "shard", pos] as const,
    bundle: (
      scoring: string,
      teams: number,
      slots: {
        QB: number;
        RB: number;
        WR: number;
        TE: number;
        K: number;
        DEF: number;
        FLEX: number;
        BENCH: number;
      }
    ) =>
      [
        "aggregates",
        "bundle",
        scoring,
        teams,
        slots.QB,
        slots.RB,
        slots.WR,
        slots.TE,
        slots.K,
        slots.DEF,
        slots.FLEX,
        slots.BENCH,
      ] as const,
    lastModified: ["aggregates", "last-modified"] as const,
  },
  draft: {
    details: (id: string) => ["draft", id, "details"] as const,
    picks: (id: string) => ["draft", id, "picks"] as const,
    viewModel: (id: string, userId: string) =>
      ["draft", id, "view-model", userId] as const,
    summary: (id: string, userId: string) =>
      ["draft", id, "summary", userId] as const,
  },
  players: {
    byScoring: (scoring: string) => ["players", scoring] as const,
  },
  sleeper: {
    playersMeta: ["sleeper", "players-meta", "static"] as const,
    playerNews: (playerId: string) =>
      ["sleeper", "player-news", playerId] as const,
  },
} as const;
