import { describe, expect, it } from "vitest";
import { chooseFantasyProsInputMode } from "../../scripts/fp/aggregate-fantasypros";

describe("FantasyPros aggregate input mode", () => {
  it("uses an explicit mode before env or marker fallbacks", () => {
    expect(
      chooseFantasyProsInputMode({
        draftEnv: "true",
        explicitMode: "weekly",
        markerMode: "draft",
      })
    ).toBe("weekly");
  });

  it("uses DRAFT=true to force draft rankings", () => {
    expect(
      chooseFantasyProsInputMode({
        draftEnv: "true",
        markerMode: "weekly",
      })
    ).toBe("draft");
  });

  it("uses the fetch-mode marker when no env override is set", () => {
    expect(
      chooseFantasyProsInputMode({
        markerMode: "draft",
      })
    ).toBe("draft");
  });

  it("keeps the old auto behavior when no mode is known", () => {
    expect(chooseFantasyProsInputMode({})).toBe("auto");
  });
});
