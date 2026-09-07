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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const DraftAssistantShell: React.FC = () => {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") || "";
  const draftId = searchParams.get("draftId") || "";
  const draftSlotParam = searchParams.get("draftSlot");
  const parsedDraftSlot = draftSlotParam ? Number(draftSlotParam) : null;
  const draftSlot =
    parsedDraftSlot != null &&
    Number.isInteger(parsedDraftSlot) &&
    parsedDraftSlot > 0
      ? parsedDraftSlot
      : undefined;
  const hasUser = Boolean(userId);
  const hasDraft = Boolean(draftId);

  return (
    <DraftDataProvider
      initialUserId={userId}
      initialDraftId={draftId}
      {...(draftSlot != null ? { initialDraftSlot: draftSlot } : {})}
    >
      <div className="group/draft p-4 md:p-6">
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
    choiceSnapshot,
    draftSlot,
    clearDraft: contextClearDraft,
    clearUser: contextClearUser,
  } = useDraftData();

  const selectedDraft = drafts?.find((d) => d.draft_id === selectedDraftId);

  const contextBar = hasDraft ? <div className="mb-3 flex items-center gap-3 text-sm" data-testid="draft-context-bar">
    <span className="min-w-0 truncate font-medium">{loading.draftDetails ? "Loading draft…" : draftDetails?.metadata?.name || selectedDraft?.metadata?.name || "Draft"}</span>
    <Dialog><DialogTrigger asChild><Button variant="ghost" size="sm">Setup</Button></DialogTrigger><DialogContent className="max-h-[85dvh] overflow-auto sm:max-w-md" aria-describedby={undefined}>
      <DialogHeader><DialogTitle>Draft setup</DialogTitle></DialogHeader>
      <div className="flex items-center justify-between text-sm"><span>{user?.username ?? "—"}</span><Button variant="outline" size="sm" onClick={contextClearUser}>Change user</Button></div>
      <p className="text-sm">{draftDetails?.settings.teams ?? "—"} teams · {draftDetails?.settings.rounds ?? "—"} rounds · Slot {draftSlot ?? "—"}</p>
      <p className="text-sm">{draftDetails?.season} · {draftDetails?.type}</p>
      <h3 className="text-sm font-medium">Scoring settings</h3>
      {choiceSnapshot?.scoringRules ? <dl className="grid grid-cols-2 gap-1 text-xs">{Object.entries(choiceSnapshot.scoringRules).map(([key, value]) => <React.Fragment key={key}><dt>{key.replaceAll("_", " ")}</dt><dd className="text-right">{value}</dd></React.Fragment>)}</dl> : <p className="text-sm">Scoring settings unavailable.</p>}
      <Button variant="outline" size="sm" onClick={contextClearDraft} data-testid="clear-draft">Change draft</Button>
    </DialogContent></Dialog>
  </div> : null;
  return <>
    {!hasUser || !hasDraft ? <h1 className="mb-3 text-xl font-bold">Draft Assistant</h1> : null}
    {!hasUser && <DraftAssistantForm step="user" />}
    {hasUser && !hasDraft && <DraftAssistantForm step="draft" />}
    {hasUser && hasDraft ? <DraftAssistantContentComponent header={contextBar} /> : contextBar}
  </>;
};

export default DraftAssistantShell;
