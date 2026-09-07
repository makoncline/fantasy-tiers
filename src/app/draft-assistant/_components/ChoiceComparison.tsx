"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useDraftData } from "../_contexts/DraftDataContext";
import {
  buildDraftChoices, choiceRosterFit, choiceContributionDifference,
  CHOICE_COMPONENT_LABELS, type DraftChoice, type DraftChoiceSnapshot,
} from "@/lib/draftChoices";
import { analyzeDraftChoiceSensitivity, type DraftChoiceSensitivity } from "@/lib/draftChoiceSensitivity";
import type { DraftCandidate } from "@/lib/draftCandidate";
import type { DraftValueBoard } from "@/lib/draftValue";
import { useDraftScenario, type ScenarioPayload } from "./useDraftScenario";
import { DraftOptionalBoundary } from "./DraftOptionalBoundary";
import { DraftPickFeedStatus } from "./DraftPickFeedStatus";
import { formatDraftPick, getChoicePickWindow, scenarioMarketOrder } from "@/lib/draftLookaheadCore";
import {
  formatDraftMetric as score, formatMetricDifference,
  overallTier, tierDifference,
} from "@/lib/draftCardMetrics";

import type { DraftPickAction } from "../_lib/types";
import { DraftAdpValue } from "./DraftAdpValue";
const noteSchema = z.object({ note: z.string().trim().max(400) });

function JudgmentNote({ saved, onSave }: { saved: string; onSave: (note: string) => void }) {
  const form = useForm<z.infer<typeof noteSchema>>({ resolver: zodResolver(noteSchema), defaultValues: { note: saved } });
  return <Form {...form}>
    <form className="flex flex-col gap-2" onSubmit={form.handleSubmit(({ note }) => onSave(note))}>
      <FormField control={form.control} name="note" render={({ field }) => <FormItem>
        <FormLabel>Personal judgment</FormLabel>
        <FormControl><Textarea {...field} rows={2} placeholder="Why I prefer this player or path." /></FormControl>
        <FormMessage />
      </FormItem>} />
      <p className="text-xs text-muted-foreground">Does not change scores. Saved for this board until reload; export evidence to keep it.</p>
      <Button type="submit" variant="outline" size="sm" className="w-fit">Keep note</Button>
      {saved ? <p className="text-sm">{saved}</p> : null}
    </form>
  </Form>;
}

function Metric({ label, value, difference }: { label: string; value: string; difference: string }) {
  return <div className="min-w-0">
    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
    <dd className="mt-1 text-[22px] font-semibold leading-none tabular-nums">{value}</dd>
    <dd className="mt-1.5 text-xs text-muted-foreground tabular-nums">{difference}</dd>
  </div>;
}

