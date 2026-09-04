import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "../../src/app/api/draft/view-model/route";
import { buildAggregateBundle } from "../../src/lib/aggregateBundle";
import { draftCandidateMapFromBundle } from "../../src/lib/draftCandidate";
import { fetchDraftDetails } from "../../src/lib/draftDetails";
import { fetchDraftPicks } from "../../src/lib/draftPicks";
import { buildDraftViewModel } from "../../src/lib/draftState";
import { draftReadinessShardCountsFromBundle } from "../../src/lib/draftReadiness";
import { fetchSleeperLeagueById } from "../../src/lib/sleeper";

vi.mock("../../src/lib/aggregateBundle", () => ({ buildAggregateBundle: vi.fn() }));
vi.mock("../../src/lib/draftCandidate", () => ({ draftCandidateMapFromBundle: vi.fn() }));
vi.mock("../../src/lib/draftDetails", () => ({ fetchDraftDetails: vi.fn() }));
vi.mock("../../src/lib/draftPicks", () => ({ fetchDraftPicks: vi.fn() }));
vi.mock("../../src/lib/draftState", () => ({ buildDraftViewModel: vi.fn() }));
vi.mock("../../src/lib/draftReadiness", () => ({
  draftReadinessShardCountsFromBundle: vi.fn(),
}));
vi.mock("../../src/lib/sleeper", () => ({ fetchSleeperLeagueById: vi.fn() }));

const draft = {
  draft_id: "draft-1",
  league_id: "league-1",
  type: "snake",
  metadata: { scoring_type: "ppr" },
  settings: {
    teams: 10,
    rounds: 15,
    pick_timer: 60,
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
const shardCounts = { ALL: 1, QB: 1, RB: 1, WR: 1, TE: 1, K: 1, DEF: 1, FLEX: 1 };
const bundle = {
  sourceHealth: { generatedAt: "2026-09-04T12:00:00.000Z" },
  draftProjections: null,
};
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
  readiness: { status: "ready" },
};

function request(query = "draft_id=draft-1&user_id=user-1") {
  return new NextRequest(`http://localhost/api/draft/view-model?${query}`);
}

describe("GET /api/draft/view-model", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(fetchDraftDetails).mockResolvedValue(draft);
    vi.mocked(fetchDraftPicks).mockResolvedValue(picks);
    vi.mocked(fetchSleeperLeagueById).mockResolvedValue({
      league_id: "league-1",
      name: "Public League",
      scoring_settings: { rec: 1 },
    });
    vi.mocked(buildAggregateBundle).mockReturnValue(bundle);
    vi.mocked(draftCandidateMapFromBundle).mockReturnValue(playersMap);
    vi.mocked(buildDraftViewModel).mockReturnValue(viewModel);
    vi.mocked(draftReadinessShardCountsFromBundle).mockReturnValue(shardCounts);
  });

  it("builds and returns the current draft view-model shape", async () => {
    const response = await GET(request());
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject(viewModel);
    expect(body).toHaveProperty("leagueConfig", {
      source: "sleeper-draft",
      teams: 10,
      rounds: 15,
      userSlot: 5,
      draftType: "snake",
      draftOrderMode: "sleeper",
      pickTimerSeconds: 60,
      scoring: "ppr",
      scoringSource: "league",
      scoringRules: expect.objectContaining({ reception: 1 }),
      rosterSlots: {
        QB: 1,
        RB: 2,
        WR: 2,
        TE: 1,
        K: 1,
        DEF: 1,
        FLEX: 1,
        BENCH: 6,
        IR: 0,
      },
    });
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
      scoringRules: expect.any(Object),
      projectionArtifact: null,
      sourceHealth: bundle.sourceHealth,
      shardCounts,
    });
  });

  it("uses exact Sleeper scoring instead of the preset scoring bucket", async () => {
    vi.mocked(fetchDraftDetails).mockResolvedValue({
      ...draft,
      scoring_settings: {
        rec: 0.5,
        rush_yd: 0.1,
        rec_yd: 0.1,
        rush_td: 6,
        rec_td: 6,
        pass_yd: 0.04,
        pass_td: 6,
        pass_int: -2,
        fum_lost: -2,
        rush_att: 0,
      },
    });

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(buildAggregateBundle).toHaveBeenCalledWith(
      expect.objectContaining({ scoring: "half" })
    );
  });

  it("uses a manual slot when Sleeper has not published the draft order", async () => {
    vi.mocked(fetchDraftDetails).mockResolvedValue({
      ...draft,
      draft_order: {},
    });

    const response = await GET(
      request("draft_id=draft-1&user_id=user-1&draft_slot=4")
    );
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty("leagueConfig.userSlot", 4);
    expect(body).toHaveProperty("leagueConfig.draftOrderMode", "manual");
    expect(buildDraftViewModel).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", userSlot: 4 })
    );
  });

  it("rejects an invalid manual draft slot", async () => {
    const response = await GET(
      request("draft_id=draft-1&user_id=user-1&draft_slot=zero")
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "draft_slot must be a positive integer",
    });
    expect(fetchDraftDetails).not.toHaveBeenCalled();
  });

  it("does not expose an alternate recommendation strategy through the URL", async () => {
    const response = await GET(
      request("draft_id=draft-1&user_id=user-1&strategy=current")
    );

    expect(response.status).toBe(200);
    expect(buildDraftViewModel).toHaveBeenCalledWith(
      expect.not.objectContaining({ strategy: expect.anything() })
    );
  });

  it("loads exact scoring from the Sleeper league when the draft omits it", async () => {
    vi.mocked(fetchSleeperLeagueById).mockResolvedValue({
      league_id: "league-1",
      name: "Public League",
      scoring_settings: { rec: 0, pass_td: 6, pass_int: -3 },
    });

    const response = await GET(request());
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(fetchSleeperLeagueById).toHaveBeenCalledWith("league-1");
    expect(buildAggregateBundle).toHaveBeenCalledWith(
      expect.objectContaining({ scoring: "std" })
    );
    expect(body).toHaveProperty("leagueConfig.scoringSource", "league");
    expect(body).toHaveProperty("leagueConfig.scoringRules.passingTouchdown", 6);
    expect(body).toHaveProperty("leagueConfig.scoringRules.interception", -3);
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

  it("returns 503 without recommendations for a readiness incident", async () => {
    vi.mocked(buildDraftViewModel).mockReturnValue({
      ...viewModel,
      readiness: {
        status: "incident",
        incidents: [{ message: "FantasyPros is stale." }],
      },
    });

    const response = await GET(request());
    const body: unknown = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      error: "Draft data is not ready.",
      readiness: { status: "incident" },
    });
    expect(body).not.toHaveProperty("recommendationBoard");
  });

  it("returns a stable error response when a dependency fails", async () => {
    vi.mocked(fetchDraftDetails).mockRejectedValue(new Error("Sleeper failed"));

    const response = await GET(request());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Sleeper failed" });
  });
});
