"use client";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AvailablePlayers from "./availablePlayers";
import PositionCompactTables from "./PositionCompactTables";
import { DraftComparisonProvider, DraftSelectedComparison } from "./DraftSelectedComparison";
import DraftTableFacts from "./DraftTableFacts";
import type { DraftPickAction } from "../_lib/types";
import { useDraftData } from "../_contexts/DraftDataContext";

const POSITIONS = ["RB", "WR", "FLEX", "QB", "TE", "DEF", "K"] as const;
export default function DraftPlayerPool({ loading, pickAction }: { loading: boolean; pickAction?: DraftPickAction | undefined }) {
  const [tab, setTab] = useState("ALL");
  const { userPositionRequirements, selectedDraftId } = useDraftData();
  const positions = POSITIONS.filter(p => p === "RB" || p === "WR" || p === "TE"
    ? (userPositionRequirements[p] ?? 0) > 0 || (userPositionRequirements.FLEX ?? 0) > 0
    : (userPositionRequirements[p] ?? 0) > 0);
  return <DraftComparisonProvider key={selectedDraftId}><div className="space-y-3" data-testid="draft-player-pool">
    <DraftTableFacts />
    <DraftSelectedComparison />
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList aria-label="Player pool positions" className="h-auto flex-wrap justify-start">
        <TabsTrigger value="ALL">Overall</TabsTrigger>
        {positions.map(p => <TabsTrigger key={p} value={p}>{p === "DEF" ? "D/ST" : p}</TabsTrigger>)}
      </TabsList>
      <TabsContent value="ALL" forceMount className="data-[state=inactive]:hidden"><AvailablePlayers loading={loading} pickAction={pickAction} /></TabsContent>
      {positions.map(p => <TabsContent key={p} value={p} forceMount className="data-[state=inactive]:hidden"><PositionCompactTables position={p} pickAction={pickAction} /></TabsContent>)}
    </Tabs>
  </div></DraftComparisonProvider>;
}
