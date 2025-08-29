// src/components/AvailablePlayers.tsx

import React from "react";
import type { DraftedPlayer, RankedPlayer } from "@/lib/schemas";
import { PlayerTable, mapToPlayerRow, type PlayerRow } from "./PlayerTable";
import { Button } from "@/components/ui/button";
import PreviewPickDialog from "./PreviewPickDialog";
import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";

interface AvailablePlayersProps {
  availablePlayers: RankedPlayer[];
  loading: boolean;
}

export default function AvailablePlayers({
  availablePlayers,
  loading,
}: AvailablePlayersProps) {
  if (loading) return <p aria-live="polite">Loading available players...</p>;
  const { userRosterSlots } = useDraftData();
  const [open, setOpen] = React.useState(false);
  const [previewPlayer, setPreviewPlayer] = React.useState<RankedPlayer | null>(
    null
  );

  const rows = mapToPlayerRow(availablePlayers);

  const onPreview = (row: PlayerRow) => {
    const found = availablePlayers.find((p) => p.player_id === row.player_id);
    if (found) {
      setPreviewPlayer(found);
      setOpen(true);
    }
  };

  return (
    <>
      <PlayerTable
        rows={rows}
        renderActions={(row) => (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPreview(row)}
            aria-label="Preview"
            title="Preview"
          >
            {/* eye icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </Button>
        )}
      />
      <PreviewPickDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setPreviewPlayer(null);
        }}
        baseSlots={userRosterSlots}
        player={previewPlayer}
      />
    </>
  );
}
