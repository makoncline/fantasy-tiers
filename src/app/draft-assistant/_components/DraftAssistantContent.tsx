import React from "react";
import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";
import UserRoster from "@/app/draft-assistant/_components/userRoster";
// import PositionNeeds from "@/app/draft-assistant/_components/positionNeeds";
// import RecommendationsSection from "@/app/draft-assistant/_components/Recommendations";
import AvailablePlayers from "@/app/draft-assistant/_components/availablePlayers";
import PositionCompactTables from "@/app/draft-assistant/_components/PositionCompactTables";
// import { RefreshButton } from "@/app/draft-assistant/_components/RefreshButton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
// import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import RosterSlots from "@/app/draft-assistant/_components/RosterSlots";
import DraftStatusCard from "@/app/draft-assistant/_components/DraftStatusCard";
import { Badge } from "@/components/ui/badge";

// Removed ticker/ago helpers; status card shows freshness

export default function DraftAssistantContent() {
  const {
    recommendations,
    availablePlayers,
    userPositionNeeds,
    userPositionCounts,
    draftWideNeeds,
    userRoster,
    loading,
    error,
    refetchData,
    lastUpdatedAt,
    userRosterSlots,
  } = useDraftData();

  const isLoading = Object.values(loading).some(Boolean);
  const hasError = Object.values(error).some(Boolean);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (hasError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          There was a problem loading draft data. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <DraftStatusCard />

      <Card id="roster-section">
        <CardHeader>
          <CardTitle>Your Roster</CardTitle>
        </CardHeader>
        <CardContent>
          <RosterSlots slots={userRosterSlots || []} />
        </CardContent>
      </Card>

      {/* Positions section header */}
      <div id="positions-section" className="mb-4">
        <h2 className="text-2xl font-semibold">Position Rankings</h2>
      </div>

      {/* Positions + Available players are grouped to keep toolbar pinned */}
      <PositionCompactTables />

      {/* Bring back page-level Available section */}
      <Card id="available-section">
        <CardHeader>
          <CardTitle>Available Ranked Players</CardTitle>
        </CardHeader>
        <CardContent>
          <AvailablePlayers
            availablePlayers={availablePlayers}
            loading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// Removed page-level refresh + last-updated; handled in status card
