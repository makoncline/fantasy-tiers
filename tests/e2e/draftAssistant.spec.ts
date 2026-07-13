import { expect, test, type Locator } from "@playwright/test";

async function valueCellStyle(table: Locator, playerName: string) {
  const headers = await table
    .locator("thead tr")
    .nth(1)
    .locator("th")
    .allTextContents();
  const valueIndex = headers.findIndex((header) => header.includes("VAL"));
  expect(valueIndex).toBeGreaterThanOrEqual(0);
  const row = table.locator("tbody tr").filter({ hasText: playerName }).first();
  return row.locator("td").nth(valueIndex).getAttribute("style");
}

test("seeded mock exercises the shared draft assistant workflow", async ({
  page,
}) => {
  await page.goto("/mock-draft");
  const start = page.getByTestId("mock-start");
  await expect(start).toBeEnabled({ timeout: 20_000 });

  await page.getByLabel("Rounds").fill("3");
  await expect(start).toBeEnabled({ timeout: 20_000 });
  await start.click();

  await expect(page.getByTestId("mock-assistant-panel")).toBeVisible();
  await expect(page.getByTestId("decision-recommendation-card").first()).toBeVisible();
  await expect(page.getByText("League starter needs")).toBeVisible();
  await expect(page.getByTestId("pos-card-QB")).toBeHidden();
  await page.locator("#positions-section summary").click();
  await expect(page.getByTestId("pos-card-QB")).toBeVisible();
  await expect(page.getByTestId("pos-card-QB").locator("tbody tr").first()).toBeVisible();

  const available = page.locator("#available-section");
  const table = available.locator("table");
  await expect(table.locator("tbody tr").first()).toBeVisible();

  await available.getByRole("button", { name: "Preview" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByTestId("preview-fit-summary")).toBeVisible();
  await page.keyboard.press("Escape");

  await available.getByText("Advanced filters").click();
  const showDrafted = page.getByTestId("available-toggle-show-drafted");
  await expect(showDrafted).toBeVisible();
  await showDrafted.click();
  await expect(showDrafted).toHaveAttribute("data-state", "checked");
  await showDrafted.click();
  await available.getByText("Advanced filters").click();

  const firstPick = available.locator('[data-testid^="mock-pick-"]:enabled').first();
  const pickLabel = await firstPick.getAttribute("aria-label");
  expect(pickLabel).toMatch(/^Pick /);
  const playerName = pickLabel?.replace(/^Pick /, "") ?? "";
  const beforeStyle = await valueCellStyle(table, playerName);
  expect(beforeStyle).toContain("background");
  await firstPick.click();
  await expect(page.getByTestId("roster-table").getByText(playerName)).toBeVisible();

  await page.getByTestId("mock-undo").click();
  await expect(available.getByText(playerName).first()).toBeVisible();
  expect(await valueCellStyle(table, playerName)).toBe(beforeStyle);

  await available.getByRole("button", { name: `Pick ${playerName}` }).click();
  for (let pick = 2; pick <= 3; pick += 1) {
    await page.getByTestId("mock-advance").click();
    await expect(
      available.locator('[data-testid^="mock-pick-"]:enabled').first()
    ).toBeVisible();
    await available.locator('[data-testid^="mock-pick-"]:enabled').first().click();
  }
  await page.getByTestId("mock-advance").click();

  await expect(page.getByText("Complete", { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("decision-board")).toHaveCount(0);
});
