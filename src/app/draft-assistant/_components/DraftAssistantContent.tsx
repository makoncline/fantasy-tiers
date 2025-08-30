import React from "react";
import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";
import UserRoster from "@/app/draft-assistant/_components/userRoster";
import PositionNeeds from "@/app/draft-assistant/_components/positionNeeds";
import RecommendationsSection from "@/app/draft-assistant/_components/Recommendations";
import AvailablePlayers from "@/app/draft-assistant/_components/availablePlayers";
import PositionTables from "@/app/draft-assistant/_components/PositionTables";
import { RefreshButton } from "@/app/draft-assistant/_components/RefreshButton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import RosterSlots from "@/app/draft-assistant/_components/RosterSlots";

function useTicker(intervalMs: number = 1000) {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    const id = setInterval(force, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

function formatAgo(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m ago`;
  if (m > 0) return `${m}m ${s % 60}s ago`;
  return `${s}s ago`;
}

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
      <Card>
        <CardHeader>
          <CardTitle>Your Roster</CardTitle>
        </CardHeader>
        <CardContent>
          <RosterSlots slots={userRosterSlots || []} />
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <RefreshButton loading={isLoading} onRefresh={refetchData} />
        <LastFetchIndicator lastUpdatedAt={lastUpdatedAt} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Position Needs</CardTitle>
        </CardHeader>
        <CardContent>
          <PositionNeeds
            userPositionNeeds={userPositionNeeds}
            userPositionCounts={userPositionCounts}
            draftWideNeeds={draftWideNeeds}
          />
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <RecommendationsSection
            recommendations={recommendations}
            loading={isLoading}
          />
        </CardContent>
      </Card>

      <Separator />

      {/* Position lists above the Available Ranked Players card */}
      <PositionTables />

      <Separator />

      <Card>
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

function LastFetchIndicator({
  lastUpdatedAt,
}: {
  lastUpdatedAt: number | null;
}) {
  // Tick every second so the label stays fresh.
  useTicker(1000);
  if (!lastUpdatedAt) {
    return <span className="text-sm text-muted-foreground">Updated —</span>;
  }
  const diff = Date.now() - lastUpdatedAt;
  return (
    <span className="text-sm text-muted-foreground">
      Updated {formatAgo(Math.max(0, diff))}
    </span>
  );
}

 
