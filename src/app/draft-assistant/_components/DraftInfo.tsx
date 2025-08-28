import React from "react";

interface DraftInfoProps {
  name: string;
  draftId: string;
  type?: string;
  teams?: number | string;
  rounds?: number | string;
  season?: string;
  startTime?: number;
  status?: string;
  pickNumber?: number | string;
  scoringType?: string;
}

export function DraftInfo({
  name,
  draftId,
  type,
  teams,
  rounds,
  season,
  startTime,
  status,
  pickNumber,
  scoringType,
}: DraftInfoProps) {
  return (
    <div className="text-sm">
      <div className="font-semibold text-base">{name || "—"}</div>
      <div className="text-muted-foreground mt-1">
        draftId: {draftId || "—"}
      </div>
      <div className="mt-1">
        {(type || "—") + " - "}
        {(teams ?? "—") + " teams - "}
        {(rounds ?? "—") + " rounds - "}
        {scoringType ?? "-"}
      </div>
      <div className="mt-1">
        {(season || "—") + " - "}
        {startTime ? new Date(startTime).toLocaleString() : "—"}
        {" - "}
        {status || "—"}
      </div>
      <div className="mt-1">pick number {pickNumber ?? "—"}</div>
    </div>
  );
}

export default DraftInfo;
