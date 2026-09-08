import { applyEspnMessage } from "../../src/lib/espn/protocol";
import { normalizeEspnDraftData } from "../../src/lib/espn/draftData";
import { EspnRoomSchema, type EspnRoom } from "../../src/lib/espn/schemas";

// Runs before ESPN creates its socket. Observe the existing connection only.
const room: EspnRoom = { connected: false, updatedAt: 0, error: null, data: null, live: null };
const nativeFetch = window.fetch.bind(window);
let activeSocket: WebSocket | null = null;
let loading = false;

async function loadData() {
  if (loading || room.data) return;
  const params = new URL(location.href).searchParams;
  const leagueId = Number(params.get("leagueId")), season = Number(params.get("seasonId"));
  if (!Number.isInteger(leagueId) || leagueId <= 0 || season < 2020) return;
  loading = true;
  try {
    const query = new URLSearchParams({ filter: JSON.stringify({ players: { filterStatsForContainerIds: { value: [`00${season - 1}`, `10${season}`] } } }) });
    query.append("view", "draftInit"); query.append("view", "mSettings");
    const response = await nativeFetch(`https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}?${query}`, { credentials: "include", cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Draft data unavailable");
    room.data = normalizeEspnDraftData(await response.json(), leagueId, season);
    room.error = null;
  } catch { room.error = "Could not read ESPN settings. Reload the ESPN draft tab."; }
  finally { loading = false; }
}

const NativeSocket = window.WebSocket;
window.WebSocket = new Proxy(NativeSocket, {
  construct(target, args: ConstructorParameters<typeof WebSocket>) {
    const socket = new target(...args);
    const url = new URL(String(args[0]), location.href);
    if (url.hostname !== "fantasydraft.espn.com") return socket;
    activeSocket = socket;
    room.live = null; room.connected = false; room.error = null;
    socket.addEventListener("open", () => { if (activeSocket === socket) { room.connected = true; void loadData(); } });
    socket.addEventListener("message", (event) => {
      if (activeSocket !== socket || typeof event.data !== "string") return;
      room.updatedAt = Date.now();
      const command = event.data.split(" ", 1)[0]?.trim();
      // Never forward raw frames, tokens, member identifiers, queues, or chat.
      if (!["INIT", "STATE", "SELECTED", "UNDONE", "RESET"].includes(command ?? "")) return;
      try {
        room.live = applyEspnMessage(room.live, event.data);
        if (command === "INIT") { room.error = null; void loadData(); }
        if (command === "RESET") room.error = "Draft reset. Reload the ESPN draft tab.";
      } catch { room.error = "ESPN draft state changed. Reload the ESPN draft tab."; }
    });
    const closed = () => { if (activeSocket === socket) { room.connected = false; room.updatedAt = Date.now(); } };
    socket.addEventListener("close", closed);
    socket.addEventListener("error", closed);
    return socket;
  },
});

setInterval(() => {
  room.connected = activeSocket?.readyState === NativeSocket.OPEN;
  // A quiet draft is healthy while ESPN keeps its own socket open.
  room.updatedAt = Date.now();
  if (room.connected && !room.data) void loadData();
  const parsed = EspnRoomSchema.safeParse(room);
  if (parsed.success) window.postMessage({ type: "fantasy-tiers-espn-room", room: parsed.data }, location.origin);
}, 2000);
