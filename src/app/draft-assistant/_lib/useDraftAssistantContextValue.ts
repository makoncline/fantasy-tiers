"use client";

import { useMemo } from "react";
import type { DraftDataContextType } from "../_contexts/DraftDataContext";
import type { Position as DraftAssistantPosition } from "./types";
import type { DraftDetails } from "@/lib/draftDetails";
import type { DraftPick, ScoringType, DraftedPlayer, Position, RosterSlot } from "@/lib/schemas";
import type { AggregatesBundleResponseT } from "@/lib/schemas-bundle";
import type { PlayerWithPick } from "@/lib/types.draft";
import type { buildDraftViewModel } from "@/lib/draftState";
import { buildRosterRequirementsFromDraftSettings } from "@/lib/draftHelpers";
import { normalizePick } from "@/lib/normalizePick";
import { attachDraftValueMetrics } from "@/lib/draftValue";
import { buildPositionTierMapFromBundle, toPlayerRowsFromBundle } from "@/lib/playerRows";

const assistantRosterSlotOrder = ["QB", "RB", "WR", "TE", "FLEX", "K", "DEF"] as const;
type DraftViewModel = ReturnType<typeof buildDraftViewModel>;

export function useDraftAssistantContextValue(props: {
  viewModel: DraftViewModel | null;
  bundle: AggregatesBundleResponseT | undefined;
  draftDetails: DraftDetails | null;
  draftPicks: DraftPick[];
  userId: string;
  userSlot: number;
  scoring: ScoringType;
}): Partial<DraftDataContextType> | null {
  const { viewModel, bundle, draftDetails, draftPicks, userId, userSlot, scoring } = props;
  const teams = draftDetails?.settings.teams ?? 0;

  const league = useMemo(() => {
    if (!draftDetails) return null;
    const requirements = buildRosterRequirementsFromDraftSettings(
      draftDetails.settings
    );
    return {
      teams,
      scoring: scoring,
      roster: {
        QB: requirements.QB,
        RB: requirements.RB,
        WR: requirements.WR,
        TE: requirements.TE,
        K: requirements.K,
        DEF: requirements.DEF,
        FLEX: requirements.FLEX,
        BENCH: requirements.BN,
      },
    };
  }, [draftDetails, scoring, teams]);

  const positionRows = useMemo(() => {
    if (!bundle || !teams) return null;
    const positionTierByPlayerId = buildPositionTierMapFromBundle(bundle);
    const positionTierOptions = { tiersArePositionTiers: true };
    return {
      QB: toPlayerRowsFromBundle(bundle.shards.QB, teams, positionTierOptions),
      RB: toPlayerRowsFromBundle(bundle.shards.RB, teams, positionTierOptions),
      WR: toPlayerRowsFromBundle(bundle.shards.WR, teams, positionTierOptions),
      TE: toPlayerRowsFromBundle(bundle.shards.TE, teams, positionTierOptions),
      K: toPlayerRowsFromBundle(bundle.shards.K, teams, positionTierOptions),
      DEF: toPlayerRowsFromBundle(
        bundle.shards.DEF,
        teams,
        positionTierOptions
      ),
      FLEX: toPlayerRowsFromBundle(
        bundle.shards.FLEX,
        teams,
        { positionTierByPlayerId }
      ),
      ALL: toPlayerRowsFromBundle(bundle.shards.ALL, teams, {
        positionTierByPlayerId,
      }),
    };
  }, [bundle, teams]);

  const pickOverlay = useMemo(() => {
    const overlay = new Map<string, NonNullable<PlayerWithPick["picked"]>>();
    for (const pick of draftPicks) {
      const normalized = normalizePick(pick, teams ? { teams } : undefined);
      if (normalized) overlay.set(normalized.playerId, normalized.meta);
    }
    return overlay;
  }, [draftPicks, teams]);

  const user = useMemo(() => ({ username: userId, user_id: userId, display_name: "You" }), [userId]);

  const playersAllWithPicks = useMemo(() => {
    const rows = positionRows?.ALL ?? [];
    if (!rows.length) return [];
    return rows.map((row) => {
      const meta = pickOverlay.get(row.player_id);
      return meta
        ? {
            ...row,
            picked: meta,
            draftedByMe: meta.drafterId ? meta.drafterId === userId : meta.slot === userSlot,
          }
        : { ...row };
    });
  }, [userId, userSlot, pickOverlay, positionRows]);

  const draftValueBoard = viewModel?.recommendationBoard ?? null;

  const attachDraftValue = useMemo(
    () => (row: PlayerWithPick): PlayerWithPick =>
      attachDraftValueMetrics(
        { ...row,
          draft_projected_points: viewModel?.choiceSnapshot?.values.valuesByPlayerId[row.player_id]?.projectedPoints ?? null,
          draft_raw_value_score: viewModel?.draftRawValuesByPlayerId[row.player_id] ?? null,
          draft_value_label: "Starter-aware value",
        },
        draftValueBoard?.metricsByPlayerId[row.player_id]
      ),
    [draftValueBoard, viewModel?.choiceSnapshot, viewModel?.draftRawValuesByPlayerId]
  );

  const playersAll = useMemo(
    () =>
      playersAllWithPicks
        .map(attachDraftValue)
        .sort(
          (a, b) =>
            (a.draft_recommendation_rank ?? 999_999) -
              (b.draft_recommendation_rank ?? 999_999) ||
            (a.tier_rank ?? a.rank ?? 999_999) -
              (b.tier_rank ?? b.rank ?? 999_999)
        ),
    [attachDraftValue, playersAllWithPicks]
  );

  const playersByPosition = useMemo(() => {
    if (!positionRows) return null;
    const enrich = (rows: PlayerWithPick[]) =>
      rows
        .map((row) => {
          const meta = pickOverlay.get(row.player_id);
          return meta
            ? {
                ...row,
                picked: meta,
                draftedByMe: meta.drafterId ? meta.drafterId === userId : meta.slot === userSlot,
              }
            : { ...row };
        })
        .map(attachDraftValue);

    return {
      QB: enrich(positionRows.QB),
      RB: enrich(positionRows.RB),
      WR: enrich(positionRows.WR),
      TE: enrich(positionRows.TE),
      K: enrich(positionRows.K),
      DEF: enrich(positionRows.DEF),
      FLEX: enrich(positionRows.FLEX),
      ALL: enrich(positionRows.ALL),
    };
  }, [attachDraftValue, userId, userSlot, pickOverlay, positionRows]);

  const draftedIds = useMemo(
    () => new Set(Array.from(pickOverlay.keys())),
    [pickOverlay]
  );

  return useMemo(() => {
    if (!viewModel || !draftDetails) return null;
    return {
      valueSource: viewModel.valueSource,
      sourceComparison: viewModel.sourceComparison,
      username: userId,
      selectedDraftId: draftDetails.draft_id,
      draftSlot: userSlot,
      draftValueStatus: viewModel.draftValueStatus,
      readiness: viewModel.readiness,
      choiceSnapshot: viewModel.choiceSnapshot,
      recommendationBoard: draftValueBoard,
      user,
      drafts: [],
      draftDetails,
      playersBundle: bundle ?? null,
      picks: draftPicks,
      availablePlayers: viewModel.available,
      availableByPosition: viewModel.availableByPosition,
      topAvailablePlayersByPosition: viewModel.topAvailablePlayersByPosition,
      userPositionNeeds:
        viewModel.userRoster?.remainingPositionRequirements ?? {},
      userPositionCounts: viewModel.userRoster?.rosterPositionCounts ?? {},
      userPositionRequirements: viewModel.rosterRequirements,
      getRosterStatus: (pos: DraftAssistantPosition) => {
        const count = viewModel.userRoster?.rosterPositionCounts?.[pos] ?? 0;
        const requirement = viewModel.rosterRequirements?.[pos] ?? 0;
        return { count, requirement, met: requirement > 0 && count >= requirement };
      },
      draftWideNeeds: viewModel.draftWideNeeds,
      userRoster: viewModel.userRoster?.players ?? [],
      userRosterSlots: buildUserRosterSlots(viewModel),
      decisionRows:
        playersAllWithPicks
          .map(attachDraftValue)
          .filter(
            (row) => !row.picked && row.draft_recommendation_rank != null
          )
          .sort(
            (a, b) =>
              (a.draft_recommendation_rank ?? 999_999) -
              (b.draft_recommendation_rank ?? 999_999)
          )
          .slice(0, 12) ?? [],
      topRecommendation:
        playersAllWithPicks
          .map(attachDraftValue)
          .filter(
            (row) => !row.picked && row.draft_recommendation_rank != null
          )
          .sort(
            (a, b) =>
              (a.draft_recommendation_rank ?? 999_999) -
              (b.draft_recommendation_rank ?? 999_999)
          )[0] ?? null,
      rosterConstruction: draftValueBoard?.rosterConstruction ?? null,
      draftContext: viewModel.draftContext,
      sourceHealth: bundle?.sourceHealth ?? null,
      positionRows,
      loading: {
        user: false,
        drafts: false,
        draftDetails: false,
        players: false,
        picks: false,
      },
      error: {
        user: null,
        drafts: null,
        draftDetails: null,
        players: null,
        picks: null,
      },
      league,
      refetchData: () => {},
      lastUpdatedAt: null,
      playersAll,
      playersByPosition,
      draftedIds,
    };
  }, [
    attachDraftValue,
    bundle,
    draftDetails,
    draftPicks,
    userId,
    userSlot,
    draftValueBoard,
    draftedIds,
    league,
    playersAll,
    playersAllWithPicks,
    playersByPosition,
    positionRows,
    user,
    viewModel,
  ]);
}

function buildUserRosterSlots(viewModel: DraftViewModel) {
  const requirements = viewModel.rosterRequirements;
  const players = [...(viewModel.userRoster?.players ?? [])];
  const slots: { slot: RosterSlot; player: DraftedPlayer | null }[] = [];

  for (const slot of assistantRosterSlotOrder) {
    for (let index = 0; index < (requirements[slot] ?? 0); index += 1) {
      const playerIndex = players.findIndex((player) =>
        fitsRosterSlot(player.position, slot)
      );
      slots.push({
        slot,
        player: playerIndex >= 0 ? players.splice(playerIndex, 1)[0] ?? null : null,
      });
    }
  }

  const benchSlots = requirements.BN ?? 0;
  for (let index = 0; index < Math.max(benchSlots, players.length); index += 1) {
    slots.push({ slot: "BN", player: players.shift() ?? null });
  }
  return slots;
}

function fitsRosterSlot(position: Position, slot: RosterSlot) {
  if (position === slot) return true;
  return slot === "FLEX" && ["RB", "WR", "TE"].includes(position);
}
