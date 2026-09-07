/** @vitest-environment jsdom */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { projectionPositionRanks } from "@/lib/draftSourceComparison";
import { PlayerPositionRank } from "@/app/draft-assistant/_components/PlayerPositionRank";

const state = vi.hoisted(() => ({ valueSource: "sleeper", sourceComparison: {} }));
vi.mock("@/app/draft-assistant/_contexts/DraftDataContext", () => ({ useDraftData: () => state }));
it("switches full-pool projected ranks with source and preserves ties and missing data", () => {
  const rows = [
    {playerId: "drafted", position: "WR", projectedPoints: 240},
    {playerId: "nico", position: "WR", projectedPoints: 218},
    {playerId: "london", position: "WR", projectedPoints: 203.2},
    {playerId: "tie", position: "WR", projectedPoints: 203.2},
    {playerId: "rb", position: "RB", projectedPoints: 280},
  ];
  const sleeper = projectionPositionRanks(rows);
  const fp = projectionPositionRanks(rows.map(row => row.playerId === "london" ? {...row, projectedPoints: 250} : row));
  state.sourceComparison = {sleeper: {positionRanksByPlayerId: sleeper}, fp: {positionRanksByPlayerId: fp}};
  const render = (id: string) => renderToStaticMarkup(<PlayerPositionRank position="WR" playerId={id} />);
  expect(render("nico")).toContain("WR2");
  expect(render("nico")).toContain("Sleeper projected position rank");
  expect(sleeper.london).toBe(sleeper.tie);
  expect(sleeper.rb).toBe(1);
  state.valueSource = "fp";
  expect(render("nico")).toContain("WR3");
  expect(render("london")).toContain("WR1");
  expect(render("london")).toContain("FantasyPros projected position rank");
  expect(render("missing")).toContain("WR—");
});
