"use client";
import { useMemo } from "react";
import { useDraftPreference, draftSourcePreference } from "./useDraftPreference";
import { useQuery } from "@tanstack/react-query";
import { ProjectionSourceSchema } from "@/lib/draftSourceComparison";
import { qk } from "@/lib/queryKeys";

export function useDraftProjectionSource() {
  const [valueSource, setValueSource] = useDraftPreference("source", draftSourcePreference, "sleeper");
  const query = useQuery({
    queryKey: qk.draft.projectionSource,
    queryFn: async () => {
      const response = await fetch("/api/draft/projection-source", { cache: "no-store" });
      if (!response.ok) throw new Error("FP projections are unavailable.");
      return ProjectionSourceSchema.parse(await response.json());
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
  });
  const evaluationNow = useMemo(() => new Date(Math.max(query.dataUpdatedAt, query.errorUpdatedAt) || Date.now()), [query.dataUpdatedAt, query.errorUpdatedAt]);
  return { refetchSource: query.refetch, evaluationNow, valueSource, setValueSource, fpSource: query.data ?? null };
}
