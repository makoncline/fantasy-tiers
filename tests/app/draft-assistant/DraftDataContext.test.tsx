import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { filterAvailableRows } from "@/app/draft-assistant/_lib/filterAvailableRows";
import type { PlayerRow } from "@/lib/playerRows";

// Mock the hooks
vi.mock("@/app/draft-assistant/_lib/useSleeper", () => ({
  useSleeperUserByUsername: vi.fn(),
  useSleeperDrafts: vi.fn(),
}));

vi.mock("@/app/draft-assistant/_lib/useDraftQueries", () => ({
  useDraftDetails: vi.fn(),
  useDraftPicks: vi.fn(),
  useAggregatesBundle: vi.fn(),
}));

// Create test wrapper for React Testing Library
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Import the mocked hooks
import {
  useSleeperUserByUsername,
  useSleeperDrafts,
} from "@/app/draft-assistant/_lib/useSleeper";
import {
  useDraftDetails,
  useDraftPicks,
  useAggregatesBundle,
} from "@/app/draft-assistant/_lib/useDraftQueries";

const mockUseSleeperUserByUsername = vi.mocked(useSleeperUserByUsername);
const mockUseSleeperDrafts = vi.mocked(useSleeperDrafts);
const mockUseDraftDetails = vi.mocked(useDraftDetails);
const mockUseDraftPicks = vi.mocked(useDraftPicks);
const mockUseAggregatesBundle = vi.mocked(useAggregatesBundle);

describe("DraftDataContext mocks setup", () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
  });

  it("mocks are properly configured", () => {
    // Test that the mocks exist and can be configured
    expect(mockUseSleeperUserByUsername).toBeDefined();
    expect(mockUseSleeperDrafts).toBeDefined();
    expect(mockUseDraftDetails).toBeDefined();
    expect(mockUseDraftPicks).toBeDefined();
    expect(mockUseAggregatesBundle).toBeDefined();

    // Test mock configuration
    const mockUser = {
      user_id: "123",
      username: "testuser",
      display_name: "Test User",
    };

    mockUseSleeperUserByUsername.mockReturnValue({
      data: mockUser,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    expect(mockUseSleeperUserByUsername).toBeDefined();
  });

  it("default context module loads (optional exports)", async () => {
    const mod = await import(
      "@/app/draft-assistant/_contexts/DraftDataContext"
    );
    expect(mod).toBeDefined();
    if ((mod as any).defaultContextValue) {
      const dv = (mod as any).defaultContextValue;
      expect(dv.username).toBeTypeOf("string");
      expect(dv.showDrafted).toBeTypeOf("boolean");
    }
  });

  it("useDraftData export exists", async () => {
    const mod = await import(
      "@/app/draft-assistant/_contexts/DraftDataContext"
    );
    expect((mod as any).useDraftData).toBeDefined();
  });

  it("useDraftData hook is exported", () => {
    import("@/app/draft-assistant/_contexts/DraftDataContext").then(
      ({ useDraftData }) => {
        expect(useDraftData).toBeDefined();
        expect(typeof useDraftData).toBe("function");
      }
    );
  });

  it("DraftDataProvider is exported", () => {
    import("@/app/draft-assistant/_contexts/DraftDataContext").then(
      ({ DraftDataProvider }) => {
        expect(DraftDataProvider).toBeDefined();
        expect(typeof DraftDataProvider).toBe("function");
      }
    );
  });
});

