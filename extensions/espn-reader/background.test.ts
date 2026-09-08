import { afterEach, expect, it, vi } from "vitest";
import { EspnRoomSchema } from "../../src/lib/espn/schemas";

afterEach(() => vi.unstubAllGlobals());
it("separates two drafts, rejects foreign and old documents, recovers after worker suspension, and clears closed bindings", async () => {
  vi.resetModules();
  const storage: Record<string, unknown> = {};
  const tabs = new Map<number, { id: number; url: string; status: string }>();
  const instances = new Map<number, string>();
  const id = "a".repeat(32);
  let nextTab = 100;
  let messageListener: (input: unknown, sender: unknown, reply: (value: unknown) => void) => boolean = () => false;
  let removed: (id: number) => void = () => {};
  let updated: (id: number, change: { status: string }) => void = () => {};
  const delivered: unknown[] = [];
  const session = { get: async () => structuredClone(storage), set: async (data: object) => Object.assign(storage, structuredClone(data)) };
  const chromeMock = {
    runtime: { id, getURL: (path: string) => `chrome-extension://${id}/${path}`, onMessage: { addListener: (fn: typeof messageListener) => { messageListener = fn; } } },
    storage: { session },
    tabs: {
      get: async (tab: number) => { const value = tabs.get(tab); if (!value) throw new Error("Missing"); return value; },
      create: async ({ url }: { url: string }) => { const tab = { id: nextTab++, url, status: "complete" }; tabs.set(tab.id, tab); return tab; },
      update: async (tab: number, change: { url: string }) => { tabs.set(tab, { id: tab, status: "complete", url: change.url }); },
      reload: vi.fn(),
      sendMessage: async (tab: number, input: { type: string }) => {
        if (input.type === "source-probe") return { instanceId: instances.get(tab), ready: true };
        if (input.type === "assistant-update") delivered.push({ tab, input });
        return true;
      },
      onRemoved: { addListener: (fn: typeof removed) => { removed = fn; } },
      onUpdated: { addListener: (fn: typeof updated) => { updated = fn; } },
    },
  };
  vi.stubGlobal("chrome", chromeMock);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("No network transport allowed"); }));
  await import("./background");
  const send = (input: unknown, sender: unknown) => new Promise<unknown>(resolve => messageListener(input, sender, resolve));
  const sourceUrl = (league: number) => `https://fantasy.espn.com/football/draft?leagueId=${league}&seasonId=2026&teamId=2`;
  const sourceSender = (tab: number) => ({ id, frameId: 0, url: tabs.get(tab)?.url, tab: { id: tab, index: 0, pinned: false, highlighted: false, active: true, incognito: false, selected: true } });
  const room = (league: number, now = Date.now()) => EspnRoomSchema.parse({ connected: true, updatedAt: now, error: null,
    data: { observedAt: now, leagueId: league, season: 2026, name: `Practice ${league}`, draftType: "SNAKE", practice: true, rankType: "PPR", scoringItems: [], teams: [], players: [] },
    live: { leagueId: league, teamId: 2, state: 3, draftType: 1, limits: [], slots: [], teams: [], picks: [] } });
  for (const tab of [1, 2]) {
    tabs.set(tab, { id: tab, url: sourceUrl(tab), status: "complete" }); instances.set(tab, crypto.randomUUID());
    await send({ type: "open-assistant", tabId: tab }, { id, url: chromeMock.runtime.getURL("popup.html") });
    await send({ type: "source-room", instanceId: instances.get(tab), revision: 1, room: room(tab) }, sourceSender(tab));
  }
  const first = await send({ type: "assistant-ready" }, sourceSender(100));
  const second = await send({ type: "assistant-ready" }, sourceSender(101));
  expect(first).toMatchObject({ room: { data: { leagueId: 1 } } });
  expect(second).toMatchObject({ room: { data: { leagueId: 2 } } });
  const before = structuredClone(storage.pairs);
  for (const sender of [{ ...sourceSender(1), frameId: 1 }, { ...sourceSender(1), url: "https://evil.example/" }, { ...sourceSender(1), id: "other" }]) {
    await send({ type: "source-room", instanceId: instances.get(1), revision: 2, room: room(1) }, sender);
  }
  await send({ type: "source-room", instanceId: instances.get(1), revision: 1, room: room(1) }, sourceSender(1));
  await send({ type: "source-room", instanceId: instances.get(1), revision: 2, room: room(2) }, sourceSender(1));
  await send({ type: "source-room", instanceId: crypto.randomUUID(), revision: 2, room: room(1) }, sourceSender(1));
  expect(storage.pairs).toEqual(before);
  // Reloading the worker must use session storage, not its old globals.
  vi.resetModules(); await import("./background");
  expect(await send({ type: "assistant-ready" }, sourceSender(100))).toEqual(first);
  updated(1, { status: "loading" });
  expect(await send({ type: "assistant-ready" }, sourceSender(100))).toMatchObject({ room: null });
  instances.set(1, crypto.randomUUID());
  await send({ type: "source-room", instanceId: instances.get(1), revision: 1, room: room(1) }, sourceSender(1));
  expect(await send({ type: "assistant-ready" }, sourceSender(100))).toMatchObject({ room: { connected: true } });
  tabs.delete(1); removed(1);
  expect(await send({ type: "assistant-ready" }, sourceSender(100))).toMatchObject({ room: null });
  expect(await send({ type: "assistant-ready" }, sourceSender(101))).toMatchObject({ room: { data: { leagueId: 2 } } });
  await send({ type: "assistant-stop" }, sourceSender(101));
  expect(storage.pairs).toEqual([]);
  expect(delivered.length).toBeGreaterThan(2);
  expect(fetch).not.toHaveBeenCalled();
});
