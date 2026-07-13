/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import RosterSlots from "@/app/draft-assistant/_components/RosterSlots";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("RosterSlots", () => {
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

  it("renders the compact roster and preserves the preview highlight", () => {
    act(() => {
      root.render(
        <RosterSlots
          highlightPlayerId="p1"
          slots={[
            {
              slot: "RB",
              player: {
                player_id: "p1",
                name: "Current Runner",
                position: "RB",
                team: "DEN",
                bye_week: "12",
                rank: 4,
                tier: 1,
              },
            },
          ]}
        />
      );
    });

    const headers = Array.from(container.querySelectorAll("th")).map(
      (header) => header.textContent
    );
    expect(headers).toEqual(["Slot", "Player", "Bye"]);
    expect(container.textContent).toContain("Current Runner");
    expect(container.textContent).toContain("DEN · RB");
    expect(container.textContent).toContain("12");
    expect(container.querySelectorAll("tbody tr td")).toHaveLength(3);
    expect(container.querySelector("tbody tr")?.innerHTML).toContain(
      "border-primary"
    );
  });
});
