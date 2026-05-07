import { test, expect } from "@playwright/test";

test("ops console renders the audit surface", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sovereign Vault" })).toBeVisible();
  await expect(page.getByLabel("Adversarial request controls")).toBeVisible();
  await expect(page.getByLabel("Live service flow")).toBeVisible();
  await expect(page.getByLabel("Noisy security log")).toBeVisible();
});
