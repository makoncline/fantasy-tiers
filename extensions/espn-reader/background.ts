import { z } from "zod";
import { BrowserDraftSchema, DraftIdentitySchema, SourceSnapshotSchema, draftIdentity, isAssistantUrl, type BrowserDraft } from "../../src/lib/espn/browserTransport";
import { assistantOrigin } from "./config";

const PairSchema = z.object({
  sourceTab: z.number().int(), assistantTab: z.number().int(), identity: DraftIdentitySchema,
  instanceId: z.string().nullable(), revision: z.number().int(), draft: BrowserDraftSchema,
});
const PairsSchema = z.array(PairSchema).max(4);
const ProbeSchema = z.object({ instanceId: z.string().uuid(), ready: z.boolean() });
type Pair = z.infer<typeof PairSchema>;
const disconnected = (message: string): BrowserDraft => ({ room: null, receivedAt: Date.now(), message });
async function readPairs() {
  const parsed = PairsSchema.safeParse((await chrome.storage.session.get("pairs")).pairs ?? []);
  return parsed.success ? parsed.data : [];
}
async function save(pairs: Pair[]) { await chrome.storage.session.set({ pairs }); }
async function deliver(pair: Pair) {
  const tab = await chrome.tabs.get(pair.assistantTab).catch(() => null);
  if (tab && isAssistantUrl(tab.url, assistantOrigin)) {
    await chrome.tabs.sendMessage(pair.assistantTab, { type: "assistant-update", draft: pair.draft }, { frameId: 0 }).catch(() => {});
  }
}
const sameIdentity = (a: z.infer<typeof DraftIdentitySchema>, b: z.infer<typeof DraftIdentitySchema>) => a.leagueId === b.leagueId && a.season === b.season && a.teamId === b.teamId;

async function openAssistant(tabId: number) {
  const source = await chrome.tabs.get(tabId);
  const identity = draftIdentity(source.url);
  if (!identity) throw new Error("Open your ESPN draft, then click Open assistant.");
  let pairs = await readPairs();
  // Drop closed pairs before applying the bounded session limit.
  const tabs = await Promise.all(pairs.map(pair => chrome.tabs.get(pair.assistantTab).catch(() => null)));
  pairs = pairs.filter((_pair, index) => tabs[index] != null);
  let pair = pairs.find(item => item.sourceTab === tabId && sameIdentity(item.identity, identity));
  const probe = ProbeSchema.safeParse(await chrome.tabs.sendMessage(tabId, { type: "source-probe" }, { frameId: 0 }).catch(() => null));
  if (!pair) {
    for (const old of pairs.filter(item => item.sourceTab === tabId)) {
      old.draft = disconnected("Draft changed. Open ESPN Reader to connect."); await deliver(old);
    }
    pairs = pairs.filter(item => item.sourceTab !== tabId);
    if (pairs.length >= 4) throw new Error("Close an assistant tab, then try again.");
    // Store the binding before loading the assistant's content script.
    const assistant = await chrome.tabs.create({ url: "about:blank" });
    if (assistant.id == null) throw new Error("Could not open the assistant.");
    pair = { sourceTab: tabId, assistantTab: assistant.id, identity, instanceId: null, revision: 0, draft: disconnected("Connecting… Keep ESPN open.") };
    pairs.push(pair);
  }
  await save(pairs);
  if (!probe.success || !probe.data.ready) await chrome.tabs.reload(tabId);
  else await chrome.tabs.sendMessage(tabId, { type: "source-snapshot" }, { frameId: 0 }).catch(() => {});
  await chrome.tabs.update(pair.assistantTab, { url: `${assistantOrigin}/espn-draft`, active: true });
  await chrome.storage.session.set({ status: "Connecting…" });
}

