"use client";

import { useEffect, useState } from "react";
import { z } from "zod";

export const draftSortIdPreference = z.string().nullable();
export const draftSortDirectionPreference = z.enum(["asc", "desc"]);
export const draftBooleanPreference = z.boolean();
export const draftSourcePreference = z.enum(["sleeper", "fp"]);
export const draftPositionFiltersPreference = z.array(z.enum(["QB", "RB", "WR", "TE", "K", "DEF"]));

// Read after hydration. A failed storage read/write must not block the draft UI.
export function useDraftPreference<T>(key: string, schema: z.ZodType<T>, initial: T) {
  const [value, setValue] = useState(initial);
  const [loaded, setLoaded] = useState(false);
  const storageKey = `fantasy-tiers:draft:${key}`;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw != null) {
        const parsed = schema.safeParse(JSON.parse(raw));
        if (parsed.success) setValue(parsed.data);
      }
    } catch { /* Storage may be blocked or contain invalid JSON. */ }
    setLoaded(true);
  }, [storageKey, schema]);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(storageKey, JSON.stringify(value)); }
    catch { /* Keep this session usable when storage is unavailable. */ }
  }, [storageKey, value, loaded]);
  return [value, setValue] as const;
}
