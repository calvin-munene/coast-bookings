import { expect, test } from "@playwright/test";

test("public marketplace remains available", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Stay close to/ })).toBeVisible();
  await page.goto("/stays/ocean-breeze-guest-house", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Ocean Breeze Guest House" })).toBeVisible();
});

test("checkout and all role workspaces require authentication", async ({ page }) => {
  for (const path of ["/checkout?stay=ocean-breeze-guest-house", "/guest/dashboard", "/host/dashboard", "/staff/dashboard", "/admin/dashboard"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/sign-in/);
  }
});

test("premium sign-in and sign-up routes are public", async ({ page }) => {
  await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/Secure account access|Sign in/i).first()).toBeVisible();
  await page.goto("/sign-up", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/Secure account access|Create your account/i).first()).toBeVisible();
});
