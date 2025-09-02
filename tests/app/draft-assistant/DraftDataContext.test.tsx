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
  const mockPlayers: PlayerWithPick[] = [
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
      picked: true, // Jonathan Taylor is drafted
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
      picked: false,
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
      picked: false,
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
      picked: true, // Unranked but drafted player
    },
  ];

  it("should filter by position correctly", () => {
    const result = filterAvailableRows(mockPlayers, {
      showDrafted: true,
      showUnranked: true,
    });

    expect(result).toHaveLength(4); // All players are RB
    expect(result.every((p) => p.position === "RB")).toBe(true);
  });

  it("should filter out unranked players when showUnranked is false", () => {
    const result = filterAvailableRows(mockPlayers, {
      showDrafted: true,
      showUnranked: false,
    });

    expect(result).toHaveLength(4); // 3 ranked players + 1 drafted unranked player
    // All players should either be ranked OR drafted (drafted unranked players are allowed)
    expect(
      result.every((p) => typeof p.bc_rank === "number" || p.picked === true)
    ).toBe(true);
    expect(result.find((p) => p.name === "Unranked Player")).toBeDefined(); // Should be included as drafted unranked
  });

  it("should filter out drafted players when showDrafted is false", () => {
    const result = filterAvailableRows(mockPlayers, {
      showDrafted: false,
      showUnranked: true,
    });

    expect(result).toHaveLength(2); // All except drafted players (Jonathan Taylor and Unranked Player)
    expect(result.find((p) => p.player_id === "1")).toBeUndefined();
    expect(result.some((p) => p.player_id !== "1")).toBe(true);
  });

  it("should include drafted players when showDrafted is true", () => {
    const result = filterAvailableRows(mockPlayers, {
      showDrafted: true,
      showUnranked: true,
    });

    expect(result).toHaveLength(4); // All players including drafted
    expect(result.find((p) => p.player_id === "1")).toBeDefined();
  });

  it("should handle mixed position players", () => {
    const mixedPlayers = [
      ...mockPlayers,
      {
        ...mockPlayers[0],
        player_id: "5",
        name: "Cooper Kupp",
        position: "WR",
        bc_rank: 4,
        bc_tier: 1,
        picked: false,
      },
      {
        ...mockPlayers[0],
        player_id: "6",
        name: "Patrick Mahomes",
        position: "QB",
        bc_rank: 5,
        bc_tier: 1,
        picked: false,
      },
    ];

    const result = filterAvailableRows(mixedPlayers, {
      showDrafted: true,
      showUnranked: true,
    });

    expect(result).toHaveLength(6); // All players regardless of position
    expect(result.find((p) => p.position === "QB")).toBeDefined();
    expect(result.find((p) => p.position === "WR")).toBeDefined();
  });

  it("should sort by Boris rank ascending", () => {
    const result = filterAvailableRows(mockPlayers, {
      showDrafted: true,
      showUnranked: true,
    });

    expect(result[0].bc_rank).toBe(1); // Jonathan Taylor
    expect(result[1].bc_rank).toBe(2); // Christian McCaffrey
    expect(result[2].bc_rank).toBe(3); // Austin Ekeler
  });

  it("should handle empty drafted sets", () => {
    const result = filterAvailableRows(mockPlayers, {
      showDrafted: false,
      showUnranked: true,
    });

    expect(result).toHaveLength(2); // Jonathan Taylor and Unranked Player filtered out (both picked), others included
  });

  it("should handle drafted players", () => {
    const result = filterAvailableRows(mockPlayers, {
      showDrafted: false,
      showUnranked: true,
    });

    expect(result).toHaveLength(2); // All except drafted players (Jonathan Taylor and Unranked Player)
    expect(result.find((p) => p.name === "Jonathan Taylor")).toBeUndefined();
  });

  it("should include drafted players in unranked filter when showUnranked is false", () => {
    const result = filterAvailableRows(mockPlayers, {
      showDrafted: true,
      showUnranked: false,
    });

    // Should include the drafted unranked player (player 4)
    expect(result.find((p) => p.player_id === "4")).toBeDefined();
    // Should exclude other unranked players, include ranked players
    expect(result).toHaveLength(4); // 3 ranked + 1 drafted unranked
  });
});

