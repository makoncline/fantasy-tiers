"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import DraftAssistantForm from "@/components/DraftAssistantForm";
import DraftAssistantContentComponent from "@/components/DraftAssistantContent";
import { useDraftAssistantForm } from "@/hooks/useDraftAssistantForm";
import { DraftDataProvider } from "@/contexts/DraftDataContext";

const DraftAssistantPageContent: React.FC = () => {
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
    <DraftDataProvider userId={userId} draftId={draftId}>
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
        <DraftAssistantContentComponent />
      </div>
    </DraftDataProvider>
  );
};

export default DraftAssistantPageContent;
