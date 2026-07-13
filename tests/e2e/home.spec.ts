import { expect, test } from "@playwright/test";

test("home page links to the draft assistant", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Draft day and roster planning start here.",
    })
  ).toBeVisible();

  const draftLink = page.getByTestId("home-link-draft-assistant");
  await expect(draftLink).toHaveAttribute("href", "/draft-assistant");
  await draftLink.click();
  await expect(page).toHaveURL(/\/draft-assistant$/);
  await expect(
    page.getByRole("heading", { name: "Draft Assistant" })
  ).toBeVisible();
});

test("home page links to the league manager", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Draft day and roster planning start here.",
    })
  ).toBeVisible();

  const leagueManagerLink = page.getByTestId("home-link-league-manager");
  await expect(leagueManagerLink).toHaveAttribute("href", "/league-manager");
  await leagueManagerLink.click();
  await expect(page).toHaveURL(/\/league-manager$/);
  await expect(
    page.getByRole("heading", { name: "League Manager" })
  ).toBeVisible();
});

test("home page links to rating history", async ({ page }) => {
  await page.goto("/");

  const ratingHistoryLink = page.getByTestId("home-link-rating-history");
  await expect(ratingHistoryLink).toHaveAttribute("href", "/rating-history");
  await ratingHistoryLink.click();
  await expect(page).toHaveURL(/\/rating-history$/);
  await expect(
    page.getByRole("heading", { name: "Rating History" })
  ).toBeVisible();
});
