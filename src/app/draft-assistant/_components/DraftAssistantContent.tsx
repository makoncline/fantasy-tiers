import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";
import AvailablePlayers from "@/app/draft-assistant/_components/availablePlayers";
import PositionCompactTables from "@/app/draft-assistant/_components/PositionCompactTables";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import RosterSlots from "@/app/draft-assistant/_components/RosterSlots";
import DraftStatusCard from "@/app/draft-assistant/_components/DraftStatusCard";
import DecisionBoard from "@/app/draft-assistant/_components/DecisionBoard";
import type { DraftPickAction } from "@/app/draft-assistant/_lib/types";

export default function DraftAssistantContent({
  pickAction,
}: {
  pickAction?: DraftPickAction | undefined;
} = {}) {
  const { availablePlayers, loading, error, userRosterSlots, draftDetails } =
    useDraftData();

  const isLoading = Object.values(loading).some(Boolean);
  const hasError = Object.values(error).some(Boolean);
  const isComplete = draftDetails?.status === "complete";

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

      {!isComplete ? <DecisionBoard /> : null}

      <Card id="roster-section">
        <CardHeader>
          <CardTitle>Your Roster</CardTitle>
        </CardHeader>
        <CardContent>
          <RosterSlots slots={userRosterSlots || []} />
        </CardContent>
      </Card>

      <Card id="available-section">
        <CardHeader>
          <CardTitle>
            {isComplete ? "Remaining Player Pool" : "Overall Value Pool"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AvailablePlayers
            availablePlayers={availablePlayers}
            loading={isLoading}
            pickAction={pickAction}
          />
        </CardContent>
      </Card>

      <details
        id="positions-section"
        className="group rounded-md border bg-card text-card-foreground"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">Position Tables</h2>
            <p className="text-xs text-muted-foreground">
              Compare the best remaining options within one position.
            </p>
          </div>
          <span className="text-xs font-medium text-muted-foreground group-open:hidden">
            Show
          </span>
          <span className="hidden text-xs font-medium text-muted-foreground group-open:inline">
            Hide
          </span>
        </summary>
        <div className="border-t p-3">
          <PositionCompactTables pickAction={pickAction} />
        </div>
      </details>
    </div>
  );
}

// Removed page-level refresh + last-updated; handled in status card