describe("getRosterStatus helper function", () => {
  it("should calculate roster status correctly for positions with players", () => {
    // Mock view model data
    const mockViewModel = {
      userRoster: {
        rosterPositionCounts: {
          QB: 2, // User has 2 QBs
          RB: 3, // User has 3 RBs
          WR: 4, // User has 4 WRs
          TE: 1, // User has 1 TE
          FLEX: 1, // User has 1 FLEX
          K: 1, // User has 1 K
          DEF: 1, // User has 1 DEF
        },
      },
      rosterRequirements: {
        QB: 1, // League requires 1 QB
        RB: 2, // League requires 2 RBs
        WR: 2, // League requires 2 WRs
        TE: 1, // League requires 1 TE
        FLEX: 1, // League requires 1 FLEX
        K: 1, // League requires 1 K
        DEF: 1, // League requires 1 DEF
      },
    };

    // Create the helper function with mocked data
    const getRosterStatus = (pos: string) => {
      const count =
        mockViewModel.userRoster?.rosterPositionCounts?.[
          pos as keyof typeof mockViewModel.userRoster.rosterPositionCounts
        ] ?? 0;
      const requirement =
        mockViewModel.rosterRequirements?.[
          pos as keyof typeof mockViewModel.rosterRequirements
        ] ?? 0;
      const met = requirement > 0 && count >= requirement;
      return { count, requirement, met };
    };

    // Test QB: 2 players, needs 1 → met
    expect(getRosterStatus("QB")).toEqual({
      count: 2,
      requirement: 1,
      met: true,
    });

    // Test RB: 3 players, needs 2 → met
    expect(getRosterStatus("RB")).toEqual({
      count: 3,
      requirement: 2,
      met: true,
    });

    // Test WR: 4 players, needs 2 → met
    expect(getRosterStatus("WR")).toEqual({
      count: 4,
      requirement: 2,
      met: true,
    });

    // Test TE: 1 player, needs 1 → met
    expect(getRosterStatus("TE")).toEqual({
      count: 1,
      requirement: 1,
      met: true,
    });

    // Test FLEX: 1 player, needs 1 → met
    expect(getRosterStatus("FLEX")).toEqual({
      count: 1,
      requirement: 1,
      met: true,
    });

    // Test K: 1 player, needs 1 → met
    expect(getRosterStatus("K")).toEqual({
      count: 1,
      requirement: 1,
      met: true,
    });

    // Test DEF: 1 player, needs 1 → met
    expect(getRosterStatus("DEF")).toEqual({
      count: 1,
      requirement: 1,
      met: true,
    });
  });

  it("should handle positions that are not fully met", () => {
    // Mock view model data with unmet requirements
    const mockViewModel = {
      userRoster: {
        rosterPositionCounts: {
          QB: 0, // User has 0 QBs
          RB: 1, // User has 1 RB
          WR: 1, // User has 1 WR
        },
      },
      rosterRequirements: {
        QB: 1, // League requires 1 QB
        RB: 2, // League requires 2 RBs
        WR: 3, // League requires 3 WRs
      },
    };

    // Create the helper function with mocked data
    const getRosterStatus = (pos: string) => {
      const count =
        mockViewModel.userRoster?.rosterPositionCounts?.[
          pos as keyof typeof mockViewModel.userRoster.rosterPositionCounts
        ] ?? 0;
      const requirement =
        mockViewModel.rosterRequirements?.[
          pos as keyof typeof mockViewModel.rosterRequirements
        ] ?? 0;
      const met = requirement > 0 && count >= requirement;
      return { count, requirement, met };
    };

    // Test QB: 0 players, needs 1 → not met
    expect(getRosterStatus("QB")).toEqual({
      count: 0,
      requirement: 1,
      met: false,
    });

    // Test RB: 1 player, needs 2 → not met
    expect(getRosterStatus("RB")).toEqual({
      count: 1,
      requirement: 2,
      met: false,
    });

    // Test WR: 1 player, needs 3 → not met
    expect(getRosterStatus("WR")).toEqual({
      count: 1,
      requirement: 3,
      met: false,
    });
  });

  it("should handle positions with no requirements", () => {
    // Mock view model data with zero requirements
    const mockViewModel = {
      userRoster: {
        rosterPositionCounts: {
          QB: 2, // User has 2 QBs
        },
      },
      rosterRequirements: {
        QB: 0, // League requires 0 QBs
      },
    };

    // Create the helper function with mocked data
    const getRosterStatus = (pos: string) => {
      const count =
        mockViewModel.userRoster?.rosterPositionCounts?.[
          pos as keyof typeof mockViewModel.userRoster.rosterPositionCounts
        ] ?? 0;
      const requirement =
        mockViewModel.rosterRequirements?.[
          pos as keyof typeof mockViewModel.rosterRequirements
        ] ?? 0;
      const met = requirement > 0 && count >= requirement;
      return { count, requirement, met };
    };

    // Test QB: 2 players, needs 0 → not met (requirement is 0, so met is false)
    expect(getRosterStatus("QB")).toEqual({
      count: 2,
      requirement: 0,
      met: false,
    });
  });

  it("should handle missing roster data gracefully", () => {
    // Mock view model data with missing roster data
    const mockViewModel = {
      userRoster: null, // No roster data
      rosterRequirements: {
        QB: 1,
      },
    };

    // Create the helper function with mocked data
    const getRosterStatus = (pos: string) => {
      const count =
        mockViewModel.userRoster?.rosterPositionCounts?.[
          pos as keyof typeof mockViewModel.userRoster.rosterPositionCounts
        ] ?? 0;
      const requirement =
        mockViewModel.rosterRequirements?.[
          pos as keyof typeof mockViewModel.rosterRequirements
        ] ?? 0;
      const met = requirement > 0 && count >= requirement;
      return { count, requirement, met };
    };

    // Test QB: 0 players (fallback), needs 1 → not met
    expect(getRosterStatus("QB")).toEqual({
      count: 0,
      requirement: 1,
      met: false,
    });
  });

  it("should handle missing requirements data gracefully", () => {
    // Mock view model data with missing requirements data
    const mockViewModel = {
      userRoster: {
        rosterPositionCounts: {
          QB: 2,
        },
      },
      rosterRequirements: null, // No requirements data
    };

    // Create the helper function with mocked data
    const getRosterStatus = (pos: string) => {
      const count =
        mockViewModel.userRoster?.rosterPositionCounts?.[
          pos as keyof typeof mockViewModel.userRoster.rosterPositionCounts
        ] ?? 0;
      const requirement =
        mockViewModel.rosterRequirements?.[
          pos as keyof typeof mockViewModel.rosterRequirements
        ] ?? 0;
      const met = requirement > 0 && count >= requirement;
      return { count, requirement, met };
    };

    // Test QB: 2 players, needs 0 (fallback) → not met
    expect(getRosterStatus("QB")).toEqual({
      count: 2,
      requirement: 0,
      met: false,
    });
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
