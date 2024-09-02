"use client";

import React, { Suspense } from "react";
import dynamic from "next/dynamic";
import { DraftDataProvider } from "@/contexts/DraftDataContext";

const DraftAssistantPageContent = dynamic(
  () => import("./DraftAssistantContent"),
  {
    ssr: false,
    loading: () => <div>Loading...</div>,
  }
);

export default function DraftAssistantPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DraftAssistantPageContent />
    </Suspense>
  );
}
