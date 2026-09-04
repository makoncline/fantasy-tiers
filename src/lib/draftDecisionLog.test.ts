import { describe, expect, it } from "vitest";

import { createPlayerPoolSignature as createClientSignature } from "@/lib/draftDecisionLog.client";
import { createPlayerPoolSignature as createServerSignature } from "@/lib/draftDecisionLog.server";

describe("draft decision source identity", () => {
  it("creates the same player-pool signature in the browser and server", async () => {
    const players = [{ player_id: "player-b" }, { player_id: "player-a" }];

    expect(await createClientSignature(players)).toBe(
      createServerSignature(players)
    );
  });
});
