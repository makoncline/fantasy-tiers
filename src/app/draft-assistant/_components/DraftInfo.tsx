import React from "react";

interface DraftInfoProps {
  name: string;
  draftId?: string;
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
  type,
  teams,
  rounds,
  season,
  status,
  pickNumber,
  scoringType,
}: DraftInfoProps) {
  return (
    <div className="min-w-0">
      <div className="truncate font-semibold">{name || "—"}</div>
      <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
        {teams ? <span>{teams} teams</span> : null}
        {rounds ? <span>{rounds} rounds</span> : null}
        {scoringType ? <span>{scoringType}</span> : null}
        {pickNumber ? <span>slot {pickNumber}</span> : null}
        {season ? <span>{season}</span> : null}
        {type ? <span>{type}</span> : null}
        {status ? <span>{status}</span> : null}
      </div>
    </div>
  );
}

export default DraftInfo;
