import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import RosterSlots from "@/app/draft-assistant/_components/RosterSlots";
import type { DraftedPlayer, RankedPlayer, RosterSlot } from "@/lib/schemas";

function assignToSlots(
  baseSlots: { slot: RosterSlot; player: DraftedPlayer | null }[],
  preview: RankedPlayer
) {
  const slots = baseSlots.map((s) => ({ ...s }));
  const findIndex = (s: RosterSlot) =>
    slots.findIndex((x) => x.slot === s && x.player === null);

  // Try primary position
  const posIndex = findIndex(preview.position as RosterSlot);
  if (posIndex !== -1) {
    slots[posIndex].player = preview as DraftedPlayer;
    return slots;
  }
  // Try FLEX
  if ((["RB", "WR", "TE"] as RosterSlot[]).includes(preview.position as any)) {
    const flexIndex = findIndex("FLEX");
    if (flexIndex !== -1) {
      slots[flexIndex].player = preview as DraftedPlayer;
      return slots;
    }
  }
  // Fallback to BN
  const bnIndex = findIndex("BN");
  if (bnIndex !== -1) {
    slots[bnIndex].player = preview as DraftedPlayer;
  }
  return slots;
}

export default function PreviewPickDialog({
  open,
  onOpenChange,
  baseSlots,
  player,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  baseSlots: { slot: RosterSlot; player: DraftedPlayer | null }[];
  player: RankedPlayer | null;
}) {
  const slots = React.useMemo(
    () => (player ? assignToSlots(baseSlots, player) : baseSlots),
    [baseSlots, player]
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Preview Pick {player ? `— ${player.name}` : ""}
          </DialogTitle>
          <DialogDescription>
            Preview how this player would fit into your current roster.
          </DialogDescription>
        </DialogHeader>
        <RosterSlots slots={slots} highlightPlayerId={player?.player_id} />
      </DialogContent>
    </Dialog>
  );
}
