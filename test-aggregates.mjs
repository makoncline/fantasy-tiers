import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the schema (this will work in the Next.js environment)
import("./src/lib/schemas-aggregates.js")
  .then(async (schemas) => {
    const { CombinedShard } = schemas;

    const aggregateDir = join(__dirname, "public/data/aggregate");
    const files = readdirSync(aggregateDir).filter((f) =>
      f.endsWith("-combined-aggregate.json")
    );

    console.log("Testing schema validation against aggregate files...");
    console.log("==================================================");

    let totalFiles = 0;
    let validFiles = 0;
    let totalEntries = 0;

    for (const file of files) {
      totalFiles++;
      const filePath = join(aggregateDir, file);
      try {
        const data = JSON.parse(readFileSync(filePath, "utf8"));
        CombinedShard.parse(data);
        validFiles++;
        const entryCount = Object.keys(data).length;
        totalEntries += entryCount;
        console.log("✅", file, "- Valid (", entryCount, "entries)");
      } catch (error) {
        console.log("❌", file, "- Invalid:", error.message);
        console.log(
          "   Details:",
          error.errors
            ?.slice(0, 3)
            .map((e) => e.message)
            .join(", ")
        );
      }
    }

    console.log("==================================================");
    console.log("Summary:");
    console.log("- Files tested:", totalFiles);
    console.log("- Files valid:", validFiles);
    console.log("- Total entries validated:", totalEntries);
    console.log(
      "- Success rate:",
      ((validFiles / totalFiles) * 100).toFixed(1) + "%"
    );
  })
  .catch((error) => {
    console.error("Failed to import schemas:", error.message);
  });
