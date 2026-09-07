"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDraftData } from "../_contexts/DraftDataContext";
import { getPickFeedStatus } from "@/lib/draftLiveState";

/** Source freshness and successful pick polling are separate facts. */
export function DraftPickFeedStatus() {
  const { pickFeed, error, picks, refetchData } = useDraftData();
  const [now, setNow] = useState(() => Date.now());
  const shouldTick = pickFeed != null && !pickFeed.complete;
  useEffect(() => {
    if (!shouldTick) return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [shouldTick]);
  if (!pickFeed) return null; // A static/local board does not claim live synchronization.
  const status = getPickFeedStatus({ ...pickFeed, now, hasError: error.picks != null });
  return <div className={`flex flex-wrap items-center gap-2 text-xs ${status.warning
    ? "text-amber-800 dark:text-amber-300" : "text-muted-foreground"}`} data-testid="draft-pick-feed">
    <span role={status.warning ? "status" : undefined}>{status.label} · {picks.length} picks received</span>
    {status.warning ? <Button type="button" size="sm" variant="outline" onClick={refetchData}>Retry updates</Button> : null}
    <span className="sr-only">This reports the last successful response, not a guarantee about Sleeper cache freshness.</span>
  </div>;
}
