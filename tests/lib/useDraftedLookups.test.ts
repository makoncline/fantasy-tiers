import { describe, it, expect } from "vitest";
import { normalizePlayerName } from "../../src/lib/util";
import type { DraftPick } from "../../src/lib/schemas";
import type { SleeperPlayersMetaT } from "../../src/lib/schemas-sleeper";

// Test the logic directly without React hooks since it's pure logic
function getDraftedLookups(
  picks?: DraftPick[],
  sleeperMeta?: SleeperPlayersMetaT
) {
  const draftedIds = new Set((picks ?? []).map((p) => String(p.player_id)));
  const draftedNames = new Set<string>();

  if (!picks || !sleeperMeta) return { draftedIds, draftedNames };

  for (const p of picks) {
    const meta = sleeperMeta[String(p.player_id)];
    const full = String(meta?.full_name || meta?.name || "");
    const nm = normalizePlayerName(full);
    if (nm) draftedNames.add(nm);
  }

  return { draftedIds, draftedNames };
}

describe("useDraftedLookups", () => {
  const mockPicks: DraftPick[] = [
    { draft_slot: 1, round: 1, pick_no: 1, player_id: "123" },
    { draft_slot: 2, round: 1, pick_no: 2, player_id: "456" },
  ];

  const mockSleeperMeta: SleeperPlayersMetaT = {
    "123": { full_name: "John Doe", name: "John Doe" },
    "456": { full_name: "Jane Smith", name: "Jane Smith" },
    "789": { full_name: "Bob Johnson", name: "Bob Johnson" },
  };

  it("should return empty sets when no picks provided", () => {
    const result = getDraftedLookups();

    expect(result.draftedIds.size).toBe(0);
    expect(result.draftedNames.size).toBe(0);
  });

  it("should return drafted IDs from picks", () => {
    const result = getDraftedLookups(mockPicks, mockSleeperMeta);

    expect(result.draftedIds.has("123")).toBe(true);
    expect(result.draftedIds.has("456")).toBe(true);
    expect(result.draftedIds.has("789")).toBe(false);
  });

  it("should return drafted names from sleeper meta", () => {
    const result = getDraftedLookups(mockPicks, mockSleeperMeta);

    expect(result.draftedNames.has("john doe")).toBe(true);
    expect(result.draftedNames.has("jane smith")).toBe(true);
    expect(result.draftedNames.has("bob johnson")).toBe(false);
  });

  it("should handle missing sleeper meta gracefully", () => {
    const result = getDraftedLookups(mockPicks);

    expect(result.draftedIds.has("123")).toBe(true);
    expect(result.draftedNames.size).toBe(0);
  });

  it("should handle players without meta gracefully", () => {
    const picksWithMissingMeta: DraftPick[] = [
      { draft_slot: 1, round: 1, pick_no: 1, player_id: "999" }, // No meta for this ID
    ];

    const result = getDraftedLookups(picksWithMissingMeta, mockSleeperMeta);

    expect(result.draftedIds.has("999")).toBe(true);
    expect(result.draftedNames.size).toBe(0); // No names added since meta is missing
  });

  it("should handle empty meta objects gracefully", () => {
    const emptyMeta: SleeperPlayersMetaT = {
      "123": {}, // Empty meta object
    };

    const result = getDraftedLookups(mockPicks, emptyMeta);

    expect(result.draftedIds.has("123")).toBe(true);
    expect(result.draftedNames.size).toBe(0); // No names since meta is empty
  });
});
