import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
import { z } from "zod";

import {
  DEFAULT_PLAYER_ID_CACHE_PATH,
  loadPlayerIdCache,
  lookupPlayerIdCache,
  positionLabel,
  savePlayerIdCache,
  upsertPlayerIdCache,
  type PlayerIdCache,
} from "./player-id-cache";

const BASE_URL = "https://www.footballguys.com";
const DEFAULT_INPUT_PATH = "data/footballguys-rate-my-team-request.json";
const DEFAULT_ENV_PATH = "data/footballguys-session.env";
const DEFAULT_OUTPUT_PATH = "data/footballguys-rate-my-team-report.html";
const DEFAULT_RESULT_PREFIX = "footballguys";
const ERROR_BODY_PREVIEW_LENGTH = 700;

const RosterSettingsSchema = z.object({
  leagueName: z.string().min(1),
  numTeams: z.string().min(1),
  ppr: z.string().min(1),
  passingYards: z.string().min(1),
  passingTouchdowns: z.string().min(1),
  quarterbacks: z.string().min(1),
  runningBacks: z.string().min(1),
  wideReceivers: z.string().min(1),
  tightEnds: z.string().min(1),
  flex: z.string().min(1),
  superflex: z.string().min(1),
  teamDefense: z.string().min(1),
  kicker: z.string().min(1),
  teamName: z.string().min(1),
});

const PlayerInputSchema = z.union([
  z.string().min(1),
  z.object({
    id: z.string().min(1).optional(),
    name: z.string().min(1),
    player_id: z.coerce.string().min(1).optional(),
    position: z.string().min(1).optional(),
    sleeperId: z.coerce.string().min(1).optional(),
  }),
]);

const RequestSchema = z.object({
  currentReport: z
    .object({
      fragmentUrl: z.string().url().optional(),
    })
    .optional(),
  manualEntryFields: RosterSettingsSchema.extend({
    rosterPlayers: z.array(z.string().min(1)).optional(),
    teamRoster: z.array(z.string().min(1)).optional(),
    players: z.array(PlayerInputSchema).optional(),
  }),
});

const AutocompleteResultSchema = z.object({
  label: z.string(),
  value: z.string(),
});
const AutocompleteResultsSchema = z.array(AutocompleteResultSchema);

const ValidationResponseSchema = z.object({
  valid: z.boolean(),
  message: z.string().optional(),
});

type RequestConfig = z.infer<typeof RequestSchema>;
type PlayerInput = z.infer<typeof PlayerInputSchema>;
type ErrorArtifactOptions = {
  dir: string;
  prefix: string;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = args.input ?? DEFAULT_INPUT_PATH;
  const resultPrefix = safeFilePrefix(args.reportPrefix ?? DEFAULT_RESULT_PREFIX);
  const outputPath =
    args.output ??
    (args.resultDir
      ? path.join(args.resultDir, `${resultPrefix}-report.html`)
      : DEFAULT_OUTPUT_PATH);
  const errorArtifacts = {
    dir: args.resultDir ?? path.dirname(outputPath),
    prefix: resultPrefix,
  } satisfies ErrorArtifactOptions;
  const envPath = args.env ?? DEFAULT_ENV_PATH;
  const idCachePath = args.idCache ?? DEFAULT_PLAYER_ID_CACHE_PATH;
  loadEnvFile(envPath);

  const cookie = process.env.FBG_COOKIE;
  if (!cookie) {
    throw new Error(
      `Missing FBG_COOKIE. Capture Chrome cookies into ${envPath} or set FBG_COOKIE.`
    );
  }
  const userAgent = process.env.FBG_USER_AGENT ?? "Mozilla/5.0";
  const input = RequestSchema.parse(
    JSON.parse(await readFile(inputPath, "utf8"))
  );
  const idCache = loadPlayerIdCache(idCachePath);

  const reportUrl = args.existing
    ? input.currentReport?.fragmentUrl
    : await createReport(input, { cookie, userAgent }, idCache, errorArtifacts);

  if (!reportUrl) {
    throw new Error("No report fragment URL is available.");
  }

  const html = await fetchText(reportUrl, { cookie, userAgent }, {
    artifacts: errorArtifacts,
    phase: "report-fragment",
  });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html);

  const summary = summarizeReport(html);
  const resultSummary = {
    reportUrl,
    outputPath,
    bytes: html.length,
    ...summary,
  };
  if (args.resultDir) {
    const summaryPath = path.join(args.resultDir, `${resultPrefix}-summary.json`);
    await writeFile(summaryPath, JSON.stringify(resultSummary, null, 2));
  }
  await savePlayerIdCache(idCache, idCachePath);
  console.log(
    JSON.stringify(
      resultSummary,
      null,
      2
    )
  );
}

