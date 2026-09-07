"use client";
import { byeCoverage } from "../_lib/draftTableReview";
import { useDraftData } from "../_contexts/DraftDataContext";
import { getChoicePickWindow, formatDraftPick } from "@/lib/draftLookaheadCore";

export default function DraftTableFacts() {
  const { choiceSnapshot, userRosterSlots } = useDraftData();
  if (!choiceSnapshot) return null;
  const window = getChoicePickWindow(choiceSnapshot.boardInput);
  const open = Object.entries(choiceSnapshot.boardInput.userPositionNeeds)
    .filter(([slot, count]) => slot !== "BN" && count > 0)
    .map(([slot, count]) => `${count} ${slot === "DEF" ? "D/ST" : slot}`);
  const coverage = byeCoverage(userRosterSlots).filter(({ added }) => added.length > 0);
  return <div className="space-y-1 rounded-md border bg-muted/20 p-3 text-xs" data-testid="draft-table-facts">
    <p>{window.state === "unknown" ? "Pick order incomplete" : window.state === "complete" ? "Your draft picks are complete" : <>
      {window.onClock ? "Your pick" : "Upcoming pick"} {formatDraftPick(window.ownPick, choiceSnapshot.boardInput.teams)} (#{window.ownPick}).
      {window.beforeOwn ? ` ${window.beforeOwn} selections before you.` : ""}
      {window.nextOwnPick ? ` Then ${window.betweenOwn} opponent selections until ${formatDraftPick(window.nextOwnPick, choiceSnapshot.boardInput.teams)} (#${window.nextOwnPick}).` : " Your final selection."}
    </>}</p>
    <p>Open: {open.join(", ") || "all starting slots covered"}.</p>
    {coverage.map(({ week, absent, added }) => <div key={week}>
      <p title={absent.join(", ")}>Bye {week}: uncovered {added.join(", ")}.</p>
    </div>)}

  </div>;
}
