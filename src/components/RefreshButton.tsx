import React from "react";

interface RefreshButtonProps {
  loading: boolean;
}

export function RefreshButton({ loading }: RefreshButtonProps) {
  return (
    <button
      type="submit"
      className="bg-blue-500 text-white px-4 py-2 rounded"
      disabled={loading}
    >
      {loading ? "Loading..." : "Fetch Draft Data"}
    </button>
  );
}