function CompactChoiceCard({ choice, lean, snapshot, future = false, selected = false, onPreview, explanation, onPick, pickDisabled }: {
  choice: DraftChoice; lean: DraftChoice; snapshot: DraftChoiceSnapshot;
  future?: boolean; selected?: boolean; onPreview?: (() => void) | undefined;
  explanation?: string; onPick?: (() => void) | undefined; pickDisabled?: boolean | undefined;
}) {
  const { player, metrics } = choice;
  const isLean = player.player_id === lean.player.player_id;
  const fit = choiceRosterFit(player, snapshot.boardInput.userPositionNeeds);
  const value = snapshot.values.valuesByPlayerId[player.player_id];
  const tier = overallTier(player);
  const window = getChoicePickWindow(snapshot.boardInput);
  const differences = choiceContributionDifference(lean.metrics, metrics);
  const byePeers = (snapshot.boardInput.userRosterPlayers ?? []).filter((p) => player.bye_week && String(p.bye_week) === player.bye_week);
  const hasRisk = metrics.availability.classification !== "healthy";
  const [open, setOpen] = useState(false);
  return <Card className={`min-w-0 rounded-xl py-0 shadow-none ${
    isLean && !future ? "border-primary/45 bg-primary/[0.04]" : "bg-transparent"
  } ${selected && !isLean ? "ring-1 ring-sky-500/60" : ""}`} data-testid={future ? "next-pick-option" : "decision-recommendation-card"}>
    <CardContent className="flex h-full flex-col gap-3 p-3.5">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{isLean ? future ? "Scenario lean" : "Recommended" : "Compare"}</span>
        <span>{player.position}{player.team ? ` · ${player.team}` : ""}{player.bye_week ? ` · Bye ${player.bye_week}` : ""}</span>
      </div>
      <h3 className="break-words text-base font-semibold leading-snug capitalize">{player.name}</h3>
      <dl className="grid grid-cols-3 gap-3">
        <Metric label="Val" value={score(metrics.staticValue)} difference={isLean ? "Reference" : formatMetricDifference(metrics.staticValue, lean.metrics.staticValue)} />
        <Metric label="Adj" value={score(metrics.recommendationScore)} difference={isLean ? "Reference" : formatMetricDifference(metrics.recommendationScore, lean.metrics.recommendationScore)} />
        <Metric label="Overall tier" value={tier == null ? "—" : String(tier)} difference={isLean ? "Lower is better" : tierDifference(tier, overallTier(lean.player))} />
      </dl>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">ECR {score(player.fp_rank_ave)}</span>
        <DraftAdpValue adp={metrics.sleeperAdp} pick={window.ownPick} teams={snapshot.boardInput.teams} />
      </div>
      <p className="text-xs text-muted-foreground" data-testid={isLean && !future ? "decision-recommendation-summary" : undefined}>
        {fit.slot === "BN" ? `${player.position} bench coverage` : `${fit.slot} starter`}
        {explanation ? ` · ${explanation}` : ""}
      </p>
      <p className="text-xs text-muted-foreground">{fit.remaining}</p>
      {byePeers.length ? <p className="text-xs">Shares bye {player.bye_week} with {byePeers.map((p) => p.name ?? p.position).join(", ")}. Coverage needs review.</p> : null}
      {hasRisk ? <p className="text-xs text-amber-800 dark:text-amber-300">{metrics.availability.detail}</p> : null}
      {hasRisk ? <Badge variant="outline" className="w-fit border-amber-500/30 text-amber-800 dark:text-amber-300" title={metrics.availability.detail}>
        {metrics.availability.label}
      </Badge> : null}
      {metrics.availability.rankingsMayBeStale ? <Badge variant="outline" className="w-fit border-amber-500/30 text-amber-800 dark:text-amber-300">News newer than rankings</Badge> : null}
      {metrics.missingFields.length ? <p className="text-xs text-amber-800 dark:text-amber-300">Source notes: {metrics.missingFields.join(", ")}</p> : null}
      {future && scenarioMarketOrder(player) == null ? <p className="text-xs text-amber-800 dark:text-amber-300">No market placement; survival was not modeled.</p> : null}
      <div className="mt-auto flex flex-col gap-1">
        {onPick ? <Button type="button" size="sm" disabled={pickDisabled} onClick={onPick} aria-label={`Pick ${player.name}`}>Pick {player.name}</Button> : null}
        {onPreview ? <Button type="button" size="sm" variant={selected ? "secondary" : "outline"}
          aria-pressed={selected} onClick={onPreview} className="min-h-9 w-full text-xs">
          {selected ? "Previewing this path" : "Preview after this pick"}
        </Button> : null}
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild><Button type="button" variant="ghost" size="sm" className="h-8 px-0 text-xs text-muted-foreground">Value and adjustment details</Button></CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-2 border-t pt-3 text-xs">
            <p>{choice.reason}. A comparison is not a claim of equal value.</p>
            <p>Val is an ECR-calibrated value estimate. It does not retain each player’s stat profile. Adj is a ranking score, not fantasy points or confidence.</p>
            <p>Original league-scored projection: {score(value?.rawProjectedPoints)} points.</p>
            <p>ECR-assigned projection: {score(value?.projectedPoints)} points.</p>
            <p>Roster depth and balance can affect a FLEX starter as well as a bench pick. It reflects roster composition, not just empty bench slots.</p>
            <p>Position tier: {player.position} {player.position_tier_level ?? "—"}. Compare position tiers only within the same position.</p>
            <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 tabular-nums">
              {Object.entries(CHOICE_COMPONENT_LABELS).map(([key, label]) => <div className="contents" key={key}>
                <dt>{label}</dt><dd>{score(Object.entries(metrics.components).find(([k]) => k === key)?.[1])}</dd>
              </div>)}
            </dl>
            {!isLean ? <p>Largest contributions favoring the lean: {differences.filter((d) => d.value > 0).slice(0, 2).map((d) => `${d.label} +${score(d.value)}`).join(", ") || "none"}.</p> : null}
            {metrics.recommendationExplanation.dataQuality.map((text) => <p key={text}>{text}</p>)}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </CardContent>
  </Card>;
}

