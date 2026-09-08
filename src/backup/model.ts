import { z } from "zod";
import { DraftRosterSlotsSchema, DEFAULT_DRAFT_SCORING_RULES, calculateDraftRounds, type DraftScoringRules } from "@/lib/draftLeagueConfig";
import { DraftProjectionStatsSchema, buildStarterAwareValues, calculateBeerPlusProjectedPoints } from "@/lib/beerPlusStrategy";
import { PositionEnum } from "@/lib/schemas";
import { scoringTypeFromReceptionPoints } from "@/lib/scoring";

// Verified in the league's read-only ESPN settings on September 8, 2026.
export const scoringFields = [
  ["passingYard", "Passing yard", .04], ["passingTouchdown", "Passing TD", 4],
  ["interception", "Interception thrown", -2], ["rushingYard", "Rushing yard", .1],
  ["rushingTouchdown", "Rushing TD", 6], ["receivingYard", "Receiving yard", .1],
  ["reception", "Reception (PPR)", 1], ["receivingTouchdown", "Receiving TD", 6],
  ["lostFumble", "Fumble lost", -2],
] as const;
export const referenceFields = [
  ["pass2", "Passing 2-point conversion", 2], ["rush2", "Rushing 2-point conversion", 2], ["rec2", "Receiving 2-point conversion", 2],
  ["pat", "PAT made", 1], ["fgmiss", "Field goal missed", -1], ["fg39", "Field goal 0–39 yards", 3], ["fg49", "Field goal 40–49 yards", 4], ["fg59", "Field goal 50–59 yards", 5], ["fg60", "Field goal 60+ yards", 6],
  ["kickTD", "Kickoff return TD", 6], ["puntTD", "Punt return TD", 6], ["intTD", "Interception return TD", 6], ["fumTD", "Fumble return TD", 6], ["blockTD", "Blocked kick return TD", 6], ["return2", "2-point return", 2], ["safety1", "1-point safety", 1], ["recoveredTD", "Fumble recovered for TD", 6],
  ["sack", "D/ST sack", 1], ["block", "D/ST blocked kick", 2], ["defInt", "D/ST interception", 2], ["defFum", "D/ST fumble recovered", 2], ["safety", "D/ST safety", 2],
  ["pa0", "D/ST points allowed: 0", 5], ["pa6", "D/ST points allowed: 1–6", 4], ["pa13", "D/ST points allowed: 7–13", 3], ["pa17", "D/ST points allowed: 14–17", 1], ["pa27", "D/ST points allowed: 18–27", 0], ["pa34", "D/ST points allowed: 28–34", -1], ["pa45", "D/ST points allowed: 35–45", -3], ["pa46", "D/ST points allowed: 46+", -5],
  ["ya99", "D/ST yards allowed: under 100", 5], ["ya199", "D/ST yards allowed: 100–199", 3], ["ya299", "D/ST yards allowed: 200–299", 2], ["ya349", "D/ST yards allowed: 300–349", 0], ["ya399", "D/ST yards allowed: 350–399", -1], ["ya449", "D/ST yards allowed: 400–449", -3], ["ya499", "D/ST yards allowed: 450–499", -5], ["ya549", "D/ST yards allowed: 500–549", -6], ["ya550", "D/ST yards allowed: 550+", -7],
] as const;
const rates = z.record(z.string(), z.number().min(-100).max(100));
export const RulesSchema = z.object({
  teams: z.number().int().min(2).max(32), slot: z.number().int().min(1).max(32),
  draftType: z.enum(["snake", "linear"]), timer: z.number().int().min(0).max(600),
  roster: DraftRosterSlotsSchema,
  limits: z.object({ QB: z.number().int().min(0).max(32), RB: z.number().int().min(0).max(32), WR: z.number().int().min(0).max(32), TE: z.number().int().min(0).max(32), K: z.number().int().min(0).max(32), DEF: z.number().int().min(0).max(32) }),
  scoring: rates.refine(v => scoringFields.every(([key]) => typeof v[key] === "number"), "All scoring fields are required."),
  reference: rates.refine(v => referenceFields.every(([key]) => typeof v[key] === "number"), "All reference rules are required."),
}).superRefine((rules, ctx) => {
  if (rules.slot > rules.teams) ctx.addIssue({ code: "custom", path: ["slot"], message: "Pick must not exceed team count." });
  if (calculateDraftRounds(rules.roster) < 1) ctx.addIssue({ code: "custom", path: ["roster", "BENCH"], message: "Add at least one roster spot." });
  for (const pos of PositionEnum.options) if (rules.limits[pos] > 0 && rules.limits[pos] < rules.roster[pos]) ctx.addIssue({ code: "custom", path: ["limits", pos], message: "Maximum must cover starters. Use 0 for no limit." });
});
export type Rules = z.infer<typeof RulesSchema>;
export const WIFE_RULES: Rules = RulesSchema.parse({
  teams: 12, slot: 7, draftType: "snake", timer: 45,
  roster: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DEF: 1, BENCH: 7, IR: 1 },
  limits: { QB: 4, RB: 8, WR: 8, TE: 3, K: 3, DEF: 3 },
  scoring: Object.fromEntries(scoringFields.map(([key, , value]) => [key, value])),
  reference: Object.fromEntries(referenceFields.map(([key, , value]) => [key, value])),
});
const RankSchema = z.object({ tier: z.number().nullable(), overall: z.number().nullable(), flex: z.number().nullable(), ecr: z.number().nullable(), adp: z.number().nullable() });
export const SheetPlayerSchema = z.object({
  id: z.string(), name: z.string(), pos: PositionEnum, team: z.string().nullable(), bye: z.number().nullable(), status: z.string().nullable(),
  stats: DraftProjectionStatsSchema.nullable(),
  ranks: z.object({ std: RankSchema, half: RankSchema, ppr: RankSchema }),
});
export const SheetDataSchema = z.object({ season: z.string(), fpDate: z.string(), sleeperDate: z.string(), rankingsDate: z.string(), players: z.array(SheetPlayerSchema) });
export type SheetData = z.infer<typeof SheetDataSchema>;
export const MarksSchema = z.record(z.string(), z.enum(["taken", "mine"]));
export type Marks = z.infer<typeof MarksSchema>;
export const SavedSchema = z.object({ version: z.literal(1), rules: RulesSchema, marks: MarksSchema });
export const STORAGE_KEY = "fantasy-espn-emergency-sheet-v1";
export function calculateSheet(data: SheetData, rules: Rules) {
  const scoring = scoringTypeFromReceptionPoints(rules.scoring.reception!);
  const scoringRules: DraftScoringRules = { ...DEFAULT_DRAFT_SCORING_RULES };
  for (const [key] of scoringFields) scoringRules[key] = rules.scoring[key]!;
  const points = data.players.flatMap(p => p.stats ? [{ playerId: p.id, position: p.pos, projectedPoints: calculateBeerPlusProjectedPoints({ position: p.pos, stats: p.stats, scoringRules }) }] : []);
  const values = buildStarterAwareValues({ teams: rules.teams, rosterSlots: rules.roster, players: points });
  return data.players.map(p => ({ ...p, ...p.ranks[scoring], pts: values.valuesByPlayerId[p.id]?.projectedPoints ?? null, val: rules.roster[p.pos] > 0 || (["RB", "WR", "TE"].includes(p.pos) && rules.roster.FLEX > 0) ? values.valuesByPlayerId[p.id]?.value ?? null : null }));
}
