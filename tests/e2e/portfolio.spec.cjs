const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
    page.on("pageerror", (error) => {
        throw error;
    });
});

test("portfolio v2 boots with WebGL experience and core content", async ({ page }) => {
    await page.goto("portfolio-v2/");
    await expect(page).toHaveTitle(/Maharshi Patel/);
    await expect(page.locator("h1")).toContainText("INTELLIGENT SYSTEMS");
    await expect(page.locator("#world")).toBeVisible();
    await expect(page.locator("#boot")).toHaveClass(/is-off/, { timeout: 10000 });
    await expect(page.locator("#education")).toContainText("aivancity");
    await expect(page.locator("#systems")).toContainText("Mak’ma AI OS");
    await expect(page.locator("#achievements")).toContainText(
        "AWS Certified Machine Learning Engineer",
    );
});

test("portfolio v2 project filters and architecture explorer react", async ({
    page,
}) => {
    await page.goto("portfolio-v2/");
    await expect(page.locator("#boot")).toHaveClass(/is-off/, { timeout: 10000 });

    await page.locator('[data-filter="rag"]').click();
    await expect(
        page.locator('.project[data-category="mlops"]').first(),
    ).toHaveClass(/is-hidden/);
    await expect(
        page.locator('.project[data-category*="rag"]').first(),
    ).not.toHaveClass(/is-hidden/);

    const tools = page.locator(".map-node.n-tools");
    await tools.scrollIntoViewIfNeeded();
    await tools.hover();
    await expect(page.locator("#mapCopy")).toContainText(
        "Permissioned tools",
    );
});
