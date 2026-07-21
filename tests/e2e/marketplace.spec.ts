import { expect, test } from "@playwright/test";

test("guest can browse a stay and reach protected checkout", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Stay close to/ })).toBeVisible();
  await page.goto("/stays/ocean-breeze-guest-house", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Ocean Breeze Guest House" })).toBeVisible();
  await page.goto("/checkout?stay=ocean-breeze-guest-house", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Confirm your stay" })).toBeVisible();
});

test("all role portals have distinct dashboards", async ({ page }) => {
  for (const role of ["guest", "host", "staff", "admin"]) {
    await page.goto(`/${role}/dashboard`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".dashboard-page")).toBeVisible();
  }
});
