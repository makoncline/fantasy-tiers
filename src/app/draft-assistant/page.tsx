"use client";

import { useSearchParams } from "next/navigation";
import { DraftDataProvider } from "@/contexts/DraftDataContext";
import DraftAssistantForm from "@/components/DraftAssistantForm";
import DraftAssistantContent from "@/components/DraftAssistantContent";
import { useDraftAssistantForm } from "@/hooks/useDraftAssistantForm";

function DraftAssistantPageContent() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") || "";
  const draftId = searchParams.get("draftId") || "";

  const {
    register,
    handleSubmit,
    errors,
    onSubmit,
    isSubmitting,
    userIdError,
    draftIdError,
  } = useDraftAssistantForm(userId, draftId);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Fantasy Draft Assistant</h1>
      <DraftAssistantForm
        register={register}
        handleSubmit={handleSubmit}
        onSubmit={onSubmit}
        errors={errors}
        isSubmitting={isSubmitting}
        userIdError={userIdError}
        draftIdError={draftIdError}
      />
      <DraftAssistantContent />
    </div>
  );
}

export default function DraftAssistantPage() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") || "";
  const draftId = searchParams.get("draftId") || "";

  return (
    <DraftDataProvider userId={userId} draftId={draftId}>
      <DraftAssistantPageContent />
    </DraftDataProvider>
  );
}
