import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("scheduled data workflow", () => {
  it("publishes only validated 2026 draft aggregates", () => {
    const workflow = fs.readFileSync(
      path.resolve(".github/workflows/fetch-data.yml"),
      "utf8"
    );
    const packageFile = fs.readFileSync(path.resolve("package.json"), "utf8");
    expect(workflow).toContain('SEASON: "2026"');
    expect(workflow).toContain('DRAFT: "true"');
    expect(workflow).toContain('FP_FETCH_PROJECTIONS: "false"');
    expect(workflow).toContain("pnpm run validate:aggregates:ci");
    expect(workflow).toContain("pnpm run test:data-quality");
    expect(workflow).toContain("git add public/data/aggregate/");
    expect(workflow).toContain("git diff --cached --quiet");
    expect(workflow).toContain("git rev-parse origin/main");
    expect(workflow).toContain("pnpm run verify:deployment");
    expect(workflow).toContain('--expected-sha "$DATA_COMMIT_SHA"');
    expect(workflow.indexOf("Verify main has not advanced")).toBeLessThan(
      workflow.indexOf("Snapshot rating history")
    );
    expect(workflow).toContain("Persistent rating history secrets are required");
    expect(workflow.indexOf("history:ingest:aggregates")).toBeLessThan(
      workflow.indexOf("history:snapshot-dashboard")
    );
    expect(workflow.indexOf("history:snapshot-dashboard")).toBeLessThan(
      workflow.indexOf("git add public/data/aggregate/")
    );
    expect(workflow).not.toContain("Skipping rating history snapshot");
    expect(packageFile).toContain(
      '"fetch:all": "pnpm run fetch:fp && pnpm run fetch:sleeper && pnpm run fetch:tiers"'
    );
    expect(workflow).not.toContain("Sleeper player data and projections");
    expect(workflow).toContain(
      "https://send-to-makon.vercel.app/api/send-telegram"
    );
    expect(workflow).toContain("Fantasy Tiers data incident");
    expect(workflow).toContain("Fantasy Tiers data recovered");
    expect(workflow).toContain('|| PREVIOUS_CONCLUSION=""');
    expect(workflow).not.toContain(
      'if [ "$PREVIOUS_CONCLUSION" = "failure" ]; then'
    );
  });

  it("checks production health after each refresh window", () => {
    const workflow = fs.readFileSync(
      path.resolve(".github/workflows/check-data-health.yml"),
      "utf8"
    );
    expect(workflow).toContain("/api/health/data");
    expect(workflow).toContain('cron: "0 14 * * *"');
    expect(workflow).toContain('cron: "0 23 * * *"');
    expect(workflow).toContain(
      "https://send-to-makon.vercel.app/api/send-telegram"
    );
    expect(workflow).toContain("Fantasy Tiers data incident");
    expect(workflow).toContain("Fantasy Tiers data recovered");
    expect(workflow).toContain('|| HTTP_STATUS="000"');
    expect(workflow).toContain("Production health endpoint is unreachable.");
    expect(workflow).toContain('|| PREVIOUS_CONCLUSION=""');
    expect(workflow).not.toContain(
      'if [ "$PREVIOUS_CONCLUSION" != "failure" ]; then'
    );
  });
});
