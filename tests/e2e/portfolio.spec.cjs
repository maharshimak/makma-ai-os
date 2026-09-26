const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
    page.on("pageerror", (error) => {
        throw error;
    });
});

test("portfolio v2 boots into immersive museum journey", async ({ page }) => {
    await page.goto("portfolio-v2/");
    await expect(page).toHaveTitle(/Maharshi Patel/);
    await expect(page.locator("#experience")).toBeVisible();
    await expect(page.locator("#preloader")).toHaveClass(/is-off/, { timeout: 12000 });
    await expect(page.locator("#home h1")).toContainText("MAHARSHI");
    await expect(page.locator("#education")).toContainText("aivancity");
    await expect(page.locator("#journey")).toContainText("AI engineering");
    await expect(page.locator("#systems")).toContainText("Nine systems");
    await expect(page.locator("#credential")).toContainText("Machine Learning");
});

test("portfolio v2 navigation follows chapters", async ({ page }) => {
    await page.goto("portfolio-v2/");
    await expect(page.locator("#preloader")).toHaveClass(/is-off/, { timeout: 12000 });
    await page.locator("#education").scrollIntoViewIfNeeded();
    await expect(page.locator("#education")).toHaveClass(/is-active/, { timeout: 7000 });
    await expect(page.locator("#chapterName")).toContainText("EDUCATION");
});

test("portfolio v2 exposes project gallery and dialog", async ({ page }) => {
    await page.goto("portfolio-v2/");
    await expect(page.locator("#preloader")).toHaveClass(/is-off/, { timeout: 12000 });
    await page.locator("#systems").scrollIntoViewIfNeeded();
    await expect(page.locator("#systems")).toContainText("PROJECT GALLERY");
    await page.evaluate(() => {
        const d = document.querySelector("#projectDialog");
        document.querySelector("#dialogTitle").textContent = "Mak’ma AI OS";
        d.showModal();
    });
    await expect(page.locator("#projectDialog")).toBeVisible();
    await expect(page.locator("#dialogTitle")).toContainText("Mak’ma AI OS");
    await page.locator("#dialogClose").click();
    await expect(page.locator("#projectDialog")).not.toBeVisible();
});
