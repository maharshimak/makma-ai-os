const { test, expect } = require("@playwright/test");

test.describe.configure({ mode: "serial" });

test("portfolio v3 loads the narrative engine", async ({ page }) => {
    await page.goto("portfolio-v3/?automation=1");
    await expect(page).toHaveTitle(/Maharshi Patel/);
    await expect(page.locator(".experience-canvas canvas")).toBeVisible();
    await expect(page.locator("#story")).toBeAttached();
    await expect(page.locator(".chapter-copy")).toContainText("Signal");
    await expect(page.locator(".quick-profile-trigger")).toBeVisible();
});

test("portfolio v3 exposes recruiter quick profile", async ({ page }) => {
    await page.goto("portfolio-v3/?automation=1");
    await page.locator(".quick-profile-trigger").click();
    await expect(page.locator(".quick-profile")).toBeVisible();
    await expect(page.locator(".quick-profile")).toContainText("Maharshi Patel");
    await expect(page.locator(".quick-profile")).toContainText("PANGEA SUMMIT");
    await expect(page.locator(".quick-profile")).toContainText("Mak'ma AI OS");
    await page.locator(".quick-profile-close").click();
    await expect(page.locator(".quick-profile")).not.toBeVisible();
});
