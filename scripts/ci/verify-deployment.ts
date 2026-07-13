import { z } from "zod";
import { DataHealthResponseSchema } from "../../src/lib/dataHealth";
import { AggregatesBundleResponse } from "../../src/lib/schemas-bundle";

const ArgsSchema = z.object({
  baseUrl: z.string().url(),
  expectedSha: z.string().min(7),
  timeoutSeconds: z.number().int().positive().max(600),
});

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const args = ArgsSchema.parse({
  baseUrl: argument("--base-url") ?? process.env.PRODUCTION_BASE_URL,
  expectedSha: argument("--expected-sha") ?? process.env.EXPECTED_COMMIT_SHA,
  timeoutSeconds: Number(argument("--timeout-seconds") ?? "240"),
});

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function verify(): Promise<void> {
  const deadline = Date.now() + args.timeoutSeconds * 1_000;
  let lastStatus = "No response";
  while (Date.now() < deadline) {
    try {
      const healthUrl = new URL("/api/health/data", args.baseUrl);
      healthUrl.searchParams.set("expectedCommit", args.expectedSha);
      const response = await fetch(healthUrl, { cache: "no-store" });
      const health = DataHealthResponseSchema.parse(await response.json());
      lastStatus = `${response.status} commit=${health.commitSha ?? "unknown"} status=${health.status}`;
      if (response.ok && health.status === "healthy") {
        const bundleUrl = new URL("/api/aggregates/bundle", args.baseUrl);
        bundleUrl.searchParams.set("scoring", "half");
        bundleUrl.searchParams.set("teams", "10");
        const bundleResponse = await fetch(bundleUrl, { cache: "no-store" });
        if (!bundleResponse.ok) {
          throw new Error(`Aggregate bundle returned ${bundleResponse.status}`);
        }
        AggregatesBundleResponse.parse(await bundleResponse.json());
        console.log(`Deployment verified at ${args.expectedSha}`);
        return;
      }
    } catch (error) {
      lastStatus = error instanceof Error ? error.message : String(error);
    }
    await sleep(10_000);
  }
  throw new Error(
    `Timed out waiting for healthy deployment ${args.expectedSha}: ${lastStatus}`
  );
}

verify().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
