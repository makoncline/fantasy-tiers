"use client";

import { useSearchParams } from "next/navigation";

/** URL-as-state with zero duplication */
export function useQueryParam(key: string) {
  const searchParams = useSearchParams();
  const value = searchParams.get(key) ?? ""; // read directly from the URL

  // write to the URL without a navigation (no RSC refetch)
  function set(
    next: string | null,
    opts: { history?: "push" | "replace" } = {}
  ) {
    // Always start from the live URL to avoid stale snapshots when batching
    const params = new URLSearchParams(window.location.search);
    if (!next) params.delete(key);
    else params.set(key, next);

    const paramStr = params.toString();
    const q = paramStr ? `?${paramStr}` : "";
    const url = `${window.location.pathname}${q}${window.location.hash}`;
    const op = opts.history === "push" ? "pushState" : "replaceState";
    window.history[op](null, "", url); // Next syncs this with useSearchParams()
  }

  return [value, set] as const;
}

export default useQueryParam;
