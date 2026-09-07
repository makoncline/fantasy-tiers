"use client";
import { useDraftPreference, draftBooleanPreference } from "@/hooks/useDraftPreference";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useDraftData } from "../_contexts/DraftDataContext";
import type { DraftPickAction } from "../_lib/types";
import ChoiceComparison from "./ChoiceComparison";

export default function DecisionBoard({ pickAction }: { pickAction?: DraftPickAction | undefined } = {}) {
  const { decisionRows } = useDraftData();
  const [open, setOpen] = useDraftPreference("recommendations-open", draftBooleanPreference, true);
  useEffect(() => {
    const followHash = () => {
      if (window.location.hash === "#decision-board") setOpen(true);
    };
    window.addEventListener("hashchange", followHash);
    return () => window.removeEventListener("hashchange", followHash);
  }, [setOpen]);
  if (!decisionRows.length) return null;
  return <section id="decision-board" data-testid="decision-board" className="scroll-mt-160 space-y-3 border-t pt-4">
    <Collapsible open={open} onOpenChange={setOpen}>
      <h2><CollapsibleTrigger asChild><Button variant="ghost" className="h-8 px-0 text-base font-semibold">{open ? "▾" : "▸"} Recommendations</Button></CollapsibleTrigger></h2>
      <CollapsibleContent className="pt-3"><ChoiceComparison pickAction={pickAction} /></CollapsibleContent>
    </Collapsible>
  </section>;
}