function ScenarioBody({ payload }: { payload: ScenarioPayload }) {
  const { result, room } = payload;
  const { scenario, choices, snapshot } = result;
  if (scenario.status !== "ready" || !snapshot || !choices[0]) {
    return <p className="text-sm text-muted-foreground" data-testid="next-pick-unavailable">
      {scenario.status === "ready" ? "No eligible recommendation remains in this scenario." : scenario.message}
    </p>;
  }
  const picksAfterOwn = scenario.selections.filter((pick) => pick.kind === "opponent" && pick.pick > (scenario.window.ownPick ?? 0));
  return <div className="flex flex-col gap-3" data-testid="next-pick-scenario">
    <p className="text-xs text-muted-foreground">{payload.paths.length === 2 ? "Two paths under one market-order assumption." : "Only one comparison path is available; no second path is inferred."} No validated availability probabilities or path winner. Compare scores within each future board only.</p>
    <div className="grid items-start gap-3 md:grid-cols-2">{payload.paths.map((path, index) => {
      const next = path.result;
      const firstChoice = next.choices[0];
      const waitPosition = payload.paths[index === 0 ? 1 : 0]?.firstPosition;
      const later = next.board?.recommendations.find((p) => p.position === waitPosition);
      return <Card key={path.firstName} className="gap-2 p-3" data-testid="two-pick-path"><CardContent className="space-y-2 p-0 text-sm">
        <h3 className="font-semibold capitalize">{path.firstName} now ({path.firstPosition})</h3>
        {firstChoice && next.snapshot ? <>
          <p>If the room follows this order: {firstChoice.player.name} ({firstChoice.player.position}) — {choiceRosterFit(firstChoice.player, next.snapshot.boardInput.userPositionNeeds).purpose}.</p>
          <p className="text-xs">{choiceRosterFit(firstChoice.player, next.snapshot.boardInput.userPositionNeeds).remaining}</p>
          <p className="text-xs">Future-board lean: Val {score(firstChoice.metrics.staticValue)}, Adj {score(firstChoice.metrics.recommendationScore)}.</p>
          {waitPosition && waitPosition !== path.firstPosition ? <p className="text-xs">If you wait on {waitPosition}: {later ? `${later.name} remains in this scenario.${later.player_id === firstChoice.player.player_id ? " This is the next lean shown above." : ` ${choiceRosterFit(later, next.snapshot.boardInput.userPositionNeeds).remaining}`}` : "No eligible option remains in this scenario."}</p> : null}
          {later && scenarioMarketOrder(later) == null ? <p className="text-xs">This later option has no market placement. Its survival was not modeled.</p> : null}
        </> : <p>{next.scenario.status === "ready" ? "No useful second choice is available." : next.scenario.message}</p>}
      </CardContent></Card>;
    })}</div>
    <Collapsible>
      <CollapsibleTrigger asChild><Button type="button" variant="ghost" size="sm" className="px-0 text-xs text-muted-foreground">Scenario removals and opponent rosters</Button></CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-3 pt-2 text-xs">
        <p>One what-if, not an availability forecast: opponents take the highest remaining platform market entry. Platform board order is primary; ADP is a fallback. ECR is not a market fallback. No new roster-demand weights are used.</p>
        <p>Between your two picks, this scenario removes: {picksAfterOwn.map((pick) => `${pick.name} (${pick.position}, #${pick.pick})`).join("; ") || "none"}.</p>
        {scenario.window.beforeOwn ? <p>Before your upcoming pick it removes: {scenario.selections.filter((pick) => pick.pick < (scenario.window.ownPick ?? 0)).map((pick) => pick.name).join(", ")}.</p> : null}
        <p>{scenario.unpricedCount} available players have no usable market placement and were not removed by market order. Their remaining status is not a survival forecast.</p>
        <p>Observed rosters below are context, not predicted selections. Managers may still draft backup QBs, backup TEs, or early defenses. Counts are per team; “picks” can be greater than one.</p>
        <div className="overflow-x-auto"><table className="w-full text-left tabular-nums">
          <caption className="sr-only">Teams selecting between your next two picks; current observed rosters</caption>
          <thead><tr className="border-b"><th className="py-2">Slot</th><th>Picks</th><th>QB owned</th><th>TE owned</th><th>Open starter slots now</th></tr></thead>
          <tbody>{room.map((team) => <tr key={team.slot} className="border-b border-border/50">
            <td className="py-2">{team.slot}</td><td>{team.picks}</td><td>{team.qbCount ?? "—"}</td><td>{team.teCount ?? "—"}</td><td>{team.openSlots}</td>
          </tr>)}</tbody>
        </table></div>
        <p>Scores in the next row use the simulated roster and board. Compare Adj within a row, not between rows. This scenario never changes the active recommendation.</p>
      </CollapsibleContent>
    </Collapsible>
  </div>;
}

