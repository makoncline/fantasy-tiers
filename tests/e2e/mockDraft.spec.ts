import { expect, test, type Locator } from "@playwright/test";

test("local mock draft supports start, pick, undo, and re-pick", async ({
  page,
}) => {
  await page.goto("/mock-draft");

  const start = page.getByTestId("mock-start");
  await expect(start).toBeEnabled({ timeout: 20_000 });
  await start.click();

  await expect(page.getByTestId("mock-draft-board")).toBeVisible();
  await expect(page.getByTestId("mock-assistant-panel")).toBeVisible();
  await expect(page.getByText("Your turn")).toBeVisible();

  const pickButtons = page.locator('[data-testid^="mock-pick-"]:enabled');
  await expect(pickButtons.first()).toBeEnabled();
  const firstPlayer = await pickButtonPlayerName(pickButtons.first());
  await pickButtons.first().click();

  await expect(page.getByText(firstPlayer).first()).toBeVisible();
  await expect(page.getByText("Bot room")).toBeVisible();

  await page.getByTestId("mock-undo").click();
  await expect(page.getByText("Your turn")).toBeVisible();

  const secondPlayer = await pickButtonPlayerName(pickButtons.nth(1));
  expect(secondPlayer).not.toBe(firstPlayer);
  await pickButtons.nth(1).click();

  await expect(page.getByText(secondPlayer).first()).toBeVisible();
  await expect(page.getByText("Bot room")).toBeVisible();
});

async function pickButtonPlayerName(button: Locator) {
  const label = await button.getAttribute("aria-label");
  return label?.replace(/^Pick\s+/, "") ?? "";
}
