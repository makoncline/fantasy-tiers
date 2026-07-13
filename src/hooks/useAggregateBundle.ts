import { useQuery } from "@tanstack/react-query";

import { qk } from "@/lib/queryKeys";
import {
  AggregatesBundleResponse,
  type AggregatesBundleResponseT,
} from "@/lib/schemas-bundle";
import type { ScoringType } from "@/lib/schemas";
import type { SimRosterSlots } from "@/lib/simDraft";

export function useAggregateBundle(args: {
  scoring: ScoringType;
  teams: number;
  rounds: number;
  rosterSlots: SimRosterSlots;
  enabled?: boolean;
}) {
  const benchSlots = Math.max(
    0,
    args.rounds - Object.values(args.rosterSlots).reduce((sum, value) => sum + value, 0)
  );
  return useQuery<AggregatesBundleResponseT, Error>({
    queryKey: qk.aggregates.bundle(args.scoring, args.teams, {
      ...args.rosterSlots,
      BENCH: benchSlots,
    }),
    queryFn: async () => {
      const params = new URLSearchParams({
        scoring: args.scoring,
        teams: String(args.teams),
        slots_qb: String(args.rosterSlots.QB),
        slots_rb: String(args.rosterSlots.RB),
        slots_wr: String(args.rosterSlots.WR),
        slots_te: String(args.rosterSlots.TE),
        slots_k: String(args.rosterSlots.K),
        slots_def: String(args.rosterSlots.DEF),
        slots_flex: String(args.rosterSlots.FLEX),
        slots_bench: String(benchSlots),
      });
      const response = await fetch(`/api/aggregates/bundle?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to load aggregate bundle: ${response.status}`);
      }
      return AggregatesBundleResponse.parse(await response.json());
    },
    enabled: args.enabled ?? true,
    staleTime: 60_000,
  });
}
