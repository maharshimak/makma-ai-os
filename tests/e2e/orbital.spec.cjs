const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => { throw error; });
});

test("orbital experience loads and exposes all nine real project routes", async ({ page }) => {
  await page.goto("projects/orbital/");
  await expect(page.locator("#initiate")).toBeVisible({ timeout: 12000 });
  await expect(page.getByRole("button", { name: /initiate system/i })).toBeEnabled();
  await page.locator("#initiate").click();
  await expect(page.locator("body")).toHaveClass(/started/);
  await expect(page.locator(".chapter")).toHaveCount(6);
  await page.locator("#systems-open").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator("#system-directory a")).toHaveCount(9);
  await expect(page.locator("#system-directory a:visible")).toHaveCount(9);
  await page.locator("#system-search").fill("rag");
  await expect(page.locator("#system-directory a:visible")).toHaveCount(1);
  await expect(page.locator("#system-directory a:visible")).toContainText("AGENTIC RAG ENGINE");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("orbital experience works on mobile without horizontal overflow", async ({ page }) => {
  await page.goto("projects/orbital/");
  await expect(page.locator("#initiate")).toBeVisible({ timeout: 12000 });
  await page.locator("#initiate").click();
  const sizes = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth
  }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.viewport + 1);
  await page.locator("#systems-open").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.locator("#systems-close").click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("reduced motion mode retains usable content and navigation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("projects/orbital/");
  await expect(page.locator("#initiate")).toBeVisible({ timeout: 12000 });
  await page.locator("#initiate").click();
  await expect(page.locator("#title-01")).toBeVisible();
  await expect(page.locator("#audio-toggle")).toHaveAttribute("aria-pressed", "false");
  await page.locator(".side-progress a[href='#chapter-03']").click();
  await expect(page).toHaveURL(/#chapter-03$/);
  await expect(page.locator("#title-03")).toBeVisible();
});
