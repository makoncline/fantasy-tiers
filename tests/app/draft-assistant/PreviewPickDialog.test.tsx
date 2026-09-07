/** @vitest-environment jsdom */

import React, { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PreviewPickDialog, {
  type PreviewPickPlayer,
} from "@/app/draft-assistant/_components/PreviewPickDialog";
import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";
import { DraftWatchlistProvider } from "@/app/draft-assistant/_components/DraftWatchlistContext";
import type { PlayerWithPick } from "@/lib/types.draft";

vi.mock("@/app/draft-assistant/_contexts/DraftDataContext", () => ({
  useDraftData: vi.fn(),
}));

const mockUseDraftData = vi.mocked(useDraftData);

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const selected = {
  player_id: "selected",
  name: "Selected Receiver",
  position: "WR",
  team: "DEN",
  bye_week: "9",
  rank: 12,
  tier: 3,
  fp_rank_ave: 18.4,
  sleeper_adp: 27,
  sleeper_adp_round_pick: "3.03",
  sleeper_depth_chart_position: "WR",
  sleeper_depth_chart_order: 1,
  draft_raw_value_score: 83,
  draft_value_score: 91,
  draft_adp_delta_rounds: 1.2,
  draft_recommendation_summary: "Strong roster fit at this point in the draft.",
  draft_recommendation_pros: ["Fills a starter need"],
  draft_recommendation_cons: ["Bye overlap"],
  sleeper_injury_status: "Questionable",
  sleeper_injury_notes: "Limited at practice.",
  draft_availability: "short-term-concern",
  draft_availability_label: "Short-term concern",
  draft_availability_eligible: true,
  draft_rankings_may_be_stale: false,
  draft_action_label: "unknown",
  draft_reason_labels: ["Best value"],
  draft_comeback_label: "likely",
  draft_comeback_probability: 0.72,
  position_tier_level: 2,
  draft_component_scores: {
    value: 80,
    timing: 4,
    starterNeed: 5,
    construction: 3,
    onesie: 0,
    depth: 0,
    demand: 1,
    risk: -2,
  },
} satisfies PreviewPickPlayer;

function decisionPlayer(id: string, name: string, score: number): PlayerWithPick {
  return {
    player_id: id,
    name,
    position: "WR",
    team: "TEST",
    bye_week: 8,
    fp_rank_pos: 1,
    draft_raw_value_score: score - 10,
    draft_value_score: score,
  };
}

describe("PreviewPickDialog", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    mockUseDraftData.mockReturnValue({
      playersAll: [selected],
      valueSource: "sleeper",
      sourceComparison: {
        sleeper: { values: { valuesByPlayerId: { selected: { projectedPoints: 200, value: 83 } } }, board: { metricsByPlayerId: { selected: { recommendationScore: 91, reasons: [], components: selected.draft_component_scores } } } },
        fp: { values: { valuesByPlayerId: { selected: { projectedPoints: 210, value: 88 } } }, board: { metricsByPlayerId: { selected: { recommendationScore: 94, reasons: [{code:"ONESIE_WAIT",label:"Wait for ECR",detail:"Recorded wait rule"}], components: { ...selected.draft_component_scores, onesie: -100 } } } } },
      },
      league: { scoring: "half", teams: 12 },
      positionRows: { ALL: [{ ...selected, tier_level: 5 }] },
      decisionRows: [
        decisionPlayer("top", "Top Running Back", 95),
        selected,
        decisionPlayer("next", "Next Receiver", 89),
      ],
      draftContext: {
        room: { leagueStarterSlotsRemaining: { WR: 7, FLEX: 12 } },
        positionOutlook: [
          { position: "WR", leagueStarterSlotsRemaining: 7 },
        ],
      },
      sourceHealth: {
        sleeperPlayers: [],
        fantasyProsPlayers: [],
        sources: [{ source: "hidden-source", status: "stale" }],
        warnings: ["hidden source warning"],
      },
    } as never);

    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      if (String(input).includes("player-news")) {
        return new Response(JSON.stringify({
          items: Array.from({ length: 4 }, (_, index) => ({
            metadata: {
              title: `Headline ${index + 1}`,
              description: index === 0 ? "x".repeat(220) : `Short excerpt ${index + 1}`,
            },
            player_id: "selected",
            published: 1_780_000_000_000 + index,
            source: "rotowire",
            source_key: `news-${index}`,
            sport: "nfl",
          })),
        }));
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    }));
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.unstubAllGlobals();
  });

  function renderDialog() {
    return act(async () => root.render(<QueryClientProvider client={queryClient}><DraftWatchlistProvider>
      <PreviewPickDialog open onOpenChange={vi.fn()} player={selected} />
    </DraftWatchlistProvider></QueryClientProvider>));
  }
  async function click(label: string) {
    const button = Array.from(document.querySelectorAll("button")).find(b => b.textContent === label);
    expect(button).toBeTruthy();
    await act(async () => button!.click());
  }
  it("shows separate values, source-specific adjustments, compact status and comparison actions", async () => {
    await renderDialog();
    const text = document.querySelector('[role="dialog"]')!.textContent!;
    expect(text).toContain("WR · DEN · Bye 9 · Questionable");
    expect(text.match(/Questionable/g)).toHaveLength(1);
    expect(text).toContain("Depth: WR1");
    expect(text).toContain("Sleeper (selected)200.083.091.0ADP 3.03");
    expect(text).toContain("FantasyPros210.088.094.0ECR 2.06");
    expect(text).toContain("FP Tier (Overall) 5 · FP Tier (WR) 2");
    expect(text).toContain("Sleeper: Starter need adds to ADJ by 5.0 (largest adjustment).");
    for (const removed of ["Draft value", "Room starter", "ADP vs ECR", "Availability Short", "Limited at practice", "Base value contribution"]) expect(text).not.toContain(removed);
    expect(fetch).not.toHaveBeenCalled();
    await click("Watch +");
    expect(document.querySelector('button[aria-label="Remove Selected Receiver from watch list"]')?.getAttribute("aria-pressed")).toBe("true");
    await click("Adjustment breakdown");
    expect(document.body.textContent).toContain("Sleeper · ADJ contributions");
    expect(document.body.textContent).toContain("Risk-2.0");
    expect(document.body.textContent).not.toContain("QB/TE policy");
    mockUseDraftData.mockReturnValue({...mockUseDraftData(), valueSource: "fp"});
    await renderDialog();
    expect(document.body.textContent).toContain("FantasyPros: Wait for ECR reduces ADJ by 100.0 (largest adjustment).");
    expect(document.body.textContent).toContain("FantasyPros · ADJ contributions");
  });
  it("keeps missing values missing and expands full news only on request", async () => {
    mockUseDraftData.mockReturnValue({...mockUseDraftData(), valueSource: "fp", sourceComparison: null, playersAll: [{...selected, sleeper_adp: null, fp_rank_ave: null}] } as never);
    await renderDialog();
    expect(document.body.textContent).toContain("Sleeper———ADP —");
    expect(document.body.textContent).toContain("FantasyPros (selected)———ECR —");
    expect(document.body.textContent).toContain("FantasyPros: adjustment data unavailable.");
    await click("News");
    for (let attempt=0; attempt<20 && !document.body.textContent?.includes("Headline 3"); attempt++) await act(async () => { await new Promise(r => setTimeout(r, 5)); });
    expect(document.body.textContent).toContain("Headline 3");
    expect(document.body.textContent).not.toContain("Headline 4");
    expect(document.body.textContent).toContain("x".repeat(220));
    expect(Array.from(document.querySelectorAll("button")).some(b => b.textContent?.includes("Headline 1"))).toBe(false);
  });
});
