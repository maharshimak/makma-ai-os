const { defineConfig, devices } = require("@playwright/test");
module.exports = defineConfig({
    testDir: "tests/e2e",
    timeout: 30000,
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: 0,
    workers: process.env.CI ? 2 : undefined,
    reporter: [["list"], ["html", { open: "never" }]],
    use: {
        baseURL: process.env.LIVE_BASE_URL || "http://127.0.0.1:4173",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    projects: [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "mobile", use: { ...devices["Pixel 7"] } },
    ],
    webServer: process.env.LIVE_BASE_URL
        ? undefined
        : {
              command:
                  "python -m http.server 4173 --bind 127.0.0.1 --directory dist-site",
              url: "http://127.0.0.1:4173",
              reuseExistingServer: !process.env.CI,
          },
});
