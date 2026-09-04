import type { Position, RosterSlot } from "@/lib/schemas";

const SINGLE_ROSTER_POSITIONS = ["QB", "TE", "K", "DEF"] as const satisfies
  readonly Position[];

export function isSingleRosterPosition(position: Position) {
  return SINGLE_ROSTER_POSITIONS.some((candidate) => candidate === position);
}

export function canAddPositionToRoster(input: {
  position: Position;
  counts: Partial<Record<Position, number>>;
  requirements: Partial<Record<RosterSlot, number>>;
}) {
  if (!isSingleRosterPosition(input.position)) return true;
  const configured = input.requirements[input.position] ?? 0;
  const maximum = Math.min(1, configured);
  return (input.counts[input.position] ?? 0) < maximum;
}

export function getMinimumRbWrDepth(
  requirements: Partial<Record<RosterSlot, number>>
) {
  const sharedDepth = Math.floor(
    ((requirements.FLEX ?? 0) + (requirements.BN ?? 0)) / 2
  );
  return {
    RB: (requirements.RB ?? 0) + sharedDepth,
    WR: (requirements.WR ?? 0) + sharedDepth,
  };
}
