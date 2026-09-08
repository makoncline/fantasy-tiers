"use client";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useBrowserDraft } from "@/lib/espn/useBrowserDraft";

const EspnAssistant = dynamic(() => import("./EspnAssistant").then(module => module.EspnAssistant));
export default function EspnDraftRoom() {
  const { draft, issue, refresh, stop } = useBrowserDraft();
  const room = draft?.room;
  return <main className="group/draft space-y-5 p-4 md:p-6">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-4 md:group-has-[[data-state=expanded][data-variant=floating]]/draft:ml-64">
      <div><p className="text-sm text-muted-foreground">Fantasy Tiers · ESPN</p><h1 className="text-2xl font-semibold">ESPN Draft Assistant</h1></div><Badge variant="outline">Read only</Badge>
    </header>
    <div className="flex flex-wrap items-center gap-3 md:group-has-[[data-state=expanded][data-variant=floating]]/draft:ml-64">
      <Badge variant={issue ? "destructive" : "outline"}>{issue ? "Updates stopped" : room?.live ? "Connected" : "Not connected"}</Badge>
      {room?.live && <><span className="text-sm">{room.data?.name} · Team {room.live.teamId} · {room.live.picks.filter(pick => pick.playerId !== -1).length} picks</span><Button variant="outline" onClick={stop}>Disconnect</Button></>}
    </div>
    {room?.live && <p className="text-sm text-muted-foreground md:group-has-[[data-state=expanded][data-variant=floating]]/draft:ml-64">D/ST and kicker ranks use standard Sleeper scoring as a reference. ESPN scoring can differ.</p>}
    {issue ? <Alert variant="destructive"><AlertTitle>Recommendations stopped</AlertTitle><AlertDescription>{issue}</AlertDescription><Button variant="outline" onClick={refresh}>Check again</Button></Alert>
      : room?.live && room.data ? <EspnAssistant room={room} checkedAt={draft?.receivedAt ?? 0} refreshRoom={refresh} />
      : <section className="max-w-2xl space-y-3"><h2 className="text-xl font-medium">Open ESPN Reader in your draft tab</h2><p>{draft?.message ?? "Click Open assistant. Keep both tabs open in this Chrome profile."}</p><Button asChild variant="outline"><a href="/espn-reader-install.html">Install ESPN Reader</a></Button></section>}
  </main>;
}
