"use client";
import { useDraftPreference, draftBooleanPreference } from "@/hooks/useDraftPreference";
import type { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DraftWatchlistProvider } from "./DraftWatchlistContext";
import { useDraftData } from "../_contexts/DraftDataContext";
import { DraftTablePreferences } from "./DraftTablePreferences";
import DraftSidebar from "./DraftSidebar";

export default function DraftWorkspace({ children, showRecommendations = true, header }: { children: ReactNode; showRecommendations?: boolean; header?: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useDraftPreference("sidebar-open", draftBooleanPreference, true);
  const { selectedDraftId } = useDraftData();
  return <DraftTablePreferences key={selectedDraftId}><DraftWatchlistProvider><SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
    <DraftSidebar showRecommendations={showRecommendations} />
    <div className="min-w-0 flex-1">
      <div className="mb-3 flex items-center gap-2">
        <SidebarTrigger aria-label="Toggle draft sidebar" /><h1 className="text-xl font-bold">Draft Assistant</h1>
      </div>
      {header}
      {children}
    </div>
  </SidebarProvider></DraftWatchlistProvider></DraftTablePreferences>;
}
