"use client";

import {
  createDraftSourceSnapshotFromSignature,
  serializePlayerPoolIds,
  type DraftSourceSnapshot,
} from "@/lib/draftDecisionLog";
import type { AggregatesBundleResponseT } from "@/lib/schemas-bundle";
import type { SimDraftPlayer } from "@/lib/simDraft";

export async function createDraftSourceSnapshot(input: {
  bundle: AggregatesBundleResponseT;
  players: readonly SimDraftPlayer[];
}): Promise<DraftSourceSnapshot> {
  return createDraftSourceSnapshotFromSignature(
    input,
    await createPlayerPoolSignature(input.players)
  );
}

export async function createPlayerPoolSignature(
  players: readonly { player_id: string }[]
) {
  const bytes = new TextEncoder().encode(serializePlayerPoolIds(players));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}
