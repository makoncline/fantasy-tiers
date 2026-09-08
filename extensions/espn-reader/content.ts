import { EspnRoomSchema, type EspnRoom } from "../../src/lib/espn/schemas";

const instanceId = crypto.randomUUID();
let revision = 0;
let room: EspnRoom | null = null;
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message?.type === "source-probe") reply({ instanceId, ready: Boolean(room?.live && room.connected) });
  if (message?.type === "source-snapshot" && room) {
    void chrome.runtime.sendMessage({ type: "source-room", instanceId, revision: ++revision, room }).catch(() => {});
    reply(true);
  }
});
window.addEventListener("message", (event: MessageEvent) => {
  if (event.source !== window || event.origin !== "https://fantasy.espn.com" || event.data?.type !== "fantasy-tiers-espn-room") return;
  const parsed = EspnRoomSchema.safeParse(event.data.room);
  if (!parsed.success) return;
  room = parsed.data;
  void chrome.runtime.sendMessage({ type: "source-room", instanceId, revision: ++revision, room }).catch(() => {});
});