function ChoicePanel({ board, snapshot, pickAction }: { board: DraftValueBoard<DraftCandidate>; snapshot: DraftChoiceSnapshot; pickAction?: DraftPickAction | undefined }) {
  const choices = useMemo(() => buildDraftChoices(board), [board]);
  const [comparison, setComparison] = useState("");
  const [selectedNow, setSelectedNow] = useState("");
  const [note, setNote] = useState("");
  const [stress, setStress] = useState<{ snapshot: DraftChoiceSnapshot; report: DraftChoiceSensitivity } | null>(null);
  const [stressError, setStressError] = useState("");
  const scenarioJob = useDraftScenario(snapshot, board);
  const { sourceHealth, error: sourceError, pickFeed } = useDraftData();
  const sourceChecks = sourceHealth?.sources.map((source) => ({ source: source.source,
    fetchedAt: source.fetchedAt ?? null, updatedAt: source.lastUpdated ?? null })) ?? [];
  const lean = choices[0];
  const validSelection = board.recommendations.find((p) => p.player_id === selectedNow);
  const selectedNowId = validSelection?.player_id ?? lean?.player.player_id ?? "";
  const preview = scenarioJob.current?.request.id === selectedNowId ? scenarioJob.current : null;
  const updating = preview?.status === "pending";
  const requestPreview = (id: string) => { setSelectedNow(id); scenarioJob.start(id); };
  const window = getChoicePickWindow(snapshot.boardInput);
  const report = stress?.snapshot === snapshot ? stress.report : null;
  if (!lean) return null;
  const display = choices.slice(0, 3);
  // Keep a manually selected or scenario-selected comparison visible. Do not
  // change the canonical default or its ordering to make space for it.
  for (const id of [comparison, selectedNowId]) {
    const player = board.recommendations.find((p) => p.player_id === id);
    const metrics = player ? board.metricsByPlayerId[player.player_id] : null;
    if (player && metrics && !display.some((c) => c.player.player_id === id)) {
      display.push({ player, metrics, reason: "Selected for inspection; not a claim of equal value" });
    }
  }
  const selectedName = board.recommendations.find((p) => p.player_id === selectedNowId)?.name ?? lean.player.name;
  const teams = snapshot.boardInput.teams;
  const higherValue = choices.find((c) => (c.metrics.staticValue ?? -Infinity) > (lean.metrics.staticValue ?? -Infinity));
  return <div className="flex flex-col gap-4" data-testid="choice-comparison">
    <DraftPickFeedStatus />
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="text-sm font-semibold">{window.onClock ? "Now" : "Upcoming"} · {formatDraftPick(window.ownPick, teams)} <span className="font-normal text-muted-foreground">#{window.ownPick ?? "—"}</span></h2>
      <p className="text-xs text-muted-foreground" data-testid="draft-pick-window">
        {window.state === "unknown" ? "Draft turn information is incomplete" : window.state === "complete" ? "Your picks are complete"
          : window.state === "final" ? "Your final pick"
          : `${window.betweenOwn} opponent selections → next ${formatDraftPick(window.nextOwnPick, teams)} (#${window.nextOwnPick})`}
      </p>
    </div>
    {window.beforeOwn != null && window.beforeOwn > 0 ? <p className="-mt-2 text-xs text-muted-foreground">
      {window.beforeOwn} opponent selection{window.beforeOwn === 1 ? "" : "s"} before your upcoming pick. The counts above refer to the wait after that pick.
    </p> : null}
    {window.onClock && window.betweenOwn === 0 ? <p className="-mt-2 text-xs text-muted-foreground">No opponent picks before your next turn. Other available players stay on the board.</p> : null}
    <div className="grid items-start gap-3 md:grid-cols-3">{display.map((choice) =>
      <CompactChoiceCard key={choice.player.player_id} choice={choice} lean={lean} snapshot={snapshot}
        explanation={(() => {
          const rival = choice === lean ? choices.find((c) => c !== lean) : lean;
          if (!rival) return "Only comparison shown; other eligible players are in the tables";
          const edge = choiceContributionDifference(choice.metrics, rival.metrics).find((d) => d.value > 0);
          return edge ? `${edge.label} gives the largest score edge over ${rival.player.name} (+${score(edge.value)} Adj contribution)` : `No component edge over ${rival.player.name}`;
        })()}
        onPick={pickAction ? () => pickAction.onPick(choice.player) : undefined}
        pickDisabled={pickAction?.disabled}
        selected={preview != null && preview.status !== "failed" && choice.player.player_id === selectedNowId}
        onPreview={window.state === "ready" ? () => requestPreview(choice.player.player_id) : undefined} />
    )}</div>
    {higherValue ? <p className="text-xs text-muted-foreground">The default gives up {score((higherValue.metrics.staticValue ?? 0) - (lean.metrics.staticValue ?? 0))} Val to {higherValue.player.name}; contextual adjustments explain the difference. Details are on the cards.</p> : null}
    {window.state === "ready" ? <section aria-label="Next pick market-order scenario" className="flex flex-col gap-3 border-t pt-4" aria-busy={updating}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Next · {formatDraftPick(window.nextOwnPick, teams)} <span className="font-normal text-muted-foreground">#{window.nextOwnPick}</span></h2>
        <Badge variant="outline" className="font-normal">Illustrative what-if</Badge>
      </div>
      <p className="text-xs text-muted-foreground">After taking <strong className="font-medium text-foreground capitalize">{selectedName}</strong> at #{window.ownPick}, then removing {window.betweenOwn} players in market order.</p>
      <p className="text-xs text-amber-800 dark:text-amber-300">This is not an availability forecast. Players removed here may still reach your next pick; players shown here may be taken. Use these paths to compare trade-offs, not to decide that a player is safe to wait on.</p>
      {updating ? <p className="text-sm text-muted-foreground" role="status">Calculating this scenario…</p>
        : preview?.status === "ready" ? <DraftOptionalBoundary key={preview.sequence}>
          <ScenarioBody payload={preview.payload} />
        </DraftOptionalBoundary>
        : <p className="text-xs text-muted-foreground" role="status">
          {preview?.status === "failed" ? "Preview unavailable. The current recommendation is unchanged."
            : scenarioJob.stale ? "The board changed. Refresh this optional scenario."
            : "Optional preview. No calculation runs until you request it."}
        </p>}
      <Button type="button" variant="outline" size="sm" className="w-fit" disabled={updating}
        onClick={() => requestPreview(selectedNowId)}>{preview ? "Refresh scenario" : "Show next-pick scenario"}</Button>
    </section> : null}
    <Collapsible>
      <CollapsibleTrigger asChild><Button variant="ghost" size="sm" className="px-0 text-xs text-muted-foreground">Details, assumptions &amp; notes</Button></CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4 border-t pt-4">
        <p className="text-xs text-muted-foreground">Alternatives are worth comparing, not necessarily equivalent. Higher Val/Adj and lower overall tiers rank better in this model. There is no validated “close enough” threshold. ADP colors use half a league round: amber = early, neutral = near, green = past ADP. Green does not mean a better player.</p>
        <Select value={comparison} onValueChange={setComparison}>
          <SelectTrigger className="max-w-md" aria-label="Select a player to compare"><SelectValue placeholder="Compare any eligible player" /></SelectTrigger>
          <SelectContent>{board.recommendations.map((p) => <SelectItem key={p.player_id} value={p.player_id}>{p.name} · {p.position}</SelectItem>)}</SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Comparisons follow current owner eligibility. Previewing a path does not draft a player or change the default.</p>
        {choices.length > 3 ? <p className="text-xs text-muted-foreground">Other comparison candidates: {choices.slice(3).map((c) => c.player.name).join(", ")}.</p> : null}
        <JudgmentNote saved={note} onSave={setNote} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            setStressError("");
            try { setStress({ snapshot, report: analyzeDraftChoiceSensitivity(snapshot) }); }
            catch { setStressError("Assumption check unavailable. The current recommendation is unchanged."); }
          }}>Test assumptions for this pick</Button>
          <Button variant="outline" size="sm" onClick={() => {
            // Never recompute expensive optional work during an evidence export.
            // A stale or unrequested result is null, not a fabricated scenario.
            const lookahead = preview?.status === "ready" ? preview.payload.result : null;
            const url = URL.createObjectURL(new Blob([JSON.stringify({
              schemaVersion: "choice-ui-lookahead-v2", capturedAt: new Date().toISOString(),
              snapshot, sourceChecks, pickFeed, pickFeedError: sourceError.picks?.message ?? null,
              previewStatus: preview?.status ?? "not-requested-or-stale", choices: display, sensitivity: report, personalJudgment: note,
              paths: preview?.status === "ready" ? preview.payload.paths : null,
              lookahead: lookahead ? { scenario: lookahead.scenario, choices: lookahead.choices,
                boardInput: lookahead.snapshot?.boardInput ?? null } : null,
              scoring: "Active recommendation unchanged; next-row scores are hypothetical only",
            }, null, 2)], { type: "application/json" }));
            const link = document.createElement("a");
            link.href = url; link.download = `draft-choice-pick-${snapshot.boardInput.currentPick}.json`;
            document.body.appendChild(link); link.click(); link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1_000);
          }}>Save comparison evidence</Button>

        </div>
        {stressError ? <p role="status" className="text-sm text-amber-800 dark:text-amber-300">{stressError}</p> : null}
        {report ? <div className="flex flex-col gap-2" data-testid="choice-sensitivity">
          <p className="text-sm font-medium">{report.status}</p>
          {report.status === "Choice changes with assumptions" && report.scenarios.every((s) => s.leanId === lean.player.player_id) ? <p className="text-xs">The default stays the same; the comparison set changes. This label does not mean the top pick changed.</p> : null}
          <p className="text-sm">Tested winners: {[...new Set(report.scenarios.map((s) => s.leanName ?? "No eligible choice"))].join(", ")}. These are conditional model results, not confidence estimates.</p>
          {Array.from(new Map(report.scenarios.filter((s) => s.leanId).map((s) => [s.leanId, s])).values()).map((s) => <p key={s.leanId} className="text-xs">{s.leanName}: {choices.slice(0, 3).some((c) => c.player.player_id === s.leanId) ? "visible in the initial cards" : choices.some((c) => c.player.player_id === s.leanId) ? "hidden on expansion" : "absent from the initial comparison set"}.</p>)}
          <Collapsible><CollapsibleTrigger asChild><Button variant="ghost" size="sm">Stress case details</Button></CollapsibleTrigger><CollapsibleContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Set membership only — present in all six hand-set cases: {report.persistentChoiceNames.join(", ") || "none"}. This does not establish confidence or a large advantage.</p>
          {report.scenarios.map((scenario) => <div key={scenario.assumption} className="border-l-2 pl-3 text-xs">
            <p>{scenario.assumption}</p><p>{scenario.leanName ?? "No choice"} · {scenario.path} · {scenario.change} · Adj lead {score(scenario.adjustedGap)}</p>
            {scenario.addedNames.length || scenario.removedNames.length ? <p className="text-muted-foreground">Added: {scenario.addedNames.join(", ") || "none"}. Removed: {scenario.removedNames.join(", ") || "none"}.</p> : null}
            {scenario.leanId && board.recommendations.some((p) => p.player_id === scenario.leanId) ? <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setComparison(scenario.leanId ?? "")}>Inspect this player on the current board</Button> : null}
          </div>)}
          </CollapsibleContent></Collapsible>
        </div> : <p className="text-xs text-muted-foreground">Insufficient evidence: assumptions have not been tested for this board.</p>}
      </CollapsibleContent>
    </Collapsible>
  </div>;
}

export default function ChoiceComparison({ pickAction }: { pickAction?: DraftPickAction | undefined } = {}) {
  const { recommendationBoard: board, choiceSnapshot: snapshot } = useDraftData();
  if (!board || !snapshot || !board.topRecommendation) return null;
  // Discard notes and manual paths on room/turn/owner changes. Source refreshes
  // retain the manual choice only while it is still eligible. Stress reports
  // require exact snapshot identity. Optional work is explicit and invalidated.
  const key = `${snapshot.draftId}:${snapshot.boardInput.currentPick}:${snapshot.boardInput.userSlot}`;
  return <ChoicePanel key={key} board={board} snapshot={snapshot} pickAction={pickAction} />;
}