async function createReport(
  input: RequestConfig,
  auth: { cookie: string; userAgent: string },
  idCache: PlayerIdCache,
  errorArtifacts: ErrorArtifactOptions
) {
  const playerIds = await resolveRosterPlayerIds(input, auth, idCache);
  const form = buildFormData(input.manualEntryFields, playerIds);

  const validationResponse = await fetch(
    `${BASE_URL}/rate-my-team/validate-manual-entry`,
    {
      method: "POST",
      body: form,
      headers: authHeaders(auth),
    }
  );
  const validationText = await readResponseText(validationResponse, {
    artifacts: errorArtifacts,
    phase: "validate-manual-entry",
    url: `${BASE_URL}/rate-my-team/validate-manual-entry`,
  });
  const validation = ValidationResponseSchema.parse(
    JSON.parse(validationText)
  );
  if (!validation.valid) {
    throw new Error(validation.message ?? "Footballguys validation failed.");
  }

  const reportResponse = await fetch(`${BASE_URL}/rate-my-team/league/form`, {
    method: "POST",
    body: buildFormData(input.manualEntryFields, playerIds),
    headers: authHeaders(auth),
    redirect: "manual",
  });
  if (!isRedirectOrOk(reportResponse)) {
    await saveFailedResponse(reportResponse, {
      artifacts: errorArtifacts,
      phase: "league-form",
      url: `${BASE_URL}/rate-my-team/league/form`,
    });
  }
  const location = reportResponse.headers.get("location") ?? reportResponse.url;
  const reportPageUrl = new URL(location, BASE_URL);
  const [, , year, leagueSlug, teamSlug] = reportPageUrl.pathname.split("/");
  if (!year || !leagueSlug || !teamSlug) {
    throw new Error(`Unexpected report URL: ${reportPageUrl.toString()}`);
  }
  reportPageUrl.searchParams.set("componentIdNum", "1");
  reportPageUrl.searchParams.set("teamSlug", teamSlug);
  reportPageUrl.searchParams.set("leagueSlug", leagueSlug);
  reportPageUrl.searchParams.set("generate", "true");
  reportPageUrl.searchParams.set("reload", "1");
  return reportPageUrl.toString();
}

