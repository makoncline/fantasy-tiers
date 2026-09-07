"use client";

import { useDraftPreference, draftBooleanPreference } from "@/hooks/useDraftPreference";
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useDraftTablePreferences } from "./DraftTablePreferences";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarHeader, SidebarContent, useSidebar } from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useDraftData } from "../_contexts/DraftDataContext";
import { POSITIONS, ROSTER_SLOTS } from "@/lib/schemas";
import { formatDraftPick, getChoicePickWindow } from "@/lib/draftLookaheadCore";
import { DraftPickFeedStatus } from "./DraftPickFeedStatus";
import PreviewPickDialog, { type PreviewPickPlayer } from "./PreviewPickDialog";

const colors = { QB: "text-red-500", RB: "text-emerald-500", WR: "text-sky-500", TE: "text-amber-500", K: "text-violet-500", DEF: "text-orange-500" };
function Group({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useDraftPreference(`sidebar-group:${title}`, draftBooleanPreference, true);
  return <Collapsible open={open} onOpenChange={setOpen} className="border-t py-2">
    <CollapsibleTrigger className="flex w-full items-center justify-between py-1 text-sm font-semibold">{title}<ChevronDown className="size-3" /></CollapsibleTrigger>
    <CollapsibleContent className="space-y-2 pt-2">{children}</CollapsibleContent>
  </Collapsible>;
}

export default function DraftSidebar({ showRecommendations = true }: { showRecommendations?: boolean }) {
  const { draftDetails, draftSlot, picks, userRosterSlots: slots, userPositionCounts, draftContext,
    selectedDraftId, playersAll, positionRows, pickFeed } = useDraftData();
  const tablePreferences = useDraftTablePreferences();
  const { isMobile, setOpenMobile } = useSidebar();
  const [player, setPlayer] = useState<PreviewPickPlayer | null>(null);
  const teams = draftDetails?.settings.teams ?? 0;
  const rounds = draftDetails?.settings.rounds ?? 0;
  const complete = draftDetails?.status === "complete" || (teams * rounds > 0 && picks.length >= teams * rounds);
  const turn = getChoicePickWindow({ currentPick: complete ? teams * rounds + 1 : picks.length + 1, userSlot: draftSlot,
    teams, rounds, draftType: draftDetails?.type });
  const remaining = complete ? 0 : draftSlot == null ? null : Math.max(0, rounds - picks.filter(p => p.draft_slot === draftSlot).length);
  const vacant = slots.filter(s => !s.player && s.slot !== "BN");
  const openText = ROSTER_SLOTS.flatMap(slot => {
    const n = vacant.filter(s => s.slot === slot).length;
    return n ? [`${n} ${slot}`] : [];
  }).join(" · ");
  const forced = !complete && remaining != null && remaining > 0 && vacant.length >= remaining;
  const status = complete ? "Finished" : draftDetails?.status === "paused" ? "Paused"
    : draftDetails?.status === "pre_draft" ? "Not started" : turn.onClock ? "On the clock"
      : turn.beforeOwn == null ? "Turn unknown" : `${turn.beforeOwn} picks away`;
  const positions = POSITIONS.filter(pos => slots.some(s => s.slot === pos) || (userPositionCounts[pos] ?? 0) > 0);
  function navigate(id: string) {
    if (isMobile && id !== "league-needs") setOpenMobile(false);
    // Reopen an Overall table even when its hash is already selected.
    window.location.hash = id;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
  }
  return <>
    <Sidebar variant="floating" collapsible="offcanvas" aria-label="Draft and team state" data-testid="draft-sidebar">
      <SidebarHeader>
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Draft & team</h2>
      </header>
      <div className="space-y-1 pb-2 text-xs" aria-live="polite">
        <p className="font-semibold">{status}{!complete && turn.ownPick != null ? ` · ${formatDraftPick(turn.ownPick, teams)}` : ""}</p>
        <p>{openText ? `Open: ${openText}` : "Starters filled"}</p>
        {forced ? <p className="text-amber-600 dark:text-amber-300">Urgent: use remaining picks for open starters.</p> : null}
      </div>
      <DraftPickFeedStatus showHealthy />
      <div className="flex items-center justify-between gap-2 py-1"><Label htmlFor="show-drafted" className="text-xs">Show drafted</Label><Switch id="show-drafted" checked={tablePreferences?.showDrafted ?? false} onCheckedChange={checked => tablePreferences?.setShowDrafted(checked)} /></div>
      </SidebarHeader>
      <SidebarContent className="px-3 text-xs">
        <Group title="Draft status">
          <p>Upcoming {complete ? "—" : formatDraftPick(turn.ownPick, teams)}{!complete && turn.beforeOwn != null ? ` · ${turn.beforeOwn} picks away` : ""}</p>
          <p>Following {complete ? "—" : formatDraftPick(turn.nextOwnPick, teams)}{!complete && turn.betweenOwn != null ? ` · ${turn.betweenOwn} selections between` : ""}</p>
          <p>Slot {draftSlot ?? "—"} · {remaining ?? "—"} picks left</p>
          {!pickFeed ? <p className="text-muted-foreground">Local board · no live feed</p> : null}
        </Group>
        <Group title="Team counts & needs">
          <div className="flex flex-wrap gap-x-3 gap-y-2 tabular-nums">
            {ROSTER_SLOTS.map(slot => {
              const assigned = slots.filter(s => s.slot === slot);
              return assigned.length ? <span key={slot} className="whitespace-nowrap"><span className={slot === "BN" || slot === "FLEX" ? undefined : colors[slot]}>{slot === "BN" ? "Bench" : slot}</span> {assigned.filter(s => s.player).length}/{assigned.length}</span> : null;
            })}
          </div>
          <p className="tabular-nums" title="All owned RBs and WRs, including FLEX and bench players">RB/WR ratio <span className="font-medium">{userPositionCounts.RB ?? 0}:{userPositionCounts.WR ?? 0}</span></p>
        </Group>
        <Group title="Navigation">
          <nav aria-label="Draft sections" className="flex flex-wrap gap-x-3 gap-y-2">
            {showRecommendations && !complete ? <a href="#decision-board" onClick={e => { e.preventDefault(); navigate("decision-board"); }}>Recommendations</a> : null}
            {["overall", ...positions.map(p => p.toLowerCase()), ...(slots.some(s => s.slot === "FLEX") ? ["flex"] : [])].map(pos => <a key={pos} href={`#players-${pos}`} onClick={e => { e.preventDefault(); navigate(`players-${pos}`); }}>{pos === "overall" ? "Overall" : pos.toUpperCase()}</a>)}
            <a href="#watch-list" onClick={e => { e.preventDefault(); navigate("watch-list"); }}>Watch list</a>
            <a href="#league-needs" onClick={e => { e.preventDefault(); navigate("league-needs"); }}>League needs</a>
            {/^[0-9]+$/.test(selectedDraftId) ? <a href={`https://sleeper.com/draft/nfl/${selectedDraftId}`} target="_blank" rel="noreferrer">Open Sleeper ↗</a> : null}
          </nav>
        </Group>
        <Group title="Your roster">
          {(["Starters", "FLEX", "Bench"] as const).map(group => {
            const assigned = slots.filter(s => group === "Bench" ? s.slot === "BN" : group === "FLEX" ? s.slot === "FLEX" : !["BN", "FLEX"].includes(s.slot));
            return assigned.length ? <div key={group}><h3 className="mb-1 font-medium text-muted-foreground">{group}</h3>{assigned.map((s, index) => {
              const p = s.player;
              const detail = p ? playersAll.find(row => row.player_id === p.player_id) : null;
              const row = p ? positionRows?.ALL.find(row => row.player_id === p.player_id) : null;
              return <div key={`${s.slot}-${index}`} className="flex items-baseline gap-2 py-1">
                <span className={`w-9 shrink-0 ${p ? colors[p.position] : "text-muted-foreground"}`}>{p?.position ?? s.slot}</span>
                {p ? <Button variant="link" className="h-auto min-w-0 flex-1 justify-start whitespace-normal p-0 text-left text-xs" onClick={() => setPlayer({ ...detail, ...p, rank: p.rank ?? 0, tier: p.tier ?? 0 })}>{p.name}{row?.sleeper_injury_status ? ` · ${row.sleeper_injury_status}` : ""}</Button> : <span className="flex-1 text-muted-foreground">Empty</span>}
                <span className="text-muted-foreground">{p ? `Bye ${p.bye_week ?? "—"}` : ""}</span>
              </div>;
            })}</div> : null;
          })}
        </Group>
        <section id="league-needs" className="scroll-mt-4 border-t py-2">
          <h3 className="mb-2 text-sm font-semibold">League status & needs</h3>
          <p>{picks.length}/{teams * rounds || "—"} picks made</p>
          <p className="my-1 text-muted-foreground">Starter needs remaining</p>
          <div className="flex flex-wrap gap-2">{draftContext?.room?.leagueStarterSlotsRemaining ? [...positions, ...(slots.some(s => s.slot === "FLEX") ? ["FLEX" as const] : [])].map(pos => <span key={pos} className="whitespace-nowrap">{pos} {draftContext.room.leagueStarterSlotsRemaining[pos] ?? "—"}/{teams > 0 ? teams * slots.filter(slot => slot.slot === pos).length : "—"}</span>) : <span>Room needs unavailable</span>}</div>
        </section>
      </SidebarContent>
    </Sidebar>
    {player ? <PreviewPickDialog open onOpenChange={value => { if (!value) setPlayer(null); }} player={player} /> : null}
  </>;
}
