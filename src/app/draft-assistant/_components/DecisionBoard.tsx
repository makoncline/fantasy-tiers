"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDraftData } from "../_contexts/DraftDataContext";
import type { DraftPickAction } from "../_lib/types";
import ChoiceComparison from "./ChoiceComparison";

export default function DecisionBoard({ pickAction }: { pickAction?: DraftPickAction | undefined } = {}) {
  const { decisionRows } = useDraftData();
  if (!decisionRows.length) return null;
  return <Card id="decision-board" data-testid="decision-board" className="scroll-mt-40">
    <CardHeader className="pb-3"><CardTitle>Your choices</CardTitle></CardHeader>
    <CardContent><ChoiceComparison pickAction={pickAction} /></CardContent>
  </Card>;
}
