"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useDraftData } from "../_contexts/DraftDataContext";
import { buildDraftChoices, choiceRosterFit, choiceContributionDifference, CHOICE_COMPONENT_LABELS, type DraftChoice } from "@/lib/draftChoices";
import { analyzeDraftChoiceSensitivity, type DraftChoiceSensitivity } from "@/lib/draftChoiceSensitivity";
import { getNextPickForSlot } from "@/lib/draftValue";

const score = (n: number | null | undefined) => n == null ? "—" : n.toFixed(1);
const noteSchema = z.object({ note: z.string().trim().max(400) });

function JudgmentNote({ saved, onSave }: { saved: string; onSave: (note: string) => void }) {
  const form = useForm<z.infer<typeof noteSchema>>({ resolver: zodResolver(noteSchema), defaultValues: { note: "" } });
  return <Form {...form}>
    <form className="flex flex-col gap-2" onSubmit={form.handleSubmit(({ note }) => onSave(note))}>
      <FormField control={form.control} name="note" render={({ field }) => <FormItem>
        <FormLabel>Personal judgment for this pick</FormLabel>
        <FormControl><Textarea {...field} rows={2} placeholder="Example: I expect a larger receiving role than consensus." /></FormControl>
        <FormMessage />
      </FormItem>} />
      <p className="text-xs text-muted-foreground">Your note does not change scores. It stays here until the pick changes or you reload. Save comparison evidence to keep a copy.</p>
      <Button type="submit" variant="outline" size="sm" className="w-fit">Keep note for this pick</Button>
      {saved ? <p className="text-sm">Personal judgment: {saved}</p> : null}
    </form>
  </Form>;
}

