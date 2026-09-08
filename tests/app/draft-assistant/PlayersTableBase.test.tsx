/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import PlayersTableBase from "@/app/draft-assistant/_components/table/PlayersTableBase";
import type { ColumnGroup } from "@/app/draft-assistant/_components/table/columns";
import { draftTableGroups } from "@/app/draft-assistant/_components/table/presets";
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

  it("uses canonical recommendation rank for equal ADJ before limiting rows", () => {
    const tied = [{ ...player("lower-source-rank", 20), draft_recommendation_rank: 2 },
      { ...player("higher-source-rank", 20), draft_recommendation_rank: 1 }];
    const columns: ColumnGroup<PlayerWithPick>[] = [{ header: "Players", children: [
      { id: "name", header: "Player", accessor: row => row.name },
      { id: "adj", header: "ADJ", accessor: row => row.draft_value_score, sortable: true, sortAs: "number" },
    ] }];
    act(() => root.render(<PlayersTableBase preferenceKey="source-rank-test" rows={tied} groups={columns} sortable defaultSortId="adj" defaultSortDir="desc" maxRows={1} />));
    expect(container.querySelector("tbody tr")?.textContent).toContain("higher-source-rank");
  });

  it("stores watch list and overall sorting separately", () => {
    localStorage.clear();
    act(() => root.render(<><PlayersTableBase preferenceKey="overall" rows={rows} groups={groups} sortable defaultSortId="value" /><PlayersTableBase preferenceKey="watch-list" rows={rows} groups={groups} sortable defaultSortId="value" /></>));
    act(() => container.querySelector<HTMLButtonElement>("th button")!.click());
    expect(localStorage.getItem("fantasy-tiers:draft:table:overall:direction")).toBe('"desc"');
    expect(localStorage.getItem("fantasy-tiers:draft:table:watch-list:direction")).toBe('"asc"');
    localStorage.clear();
  });

  it("counts only undrafted players toward the row limit, preserving sorted drafted rows", () => {
    const mixed = [
      {...player("drafted-high", 50), picked: {overall: 1}},
      player("available-high", 40),
      {...player("drafted-mid", 30), picked: {overall: 2}},
      player("available-low", 20),
      player("outside-limit", 10),
    ];
    act(() => root.render(<PlayersTableBase rows={mixed} groups={groups} sortable defaultSortId="value" defaultSortDir="desc" maxRows={2} dimDrafted />));
    const rendered = [...container.querySelectorAll("tbody tr")];
    expect(rendered).toHaveLength(4);
    expect(rendered.filter(row => row.getAttribute("data-row-drafted") !== "true")).toHaveLength(2);
    expect(rendered.map(row => row.textContent)).toEqual(["50", "40", "30", "20"]);
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

  it.each(["sleeper", "fp"])("shows only the %s market column in a compact row", (source) => {
    act(() => {
      root.render(
        <PlayersTableBase
          rows={[
            {
              ...player("ranked", 20),
              name: "Ranked Player",
              fp_rank_ave: 8,
              fp_rank_pos: 3,
              sleeper_adp: 11,
              sleeper_adp_round_pick: "1.11",
              tier_level: 2,
              position_tier_level: 1,
            },
          ]}
          groups={draftTableGroups({ source })}
        />
      );
    });

    expect(container.textContent).toContain(
      `Tier (Overall)PlayerTM/BYEPTSVALADJ${source === "fp" ? "ECR" : "ADP"}`
    );
    expect(container.textContent).not.toContain("Back?");
    expect(container.textContent).not.toContain("Draft board");
    expect(container.textContent).toContain("Ranked PlayerRB");
    if (source === "sleeper") expect(container.textContent).toContain("1.11");
    expect(container.textContent).not.toContain("ADP vs ECR");
    expect(container.querySelectorAll("tbody td")[0]?.textContent).toBe("2");
  });

  it.each(["tier_level", "position_tier"])("colors the displayed %s groups only while tier-sorted", (id) => {
    const rows = [
      { ...player("a", 30), tier_level: 1, position_tier_level: 3 },
      { ...player("b", 20), tier_level: 1, position_tier_level: 2 },
      { ...player("c", 10), tier_level: 2, position_tier_level: 2 },
    ];
    const tierGroups: ColumnGroup<PlayerWithPick>[] = [{ header: "", children: [
      { id, header: "Tier", accessor: r => id === "tier_level" ? r.tier_level : r.position_tier_level, sortable: true },
      { id: "value", header: "Value", accessor: r => r.draft_value_score, sortable: true },
    ] }];
    act(() => root.render(<PlayersTableBase rows={rows} groups={tierGroups} sortable />));
    const bodies = () => [...container.querySelectorAll("tbody tr")];
    expect(bodies().every(r => !r.className.includes("500/10"))).toBe(true);
    act(() => container.querySelector<HTMLButtonElement>("th button")?.click());
    expect(bodies().map(r => r.querySelector("td")?.textContent)).toEqual(id === "tier_level" ? ["1", "1", "2"] : ["2", "2", "3"]);
    expect(bodies()[0]?.className).toBe(bodies()[1]?.className);
    expect(bodies()[0]?.className).not.toBe(bodies()[2]?.className);
    expect(bodies()[0]?.className).toContain("bg-sky-500/10");
    act(() => container.querySelectorAll<HTMLButtonElement>("th button")[1]?.click());
    expect(bodies().every(r => !r.className.includes("500/10"))).toBe(true);
  });

  it("describes VAL as the league-specific starter-aware value", () => {
    const valueColumn = draftTableGroups()
      .flatMap((group) => group.children)
      .find((column) => column.id === "raw");

    expect(valueColumn?.description).toBe(
      "Starter-aware value for this league's scoring and lineup. It does not use your roster or current draft state."
    );
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
