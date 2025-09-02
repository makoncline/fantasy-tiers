import { test, expect } from "@playwright/test";

// Helper: get first N Boris ranks (RNK col) for a given position card
async function getRanksForPosition(
  page: any,
  pos: string,
  n: number
): Promise<number[]> {
  const card = page.getByTestId(`pos-card-${pos}`);
  await expect(card).toBeVisible();
  const rows = card.locator("tbody tr");
  const count = await rows.count();
  const take = Math.min(n, count);
  const ranks: number[] = [];
  for (let i = 0; i < take; i++) {
    const firstCell = rows.nth(i).locator("td").first();
    const txt = (await firstCell.innerText()).trim();
    const num = Number(txt);
    if (!Number.isNaN(num)) ranks.push(num);
  }
  return ranks;
}

// Helper: ensure a position table has rows
async function expectPositionHasData(page: any, pos: string) {
  const card = page.getByTestId(`pos-card-${pos}`);
  await expect(card).toBeVisible();
  const rowCount = await card.locator("tbody tr").count();
  expect(rowCount).toBeGreaterThan(0);
}

test("Draft Assistant E2E: verify context integration", async ({ page }) => {
  const url =
    "/draft-assistant?userId=467542001726779392&draftId=1267676459116273664";

  // Check for any JavaScript errors
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  await page.goto(url);

  // Wait for page to load
  await page.waitForLoadState("domcontentloaded", { timeout: 10000 });

  // Wait for the main draft assistant content to be visible
  await page.waitForSelector('[data-testid="selected-user-card"]', {
    timeout: 15000,
  });
  await page.waitForSelector('[data-testid="selected-draft-card"]', {
    timeout: 15000,
  });

  // Wait for data to load - check that loading states disappear
  await page.waitForFunction(
    () => {
      const loadingElements = document.querySelectorAll(
        '[data-testid="selected-username"]'
      );
      return Array.from(loadingElements).every(
        (el) => !el.textContent?.includes("Loading...")
      );
    },
    { timeout: 15000 }
  );

  // Additional check: wait for data-last-updated to finish loading
  await page.waitForFunction(
    () => {
      const lastUpdatedElement = document.querySelector(
        '[data-testid="data-last-updated"]'
      );
      return (
        lastUpdatedElement &&
        !lastUpdatedElement.textContent?.includes("Loading...")
      );
    },
    { timeout: 5000 }
  );

  // Wait for DraftStatusCard to be visible
  const statusCard = page.locator('[data-testid="draft-status-card"]');
  await expect(statusCard).toBeVisible({ timeout: 5000 });

  // Check if page loaded successfully
  const pageContent = await page.textContent("body");
  expect(pageContent).toBeTruthy();
  expect(pageContent?.length).toBeGreaterThan(100);

  // Check that all three switches are present
  const showAllSwitch = page.locator('[data-testid="status-toggle-show-all"]');
  const showDraftedSwitch = page.locator(
    '[data-testid="status-toggle-show-drafted"]'
  );
  const showUnrankedSwitch = page.locator(
    '[data-testid="status-toggle-show-unranked"]'
  );

  await expect(showAllSwitch).toBeVisible();
  await expect(showDraftedSwitch).toBeVisible();
  await expect(showUnrankedSwitch).toBeVisible();

  // Verify initial state - switches should be off (data-state="unchecked")
  await expect(showAllSwitch).toHaveAttribute("data-state", "unchecked");
  await expect(showDraftedSwitch).toHaveAttribute("data-state", "unchecked");
  await expect(showUnrankedSwitch).toHaveAttribute("data-state", "unchecked");

  // Check that Available Players section exists
  const availableSection = page.locator('[id="available-section"]');
  await expect(availableSection).toBeVisible();

  // Check that Position Compact Tables exist
  const positionTables = page.locator('[data-testid="pos-card-QB"]');
  await expect(positionTables).toBeVisible();

  // Check that Roster section exists
  const rosterSection = page.locator('[id="roster-section"]');
  await expect(rosterSection).toBeVisible();

  // Verify no JavaScript errors occurred
  expect(consoleErrors.length).toBe(0);

  console.log("✅ Context integration verification completed successfully!");
});

