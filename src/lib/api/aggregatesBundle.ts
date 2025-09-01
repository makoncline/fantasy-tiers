// src/lib/api/aggregatesBundle.ts
import {
  AggregatesBundleResponse,
  type AggregatesBundleResponseT,
} from "../schemas-bundle";

export interface AggregatesBundleParams {
  scoring: "std" | "half" | "ppr";
  teams: number;
  roster: {
    QB: number;
    RB: number;
    WR: number;
    TE: number;
    K: number;
    DEF: number;
    FLEX: number;
    BENCH: number;
  };
}

export async function fetchAggregatesBundle(
  params: AggregatesBundleParams
): Promise<AggregatesBundleResponseT> {
  const queryParams = new URLSearchParams({
    scoring: params.scoring,
    teams: params.teams.toString(),
    slots_qb: params.roster.QB.toString(),
    slots_rb: params.roster.RB.toString(),
    slots_wr: params.roster.WR.toString(),
    slots_te: params.roster.TE.toString(),
    slots_k: params.roster.K.toString(),
    slots_def: params.roster.DEF.toString(),
    slots_flex: params.roster.FLEX.toString(),
  });

  const response = await fetch(
    `/api/aggregates/bundle?${queryParams.toString()}`
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to fetch aggregates bundle: ${response.status} ${errorText}`
    );
  }

  const json = await response.json();
  return AggregatesBundleResponse.parse(json);
}
