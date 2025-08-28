"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DraftAssistantForm from "@/app/draft-assistant/_components/DraftAssistantForm";
import DraftAssistantContentComponent from "@/app/draft-assistant/_components/DraftAssistantContent";
import { useDraftAssistantForm } from "@/app/draft-assistant/_hooks/useDraftAssistantForm";
import { DraftDataProvider } from "@/app/draft-assistant/_contexts/DraftDataContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSleeperUserById } from "@/app/draft-assistant/_lib/useSleeper";
import { useDraftDetails } from "@/app/draft-assistant/_lib/useDraftQueries";
import DraftInfo from "@/app/draft-assistant/_components/DraftInfo";

const DraftAssistantShell: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const userId = searchParams.get("userId") || "";
  const draftId = searchParams.get("draftId") || "";
  const hasUser = Boolean(userId);
  const hasDraft = Boolean(draftId);

  const {
    register,
    form,
    setValue,
    errors,
    onSubmit,
    isSubmitting,
    userIdError,
    draftIdError,
    drafts,
    selectedDraftId,
  } = useDraftAssistantForm(userId, draftId);

  const selectedDraft = drafts?.find((d) => d.draft_id === selectedDraftId);
  const { data: userData, isLoading: loadingUser } = useSleeperUserById(
    userId || undefined,
    Boolean(userId)
  );
  const { data: draftDetails, isLoading: loadingDraftDetails } =
    useDraftDetails(draftId);

  const clearUser = () => {
    try {
      // Reset form fields to avoid carrying over a stale draftId/draftUrl
      form.reset({ username: "", draftId: "", draftUrl: "" });
    } catch {}
    const qs = new URLSearchParams();
    router.push(`/draft-assistant?${qs.toString()}`);
  };

  const clearDraft = () => {
    try {
      // Clear only the draft-related fields
      form.setValue("draftId", "");
      form.setValue("draftUrl", "");
    } catch {}
    const qs = new URLSearchParams();
    if (userId) qs.set("userId", userId);
    router.push(`/draft-assistant?${qs.toString()}`);
  };

  return (
    <DraftDataProvider userId={userId} draftId={draftId}>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Fantasy Draft Assistant</h1>
        {!hasUser && (
          <DraftAssistantForm
            form={form}
            register={register}
            setValue={setValue}
            onSubmit={onSubmit}
            errors={errors}
            isSubmitting={isSubmitting}
            userIdError={userIdError}
            draftIdError={draftIdError}
            drafts={drafts}
            selectedDraftId={selectedDraftId}
            step="user"
          />
        )}

        {hasUser && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Selected User</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    {loadingUser ? "Loading..." : userData?.username ?? "—"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    userId: {userId}
                  </div>
                </div>
                <Button variant="outline" onClick={clearUser}>
                  Clear user
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {hasUser && !hasDraft && (
          <DraftAssistantForm
            form={form}
            register={register}
            setValue={setValue}
            onSubmit={onSubmit}
            errors={errors}
            isSubmitting={isSubmitting}
            userIdError={userIdError}
            draftIdError={draftIdError}
            drafts={drafts}
            selectedDraftId={selectedDraftId}
            step="draft"
          />
        )}

        {hasDraft && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Selected Draft</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start justify-between gap-4 text-sm">
                <div className="grow">
                  <DraftInfo
                    name={
                      loadingDraftDetails
                        ? "Loading..."
                        : draftDetails?.metadata?.name ||
                          selectedDraft?.metadata?.name ||
                          draftDetails?.draft_id ||
                          selectedDraft?.draft_id ||
                          "—"
                    }
                    draftId={draftDetails?.draft_id || draftId}
                    type={draftDetails?.type}
                    teams={draftDetails?.settings?.teams}
                    rounds={draftDetails?.settings?.rounds}
                    season={draftDetails?.season}
                    startTime={draftDetails?.start_time ?? undefined}
                    status={draftDetails?.status}
                    pickNumber={draftDetails?.draft_order?.[userId]}
                    scoringType={draftDetails?.metadata?.scoring_type}
                  />
                </div>
                <div>
                  <Button variant="outline" onClick={clearDraft}>
                    Clear draft
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {hasUser && hasDraft && <DraftAssistantContentComponent />}
      </div>
    </DraftDataProvider>
  );
};

export default DraftAssistantShell;