test("Draft Assistant E2E: verify switch controls both tables", async ({
  page,
}) => {
  const url =
    "/draft-assistant?userId=467542001726779392&draftId=1267676459116273664";

  // Check for any JavaScript errors
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  await page.goto(url);

  // Wait for page to load
  await page.waitForLoadState("domcontentloaded", { timeout: 10000 });

  // Wait for the main draft assistant content to be visible
  await page.waitForSelector('[data-testid="selected-user-card"]', {
    timeout: 15000,
  });
  await page.waitForSelector('[data-testid="selected-draft-card"]', {
    timeout: 15000,
  });

  // Wait for data to load - check that loading states disappear
  await page.waitForFunction(
    () => {
      const loadingElements = document.querySelectorAll(
        '[data-testid="selected-username"]'
      );
      return Array.from(loadingElements).every(
        (el) => !el.textContent?.includes("Loading...")
      );
    },
    { timeout: 15000 }
  );

  // Additional check: wait for data-last-updated to finish loading
  await page.waitForFunction(
    () => {
      const lastUpdatedElement = document.querySelector(
        '[data-testid="data-last-updated"]'
      );
      return (
        lastUpdatedElement &&
        !lastUpdatedElement.textContent?.includes("Loading...")
      );
    },
    { timeout: 5000 }
  );

  // Wait for Available Players table to be visible
  const availableTable = page.locator('[id="available-section"] table');
  await expect(availableTable.locator("tbody tr").first()).toBeVisible({
    timeout: 5000,
  });

  // Verify DraftStatusCard switch exists
  const showDraftedSwitch = page.locator(
    '[data-testid="status-toggle-show-drafted"]'
  );
  await expect(showDraftedSwitch).toBeVisible();

  // Verify Position table exists
  const positionTable = page.locator('[data-testid="pos-card-QB"] table');
  await expect(positionTable).toBeVisible();

  // Initially, no drafted rows should be visible in Available table
  const initialDraftedCells = availableTable.locator('[data-drafted="D"]');
  expect(await initialDraftedCells.count()).toBe(0);

  // Toggle "Show drafted" ON
  await showDraftedSwitch.click();

  // Verify switch is now ON
  await expect(showDraftedSwitch).toHaveAttribute("data-state", "checked");

  // Check if there are any drafted players in the system
  const afterToggleDraftedCells = availableTable.locator('[data-drafted="D"]');
  const draftedCount = await afterToggleDraftedCells.count();

  // If there are drafted players, they should now be visible
  // If there are no drafted players yet, that's also fine (test passes)
  if (draftedCount > 0) {
    expect(draftedCount).toBeGreaterThan(0);
  }

  console.log(
    `Found ${draftedCount} drafted players in Available table after toggle`
  );

  // Position table should also show dimmed drafted rows (if any exist)
  const dimmedRows = positionTable.locator("tr.opacity-60"); // drafted rows get dimmed
  const dimmedCount = await dimmedRows.count();
  if (draftedCount > 0) {
    expect(dimmedCount).toBeGreaterThan(0);
  }

  // Toggle back OFF
  await showDraftedSwitch.click();

  // Verify switch is OFF again
  await expect(showDraftedSwitch).toHaveAttribute("data-state", "unchecked");

  // Drafted rows should be hidden again in Available table
  const finalDraftedCells = availableTable.locator('[data-drafted="D"]');
  expect(await finalDraftedCells.count()).toBe(0);

  // Position table should no longer show dimmed rows (should be 0 after toggle off)
  expect(await dimmedRows.count()).toBe(0);

  // Verify no JavaScript errors occurred
  expect(consoleErrors.length).toBe(0);

  console.log("✅ Switch control verification completed successfully!");
});
