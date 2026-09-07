"use client";
import { useDraftPreference, draftBooleanPreference, draftPositionFiltersPreference } from "@/hooks/useDraftPreference";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import AvailablePlayers from "./availablePlayers";
import PositionCompactTables from "./PositionCompactTables";
import { DraftWatchlist } from "./DraftWatchlist";
import DraftTableFacts from "./DraftTableFacts";
import type { DraftPickAction } from "../_lib/types";
import { useDraftData } from "../_contexts/DraftDataContext";

const POSITIONS = ["RB", "WR", "FLEX", "QB", "TE", "DEF", "K"] as const;
const FLEX_POSITIONS = ["RB", "WR", "TE"];
const label = (position: string) => position === "DEF" ? "D/ST" : position;
const sectionId = (position: string) => `players-${position.toLowerCase()}`;

export default function DraftPlayerPool({ loading, pickAction }: { loading: boolean; pickAction?: DraftPickAction | undefined }) {
  const [overallOpen, setOverallOpen] = useDraftPreference("overall-open", draftBooleanPreference, true);
  const [excluded, setExcluded] = useDraftPreference<string[]>("position-filters", draftPositionFiltersPreference, []);
  const { userPositionRequirements, selectedDraftId } = useDraftData();
  const positions = POSITIONS.filter(p => p === "RB" || p === "WR" || p === "TE"
    ? (userPositionRequirements[p] ?? 0) > 0 || (userPositionRequirements.FLEX ?? 0) > 0
    : (userPositionRequirements[p] ?? 0) > 0);
  const sectionKeys = positions.join(",");
  const filters = positions.filter(p => p !== "FLEX");
  const flexOnly = filters.every(p => FLEX_POSITIONS.includes(p) ? !excluded.includes(p) : excluded.includes(p));
  const toggle = (group: readonly string[]) => setExcluded(current => {
    const allOn = group.every(p => !current.includes(p));
    return allOn ? [...new Set([...current, ...group])] : current.filter(p => !group.includes(p));
  });

  // Hash links also work on a fresh page load, after asynchronous draft data arrives.
  useEffect(() => {
    let frame = 0;
    const followHash = () => {
      const id = window.location.hash.slice(1);
      if (!id.startsWith("players-")) return;
      if (id === "players-overall") setOverallOpen(true);
      frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
    };

    window.addEventListener("hashchange", followHash);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("hashchange", followHash); };
  }, [loading, selectedDraftId, sectionKeys, setOverallOpen]);

  return <div className="space-y-4" data-testid="draft-player-pool">
    <DraftTableFacts />
    <DraftWatchlist />
    <Collapsible id="players-overall" open={overallOpen} onOpenChange={setOverallOpen} className="scroll-mt-4 border-t pt-3">
      <CollapsibleTrigger asChild><Button variant="ghost" className="mb-2 h-8 px-0 font-semibold">{overallOpen ? "▾" : "▸"} Overall</Button></CollapsibleTrigger>
      <CollapsibleContent forceMount className="space-y-2 data-[state=closed]:hidden">
        <div role="group" aria-label="Overall position filters" className="flex flex-wrap items-center gap-1">
          {filters.map(p => <Button key={p} size="sm" variant={excluded.includes(p) ? "outline" : "secondary"} aria-pressed={!excluded.includes(p)} onClick={() => toggle([p])}>{label(p)}</Button>)}
          <Button size="sm" variant={flexOnly ? "secondary" : "outline"} aria-pressed={flexOnly} onClick={() => setExcluded(flexOnly ? [] : filters.filter(p => !FLEX_POSITIONS.includes(p)))}>FLEX</Button>
          <Button size="sm" variant="ghost" onClick={() => setExcluded([])} title="Show all positions">Reset</Button>
        </div>
        <AvailablePlayers loading={loading} pickAction={pickAction} excludedPositions={excluded} />
      </CollapsibleContent>
    </Collapsible>
    {positions.map(p => <section key={p} id={sectionId(p)} aria-label={`${label(p)} table`} className="scroll-mt-4">
      <PositionCompactTables position={p} pickAction={pickAction} />
    </section>)}
  </div>;
}