function ChoiceCard({ choice, lean, primary }: { choice: DraftChoice; lean: DraftChoice; primary: boolean }) {
  const { choiceSnapshot, recommendationBoard } = useDraftData();
  if (!choiceSnapshot || !recommendationBoard) return null;
  const { player, metrics } = choice;
  const fit = choiceRosterFit(player, choiceSnapshot.boardInput.userPositionNeeds);
  const value = choiceSnapshot.values.valuesByPlayerId[player.player_id];
  const differences = choiceContributionDifference(lean.metrics, metrics);
  const baseDifference = (metrics.staticValue ?? 0) - (lean.metrics.staticValue ?? 0);
  const input = choiceSnapshot.boardInput;
  const future = getNextPickForSlot({ ...input, currentPick: input.currentPick + 1 });
  return <Card className={primary ? "border-primary/50 bg-primary/5 shadow-none" : "shadow-none"} data-testid="decision-recommendation-card">
    <CardHeader className="p-3 pb-2">
      <CardDescription>{primary ? "Current lean" : "Alternative to review"}</CardDescription>
      <CardTitle className="text-base">{player.name} <span className="text-muted-foreground">{player.position}</span></CardTitle>
    </CardHeader>
    <CardContent className="flex flex-col gap-3 p-3 pt-0 text-sm">
      <div className="flex flex-wrap gap-2 tabular-nums">
        <Badge variant="outline" title="ECR-calibrated value estimate">Val {score(metrics.staticValue)}</Badge>
        <Badge variant="outline" title="Adjusted model score; not fantasy points">Adj {score(metrics.recommendationScore)}</Badge>
        {player.team ? <Badge variant="outline">{player.team}{player.bye_week ? ` · Bye ${player.bye_week}` : ""}</Badge> : null}
        {metrics.availability.classification !== "healthy" ? <Badge variant="secondary" title={metrics.availability.detail}>{metrics.availability.label}</Badge> : null}
      </div>
      <p>{choice.reason}.</p>
      {primary ? <p data-testid="decision-recommendation-summary"><strong>Why it leads:</strong> Base value contributes {score(metrics.components.value)} to Adj. Largest context contributions: {metrics.topComponents.filter((c) => c.key !== "value").slice(0, 2).map((c) => `${CHOICE_COMPONENT_LABELS[c.key]} ${score(c.value)}`).join(", ") || "none"}.</p> : null}
      <p><strong>Roster:</strong> Fits {fit.slot === "BN" ? "the bench" : fit.slot}. {fit.remaining}</p>
      {!primary ? <p><strong>Trade-off:</strong> {baseDifference >= 0 ? "+" : ""}{score(baseDifference)} base value;
        {" "}{score(lean.metrics.recommendationScore - metrics.recommendationScore)} lower adjusted score.</p> : null}
      <p><strong>Waiting:</strong> {future == null ? "No later own pick. Timing does not affect this choice."
        : future === input.currentPick + 1 ? "No opponent picks before your next turn. Other available players stay on the board."
        : metrics.comebackLabel === "unknown" ? "Return estimate unavailable."
        : `${metrics.comebackLabel === "likely" ? "May return" : metrics.comebackLabel === "unlikely" ? "May be gone" : "Uncertain return"} at pick ${future}. Current ADP heuristic; not a validated forecast.`}</p>
      <Collapsible>
        <CollapsibleTrigger asChild><Button variant="ghost" size="sm">Value and adjustment details</Button></CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-2 pt-2">
          <p className="text-xs text-muted-foreground">Val is an ECR-calibrated value estimate. Custom scoring shapes positional curves; it does not preserve each player’s stat profile in Val.</p>
          <p>Original league-scored Sleeper projection: {score(value?.rawProjectedPoints)} points.</p>
          <p>ECR-assigned projection: {score(value?.projectedPoints)} points.</p>
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs tabular-nums">
            {Object.entries(CHOICE_COMPONENT_LABELS).map(([key, label]) => <div className="contents" key={key}>
              <dt>{label}</dt><dd>{score(Object.entries(metrics.components).find(([k]) => k === key)?.[1])}</dd>
            </div>)}
          </dl>
          {!primary ? <p className="text-xs">Largest contributions favoring the current lean: {differences.filter((d) => d.value > 0).slice(0, 2).map((d) => `${d.label} +${score(d.value)}`).join(", ") || "none"}. These are differences in adjusted-score units.</p> : null}
          {metrics.recommendationExplanation.dataQuality.map((text) => <p className="text-xs" key={text}>{text}</p>)}
        </CollapsibleContent>
      </Collapsible>
    </CardContent>
  </Card>;
}

