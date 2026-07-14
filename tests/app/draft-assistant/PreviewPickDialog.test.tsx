/** @vitest-environment jsdom */

import React, { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PreviewPickDialog, {
  type PreviewPickPlayer,
} from "@/app/draft-assistant/_components/PreviewPickDialog";
import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";
import type { DraftedPlayer } from "@/lib/schemas";
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
  draft_value_score: 91,
  draft_adp_delta_rounds: 1.2,
  draft_recommendation_summary: "Strong roster fit at this point in the draft.",
  draft_recommendation_pros: ["Fills a starter need"],
  draft_recommendation_cons: ["Bye overlap"],
  sleeper_injury_status: "Questionable",
  sleeper_injury_notes: "Limited at practice.",
  draft_action_label: "unknown",
  draft_reason_labels: ["Best value"],
} satisfies PreviewPickPlayer;

function decisionPlayer(id: string, name: string, score: number): PlayerWithPick {
  return {
    player_id: id,
    name,
    position: "WR",
    team: "TEST",
    bye_week: 8,
    fp_rank_pos: 1,
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
      league: { scoring: "half" },
      decisionRows: [
        decisionPlayer("top", "Top Running Back", 95),
        selected,
        decisionPlayer("next", "Next Receiver", 89),
      ],
      sourceHealth: {
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

  it("shows only compact, actionable preview details", async () => {
    const byeConflict = {
      player_id: "rostered",
      name: "Rostered Receiver",
      position: "WR",
      team: "SEA",
      bye_week: "9",
      rank: 20,
      tier: 4,
    } satisfies DraftedPlayer;

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <PreviewPickDialog
            open
            onOpenChange={vi.fn()}
            player={selected}
            baseSlots={[
              { slot: "WR", player: byeConflict },
              { slot: "FLEX", player: null },
            ]}
          />
        </QueryClientProvider>
      );
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (document.body.textContent?.includes("Headline 3")) break;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      });
    }

    const text = document.body.textContent ?? "";
    expect(text).toContain("Fits FLEX");
    expect(text).toContain("Team DEN");
    expect(text).toContain("Bye conflicts Rostered Receiver");
    expect(text).toContain("Questionable");
    expect(text).toContain("VAL91");
    expect(text).toContain("ECR18.4");
    expect(text).toContain("ADP Δ+1.2 rd");
    expect(text).toContain("Overall tier3");
    expect(text).toContain("Why over Next Receiver");
    expect(text).not.toContain("Why over Top Running Back");
    expect(text).not.toContain("durable value");
    expect(text).not.toContain("Source Rows");
    expect(text).not.toContain("hidden source warning");
    expect(text).not.toContain("unknown");
    expect(text).not.toContain("Source warning");
    expect(text).toContain("Headline 3");
    expect(text).not.toContain("Headline 4");
    expect(text).not.toContain("x".repeat(180));
  });
});
