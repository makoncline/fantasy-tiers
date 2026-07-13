/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import PlayersTableBase from "@/app/draft-assistant/_components/table/PlayersTableBase";
import type { ColumnGroup } from "@/app/draft-assistant/_components/table/columns";
import { GROUPS_FULL } from "@/app/draft-assistant/_components/table/presets";
import type { PlayerWithPick } from "@/lib/types.draft";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const groups: ColumnGroup<PlayerWithPick>[] = [
  {
    header: "Player",
    children: [
      {
        id: "value",
        header: "Value",
        accessor: (row) => row.draft_value_score ?? null,
        sortable: true,
        sortAs: "number",
        nulls: "last",
        heat: { scale: "val" },
      },
    ],
  },
];

const rows: PlayerWithPick[] = [
  player("missing", null),
  player("low", 10),
  player("high", 20),
];

describe("PlayersTableBase", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("keeps null values last when sorting descending", () => {
    act(() => {
      root.render(
        <PlayersTableBase
          rows={rows}
          groups={groups}
          sortable
          defaultSortId="value"
          defaultSortDir="desc"
        />
      );
    });

    const values = Array.from(container.querySelectorAll("tbody td")).map(
      (cell) => cell.textContent
    );
    expect(values).toEqual(["20", "10", "—"]);
  });

  it("labels overall and position rankings and tiers explicitly", () => {
    act(() => {
      root.render(
        <PlayersTableBase
          rows={[
            {
              ...player("ranked", 20),
              name: "Ranked Player",
              fp_rank_ave: 8,
              fp_rank_pos: 3,
              sleeper_rank_overall: 11,
              tier_level: 2,
              position_tier_level: 1,
            },
          ]}
          groups={GROUPS_FULL}
        />
      );
    });

    expect(container.textContent).toContain("ECR (Sleeper Δ)");
    expect(container.textContent).toContain("Tier (overall / pos)");
    expect(container.textContent).toContain("Ranked Player (RB3)");
    expect(container.textContent).toContain("8 (+3)");
    expect(container.textContent).toContain("2/1");
  });

  it("keeps value colors anchored to the initial all-player domain", () => {
    const initialDomain = [player("draft-best", 100), player("draft-low", 0)];

    act(() => {
      root.render(
        <PlayersTableBase
          rows={[player("available", 20)]}
          groups={groups}
          colorize
          heatDomainRows={initialDomain}
        />
      );
    });

    const firstColor = container.querySelector("tbody td")?.getAttribute("style");
    expect(firstColor).toContain("rgba(122, 67, 31, 0.35)");

    act(() => {
      root.render(
        <PlayersTableBase
          rows={[player("available", 20), player("new-low", 10)]}
          groups={groups}
          colorize
          heatDomainRows={initialDomain}
        />
      );
    });

    expect(container.querySelector("tbody td")?.getAttribute("style")).toBe(
      firstColor
    );
  });
});

function player(player_id: string, value: number | null): PlayerWithPick {
  return {
    player_id,
    name: player_id,
    position: "RB",
    team: null,
    bye_week: null,
    draft_value_score: value,
  };
}
