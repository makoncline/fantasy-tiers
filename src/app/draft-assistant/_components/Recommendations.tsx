// src/components/Recommendations.tsx
import type { RankedPlayer } from "@/lib/schemas";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PlayerTable, mapToPlayerRow } from "./PlayerTable";

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

  return (
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
                <PlayerTable rows={mapToPlayerRow(players)} />
              ) : (
                <p>No players in this category.</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
