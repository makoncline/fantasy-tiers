"use client";
import { useEffect, useState } from "react";
import { BrowserDraftSchema, type BrowserDraft } from "./browserTransport";
import { espnRoomStatus } from "./schemas";

const request = (type: "espn-reader-ready" | "espn-reader-stop") => window.postMessage({ type }, location.origin);
export function useBrowserDraft() {
  const [draft, setDraft] = useState<BrowserDraft | null>(null);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== location.origin || event.data?.type !== "espn-reader-update") return;
      const parsed = BrowserDraftSchema.safeParse(event.data.draft);
      if (parsed.success) { setDraft(parsed.data); setNow(Date.now()); }
    };
    window.addEventListener("message", receive);
    request("espn-reader-ready");
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(timer); window.removeEventListener("message", receive); };
  }, []);
  const issue = draft?.room ? espnRoomStatus(draft.room, now) ?? (now - draft.receivedAt > 15000 ? "Reader disconnected. Open ESPN Reader again." : null) : null;
  return { draft, issue, refresh: () => request("espn-reader-ready"), stop: () => {
    setDraft({ room: null, receivedAt: Date.now(), message: "Disconnected. Open ESPN Reader to connect again." });
    request("espn-reader-stop");
  } };
}
