"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import DraftAssistantForm from "@/app/draft-assistant/_components/DraftAssistantForm";
import DraftAssistantContentComponent from "@/app/draft-assistant/_components/DraftAssistantContent";
import {
  DraftDataProvider,
  useDraftData,
} from "@/app/draft-assistant/_contexts/DraftDataContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Fantasy Draft Assistant</h1>
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

      {hasUser && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Selected User</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="flex items-center justify-between"
              data-testid="selected-user-card"
            >
              <div>
                <div className="font-medium" data-testid="selected-username">
                  {loading.user ? "Loading..." : user?.username ?? "—"}
                </div>
                <div
                  className="text-sm text-muted-foreground"
                  data-testid="selected-user-id"
                >
                  userId: {userId}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={contextClearUser}
              >
                Clear user
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {hasUser && !hasDraft && <DraftAssistantForm step="draft" />}

      {hasDraft && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Selected Draft</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="flex items-start justify-between gap-4 text-sm"
              data-testid="selected-draft-card"
            >
              <div className="grow">
                <DraftInfo
                  name={
                    loading.draftDetails
                      ? "Loading..."
                      : draftDetails?.metadata?.name ||
                        selectedDraft?.metadata?.name ||
                        draftDetails?.draft_id ||
                        selectedDraft?.draft_id ||
                        "—"
                  }
                  draftId={draftDetails?.draft_id || draftId}
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
              <div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={contextClearDraft}
                  data-testid="clear-draft"
                >
                  Clear draft
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {hasUser && hasDraft && <DraftAssistantContentComponent />}
    </>
  );
};

export default DraftAssistantShell;
