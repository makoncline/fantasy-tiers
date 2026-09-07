"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDraftData } from "../_contexts/DraftDataContext";
import { getPickFeedStatus } from "@/lib/draftLiveState";

/** Source freshness and successful pick polling are separate facts. */
export function useDraftPickFeedStatus() {
  const { pickFeed, error } = useDraftData();
  const [now, setNow] = useState(() => Date.now());
  const shouldTick = pickFeed != null && !pickFeed.complete;
  useEffect(() => {
    if (!shouldTick) return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [shouldTick]);
  return pickFeed ? getPickFeedStatus({ ...pickFeed, now, hasError: error.picks != null }) : null;
}

export function DraftPickFeedStatus({ showHealthy = false }: { showHealthy?: boolean } = {}) {
  const { refetchData } = useDraftData();
  const status = useDraftPickFeedStatus();
  if (!status) return null;
  if (!status.warning && !showHealthy) return null;
  return <div className={`flex flex-wrap items-center gap-2 text-xs ${status.warning
    ? "text-amber-800 dark:text-amber-300" : "text-muted-foreground"}`} data-testid="draft-pick-feed">
    <span role={status.warning ? "status" : undefined}>{status.warning ? status.label : status.label.replace("Pick feed checked", "Updated")}</span>
    {status.warning ? <Button type="button" size="sm" variant="outline" onClick={refetchData}>Retry updates</Button> : null}
    <span className="sr-only">This reports the last successful update response.</span>
  </div>;
}
