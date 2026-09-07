"use client";
import { byeCoverage } from "../_lib/draftTableReview";
import { useDraftData } from "../_contexts/DraftDataContext";

export default function DraftTableFacts() {
  const { userRosterSlots } = useDraftData();
  const coverage = byeCoverage(userRosterSlots).filter(({ added, absent }) => added.length > 0 && absent.length >= 2);
  if (!coverage.length) return null;
  return <div className="space-y-1 py-2 text-xs" data-testid="draft-table-facts">
    {coverage.map(({ week, absent, added }) => <div key={week}>
      <p title={absent.join(", ")}>With current roster · Bye {week}: uncovered {added.join(", ")}.</p>
    </div>)}

  </div>;
}
