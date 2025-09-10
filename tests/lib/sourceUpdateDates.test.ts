import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { getBorischenUpdateDate } from "../../src/lib/sourceUpdateDates";

describe("sourceUpdateDates", () => {
  const testDir = path.join(process.cwd(), "test-fixtures");
  const aggregateDir = path.join(testDir, "public/data/aggregate");
  const metadataFile = path.join(aggregateDir, "metadata.json");

  beforeEach(() => {
    // Create test directory structure
    fs.mkdirSync(aggregateDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test fixtures
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("getBorischenUpdateDate", () => {
    it("should return correct date from aggregated metadata", () => {
      const testMetadata = {
        fp: {},
        borischen: {
          STD: {
            QB: { last_modified: "2025-09-10T17:02:31.000Z" },
            RB: { last_modified: "2025-09-10T17:02:31.000Z" },
            WR: { last_modified: "2025-09-10T17:02:31.000Z" },
            TE: { last_modified: "2025-09-10T17:02:31.000Z" },
            FLEX: { last_modified: "2025-09-10T17:02:31.000Z" },
            K: { last_modified: "2025-09-10T16:30:00.000Z" },
            DST: { last_modified: "Mon, 08 Sep 2025 18:57:14 GMT" },
          },
          PPR: {
            QB: { last_modified: null },
            RB: { last_modified: "2025-09-10T17:02:31.000Z" },
            WR: { last_modified: "2025-09-10T17:02:31.000Z" },
            TE: { last_modified: "2025-09-10T17:02:31.000Z" },
            FLEX: { last_modified: "2025-09-10T17:02:31.000Z" },
            K: { last_modified: null },
            DST: { last_modified: null },
          },
          HALF: {
            QB: { last_modified: null },
            RB: { last_modified: "2025-09-10T17:02:31.000Z" },
            WR: { last_modified: "2025-09-10T17:02:31.000Z" },
            TE: { last_modified: "2025-09-10T17:02:31.000Z" },
            FLEX: { last_modified: "2025-09-10T17:02:31.000Z" },
            K: { last_modified: null },
            DST: { last_modified: null },
          },
        },
      };

      fs.writeFileSync(metadataFile, JSON.stringify(testMetadata, null, 2));

      // Mock process.cwd to return our test directory
      const originalCwd = process.cwd;
      process.cwd = () => testDir;

      try {
        // Test standard positions with STD scoring
        const qbResult = getBorischenUpdateDate("QB", "std");
        expect(qbResult.source).toBe("Borischen");
        expect(qbResult.lastUpdated).toEqual(
          new Date("2025-09-10T17:02:31.000Z")
        );
        expect(qbResult.fetchedAt).toBeNull();

        // Test PPR scoring
        const rbPprResult = getBorischenUpdateDate("RB", "ppr");
        expect(rbPprResult.lastUpdated).toEqual(
          new Date("2025-09-10T17:02:31.000Z")
        );

        // Test DEF position mapping to DST
        const defResult = getBorischenUpdateDate("DEF", "std");
        expect(defResult.lastUpdated).toEqual(
          new Date("Mon, 08 Sep 2025 18:57:14 GMT")
        );

        // Test K position always uses STD scoring
        const kPprResult = getBorischenUpdateDate("K", "ppr");
        expect(kPprResult.lastUpdated).toEqual(
          new Date("2025-09-10T16:30:00.000Z")
        );

        // Test null values
        const qbPprResult = getBorischenUpdateDate("QB", "ppr");
        expect(qbPprResult.lastUpdated).toBeNull();
      } finally {
        process.cwd = originalCwd;
      }
    });

    it("should handle missing metadata file", () => {
      // Mock process.cwd to return our test directory
      const originalCwd = process.cwd;
      process.cwd = () => testDir;

      try {
        const result = getBorischenUpdateDate("QB", "std");
        expect(result.source).toBe("Borischen");
        expect(result.lastUpdated).toBeNull();
        expect(result.fetchedAt).toBeNull();
        expect(result.details.error).toContain("ENOENT");
      } finally {
        process.cwd = originalCwd;
      }
    });

    it("should handle malformed metadata file", () => {
      fs.writeFileSync(metadataFile, "invalid json");

      const originalCwd = process.cwd;
      process.cwd = () => testDir;

      try {
        const result = getBorischenUpdateDate("QB", "std");
        expect(result.source).toBe("Borischen");
        expect(result.lastUpdated).toBeNull();
        expect(result.fetchedAt).toBeNull();
        expect(result.details.error).toBeDefined();
      } finally {
        process.cwd = originalCwd;
      }
    });
  });
});
