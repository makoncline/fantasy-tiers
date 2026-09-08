import { BrowserDraftSchema, isAssistantUrl } from "../../src/lib/espn/browserTransport";
import { assistantOrigin } from "./config";

function deliver(value: unknown) {
  if (!isAssistantUrl(location.href, assistantOrigin)) return;
  const parsed = BrowserDraftSchema.safeParse(value);
  if (parsed.success) window.postMessage({ type: "espn-reader-update", draft: parsed.data }, assistantOrigin);
}
chrome.runtime.onMessage.addListener((message, sender) => {
  if (sender.id === chrome.runtime.id && message?.type === "assistant-update") deliver(message.draft);
});
window.addEventListener("message", (event: MessageEvent) => {
  if (event.source !== window || event.origin !== assistantOrigin || !isAssistantUrl(location.href, assistantOrigin)) return;
  if (!["espn-reader-ready", "espn-reader-stop"].includes(event.data?.type)) return;
  void chrome.runtime.sendMessage({ type: event.data.type === "espn-reader-stop" ? "assistant-stop" : "assistant-ready" })
    .then(deliver).catch(() => deliver({ room: null, receivedAt: Date.now(), message: "Open ESPN Reader again to connect." }));
});
