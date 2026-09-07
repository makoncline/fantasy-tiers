"use client";
import { DraftEcrValue } from "./DraftEcrValue";
import { ecrToRoundPick } from "@/lib/util";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useDraftData } from "../_contexts/DraftDataContext";

export default function DraftSourceSelector() {
  const { valueSource, setValueSource, sourceComparison, recommendationBoard, draftValueStatus } = useDraftData();
  if (!setValueSource || valueSource === "combined") return null;
  const otherSource = valueSource === "fp" ? "sleeper" : "fp";
  const alternative = sourceComparison?.[otherSource]?.board.topRecommendation;
  const differs = alternative && alternative.player.player_id !== recommendationBoard?.topRecommendation?.player.player_id;
  return <section aria-label="Projection source" className="flex flex-wrap items-center gap-2 text-xs">
    <span className="text-muted-foreground">Projections</span>
    <Button size="sm" variant={valueSource === "sleeper" ? "secondary" : "ghost"} aria-pressed={valueSource === "sleeper"} onClick={() => setValueSource("sleeper")}>Sleeper</Button>
    <Button size="sm" variant={valueSource === "fp" ? "secondary" : "ghost"} aria-pressed={valueSource === "fp"} disabled={!sourceComparison?.fp && valueSource !== "fp"} title={sourceComparison?.problems.join(" ")} onClick={() => setValueSource("fp")}>FantasyPros</Button>
    <span className="text-muted-foreground">{draftValueStatus?.sourceLastModified?.slice(0,10)} · ECR/tiers: FP · K/DST: Sleeper</span>
    {differs ? <span className="capitalize">{otherSource === "fp" ? "FP" : "Sleeper"} prefers {alternative.player.name}</span> : null}
    {!sourceComparison?.fp ? <span role="status" className="text-amber-700 dark:text-amber-300">FP unavailable: {sourceComparison?.problems.join(" ") || "loading projections"}</span> : null}
  </section>;
}

export function PlayerSourceDetails({ playerId }: { playerId: string }) {
  const { sourceComparison, choiceSnapshot, playersAll, league } = useDraftData();
  const player = choiceSnapshot?.boardInput.players.find(p => p.player_id === playerId) ?? playersAll?.find(p => p.player_id === playerId);
  const teams = choiceSnapshot?.boardInput.teams ?? league?.teams;
  const number = (value: number | null | undefined) => value != null && Number.isFinite(value) ? value.toFixed(1) : "—";
  const specialist = ["K", "DEF"].includes(player?.position ?? "");
  return <div><Table aria-label="Source values" className="text-xs tabular-nums">
    <TableHeader><TableRow>{["Source", "PTS", "VAL", "ADJ", "Market"].map(label => <TableHead className="h-8 px-1" key={label}>{label}</TableHead>)}</TableRow></TableHeader>
    <TableBody>{(["sleeper", "fp"] as const).map(source => {
      const value = sourceComparison?.[source]?.values.valuesByPlayerId[playerId];
      const metric = sourceComparison?.[source]?.board.metricsByPlayerId[playerId];
      const adp = player?.sleeper_adp;
      return <TableRow key={source}>
        <TableCell className="px-1 py-2 font-medium">{source === "fp" ? "FantasyPros" : "Sleeper"}</TableCell>
        <TableCell className="px-1 py-2">{number(value?.projectedPoints)}</TableCell>
        <TableCell className="px-1 py-2">{number(value?.value)}</TableCell>
        <TableCell className="px-1 py-2">{number(metric?.recommendationScore)}</TableCell>
        <TableCell className="whitespace-nowrap px-1 py-2">{source === "fp" ? <>ECR <DraftEcrValue rank={player?.fp_rank_ave} /></> : `ADP ${adp != null && adp > 0 && adp < 999 ? ecrToRoundPick(adp, teams) ?? "—" : "—"}`}</TableCell>
      </TableRow>;
    })}</TableBody>
  </Table>{specialist ? <p className="mt-1 text-xs text-muted-foreground">Both sources use Sleeper K/DST projections.</p> : null}</div>;
}
