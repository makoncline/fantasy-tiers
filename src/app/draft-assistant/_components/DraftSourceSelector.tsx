"use client";
import { useIsFetching } from "@tanstack/react-query";
import { qk } from "@/lib/queryKeys";
import { DraftEcrValue } from "./DraftEcrValue";
import { ecrToRoundPick } from "@/lib/util";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useDraftData } from "../_contexts/DraftDataContext";

export default function DraftSourceSelector() {
  const loadingSource = useIsFetching({ queryKey: qk.draft.projectionSource }) > 0;
  const { valueSource, setValueSource, sourceComparison, draftValueStatus } = useDraftData();
  if (!setValueSource || valueSource === "combined") return null;
  return <section aria-label="Projection source" className="flex flex-wrap items-center gap-2 text-xs">
    <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Projection source">
    <Button size="sm" variant={valueSource === "sleeper" ? "secondary" : "ghost"} aria-pressed={valueSource === "sleeper"} onClick={() => setValueSource("sleeper")}>Sleeper</Button>
    <Button size="sm" variant={valueSource === "fp" ? "secondary" : "ghost"} aria-pressed={valueSource === "fp"} disabled={!sourceComparison?.fp && valueSource !== "fp"} title={sourceComparison?.problems.join(" ")} onClick={() => setValueSource("fp")}>FantasyPros</Button>
    </div>
    <span className="text-muted-foreground">{draftValueStatus?.sourceLastModified?.slice(0,10)}</span>
    <details className="text-muted-foreground"><summary className="cursor-pointer">Source details</summary><p>ECR and tiers: FantasyPros. K and D/ST projections: Sleeper.</p>{sourceComparison?.problems.map(problem => <p key={problem}>{problem}</p>)}</details>
    {!sourceComparison || (!sourceComparison.fp && loadingSource) ? <span role="status">Loading projections…</span> : !sourceComparison.fp ? <span role="status" className="text-amber-700 dark:text-amber-300">FP unavailable — see source details.</span> : null}
  </section>;
}

export function PlayerSourceDetails({ playerId }: { playerId: string }) {
  const { sourceComparison, choiceSnapshot, playersAll, league, valueSource } = useDraftData();
  const player = choiceSnapshot?.boardInput.players.find(p => p.player_id === playerId) ?? playersAll?.find(p => p.player_id === playerId);
  const teams = choiceSnapshot?.boardInput.teams ?? league?.teams;
  const number = (value: number | null | undefined) => value != null && Number.isFinite(value) ? value.toFixed(1) : "—";
  const specialist = ["K", "DEF"].includes(player?.position ?? "");
  return <div><Table aria-label="Source values" className="text-xs tabular-nums">
    <TableHeader><TableRow>{["Source", "PTS", "VAL", "ADJ", "Market"].map(label => <TableHead className={label === "Source" ? "h-8 px-1" : "h-8 px-1 text-right"} key={label}>{label}</TableHead>)}</TableRow></TableHeader>
    <TableBody>{(["sleeper", "fp"] as const).map(source => {
      const value = sourceComparison?.[source]?.values.valuesByPlayerId[playerId];
      const metric = sourceComparison?.[source]?.board.metricsByPlayerId[playerId];
      const adp = player?.sleeper_adp;
      return <TableRow key={source} className={valueSource === source ? "bg-primary/10" : undefined}>
        <TableCell className="px-1 py-2 font-medium">{source === "fp" ? "FantasyPros" : "Sleeper"}{valueSource === source ? <span className="sr-only"> (selected)</span> : null}</TableCell>
        <TableCell className="px-1 py-2 text-right">{number(value?.projectedPoints)}</TableCell>
        <TableCell className="px-1 py-2 text-right">{number(value?.value)}</TableCell>
        <TableCell className="px-1 py-2 text-right">{number(metric?.recommendationScore)}</TableCell>
        <TableCell className="whitespace-nowrap px-1 py-2 text-right">{source === "fp" ? <>ECR <DraftEcrValue rank={player?.fp_rank_ave} /></> : `ADP ${adp != null && adp > 0 && adp < 999 ? ecrToRoundPick(adp, teams) ?? "—" : "—"}`}</TableCell>
      </TableRow>;
    })}</TableBody>
  </Table>{specialist ? <p className="mt-1 text-xs text-muted-foreground">Both sources use Sleeper K and D/ST projections.</p> : null}</div>;
}
