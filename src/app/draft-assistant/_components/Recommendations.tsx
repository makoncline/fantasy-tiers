// src/components/Recommendations.tsx
import React from "react";
import type { RankedPlayer } from "@/lib/schemas";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PlayerTable, mapToPlayerRow, type PlayerRow } from "./PlayerTable";
import { Button } from "@/components/ui/button";
import PreviewPickDialog from "./PreviewPickDialog";
import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";

type RecCategory =
  | "keyPositions"
  | "bestAvailable"
  | "backups"
  | "nonKeyPositions";
interface RecommendationsProps {
  recommendations: Partial<Record<RecCategory, RankedPlayer[]>> | null;
  loading: boolean;
}

export default function RecommendationsSection({
  recommendations,
  loading,
}: RecommendationsProps) {
  const { userRosterSlots } = useDraftData();
  const [open, setOpen] = React.useState(false);
  const [previewPlayer, setPreviewPlayer] = React.useState<RankedPlayer | null>(
    null
  );
  const LABELS: Record<RecCategory, string> = {
    keyPositions: "Key positions",
    bestAvailable: "Best available",
    backups: "Backups / handcuffs",
    nonKeyPositions: "Non-key positions",
  };
  if (loading) {
    return <p aria-live="polite">Loading recommendations...</p>;
  }

  if (!recommendations) {
    return <p>No recommendations available.</p>;
  }

  const onPreview = (row: PlayerRow, source: RankedPlayer[]) => {
    const found = source.find((p) => p.player_id === row.player_id);
    if (found) {
      setPreviewPlayer(found);
      setOpen(true);
    }
  };

  return (
    <>
      <div className="mt-6 space-y-6">
        {(
          [
            "keyPositions",
            "bestAvailable",
            "backups",
            "nonKeyPositions",
          ] as RecCategory[]
        ).map((category) => {
          const players = recommendations?.[category] ?? [];
          return (
            <Card key={category}>
              <CardHeader>
                <CardTitle>{LABELS[category]}</CardTitle>
              </CardHeader>
              <CardContent>
                {players.length ? (
                  <PlayerTable
                    rows={mapToPlayerRow(players)}
                    renderActions={(row) => (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onPreview(row, players)}
                        aria-label="Preview"
                        title="Preview"
                      >
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
                ) : (
                  <p>No players in this category.</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
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
