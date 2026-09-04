import type {
  SimBotStrategyId,
  SimDraftType,
  SimRosterSlots,
} from "../../src/lib/simDraft";
import {
  DEFAULT_DRAFT_ROSTER_SLOTS,
  DEFAULT_DRAFT_SCORING_RULES,
} from "../../src/lib/draftLeagueConfig";

export type SimBatchArgs = {
  botStrategy: SimBotStrategyId;
  draftType: SimDraftType;
  outDir: string;
  runs: number;
  reception: number;
  seed: string;
  slotsArg?: string | undefined;
  teams: number;
  rosterSlots: SimRosterSlots;
};

export function parseSimBatchArgs(
  rawArgs: string[],
  options: { seed: string }
): SimBatchArgs {
  const parsed: SimBatchArgs = {
    botStrategy: "sleeper-market-v1",
    draftType: "snake",
    outDir: "data/draft-results",
    runs: 1,
    reception: DEFAULT_DRAFT_SCORING_RULES.reception,
    seed: options.seed,
    teams: 12,
    rosterSlots: { ...DEFAULT_DRAFT_ROSTER_SLOTS },
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg || arg === "--") continue;
    if (arg === "--bot-strategy") {
      parsed.botStrategy = parseSimBotStrategy(
        requireArgument(rawArgs, (index += 1), arg)
      );
    } else if (arg === "--draft-type") {
      parsed.draftType = parseSimDraftType(
        requireArgument(rawArgs, (index += 1), arg)
      );
    } else if (arg === "--out-dir") {
      parsed.outDir = requireArgument(rawArgs, (index += 1), arg);
    } else if (arg === "--runs") {
      parsed.runs = parsePositiveInteger(
        requireArgument(rawArgs, (index += 1), arg),
        arg
      );
    } else if (arg === "--reception") {
      parsed.reception = parseFiniteNumber(
        requireArgument(rawArgs, (index += 1), arg),
        arg
      );
    } else if (arg === "--seed") {
      parsed.seed = requireArgument(rawArgs, (index += 1), arg);
    } else if (arg === "--slot" || arg === "--slots") {
      parsed.slotsArg = requireArgument(rawArgs, (index += 1), arg);
    } else if (arg === "--teams") {
      parsed.teams = parsePositiveInteger(
        requireArgument(rawArgs, (index += 1), arg),
        arg
      );
    } else if (arg.startsWith("--slots-")) {
      setDraftRosterSlot(
        parsed.rosterSlots,
        arg,
        requireArgument(rawArgs, (index += 1), arg)
      );
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

export function parseDraftSlots(value: string | undefined, teams: number) {
  if (!value) return [Math.ceil(teams / 2)];
  if (value === "all") {
    return Array.from({ length: teams }, (_, index) => index + 1);
  }
  return value.split(",").flatMap((raw) => {
    const part = raw.trim();
    if (!part) return [];
    if (part.includes("-")) {
      const [startRaw, endRaw] = part.split("-");
      const start = parseDraftSlot(startRaw ?? "", teams);
      const end = parseDraftSlot(endRaw ?? "", teams);
      if (end < start) throw new Error(`Invalid slot range ${part}.`);
      return Array.from({ length: end - start + 1 }, (_, index) => start + index);
    }
    return [parseDraftSlot(part, teams)];
  });
}

export function setDraftRosterSlot(
  rosterSlots: SimRosterSlots,
  flag: string,
  value: string
) {
  const key = flag.replace("--slots-", "").toUpperCase();
  if (!isRosterSlotKey(key)) {
    throw new Error(`Unknown roster slot flag: ${flag}`);
  }
  rosterSlots[key] = parseNonNegativeInteger(value, flag);
}

export function parseSimDraftType(value: string): SimDraftType {
  if (value === "snake" || value === "linear") return value;
  throw new Error(`Invalid draft type ${value}; expected snake or linear.`);
}

export function parseSimBotStrategy(value: string): SimBotStrategyId {
  if (value === "sleeper-adp-needs" || value === "sleeper-market-v1") {
    return value;
  }
  throw new Error(
    `Invalid bot strategy ${value}; expected sleeper-adp-needs or sleeper-market-v1.`
  );
}

export function parsePositiveInteger(value: string, flag: string) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1) {
    throw new Error(`Invalid ${flag}: ${value}.`);
  }
  return numeric;
}

export function parseFiniteNumber(value: string, flag: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`Invalid ${flag}: ${value}.`);
  }
  return numeric;
}

export function requireArgument(args: string[], index: number, flag: string) {
  const value = args[index];
  if (!value) throw new Error(`Missing value for ${flag}`);
  return value;
}

export function timestamp() {
  return new Date().toISOString().replace(/\D/g, "").slice(0, 14);
}

function parseDraftSlot(value: string, teams: number) {
  const slot = Number(value);
  if (!Number.isInteger(slot) || slot < 1 || slot > teams) {
    throw new Error(`Invalid slot ${value}; expected 1-${teams}.`);
  }
  return slot;
}

function parseNonNegativeInteger(value: string, flag: string) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) {
    throw new Error(`Invalid ${flag}: ${value}.`);
  }
  return numeric;
}

function isRosterSlotKey(value: string): value is keyof SimRosterSlots {
  return value === "QB" ||
    value === "RB" ||
    value === "WR" ||
    value === "TE" ||
    value === "K" ||
    value === "DEF" ||
    value === "FLEX" ||
    value === "BENCH" ||
    value === "IR";
}
