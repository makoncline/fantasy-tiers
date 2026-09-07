"use client";

import { createContext, useContext, type ReactNode } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useDraftPreference } from "@/hooks/useDraftPreference";
import { useDraftData } from "../_contexts/DraftDataContext";

const WatchlistIds = z.array(z.string().min(1));
const WatchlistContext = createContext<{ ids: string[]; toggle: (id: string) => void } | null>(null);
export const useDraftWatchlist = () => useContext(WatchlistContext);

export function DraftWatchlistProvider({ children }: { children: ReactNode }) {
  const { selectedDraftId } = useDraftData();
  const [ids, setIds] = useDraftPreference(`watchlist:${selectedDraftId ?? "local"}`, WatchlistIds, []);
  const toggle = (id: string) => setIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  return <WatchlistContext.Provider value={{ ids, toggle }}>{children}</WatchlistContext.Provider>;
}

export function WatchlistButton({ playerId, name, labelled = false }: { playerId: string; name: string; labelled?: boolean }) {
  const watchlist = useDraftWatchlist();
  if (!watchlist) return null;
  const selected = watchlist.ids.includes(playerId);
  return <Button type="button" variant="outline" size="sm" className="h-11 min-w-11 px-2 text-xs sm:h-7 sm:min-w-7" aria-pressed={selected}
    aria-label={`${selected ? "Remove" : "Add"} ${name} ${selected ? "from" : "to"} watch list`}
    onClick={() => watchlist.toggle(playerId)}>{labelled ? "Watch " : ""}{selected ? "−" : "+"}</Button>;
}
