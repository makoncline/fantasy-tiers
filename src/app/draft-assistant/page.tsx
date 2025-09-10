"use client";

import React, { Suspense } from "react";
import DraftAssistantPageContent from "./DraftAssistantContent";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const SHOW_DRAFT_ASSISTANT = false;

export default function DraftAssistantPage() {
  return (
    <Suspense fallback={<div />}>
      {SHOW_DRAFT_ASSISTANT ? (
        <DraftAssistantPageContent />
      ) : (
        <div className="flex min-h-screen items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <h2 className="text-xl font-semibold">Draft Assistant</h2>
                <p className="text-muted-foreground">
                  Draft Assistant is disabled till next season.
                </p>
                <Button asChild={true}>
                  <a href="/league-manager">Open League Manager</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Suspense>
  );
}