async function resolveRosterPlayerIds(
  input: RequestConfig,
  auth: { cookie: string; userAgent: string },
  idCache: PlayerIdCache
) {
  const fields = input.manualEntryFields;
  if (fields.rosterPlayers?.length) return fields.rosterPlayers;
  if (fields.teamRoster?.length) return fields.teamRoster;
  if (!fields.players?.length) {
    throw new Error("Provide rosterPlayers, teamRoster, or players.");
  }
  const ids: string[] = [];
  for (const player of fields.players) {
    const playerInfo = readPlayerInput(player);
    if (playerInfo.id) {
      ids.push(playerInfo.id);
      upsertPlayerIdCache(idCache, {
        footballguysId: playerInfo.id,
        name: playerInfo.name,
        position: playerInfo.position,
        sleeperId: playerInfo.sleeperId,
        source: "request",
      });
      continue;
    }
    const cached = lookupPlayerIdCache(idCache, playerInfo);
    if (cached) {
      ids.push(cached.footballguysId);
      console.log(
        `Resolved ${playerInfo.name} -> ${cached.footballguysId} (${cached.source})`
      );
      continue;
    }
    const url = new URL(`${BASE_URL}/staff/players/autocomplete`);
    url.searchParams.set("term", playerInfo.name);
    const results = AutocompleteResultsSchema.parse(
      await fetchJson(url.toString(), auth, {
        phase: "autocomplete",
      })
    );
    const first = chooseAutocompleteResult(results, player);
    if (!first) {
      throw new Error(`No Footballguys player match for ${playerInfo.name}`);
    }
    ids.push(first.value);
    upsertPlayerIdCache(idCache, {
      footballguysId: first.value,
      label: first.label,
      name: playerInfo.name,
      position: playerInfo.position,
      sleeperId: playerInfo.sleeperId,
      source: "footballguys-autocomplete",
    });
    console.log(`Resolved ${playerInfo.name} -> ${first.label}`);
  }
  return ids;
}

function chooseAutocompleteResult(
  results: z.infer<typeof AutocompleteResultsSchema>,
  player: PlayerInput
) {
  if (typeof player === "string" || !player.position) return results[0];
  const expected = positionLabel(player.position);
  return (
    results.find((result) => result.label.includes(`(${expected},`)) ??
    results[0]
  );
}

function readPlayerInput(player: PlayerInput) {
  if (typeof player === "string") {
    return { name: player };
  }
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    sleeperId: player.sleeperId ?? player.player_id,
  };
}

function buildFormData(
  fields: RequestConfig["manualEntryFields"],
  playerIds: string[]
) {
  const form = new FormData();
  for (const [key, value] of Object.entries(RosterSettingsSchema.parse(fields))) {
    form.append(key, value);
  }
  form.append("teamRoster", JSON.stringify(playerIds));
  for (const id of playerIds) {
    form.append("roster-players[]", id);
  }
  return form;
}

async function fetchJson(
  url: string,
  auth: { cookie: string; userAgent: string },
  options?: {
    artifacts?: ErrorArtifactOptions | undefined;
    phase?: string | undefined;
  }
) {
  const response = await fetch(url, { headers: authHeaders(auth) });
  const text = await readResponseText(response, {
    artifacts: options?.artifacts,
    phase: options?.phase ?? "json",
    url,
  });
  return JSON.parse(text);
}

async function fetchText(
  url: string,
  auth: { cookie: string; userAgent: string },
  options?: {
    artifacts?: ErrorArtifactOptions | undefined;
    phase?: string | undefined;
  }
) {
  const response = await fetch(url, { headers: authHeaders(auth) });
  return readResponseText(response, {
    artifacts: options?.artifacts,
    phase: options?.phase ?? "text",
    url,
  });
}

async function readResponseText(
  response: Response,
  options: {
    artifacts?: ErrorArtifactOptions | undefined;
    phase: string;
    url: string;
  }
) {
  const text = await response.text();
  if (response.ok) return text;
  throw await failedResponseError(response, text, options);
}

function isRedirectOrOk(response: Response) {
  return response.ok || (response.status >= 300 && response.status < 400);
}

async function saveFailedResponse(
  response: Response,
  options: {
    artifacts?: ErrorArtifactOptions | undefined;
    phase: string;
    url: string;
  }
) {
  const text = await response.text();
  throw await failedResponseError(response, text, options);
}

async function failedResponseError(
  response: Response,
  text: string,
  options: {
    artifacts?: ErrorArtifactOptions | undefined;
    phase: string;
    url: string;
  }
) {
  const contentType = response.headers.get("content-type") ?? "";
  const artifactPath = options.artifacts
    ? await writeErrorArtifact({
        body: text,
        contentType,
        artifacts: options.artifacts,
        phase: options.phase,
        status: response.status,
      })
    : null;
  const preview = text.replace(/\s+/g, " ").trim().slice(0, ERROR_BODY_PREVIEW_LENGTH);
  const details = [
    `Footballguys request failed: ${response.status} ${options.url}`,
    `phase=${options.phase}`,
    contentType ? `content-type=${contentType}` : null,
    artifactPath ? `saved=${artifactPath}` : null,
    preview ? `body=${preview}` : null,
  ].filter(Boolean);
  return new Error(details.join(" | "));
}