export default function ChoiceComparison() {
  const { recommendationBoard: board, choiceSnapshot: snapshot } = useDraftData();
  const choices = useMemo(() => board ? buildDraftChoices(board) : [], [board]);
  const [comparison, setComparison] = useState("");
  const [judgment, setJudgment] = useState({ key: "", note: "" });
  const [stress, setStress] = useState<{ snapshot: typeof snapshot; report: DraftChoiceSensitivity } | null>(null);
  if (!board || !snapshot || !choices[0]) return null;
  const lean = choices[0];
  const pickKey = `${snapshot.draftId}-${snapshot.boardInput.currentPick}-${snapshot.boardInput.userSlot}`;
  const note = judgment.key === pickKey ? judgment.note : "";
  const custom = board.recommendations.find((p) => p.player_id === comparison);
  const display = choices.slice(0, 3);
  if (custom && !display.some((c) => c.player.player_id === comparison)) {
    const metrics = board.metricsByPlayerId[custom.player_id];
    if (metrics) display.push({ player: custom, metrics, reason: "Selected by you for comparison; not a claim of equal value" });
  }
  const higherValue = choices.find((c) => (c.metrics.staticValue ?? -Infinity) > (lean.metrics.staticValue ?? -Infinity));
  const contributions = higherValue ? choiceContributionDifference(lean.metrics, higherValue.metrics).filter((d) => d.key !== "value" && d.value > 0).slice(0, 2) : [];
  const report = stress?.snapshot === snapshot ? stress.report : null;
  return <div className="flex flex-col gap-3" data-testid="choice-comparison">
    <p className="text-sm text-muted-foreground">A default pick, with alternatives worth reviewing. Tier matches help select comparisons; they do not prove equal value.</p>
    {higherValue ? <Alert><AlertTitle>Context reverses the base-value order</AlertTitle>
      <AlertDescription>The current lean gives up {score((higherValue.metrics.staticValue ?? 0) - (lean.metrics.staticValue ?? 0))} Val compared with {higherValue.player.name}. The main adjustment differences are {contributions.map((c) => `${c.label} +${score(c.value)}`).join(" and ") || "shown in the details"}. This is a reason to review the choice, not a rule to reject it.</AlertDescription>
    </Alert> : null}
    <div className="grid gap-3 xl:grid-cols-3">{display.map((choice) => <ChoiceCard key={choice.player.player_id} choice={choice} lean={lean} primary={choice === lean} />)}</div>
    <Collapsible>
      <CollapsibleTrigger asChild><Button variant="outline" size="sm">More comparisons and personal judgment</Button></CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-3 pt-3">
        {choices.length > 3 ? <p className="text-sm">Other candidates from the comparison rules: {choices.slice(3).map((c) => c.player.name).join(", ")}.</p> : null}
        <Select value={comparison} onValueChange={setComparison}>
          <SelectTrigger className="max-w-md" aria-label="Select a player to compare"><SelectValue placeholder="Compare any eligible player" /></SelectTrigger>
          <SelectContent>{board.recommendations.map((p) => <SelectItem key={p.player_id} value={p.player_id}>{p.name} · {p.position}</SelectItem>)}</SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">The list follows current eligibility and owner policy, including the one-QB and one-TE limits.</p>
        <JudgmentNote key={pickKey} saved={note} onSave={(note) => setJudgment({ key: pickKey, note })} />
      </CollapsibleContent>
    </Collapsible>
    <div className="flex flex-col items-start gap-2 border-t pt-3">
      <Button variant="outline" size="sm" onClick={() => setStress({ snapshot, report: analyzeDraftChoiceSensitivity(snapshot) })}>Test assumptions for this pick</Button>
      <Button variant="ghost" size="sm" onClick={() => {
        const url = URL.createObjectURL(new Blob([JSON.stringify({
          capturedAt: new Date().toISOString(), snapshot, choices: display, sensitivity: report,
          personalJudgment: note,
          scoring: "Unchanged canonical recommendation; advisory comparison only",
        }, null, 2)], { type: "application/json" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = `draft-choice-pick-${snapshot.boardInput.currentPick}.json`;
        link.click();
        URL.revokeObjectURL(url);
      }}>Save comparison evidence</Button>
      <p className="text-xs text-muted-foreground">Six hand-set stress cases. No probabilities, forecast confidence, or change to active selections.</p>
      {report ? <div className="flex w-full flex-col gap-2" data-testid="choice-sensitivity">
        <p className="font-medium">{report.status}</p>
        <p className="text-sm">Present in every tested choice set: {report.persistentChoiceNames.join(", ") || "none"}. Stability does not show how large or reliable an advantage is.</p>
        {report.scenarios.map((scenario) => <div key={scenario.assumption} className="border-l-2 pl-3 text-sm">
          <p>{scenario.assumption}</p>
          <p>{scenario.leanName ?? "No choice"} · {scenario.path} · {scenario.change} · Adj lead {score(scenario.adjustedGap)}</p>
          {scenario.addedNames.length || scenario.removedNames.length ? <p className="text-xs text-muted-foreground">Set added: {scenario.addedNames.join(", ") || "none"}. Removed: {scenario.removedNames.join(", ") || "none"}.</p> : null}
        </div>)}
        <p className="text-xs text-muted-foreground">A changed roster path needs review. It is not, by itself, a worse choice. These cases do not test alternate projection providers or a validated opponent model.</p>
      </div> : <p className="text-xs text-muted-foreground">Insufficient evidence: assumptions have not been tested for this board.</p>}
    </div>
  </div>;
}
