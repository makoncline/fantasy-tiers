const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

type FantasyProsEnv = Partial<Pick<
  Record<string, string | undefined>,
  "FP_ACCEPT_LANGUAGE" | "FP_COOKIE" | "FANTASYPROS_COOKIE" | "FP_USER_AGENT"
>>;

const DEFAULT_ENV: FantasyProsEnv = {
  FP_ACCEPT_LANGUAGE: process.env.FP_ACCEPT_LANGUAGE,
  FP_COOKIE: process.env.FP_COOKIE,
  FANTASYPROS_COOKIE: process.env.FANTASYPROS_COOKIE,
  FP_USER_AGENT: process.env.FP_USER_AGENT,
};

export function buildFantasyProsHeaders(
  env: FantasyProsEnv = DEFAULT_ENV
): Record<string, string> {
  const headers: Record<string, string> = {
    "user-agent": env.FP_USER_AGENT?.trim() || DEFAULT_USER_AGENT,
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": env.FP_ACCEPT_LANGUAGE?.trim() || "en-US,en;q=0.9",
    referer: "https://www.fantasypros.com/",
    "cache-control": "no-cache",
  };
  const cookie = (env.FP_COOKIE || env.FANTASYPROS_COOKIE || "").trim();
  if (cookie) headers.cookie = cookie;
  return headers;
}
