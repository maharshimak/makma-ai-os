const { test, expect } = require("@playwright/test");

test("3D renderer initializes or falls back without breaking navigation", async ({ page }) => {
  page.on("pageerror", error => { throw error; });
  await page.goto("projects/orbital/");
  await expect(page.locator("#initiate")).toBeVisible({ timeout: 12000 });
  await page.locator("#initiate").click();
  await expect(page.locator("#world-canvas")).toHaveCount(1);
  await expect.poll(() => page.locator("body").getAttribute("data-renderer")).toMatch(/^(webgl|fallback)$/);
  await expect(page.locator("#title-01")).toBeVisible();
  await page.locator("#systems-open").click();
  await expect(page.locator("#system-directory a")).toHaveCount(9);
});

test("blocked WebGL uses static environment and preserves all links", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      if (kind === "webgl" || kind === "webgl2" || kind === "experimental-webgl") return null;
      return original.call(this, kind, ...args);
    };
  });
  page.on("pageerror", error => { throw error; });
  await page.goto("projects/orbital/");
  await expect(page.locator("#initiate")).toBeVisible({ timeout: 12000 });
  await page.locator("#initiate").click();
  await expect(page.locator("body")).toHaveAttribute("data-renderer", "fallback");
  await expect(page.locator("#world-canvas")).toBeHidden();
  await expect(page.locator(".stage-orbit")).toHaveClass(/is-active/);
  await page.locator("#systems-open").click();
  await expect(page.locator("#system-directory a")).toHaveCount(9);
  await page.locator("#systems-close").click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
