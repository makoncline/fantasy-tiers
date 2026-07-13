import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("scheduled data workflow", () => {
  it("publishes only validated 2026 draft aggregates", () => {
    const workflow = fs.readFileSync(
      path.resolve(".github/workflows/fetch-data.yml"),
      "utf8"
    );
    expect(workflow).toContain('SEASON: "2026"');
    expect(workflow).toContain('DRAFT: "true"');
    expect(workflow).toContain('FP_FETCH_PROJECTIONS: "false"');
    expect(workflow).toContain("pnpm run validate:aggregates:ci");
    expect(workflow).toContain("pnpm run test:data-quality");
    expect(workflow).toContain("Footballguys public-default rankings");
    expect(workflow).toContain("git add public/data/aggregate/");
    expect(workflow).toContain("git diff --cached --quiet");
    expect(workflow).toContain("git rev-parse origin/main");
    expect(workflow).toContain("pnpm run verify:deployment");
    expect(workflow).toContain('--expected-sha "$DATA_COMMIT_SHA"');
    expect(workflow.indexOf("Verify main has not advanced")).toBeLessThan(
      workflow.indexOf("Snapshot rating history")
    );
    expect(workflow).toContain("Persistent rating history secrets are required");
    expect(workflow).not.toContain("Skipping rating history snapshot");
    expect(workflow).not.toContain("fetch:borischen:remote");
    expect(workflow).not.toContain("Sleeper player data and projections");
  });
});