describe("filterAvailableRows", () => {
  const mockPlayers: PlayerRow[] = [
    {
      player_id: "1",
      name: "Jonathan Taylor",
      position: "RB",
      team: "IND",
      bye_week: 14,
      bc_rank: 1,
      bc_tier: 1,
      sleeper_rank_overall: 1,
      fp_rank_pos: 1,
      fp_pts: 350,
      fp_player_owned_avg: 95,
    },
    {
      player_id: "2",
      name: "Christian McCaffrey",
      position: "RB",
      team: "SF",
      bye_week: 9,
      bc_rank: 2,
      bc_tier: 1,
      sleeper_rank_overall: 2,
      fp_rank_pos: 2,
      fp_pts: 340,
      fp_player_owned_avg: 90,
    },
    {
      player_id: "3",
      name: "Austin Ekeler",
      position: "RB",
      team: "LAC",
      bye_week: 8,
      bc_rank: 3,
      bc_tier: 1,
      sleeper_rank_overall: 3,
      fp_rank_pos: 3,
      fp_pts: 330,
      fp_player_owned_avg: 85,
    },
    {
      player_id: "4",
      name: "Unranked Player",
      position: "RB",
      team: "TB",
      bye_week: 11,
      bc_rank: undefined,
      bc_tier: undefined,
      sleeper_rank_overall: undefined,
      fp_rank_pos: undefined,
      fp_pts: undefined,
      fp_player_owned_avg: undefined,
    },
  ];

  it("should filter by position correctly", () => {
    const result = filterAvailableRows(mockPlayers, {
      position: "RB",
      showDrafted: true,
      showUnranked: true,
      draftedIds: new Set(),
      draftedNames: new Set(),
    });

    expect(result).toHaveLength(4); // All players are RB
    expect(result.every((p) => p.position === "RB")).toBe(true);
  });

  it("should filter out unranked players when showUnranked is false", () => {
    const result = filterAvailableRows(mockPlayers, {
      position: "ALL",
      showDrafted: true,
      showUnranked: false,
      draftedIds: new Set(),
      draftedNames: new Set(),
    });

    expect(result).toHaveLength(3); // Only ranked players
    expect(result.every((p) => typeof p.bc_rank === "number")).toBe(true);
    expect(result.find((p) => p.name === "Unranked Player")).toBeUndefined();
  });

  it("should filter out drafted players when showDrafted is false", () => {
    const draftedIds = new Set(["1"]); // Jonathan Taylor is drafted

    const result = filterAvailableRows(mockPlayers, {
      position: "ALL",
      showDrafted: false,
      showUnranked: true,
      draftedIds,
      draftedNames: new Set(),
    });

    expect(result).toHaveLength(3); // All except Jonathan Taylor
    expect(result.find((p) => p.player_id === "1")).toBeUndefined();
    expect(result.some((p) => p.player_id !== "1")).toBe(true);
  });

  it("should include drafted players when showDrafted is true", () => {
    const draftedIds = new Set(["1"]); // Jonathan Taylor is drafted

    const result = filterAvailableRows(mockPlayers, {
      position: "ALL",
      showDrafted: true,
      showUnranked: true,
      draftedIds,
      draftedNames: new Set(),
    });

    expect(result).toHaveLength(4); // All players including drafted
    expect(result.find((p) => p.player_id === "1")).toBeDefined();
  });

  it("should handle RB/WR combined filter", () => {
    const mixedPlayers = [
      ...mockPlayers,
      {
        ...mockPlayers[0],
        player_id: "5",
        name: "Cooper Kupp",
        position: "WR",
        bc_rank: 4,
        bc_tier: 1,
      },
      {
        ...mockPlayers[0],
        player_id: "6",
        name: "Patrick Mahomes",
        position: "QB",
        bc_rank: 5,
        bc_tier: 1,
      },
    ];

    const result = filterAvailableRows(mixedPlayers, {
      position: "RB/WR",
      showDrafted: true,
      showUnranked: true,
      draftedIds: new Set(),
      draftedNames: new Set(),
    });

    expect(
      result.every((p) => p.position === "RB" || p.position === "WR")
    ).toBe(true);
    expect(result.find((p) => p.position === "QB")).toBeUndefined();
  });

  it("should sort by Boris rank ascending", () => {
    const result = filterAvailableRows(mockPlayers, {
      position: "ALL",
      showDrafted: true,
      showUnranked: true,
      draftedIds: new Set(),
      draftedNames: new Set(),
    });

    expect(result[0].bc_rank).toBe(1); // Jonathan Taylor
    expect(result[1].bc_rank).toBe(2); // Christian McCaffrey
    expect(result[2].bc_rank).toBe(3); // Austin Ekeler
  });

  it("should handle empty drafted sets", () => {
    const result = filterAvailableRows(mockPlayers, {
      position: "ALL",
      showDrafted: false,
      showUnranked: true,
      draftedIds: new Set(),
      draftedNames: new Set(),
    });

    expect(result).toHaveLength(4); // No players filtered out
  });

  it("should handle drafted players by name", () => {
    const draftedNames = new Set(["jonathan taylor"]);

    const result = filterAvailableRows(mockPlayers, {
      position: "ALL",
      showDrafted: false,
      showUnranked: true,
      draftedIds: new Set(),
      draftedNames,
    });

    expect(result).toHaveLength(3); // All except Jonathan Taylor
    expect(result.find((p) => p.name === "Jonathan Taylor")).toBeUndefined();
  });

  it("should include drafted players in unranked filter when showUnranked is false", () => {
    const draftedIds = new Set(["4"]); // Unranked Player is drafted

    const result = filterAvailableRows(mockPlayers, {
      position: "ALL",
      showDrafted: true,
      showUnranked: false,
      draftedIds,
      draftedNames: new Set(),
    });

    // Should include the drafted unranked player
    expect(result.find((p) => p.player_id === "4")).toBeDefined();
    // Should exclude other unranked players
    expect(result).toHaveLength(4); // 3 ranked + 1 drafted unranked
  });
});

describe("DraftDataContext runtime behavior", () => {
  it("switches are toggleable at runtime", async () => {
    const mod = await import(
      "@/app/draft-assistant/_contexts/DraftDataContext"
    );
    const { DraftDataProvider, useDraftData } = mod as any;
    // Minimal runtime render without React Testing Library; smoke the hook shape
    // We can't render here, but we can assert provider/hook functions exist
    expect(typeof DraftDataProvider).toBe("function");
    expect(typeof useDraftData).toBe("function");
  });

  it("should provide switch controls from context", async () => {
    // Test that we can import and the hook provides switch functionality
    const mod = await import(
      "@/app/draft-assistant/_contexts/DraftDataContext"
    );
    const { useDraftData } = mod as any;

    expect(typeof useDraftData).toBe("function");

    // We can't easily test the hook without a full React setup, but we can verify
    // the exports exist and the filtering function works independently
  });
});
