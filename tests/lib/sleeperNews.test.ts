import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { fetchSleeperPlayerNews } from "../../src/lib/sleeperNews";

const GraphqlRequestBody = z.object({
  operationName: z.literal("get_player_news"),
  query: z.string(),
});

describe("fetchSleeperPlayerNews", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the Sleeper player news GraphQL query and parses items", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            data: {
              get_player_news: [
                {
                  metadata: {
                    title: "Chase Brown - Heads into contract year",
                    description: "Clear-cut top option at running back.",
                    url: "https://example.com/chase-brown-news",
                  },
                  player_id: "9224",
                  published: 1782250200000,
                  source: "rotowire",
                  source_key: "631509",
                  sport: "nfl",
                },
              ],
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
    );
    vi.stubGlobal("fetch", fetchMock);

    const news = await fetchSleeperPlayerNews({
      playerId: "9224",
      limit: 5,
    });

    expect(news).toHaveLength(1);
    expect(news[0]?.metadata.title).toBe(
      "Chase Brown - Heads into contract year"
    );

    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) throw new Error("fetch was not called");

    const [url, init] = firstCall;
    expect(url).toBe("https://api.sleeper.app/graphql");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      "X-Sleeper-GraphQL-Op": "get_player_news",
    });

    const body = init?.body;
    expect(typeof body).toBe("string");
    if (typeof body !== "string") throw new Error("expected string body");

    const parsedBody = GraphqlRequestBody.parse(JSON.parse(body));
    expect(parsedBody.query).toContain("get_player_news");
    expect(parsedBody.query).toContain('player_id: "9224"');
    expect(parsedBody.query).toContain("limit: 5");
  });
});
