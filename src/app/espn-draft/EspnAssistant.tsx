"use client";
import { useMemo } from "react";
import DraftAssistantContent from "@/app/draft-assistant/_components/DraftAssistantContent";
import { DraftDataStaticProvider } from "@/app/draft-assistant/_contexts/DraftDataContext";
import { useDraftAssistantContextValue } from "@/app/draft-assistant/_lib/useDraftAssistantContextValue";
import { useAggregateBundle } from "@/hooks/useAggregateBundle";
import { espnDraftConfig, mapEspnDraft } from "@/lib/espn/adapter";
import type { EspnRoom } from "@/lib/espn/schemas";
import { buildDraftViewModel, selectDraftSource } from "@/lib/draftState";
import { draftCandidateMapFromBundle } from "@/lib/draftCandidate";
import { draftReadinessShardCountsFromBundle } from "@/lib/draftReadiness";
import type { AggregatesBundleResponseT } from "@/lib/schemas-bundle";
import { useDraftProjectionSource } from "@/hooks/useDraftProjectionSource";

type Connection = { checkedAt: number; refreshRoom: () => void };
export function EspnAssistant({ room, ...connection }: { room: EspnRoom } & Connection) {
  const config = useMemo(() => {
    try { return { value: espnDraftConfig(room) }; }
    catch (error) { return { error: error instanceof Error ? error.message : "Unsupported ESPN draft." }; }
  }, [room]);
  if (!config.value) return <p role="alert">{config.error}</p>;
  return <Rankings room={room} config={config.value} {...connection} />;
}
function Rankings({ room, config, checkedAt, refreshRoom }: { room: EspnRoom; config: ReturnType<typeof espnDraftConfig> } & Connection) {
  const query = useAggregateBundle(config);
  if (query.error) return <p role="alert">Could not load current rankings. {query.error.message}</p>;
  if (!query.data) return <p role="status">Loading current rankings…</p>;
  return <Mapped room={room} bundle={query.data} checkedAt={checkedAt} refreshRoom={() => { refreshRoom(); void query.refetch(); }} />;
}
function Mapped({ room, bundle, ...connection }: { room: EspnRoom; bundle: AggregatesBundleResponseT } & Connection) {
  const result = useMemo(() => {
    try { return { value: mapEspnDraft(room, bundle) }; }
    catch (error) { return { error: error instanceof Error ? error.message : "ESPN mapping failed." }; }
  }, [room, bundle]);
  if (!result.value) return <p role="alert">{result.error}</p>;
  return <Shared mapped={result.value} {...connection} />;
}
function Shared({ mapped, checkedAt, refreshRoom }: { mapped: ReturnType<typeof mapEspnDraft> } & Connection) {
  const { valueSource, setValueSource, fpSource, evaluationNow } = useDraftProjectionSource();
  const sourceViewModel = useMemo(() => buildDraftViewModel({
    fpSource, evaluationNow,
    playersMap: draftCandidateMapFromBundle(mapped.bundle), draft: mapped.details,
    picks: mapped.picks, userId: mapped.userId, topLimit: 3,
    scoringRules: mapped.projectionScoringRules, projectionArtifact: mapped.bundle.draftProjections,
    sourceHealth: mapped.bundle.sourceHealth ?? null, shardCounts: draftReadinessShardCountsFromBundle(mapped.bundle),
  }), [mapped, fpSource, evaluationNow]);
  const viewModel = useMemo(() => selectDraftSource(sourceViewModel, valueSource), [sourceViewModel, valueSource]);
  const context = useDraftAssistantContextValue({ viewModel, bundle: mapped.bundle,
    draftDetails: mapped.details, draftPicks: mapped.picks, userId: mapped.userId,
    userSlot: mapped.userSlot, scoring: mapped.scoring,
  });
  if (!context) return null;
  return <DraftDataStaticProvider value={{ ...context,
    valueSource, setValueSource, sourceComparison: viewModel.sourceComparison,
    refetchData: refreshRoom, lastUpdatedAt: checkedAt,
    pickFeed: { checkedAt, paused: mapped.details.status === "paused", complete: mapped.details.status === "complete" },
  }}><DraftAssistantContent /></DraftDataStaticProvider>;
}
