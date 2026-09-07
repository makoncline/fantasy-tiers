import type { ReactNode } from "react";
import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";
import DraftPlayerPool from "./DraftPlayerPool";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import DraftWorkspace from "./DraftWorkspace";

import DraftSourceSelector from "./DraftSourceSelector";

import DecisionBoard from "@/app/draft-assistant/_components/DecisionBoard";
import ManualDraftSlotForm from "@/app/draft-assistant/_components/ManualDraftSlotForm";
import type { DraftPickAction } from "@/app/draft-assistant/_lib/types";

export default function DraftAssistantContent({
  pickAction,
  showRecommendations = true,
  header,
}: {
  pickAction?: DraftPickAction | undefined;
  showRecommendations?: boolean | undefined;
  header?: ReactNode;
} = {}) {
  const {
    loading,
    error,
    draftDetails,
    formatNotices,
    draftValueStatus,
    readiness,
    refetchData,
    user,
    draftSlot,
    draftSlotSource,
    setDraftSlot,
  } = useDraftData();

  const isLoading = Object.values(loading).some(Boolean);
  const hasError = Object.values(error).some(Boolean);
  const hasBlockingError = hasError;
  const isComplete = draftDetails?.status === "complete";
  const sleeperDraftSlot = user?.user_id
    ? draftDetails?.draft_order?.[user.user_id]
    : undefined;
  const needsManualDraftSlot =
    !isComplete &&
    sleeperDraftSlot == null &&
    (draftDetails?.settings.teams ?? 0) > 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (hasBlockingError) {
    return (
      <DraftWorkspace header={header} showRecommendations={false}><Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          There was a problem loading draft data. Please try again.
        </AlertDescription>
      </Alert></DraftWorkspace>
    );
  }

  if (readiness?.status === "incident") {
    return (
      <DraftWorkspace header={header} showRecommendations={false}><Alert variant="destructive" data-testid="draft-data-incident">
        <AlertTitle>Draft data incident</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>
            Recommendations are blocked until FantasyPros and Sleeper data are
            current and complete.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {readiness.incidents.map((incident) => (
              <li key={`${incident.code}-${incident.message}`}>
                {incident.message}
              </li>
            ))}
            {readiness.playerIssues.slice(0, 8).map((issue) => (
              <li key={issue.playerId}>
                {issue.name} ({issue.position}): {issue.problems.join(" ")}
              </li>
            ))}
          </ul>
          {readiness.playerIssues.length > 8 ? (
            <p>{readiness.playerIssues.length - 8} more player issues.</p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={refetchData}
          >
            Check again
          </Button>
        </AlertDescription>
      </Alert></DraftWorkspace>
    );
  }

  return (
    <DraftWorkspace header={header} showRecommendations={showRecommendations}>
      <div className="min-w-0 space-y-3">
      {draftValueStatus?.available === false ? (
        <Alert variant="destructive" data-testid="draft-value-unavailable-notice">
          <AlertTitle>Draft recommendations unavailable</AlertTitle>
          <AlertDescription>{draftValueStatus.reason}</AlertDescription>
        </Alert>
      ) : null}

      {needsManualDraftSlot ? (
        <Alert data-testid="manual-draft-slot-notice">
          <AlertTitle>
            {draftSlotSource === "manual"
              ? `Using manual draft slot ${draftSlot}`
              : "Sleeper has not set the draft order"}
          </AlertTitle>
          <AlertDescription>
            {draftSlotSource === "manual" ? (
              <p>
                Adj, roster needs, turn timing, and recommendations use this
                slot. The app will use Sleeper automatically after it publishes
                the order.
              </p>
            ) : (
              <p>
                Raw Val is available now. Select your slot to calculate Adj,
                roster needs, turn timing, and recommendations.
              </p>
            )}
            <ManualDraftSlotForm
              key={draftSlot ?? "unset"}
              currentSlot={draftSlotSource === "manual" ? draftSlot : null}
              teams={draftDetails?.settings.teams ?? 0}
              onSave={setDraftSlot}
            />
          </AlertDescription>
        </Alert>
      ) : null}

      {formatNotices.length > 0 ? (
        <Alert data-testid="format-support-notice">
          <AlertTitle>Limited format support</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-5">
              {formatNotices.map((notice) => (
                <li key={notice.code}>{notice.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}


      <DraftSourceSelector />

      {showRecommendations &&
      !isComplete &&
      draftValueStatus?.available !== false ? (
        <DecisionBoard pickAction={pickAction} />
      ) : null}

      <section id="available-section" className="space-y-3 border-t pt-4">
        <div>
          <DraftPlayerPool
            loading={isLoading}
            pickAction={pickAction}
          />
        </div>
      </section>

      </div>
    </DraftWorkspace>
  );
}

// Removed page-level refresh + last-updated; handled in status card
