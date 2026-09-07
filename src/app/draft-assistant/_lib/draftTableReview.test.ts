import { expect, it } from "vitest";
import { byeCoverage, candidateByeNote } from "./draftTableReview";
import type { DraftedPlayer, RosterSlot } from "@/lib/schemas";

it("separates bye holes from undrafted slots and uses each bench player once", () => {
  const player = (id: string, position: DraftedPlayer["position"], bye: string): DraftedPlayer => ({ player_id: id, name: id, position, team: "TEST", bye_week: bye, rank: 1, tier: 1 });
  const slots: { slot: RosterSlot; player: DraftedPlayer | null }[] = [
    { slot: "QB", player: player("qb", "QB", "11") },
    { slot: "WR", player: player("wr", "WR", "11") },
    { slot: "TE", player: player("te", "TE", "11") },
    { slot: "FLEX", player: player("flex", "WR", "11") },
    { slot: "DEF", player: null },
    { slot: "BN", player: player("reserve", "WR", "9") },
  ];
  expect(byeCoverage(slots)[0]?.added).toEqual(["1 QB", "1 TE", "1 FLEX"]);
  slots.push({ slot: "BN", player: player("second reserve", "RB", "8") });
  expect(byeCoverage(slots)[0]?.added).toEqual(["1 QB", "1 TE"]);
});

it("labels candidate bye holes relative to the current roster without counting undrafted slots", () => {
  const owned: DraftedPlayer = { player_id: "a", name: "A", position: "WR", team: "TEST", bye_week: "9", rank: 1, tier: 1 };
  const slots: { slot: RosterSlot; player: DraftedPlayer | null }[] = [{slot:"WR",player:owned},{slot:"WR",player:null},{slot:"FLEX",player:null},{slot:"QB",player:null},{slot:"BN",player:null}];
  expect(candidateByeNote(slots, {name:"B",position:"WR",bye_week:9})).toBe("With current roster · Bye 9: uncovered 2 WR.");
  expect(candidateByeNote(slots, {name:"B",position:"WR",bye_week:10})).toBeNull();
});
