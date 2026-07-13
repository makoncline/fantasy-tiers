import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "../../src/app/api/draft/view-model/route";
import { buildAggregateBundle } from "../../src/lib/aggregateBundle";
import { draftCandidateMapFromBundle } from "../../src/lib/draftCandidate";
import { fetchDraftDetails } from "../../src/lib/draftDetails";
import { fetchDraftPicks } from "../../src/lib/draftPicks";
import { buildDraftViewModel } from "../../src/lib/draftState";

vi.mock("../../src/lib/aggregateBundle", () => ({ buildAggregateBundle: vi.fn() }));
vi.mock("../../src/lib/draftCandidate", () => ({ draftCandidateMapFromBundle: vi.fn() }));
vi.mock("../../src/lib/draftDetails", () => ({ fetchDraftDetails: vi.fn() }));
vi.mock("../../src/lib/draftPicks", () => ({ fetchDraftPicks: vi.fn() }));
vi.mock("../../src/lib/draftState", () => ({ buildDraftViewModel: vi.fn() }));

const draft = {
  draft_id: "draft-1",
  metadata: { scoring_type: "ppr" },
  settings: {
    teams: 10,
    rounds: 15,
    slots_qb: 1,
    slots_rb: 2,
    slots_wr: 2,
    slots_te: 1,
    slots_k: 1,
    slots_def: 1,
    slots_flex: 1,
  },
  draft_order: { "user-1": 5 },
  slot_to_roster_id: {},
};

const picks = [
  { draft_slot: 1, round: 1, pick_no: 1, player_id: "player-1" },
];

const playersMap = { "player-1": { player_id: "player-1" } };
const bundle = { sourceHealth: { warnings: ["stale"] } };
const viewModel = {
  available: [],
  drafted: [{ player_id: "player-1" }],
  recommendationBoard: {
    nextPick: 15,
    picksUntilNextTurn: 10,
    recommendations: [],
    topRecommendation: null,
  },
  draftContext: { room: { currentPick: 2 } },
};

function request(query = "draft_id=draft-1&user_id=user-1") {
  return new NextRequest(`http://localhost/api/draft/view-model?${query}`);
}

describe("GET /api/draft/view-model", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(fetchDraftDetails).mockResolvedValue(draft);
    vi.mocked(fetchDraftPicks).mockResolvedValue(picks);
    vi.mocked(buildAggregateBundle).mockReturnValue(bundle);
    vi.mocked(draftCandidateMapFromBundle).mockReturnValue(playersMap);
    vi.mocked(buildDraftViewModel).mockReturnValue(viewModel);
  });

  it("builds and returns the current draft view-model shape", async () => {
    const response = await GET(request());
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(viewModel);
    expect(body).toHaveProperty("recommendationBoard");
    expect(body).not.toHaveProperty("nextPickRecommendations");
    expect(body).not.toHaveProperty("dynamicRecommendations");
    expect(fetchDraftDetails).toHaveBeenCalledWith("draft-1");
    expect(fetchDraftPicks).toHaveBeenCalledWith("draft-1");
    expect(buildAggregateBundle).toHaveBeenCalledWith({
      scoring: "ppr",
      teams: 10,
      rosterSlots: {
        QB: 1,
        RB: 2,
        WR: 2,
        TE: 1,
        K: 1,
        DEF: 1,
        FLEX: 1,
        BENCH: 6,
      },
    });
    expect(draftCandidateMapFromBundle).toHaveBeenCalledWith(bundle);
    expect(buildDraftViewModel).toHaveBeenCalledWith({
      playersMap,
      draft,
      picks,
      userId: "user-1",
      sourceWarnings: ["stale"],
    });
  });

  it("rejects requests missing either required identifier", async () => {
    const missingDraft = await GET(request("user_id=user-1"));
    const missingUser = await GET(request("draft_id=draft-1"));

    expect(missingDraft.status).toBe(400);
    expect(missingUser.status).toBe(400);
    await expect(missingDraft.json()).resolves.toEqual({
      error: "draft_id and user_id are required",
    });
    expect(fetchDraftDetails).not.toHaveBeenCalled();
  });

  it("reports aggregate build failures without building a view model", async () => {
    vi.mocked(buildAggregateBundle).mockImplementation(() => {
      throw new Error("aggregate bundle unavailable");
    });

    const response = await GET(request());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "aggregate bundle unavailable",
    });
    expect(draftCandidateMapFromBundle).not.toHaveBeenCalled();
    expect(buildDraftViewModel).not.toHaveBeenCalled();
  });

  it("returns a stable error response when a dependency fails", async () => {
    vi.mocked(fetchDraftDetails).mockRejectedValue(new Error("Sleeper failed"));

    const response = await GET(request());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Sleeper failed" });
  });
});
