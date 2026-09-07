"use client";
import { useDraftPreference, draftBooleanPreference } from "@/hooks/useDraftPreference";

import { createContext, useContext, type ReactNode } from "react";

const DraftTablePreferencesContext = createContext<{
  showDrafted: boolean;
  setShowDrafted: (show: boolean) => void;
} | null>(null);

export const useDraftTablePreferences = () => useContext(DraftTablePreferencesContext);

export function DraftTablePreferences({ children }: { children: ReactNode }) {
  const [showDrafted, setShowDrafted] = useDraftPreference("show-drafted", draftBooleanPreference, false);
  return <DraftTablePreferencesContext.Provider value={{ showDrafted, setShowDrafted }}>{children}</DraftTablePreferencesContext.Provider>;
}
