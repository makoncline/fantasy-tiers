// tests/lib/queryKeys.test.ts
import { describe, it, expect } from "vitest";
import { qk } from "../../src/lib/queryKeys";

describe("Query Keys", () => {
  describe("aggregates", () => {
    it("should have merged aggregates key", () => {
      expect(qk.aggregates.merged).toEqual(["aggregates", "merged"]);
    });

    it("should generate shard keys correctly", () => {
      expect(qk.aggregates.shard("QB")).toEqual(["aggregates", "shard", "QB"]);
      expect(qk.aggregates.shard("RB")).toEqual(["aggregates", "shard", "RB"]);
      expect(qk.aggregates.shard("ALL")).toEqual(["aggregates", "shard", "ALL"]);
    });
  });

  describe("draft", () => {
    it("should generate details keys correctly", () => {
      expect(qk.draft.details("draft123")).toEqual(["draft", "draft123", "details"]);
      expect(qk.draft.details("another-draft")).toEqual(["draft", "another-draft", "details"]);
    });

    it("should generate picks keys correctly", () => {
      expect(qk.draft.picks("draft123")).toEqual(["draft", "draft123", "picks"]);
      expect(qk.draft.picks("another-draft")).toEqual(["draft", "another-draft", "picks"]);
    });

    it("should generate viewModel keys correctly", () => {
      expect(qk.draft.viewModel("draft123", "user456")).toEqual([
        "draft",
        "draft123",
        "view-model",
        "user456",
      ]);
      expect(qk.draft.viewModel("another-draft", "another-user")).toEqual([
        "draft",
        "another-draft",
        "view-model",
        "another-user",
      ]);
    });

    it("should generate summary keys correctly", () => {
      expect(qk.draft.summary("draft123", "user456")).toEqual([
        "draft",
        "draft123",
        "summary",
        "user456",
      ]);
    });
  });

  describe("players", () => {
    it("should generate byScoring keys correctly", () => {
      expect(qk.players.byScoring("std")).toEqual(["players", "std"]);
      expect(qk.players.byScoring("ppr")).toEqual(["players", "ppr"]);
      expect(qk.players.byScoring("half")).toEqual(["players", "half"]);
    });
  });

  describe("sleeper", () => {
    it("should have playersMeta key", () => {
      expect(qk.sleeper.playersMeta).toEqual(["sleeper", "players-meta", "static"]);
    });
  });

  it("should have proper TypeScript types", () => {
    // These should all be readonly arrays/tuples
    const mergedKey: readonly ["aggregates", "merged"] = qk.aggregates.merged;
    const shardKey: readonly ["aggregates", "shard", string] = qk.aggregates.shard("QB");
    const detailsKey: readonly ["draft", string, "details"] = qk.draft.details("draft123");

    expect(mergedKey).toEqual(["aggregates", "merged"]);
    expect(shardKey).toEqual(["aggregates", "shard", "QB"]);
    expect(detailsKey).toEqual(["draft", "draft123", "details"]);
  });
});