async function writeErrorArtifact(args: {
  artifacts: ErrorArtifactOptions;
  body: string;
  contentType: string;
  phase: string;
  status: number;
}) {
  await mkdir(args.artifacts.dir, { recursive: true });
  const extension = args.contentType.includes("html")
    ? "html"
    : args.contentType.includes("json")
      ? "json"
      : "txt";
  const filePath = path.join(
    args.artifacts.dir,
    `${safeFilePrefix(args.artifacts.prefix)}-error-${safeFilePrefix(args.phase)}-${args.status}.${extension}`
  );
  await writeFile(filePath, args.body, "utf8");
  return filePath;
}

function authHeaders(auth: { cookie: string; userAgent: string }) {
  return {
    accept: "text/html,application/json;q=0.9,*/*;q=0.8",
    cookie: auth.cookie,
    "user-agent": auth.userAgent,
  };
}

function summarizeReport(html: string) {
  const $ = load(html);
  const ids = $('[id]')
    .toArray()
    .map((element) => $(element).attr("id") ?? "")
    .filter((id) =>
      ["overview", "breakdown", "by-position", "game-plan"].includes(id)
    );
  const gradeAlts = $("img[alt]")
    .toArray()
    .map((element) => $(element).attr("alt") ?? "")
    .filter(Boolean);
  const positionGrades = gradeAlts.filter((alt) =>
    /^(Quarterback|Running Back|Wide Receiver|Tight End) /.test(alt)
  );
  const bodyText = $.text().replace(/\s+/g, " ").trim();
  const overallGrade =
    gradeAlts.find((alt) => /^[A-F][+-]?$/.test(alt)) ??
    bodyText.match(/With a ([A-F][+-]?) overall grade/)?.[1] ??
    null;
  return {
    overallGrade,
    sectionIds: Array.from(new Set(ids)),
    hasRoadblock: bodyText.includes("Unlock the complete analysis"),
    positionGrades: Array.from(new Set(positionGrades)),
  };
}

function loadEnvFile(envPath: string) {
  try {
    const text = readFileSync(envPath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (!key || process.env[key] != null) continue;
      process.env[key] = unquoteEnvValue(rawValue ?? "");
    }
  } catch {
    return;
  }
}

function unquoteEnvValue(rawValue: string) {
  const value = rawValue.trim();
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/'\\''/g, "'");
  }
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

function parseArgs(args: string[]) {
  const parsed: {
    env?: string;
    existing?: boolean;
    input?: string;
    idCache?: string;
    output?: string;
    reportPrefix?: string;
    resultDir?: string;
  } = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--existing") {
      parsed.existing = true;
    } else if (arg === "--input") {
      parsed.input = requireArg(args, (index += 1), arg);
    } else if (arg === "--id-cache") {
      parsed.idCache = requireArg(args, (index += 1), arg);
    } else if (arg === "--output") {
      parsed.output = requireArg(args, (index += 1), arg);
    } else if (arg === "--report-prefix") {
      parsed.reportPrefix = requireArg(args, (index += 1), arg);
    } else if (arg === "--result-dir") {
      parsed.resultDir = requireArg(args, (index += 1), arg);
    } else if (arg === "--env") {
      parsed.env = requireArg(args, (index += 1), arg);
    } else if (arg === "--") {
      continue;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function requireArg(args: string[], index: number, flag: string) {
  const value = args[index];
  if (!value) throw new Error(`Missing value for ${flag}`);
  return value;
}

function safeFilePrefix(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || DEFAULT_RESULT_PREFIX
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