async function handle(input: unknown, sender: chrome.runtime.MessageSender): Promise<BrowserDraft | null> {
  const message = z.object({ type: z.string(), tabId: z.number().int().optional() }).safeParse(input);
  if (!message.success || sender.id !== chrome.runtime.id) return null;
  if (message.data.type === "open-assistant" && sender.url === chrome.runtime.getURL("popup.html")) {
    if (message.data.tabId != null) await openAssistant(message.data.tabId);
    return null;
  }
  if (sender.frameId !== 0 || sender.tab?.id == null) return null;
  const tabId = sender.tab.id;
  const current = await chrome.tabs.get(tabId).catch(() => null);
  if (!current) return null;
  const pairs = await readPairs();
  if (["assistant-ready", "assistant-stop"].includes(message.data.type)) {
    if (!isAssistantUrl(sender.url, assistantOrigin) || !isAssistantUrl(current.url, assistantOrigin)) return null;
    const pair = pairs.find(item => item.assistantTab === tabId);
    if (!pair) return disconnected("Open ESPN Reader in your draft tab.");
    if (message.data.type === "assistant-stop") {
      await save(pairs.filter(item => item !== pair));
      return disconnected("Disconnected. Open ESPN Reader to connect again.");
    }
    const source = await chrome.tabs.get(pair.sourceTab).catch(() => null);
    const identity = draftIdentity(source?.url);
    const probe = ProbeSchema.safeParse(await chrome.tabs.sendMessage(pair.sourceTab, { type: "source-probe" }, { frameId: 0 }).catch(() => null));
    if (!identity || !sameIdentity(identity, pair.identity) || !probe.success || !probe.data.ready || probe.data.instanceId !== pair.instanceId) {
      pair.draft = disconnected("Connecting… Keep your ESPN draft open."); await save(pairs);
    }
    await chrome.tabs.sendMessage(pair.sourceTab, { type: "source-snapshot" }, { frameId: 0 }).catch(() => {});
    return pair.draft;
  }
  const identity = draftIdentity(sender.url), currentIdentity = draftIdentity(current.url);
  const parsed = SourceSnapshotSchema.safeParse(input);
  if (current.status !== "complete" || !identity || !currentIdentity || !sameIdentity(identity, currentIdentity) || !parsed.success) return null;
  const pair = pairs.find(item => item.sourceTab === tabId && sameIdentity(item.identity, identity));
  if (!pair) return null;
  const snapshot = parsed.data;
  const probe = ProbeSchema.safeParse(await chrome.tabs.sendMessage(tabId, { type: "source-probe" }, { frameId: 0 }).catch(() => null));
  if (!probe.success || probe.data.instanceId !== snapshot.instanceId) return null;
  if (pair.instanceId === snapshot.instanceId && (snapshot.revision <= pair.revision || snapshot.room.updatedAt < (pair.draft.room?.updatedAt ?? 0))) return null;
  const { room } = snapshot;
  if ((room.data && (room.data.leagueId !== identity.leagueId || room.data.season !== identity.season)) || (room.live && (room.live.leagueId !== identity.leagueId || room.live.teamId !== identity.teamId))) return null;
  if (room.updatedAt > Date.now() + 30000 || JSON.stringify(room).length > 1_000_000) return null;
  pair.instanceId = snapshot.instanceId; pair.revision = snapshot.revision;
  pair.draft = { room, receivedAt: Date.now(), message: null };
  await save(pairs); await deliver(pair);
  await chrome.storage.session.set({ status: room.connected ? "Connected" : "ESPN disconnected. Reopen the draft." });
  return null;
}

// Serialize storage changes so concurrent tab events cannot overwrite other pairs.
let pending = Promise.resolve();
function enqueue(work: () => Promise<void>) {
  pending = pending.then(work).catch(async () => { await chrome.storage.session.set({ status: "Open ESPN Reader again to retry." }); });
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  enqueue(async () => {
    try { reply(await handle(message, sender)); }
    catch (error) { await chrome.storage.session.set({ status: error instanceof Error ? error.message : "Could not connect." }); reply(null); }
  });
  return true;
});
chrome.tabs.onRemoved.addListener(tabId => enqueue(async () => {
  const pairs = await readPairs();
  for (const pair of pairs.filter(item => item.sourceTab === tabId)) { pair.draft = disconnected("ESPN tab closed. Reopen your draft and ESPN Reader."); await deliver(pair); }
  await save(pairs.filter(item => item.sourceTab !== tabId && item.assistantTab !== tabId));
}));
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status !== "loading" && !change.url) return;
  enqueue(async () => {
    const pairs = await readPairs();
    for (const pair of pairs.filter(item => item.sourceTab === tabId)) {
      pair.instanceId = null; pair.revision = 0; pair.draft = disconnected("Connecting… Keep ESPN open."); await deliver(pair);
    }
    await save(pairs);
  });
});
