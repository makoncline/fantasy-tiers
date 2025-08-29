import React from "react";
import { Button } from "@/components/ui/button";

export function RefreshButton({
  loading,
  onRefresh,
}: {
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <Button
      type="button"
      onClick={onRefresh}
      disabled={loading}
      aria-busy={loading}
    >
      {loading ? "Loading..." : "Fetch Draft Data"}
    </Button>
  );
}
