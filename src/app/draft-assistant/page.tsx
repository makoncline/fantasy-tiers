"use client";

import React, { Suspense } from "react";
import DraftAssistantPageContent from "./DraftAssistantContent";

export default function DraftAssistantPage() {
  return (
    <Suspense fallback={<div />}> 
      <DraftAssistantPageContent />
    </Suspense>
  );
}
