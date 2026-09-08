import { describe, expect, it } from "vitest";
import { draftChoiceFixture } from "./draftChoiceFixture";
import { buildDraftValueBoard } from "./draftValue";
import { hasPositionQualityConflict } from "./draftPositionComparison";
import { selectPositionPolicy } from "../../scripts/draft/position-quality-policy";

function fixture() {
  const board = buildDraftValueBoard(draftChoiceFixture().boardInput);
  const lead = board.topRecommendation!;
  const rival = board.recommendations.find(p => p.position === lead.player.position && p.player_id !== lead.player.player_id)!;
  const metrics = board.metricsByPlayerId[rival.player_id]!;
  metrics.staticValue = lead.metrics.staticValue! + 8;
  metrics.positionTier = lead.metrics.positionTier;
  metrics.availability = { ...lead.metrics.availability };
  metrics.components = { ...lead.metrics.components, value: lead.metrics.components.value + 5, timing: lead.metrics.components.timing - 10 };
  metrics.recommendationScore = lead.metrics.recommendationScore - 5;
  return { board, lead, rival, metrics };
}

describe("same-position comparison", () => {
  it("does not call tier disagreements, added risk, unknown risk, or missing values dominance", () => {
    const { lead, metrics } = fixture();
    expect(hasPositionQualityConflict(lead.metrics, metrics)).toBe(true);
    expect(hasPositionQualityConflict(lead.metrics, { ...metrics, positionTier: lead.metrics.positionTier! + 1 })).toBe(false);
    expect(hasPositionQualityConflict(lead.metrics, { ...metrics, staticValue: null })).toBe(false);
    expect(hasPositionQualityConflict(lead.metrics, { ...metrics, availability: { ...metrics.availability, penalty: lead.metrics.availability.penalty + 1 } })).toBe(false);
    expect(hasPositionQualityConflict(lead.metrics, { ...metrics, availability: { ...metrics.availability, classification: "unknown" } })).toBe(false);
  });
  it("uses timing only after position representatives are selected and removes separate demand", () => {
    const { board, lead, rival, metrics } = fixture();
    lead.metrics.components.demand = 0;
    metrics.components.demand = 0;
    const other = draftChoiceFixture().boardInput.players.find(p => p.position !== lead.player.position)!;
    board.recommendations = [lead.player, rival, other];
    board.metricsByPlayerId[other.player_id] = { ...lead.metrics,
      recommendationScore: metrics.recommendationScore + 1,
      components: { ...lead.metrics.components, demand: 10 } };
    expect(selectPositionPolicy(board, "position-timing")?.player_id).toBe(rival.player_id);
  });
  it("competes across positions with each selected player's own score", () => {
    const { board, lead, rival, metrics } = fixture();
    board.recommendations = [lead.player, rival];
    expect(selectPositionPolicy(board, "quality-guard")?.player_id).toBe(rival.player_id);
    const other = draftChoiceFixture().boardInput.players.find(p => p.position !== lead.player.position)!;
    board.recommendations.push(other);
    board.metricsByPlayerId[other.player_id] = { ...lead.metrics, playerId: other.player_id, recommendationScore: metrics.recommendationScore + 1 };
    expect(selectPositionPolicy(board, "quality-guard")?.player_id).toBe(other.player_id);
    expect(board.topRecommendation?.player.player_id).toBe(lead.player.player_id);
  });
});
