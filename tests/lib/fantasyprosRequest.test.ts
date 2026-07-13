import { describe, expect, it } from "vitest";
import { buildFantasyProsHeaders } from "../../src/lib/fantasyprosRequest";

describe("FantasyPros request headers", () => {
  it("uses browser-like defaults without a cookie", () => {
    const headers = buildFantasyProsHeaders({});

    expect(headers.cookie).toBeUndefined();
    expect(headers.referer).toBe("https://www.fantasypros.com/");
    expect(headers["user-agent"]).toContain("Chrome");
  });

  it("uses an optional FantasyPros cookie and user agent from env", () => {
    const headers = buildFantasyProsHeaders({
      FP_COOKIE: "session=value; other=value",
      FP_USER_AGENT: "Test Browser",
    });

    expect(headers.cookie).toBe("session=value; other=value");
    expect(headers["user-agent"]).toBe("Test Browser");
  });
});
