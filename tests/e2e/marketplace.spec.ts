import { expect, test } from "@playwright/test";

test("public marketplace remains available", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Stay close to/ })).toBeVisible();
});

test("a seeded public property is visible", async ({ page }) => {
  test.skip(!process.env.E2E_PROPERTY_SLUG, "Set E2E_PROPERTY_SLUG when running against a seeded Replit database");
  await page.goto(`/stays/${encodeURIComponent(process.env.E2E_PROPERTY_SLUG!)}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
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

test("group enquiry and installable app metadata are public", async ({ page, request }) => {
  await page.goto("/group-accommodation", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /One brief\. Several options/i })).toBeVisible();
  await page.goto("/request-quote", { waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Teachers / supervisors")).toBeVisible();
  await expect(page.getByLabel("Meal plan")).toBeVisible();
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  await expect(manifest.json()).resolves.toMatchObject({ name: "Coast Bookings", display: "standalone" });
});

test("Whop webhook is public but rejects unsigned requests", async ({ request }) => {
  const response = await request.post("/api/webhooks/whop", { data: { type: "payment.succeeded" } });
  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toMatchObject({ error: "MISSING_SIGNATURE" });
});
