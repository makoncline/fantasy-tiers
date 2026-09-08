// ESPN's versioned, big-endian INIT format, verified against the 2026 mock HAR.
// This module is shared by the direct browser stream and HAR replay.
class Reader {
  private offset = 0;
  private view: DataView;
  constructor(encoded: string) {
    const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
    this.view = new DataView(bytes.buffer);
  }
  skip(size: number) {
    if (size < 0 || this.offset + size > this.view.byteLength) throw new Error("Truncated ESPN INIT");
    this.offset += size;
  }
  int() { const n = this.view.getInt32(this.offset); this.skip(4); return n; }
  bool() { const n = this.view.getUint8(this.offset); this.skip(1); if (n > 1) throw new Error("Invalid ESPN boolean"); return n === 1; }
  object<T>(version: number, read: () => T): T | null {
    const present = this.int();
    if (present === 0) return null;
    if (present !== 1 || this.int() !== version) throw new Error("Unsupported ESPN INIT version");
    return read();
  }
  list<T>(read: () => T): T[] {
    const size = this.int();
    if (size < 0 || size > 10000) throw new Error("Invalid ESPN array size");
    return Array.from({ length: size }, read);
  }
}

export function decodeEspnInit(encoded: string) {
  const r = new Reader(encoded);
  const result = r.object(1, () => {
    const leagueId = r.int();
    const teamId = r.int();
    const league = r.object(1, () => {
      if (r.int() !== leagueId) throw new Error("ESPN league mismatch");
      const draftType = r.int();
      r.int(); // universe
      if (r.int() !== 0) r.skip(8); // date
      const state = r.int();
      r.object(1, () => {
        r.int();
        const state = r.int();
        if (r.int() !== 0) r.skip(8);
        r.skip(20);
        return { state };
      });
      r.object(2, () => {
        r.skip(20);
        r.object(1, () => r.skip(12)); // break schedule
        r.object(1, () => r.skip(12)); // auto-draft protection
        r.skip(16 + 32 + 4);
        r.bool();
        r.skip(12);
        r.bool(); r.bool();
        r.object(1, () => {
          r.skip(8);
          r.list(() => r.object(3, () => { r.skip(16); r.bool(); }));
        });
        r.bool();
      });
      const limits = r.list(() => r.object(1, () => {
        r.int(); return { positionId: r.int(), maximum: r.int() };
      })).filter((v) => v !== null);
      const slots = r.list(() => r.object(1, () => {
        r.int(); const id = r.int(); const category = r.int();
        const positions = r.list(() => r.object(1, () => { r.skip(8); return r.int(); })).filter((v) => v !== null);
        return { id, category, positions };
      })).filter((v) => v !== null);
      const picks = r.list(() => r.object(3, () => {
        r.int(); const teamId = r.int(); const pickNumber = r.int(); const playerId = r.int(); const slotId = r.int();
        r.skip(8); const keeper = r.bool(); r.skip(8);
        return { teamId, pickNumber, playerId, slotId, keeper };
      })).filter((v) => v !== null);
      const teams = r.list(() => r.object(2, () => {
        r.int(); const id = r.int(); const draftPosition = r.int(); r.skip(8);
        // Owner identifiers are deliberately discarded.
        r.list(() => r.object(1, () => { r.skip(12); r.bool(); r.bool(); r.bool(); }));
        r.list(() => r.object(1, () => { r.skip(16); r.bool(); }));
        return { id, draftPosition };
      })).filter((v) => v !== null);
      return { state, draftType, limits, slots, picks, teams };
    });
    if (!league) throw new Error("Missing ESPN league state");
    // Remaining INIT fields are private queues and nomination lists. Do not read them.
    return { leagueId, teamId, ...league };
  });
  if (!result) throw new Error("Missing ESPN INIT");
  return result;
}

export type EspnLiveState = ReturnType<typeof decodeEspnInit>;

export function applyEspnMessage(state: EspnLiveState | null, message: string): EspnLiveState | null {
  const [command, ...args] = message.trim().split(/\s+/);
  if (command === "INIT") return decodeEspnInit(args[0] ?? "");
  if (!state) return null;
  const number = (index: number) => {
    if (!/^-?\d+$/.test(args[index] ?? "")) throw new Error("Invalid ESPN message");
    return Number(args[index]);
  };
  if (command === "STATE") return { ...state, state: number(0) };
  if (command === "SELECTED") {
    const teamId = number(0), playerId = number(1), slotId = number(2);
    if (state.picks.some((p) => p.playerId === playerId)) return state;
    const next = state.picks.find((p) => p.playerId === -1);
    if (!next || next.teamId !== teamId) throw new Error("ESPN pick order changed. Reload the ESPN draft.");
    return { ...state, picks: state.picks.map((p) => p.pickNumber === next.pickNumber ? { ...p, playerId, slotId } : p) };
  }
  if (command === "UNDONE") {
    // UNDONE uses a zero-based index; INIT pick numbers are one-based.
    const pickNumber = number(0) + 1;
    return { ...state, picks: state.picks.map((p) => p.pickNumber >= pickNumber ? { ...p, playerId: -1, slotId: 0 } : p) };
  }
  if (command === "RESET") return null;
  return state;
}
