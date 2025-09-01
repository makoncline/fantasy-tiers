const { z } = require("zod");

const FantasyProsCombined = z
  .object({
    player_id: z.union([z.coerce.string(), z.null()]),
    player_owned_avg: z.union([z.coerce.number(), z.null()]),
    pos_rank: z.union([z.coerce.number(), z.null()]),
    stats: z.record(z.string(), z.unknown()),
    rankings: z.record(z.string(), z.unknown()),
  })
  .strict();

const data = JSON.parse(
  require("fs").readFileSync(
    "public/data/aggregate/RB-combined-aggregate.json",
    "utf8"
  )
);
const entries = Object.entries(data);
const withFP = entries.filter(([_, v]) => v.fantasypros !== null);

console.log(`Found ${withFP.length} entries with fantasypros data`);

// Test first 5 entries
for (let i = 0; i < Math.min(5, withFP.length); i++) {
  console.log(`\nTesting entry ${i + 1}:`);
  const testEntry = withFP[i][1].fantasypros;
  console.log(
    `pos_rank value: ${JSON.stringify(
      testEntry.pos_rank
    )} (type: ${typeof testEntry.pos_rank})`
  );

  const result = FantasyProsCombined.safeParse(testEntry);

  if (!result.success) {
    console.log("Validation errors:");
    result.error.issues.forEach((issue) =>
      console.log(JSON.stringify(issue, null, 2))
    );
  } else {
    console.log("Validation passed!");
  }
}
