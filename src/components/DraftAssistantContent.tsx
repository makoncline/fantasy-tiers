import React from "react";
import { useDraftData } from "@/contexts/DraftDataContext";
import UserRoster from "@/components/userRoster";
import PositionNeeds from "@/components/positionNeeds";
import RecommendationsSection from "@/components/reccomendations";
import AvailablePlayers from "@/components/availablePlayers";
import { RefreshButton } from "@/components/RefreshButton";

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
  } = useDraftData();

  const isLoading = Object.values(loading).some(Boolean);
  const hasError = Object.values(error).some(Boolean);

  if (isLoading) {
    return <div>Loading draft data...</div>;
  }

  if (hasError) {
    return <div>Error loading draft data. Please try again.</div>;
  }

  return (
    <>
      <details open className="my-6">
        <summary className="cursor-pointer text-xl font-bold mb-4">
          Your Roster
        </summary>
        <UserRoster players={userRoster || []} />
      </details>
      <RefreshButton loading={isLoading} />
      <details open className="my-6">
        <summary className="cursor-pointer text-xl font-bold mb-4">
          Position Needs
        </summary>
        <PositionNeeds
          userPositionNeeds={userPositionNeeds}
          userPositionCounts={userPositionCounts}
          draftWideNeeds={draftWideNeeds}
        />
      </details>
      <RefreshButton loading={isLoading} />
      <details open className="my-6">
        <summary className="cursor-pointer text-xl font-bold mb-4">
          Recommendations
        </summary>
        <RecommendationsSection
          recommendations={recommendations}
          loading={isLoading}
        />
      </details>
      <RefreshButton loading={isLoading} />
      <details className="my-6">
        <summary className="cursor-pointer text-xl font-bold mb-4">
          Available Ranked Players
        </summary>
        <AvailablePlayers
          availablePlayers={availablePlayers}
          loading={isLoading}
        />
      </details>
    </>
  );
}
