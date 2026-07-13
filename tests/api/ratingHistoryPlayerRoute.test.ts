import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../../src/app/api/rating-history/player/route";

const ORIGINAL_VERCEL = process.env.VERCEL;
const ORIGINAL_URL = process.env.FANTASY_HISTORY_DATABASE_URL;
const ORIGINAL_TOKEN = process.env.FANTASY_HISTORY_DATABASE_AUTH_TOKEN;

afterEach(() => {
  process.env.VERCEL = ORIGINAL_VERCEL;
  process.env.FANTASY_HISTORY_DATABASE_URL = ORIGINAL_URL;
  process.env.FANTASY_HISTORY_DATABASE_AUTH_TOKEN = ORIGINAL_TOKEN;
});

describe("rating history player API", () => {
  it("returns a stable unavailable response without exposing a local path", async () => {
    process.env.VERCEL = "1";
    delete process.env.FANTASY_HISTORY_DATABASE_URL;
    delete process.env.FANTASY_HISTORY_DATABASE_AUTH_TOKEN;
    const response = await GET(
      new NextRequest(
        "http://localhost/api/rating-history/player?playerId=p1&position=WR&scoring=half"
      )
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.signal).toMatchObject({
      available: false,
      reason: "Rating history is not configured for this deployment.",
    });
    expect(JSON.stringify(body)).not.toContain("fantasy-history.db");
    expect(JSON.stringify(body)).not.toContain(process.cwd());
  });
});
