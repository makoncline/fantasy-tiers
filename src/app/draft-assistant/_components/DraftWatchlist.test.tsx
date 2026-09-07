/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { DraftDataStaticProvider } from "../_contexts/DraftDataContext";
import { DraftWatchlistProvider, WatchlistButton } from "./DraftWatchlistContext";
import { DraftWatchlist } from "./DraftWatchlist";
import type { PlayerWithPick } from "@/lib/types.draft";

it("keeps an unlimited per-draft watch list current and removable through its player table", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  const host = document.createElement("div");document.body.append(host);const root = createRoot(host);
  const rows: PlayerWithPick[] = Array.from({length:4},(_,i)=>({player_id:String(i),name:`Player ${i}`,position:"RB",team:"TEST",bye_week:8,fp_rank_ave:i+1,fp_rank_pos:i+1,draft_raw_value_score:40-i,draft_value_score:50-i}));
  const render = (playersAll: PlayerWithPick[], key="first") => act(()=>root.render(<DraftDataStaticProvider value={{playersAll,selectedDraftId:"watch-test"}}><DraftWatchlistProvider key={key}><div id="buttons">{rows.map(row=><WatchlistButton key={row.player_id} playerId={row.player_id} name={row.name}/>)}</div><DraftWatchlist/></DraftWatchlistProvider></DraftDataStaticProvider>));
  try {
    render(rows);
    for(const button of host.querySelectorAll<HTMLButtonElement>('#buttons button'))act(()=>button.click());
    expect(host.querySelector('#watch-list')?.textContent).toContain("Watch list (4)");
    expect([...host.querySelectorAll('#watch-list th')].map(th=>th.textContent)).toEqual(["FP Tier (Overall)","Player","TM/BYE","PTS","VAL ▼","ADJ","ADP","Watch list"]);
    render([{...rows[0]!,picked:{overall:1},draft_value_score:null},...rows.slice(1)],"reload");
    expect(host.querySelector('#watch-list')?.textContent).toContain("Watch list (4)");
    expect(host.querySelector('#watch-list [data-row-drafted="true"]')?.textContent).toContain("Drafted");
    act(()=>host.querySelector<HTMLButtonElement>('#watch-list button[aria-label="Remove Player 0 from watch list"]')!.click());
    expect(host.querySelector('#watch-list')?.textContent).toContain("Watch list (3)");
    expect(host.querySelector('#buttons button')?.getAttribute('aria-pressed')).toBe('false');
  } finally {act(()=>root.unmount());host.remove();localStorage.clear();vi.unstubAllGlobals();}
});
