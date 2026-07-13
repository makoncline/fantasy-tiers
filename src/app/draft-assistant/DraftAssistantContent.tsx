"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import DraftAssistantForm from "@/app/draft-assistant/_components/DraftAssistantForm";
import DraftAssistantContentComponent from "@/app/draft-assistant/_components/DraftAssistantContent";
import {
  DraftDataProvider,
  useDraftData,
} from "@/app/draft-assistant/_contexts/DraftDataContext";
import { Button } from "@/components/ui/button";
import DraftInfo from "@/app/draft-assistant/_components/DraftInfo";

const DraftAssistantShell: React.FC = () => {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") || "";
  const draftId = searchParams.get("draftId") || "";
  const hasUser = Boolean(userId);
  const hasDraft = Boolean(draftId);

  return (
    <DraftDataProvider initialUserId={userId} initialDraftId={draftId}>
      <div className="p-4 md:p-6">
        <h1 className="mb-3 text-xl font-bold">Draft Assistant</h1>
        <DraftAssistantInner
          userId={userId}
          draftId={draftId}
          hasUser={hasUser}
          hasDraft={hasDraft}
        />
      </div>
    </DraftDataProvider>
  );
};

const DraftAssistantInner: React.FC<{
  userId: string;
  draftId: string;
  hasUser: boolean;
  hasDraft: boolean;
}> = ({ userId, draftId, hasUser, hasDraft }) => {
  const {
    user,
    drafts,
    selectedDraftId,
    draftDetails,
    loading,
    error,
    clearDraft: contextClearDraft,
    clearUser: contextClearUser,
  } = useDraftData();

  const selectedDraft = drafts?.find((d) => d.draft_id === selectedDraftId);

  return (
    <>
      {!hasUser && <DraftAssistantForm step="user" />}

      {hasUser && !hasDraft && <DraftAssistantForm step="draft" />}

      {hasDraft && (
        <div
          className="mb-4 flex flex-col gap-3 border-y py-3 text-sm md:flex-row md:items-center md:justify-between"
          data-testid="draft-context-bar"
        >
          <div className="flex min-w-0 flex-col gap-1 md:flex-row md:items-center md:gap-4">
            <div className="flex items-center gap-2" data-testid="selected-user-card">
              <span className="font-medium" data-testid="selected-username">
                {loading.user ? "Loading..." : user?.username ?? "—"}
              </span>
              <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={contextClearUser}>
                Change
              </Button>
            </div>
            <div className="min-w-0" data-testid="selected-draft-card">
                <DraftInfo
                  name={
                    loading.draftDetails
                      ? "Loading..."
                      : draftDetails?.metadata?.name ||
                        selectedDraft?.metadata?.name ||
                        `${draftDetails?.season ?? "2026"} draft`
                  }
                  {...(draftDetails?.type && { type: draftDetails.type })}
                  {...(draftDetails?.settings?.teams && {
                    teams: draftDetails.settings.teams,
                  })}
                  {...(draftDetails?.settings?.rounds && {
                    rounds: draftDetails.settings.rounds,
                  })}
                  {...(draftDetails?.season && {
                    season: draftDetails.season,
                  })}
                  {...(draftDetails?.start_time && {
                    startTime: draftDetails.start_time,
                  })}
                  {...(draftDetails?.status && {
                    status: draftDetails.status,
                  })}
                  {...(draftDetails?.draft_order?.[userId] && {
                    pickNumber: draftDetails.draft_order[userId],
                  })}
                  {...(draftDetails?.metadata?.scoring_type && {
                    scoringType: draftDetails.metadata.scoring_type,
                  })}
                />
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={contextClearDraft} data-testid="clear-draft">
            Change draft
          </Button>
        </div>
      )}

      {hasUser && hasDraft && <DraftAssistantContentComponent />}
    </>
  );
};

export default DraftAssistantShell;
