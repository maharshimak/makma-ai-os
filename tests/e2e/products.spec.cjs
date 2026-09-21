const { test, expect } = require("@playwright/test");
const path = (slug) => (slug ? `projects/${slug}/` : "");
async function open(page, slug) {
    await page.goto(path(slug));
    if (slug) {
        await expect(page.locator("#run")).toBeEnabled();
        await expect(page.locator("#result")).not.toContainText(
            "Could not run this workflow",
        );
    }
}
async function run(page) {
    await page.locator("#run").click();
    await expect(page.locator("#run")).toBeEnabled();
}
async function fillJson(page, id, change) {
    const value = JSON.parse(await page.locator("#" + id).inputValue());
    await page.locator("#" + id).fill(JSON.stringify(change(value)));
}
async function say(page, text) {
    await page.locator("#message-input").fill(text);
    await page.locator("#send-button").click();
    await expect(page.locator("#send-button")).toBeEnabled();
}
test.beforeEach(async ({ page }) => {
    page.on("pageerror", (error) => {
        throw error;
    });
});
test("flagship calculates, remembers, recalls, exports and resets", async ({
    page,
}) => {
    await open(page);
    await say(page, "calculate 19 * 23");
    await expect(page.locator("#messages")).toContainText("19 * 23 = 437");
    await say(
        page,
        "Remember that my deployment region is eu-west-3 and calculate 8200 / 4",
    );
    await expect(page.locator("#messages")).toContainText("2050");
    await say(page, "recall deployment region");
    await expect(page.locator("#messages .message").last()).toContainText(
        "eu-west-3",
    );
    const download = page.waitForEvent("download");
    await page.locator("#export-session-button").click();
    expect((await download).suggestedFilename()).toMatch(/makma-session.*json/);
    await page.locator("#new-session-button").click();
    await say(page, "recall deployment region");
    await expect(page.locator("#messages .message").last()).toContainText(
        "No matching memories found",
    );
});
test("flagship storage and approval are explicit", async ({ page }) => {
    await open(page);
    await say(page, "remember release region is Paris");
    await page.reload();
    await expect(page.locator("#messages")).toContainText("Paris");
    await page.locator('[data-tab="memory"]').click();
    await page.locator("#delete-session-memory").click();
    await expect(page.locator("#memory-permission-status")).toContainText(
        "Approval required",
    );
    await page.locator("#approve-memory-delete").check();
    await page.locator("#delete-session-memory").click();
    await expect(page.locator("#memory-permission-status")).toContainText(
        "deleted with approval",
    );
});
test("RAG changed corpus/query changes rank; judgments compute and export", async ({
    page,
}) => {
    await open(page, "agentic-rag-engine");
    await page
        .locator("#corpus")
        .fill("alpha | apples orchard fruit\nbeta | cars motor wheels");
    await page.locator("#query").fill("apples");
    await page.locator("#relevant").fill("alpha");
    await page.locator("#topk").fill("1");
    await run(page);
    await expect(page.locator("#result .card").first()).toContainText("alpha");
    await expect(page.locator("#result")).toContainText("100.0%");
    await page.locator("#save-baseline").click();
    await page.locator("#query").fill("cars");
    await page.locator("#relevant").fill("beta");
    await run(page);
    await expect(page.locator("#result .card").first()).toContainText("beta");
    await expect(page.locator("#result")).toContainText("not comparable");
    const dl = page.waitForEvent("download");
    await page.locator("#export-rag").click();
    expect((await dl).suggestedFilename()).toBe("retrieval.json");
});
for (const [name, edit, message] of [
    [
        "candidate count",
        async (p) => {
            await p.locator("#topk").fill("5");
            await p.locator("#candidatek").fill("2");
        },
        "Candidate K must be greater",
    ],
    [
        "unknown judgment",
        async (p) => p.locator("#relevant").fill("missing"),
        "not found in the corpus",
    ],
    [
        "duplicate IDs",
        async (p) => p.locator("#corpus").fill("x | one\nx | two"),
        "must be unique",
    ],
    [
        "blank configuration",
        async (p) => p.locator("#topk").fill(""),
        "Top K is required",
    ],
    ["no judgments", async (p) => p.locator("#relevant").fill(""), "N/A"],
])
    test("RAG " + name, async ({ page }) => {
        await open(page, "agentic-rag-engine");
        await edit(page);
        await run(page);
        await expect(page.locator("#result")).toContainText(message);
    });
test("media preflight handles useful, unsupported and over-budget requests", async ({
    page,
}) => {
    await open(page, "multimodal-ai-studio");
    await expect(page.locator("#result")).toContainText("retime");
    await expect(page.locator("#result")).toContainText("speech transcription");
    await page.locator("#prompt").fill("teleport my dog");
    await run(page);
    await expect(page.locator("#result")).toContainText(
        "No supported operations",
    );
    await expect(page.locator("#result")).toContainText("PREFLIGHT BLOCK");
    await page.locator("#prompt").fill("remove background");
    await page.locator("#budget").fill("1");
    await run(page);
    await expect(page.locator("#result")).toContainText(
        "Render budget exceeded",
    );
});
test("graph resolves, traverses, rejects nonsense and inspects evidence", async ({
    page,
}) => {
    await open(page, "knowledge-twin");
    await expect(page.locator("#result")).toContainText("exact match");
    await expect(page.locator("#result")).toContainText("MEASURED_BY");
    await page
        .getByRole("button", { name: "Agentic RAG Engine", exact: true })
        .click();
    await expect(page.locator("#node-details")).toContainText("Synthetic");
    await page.locator("#query").fill("zzzzrandomunknown");
    await run(page);
    await expect(page.locator("#result")).toContainText(
        "No confident entity resolution",
    );
});
test("graph validates references and quality", async ({ page }) => {
    await open(page, "knowledge-twin");
    await fillJson(page, "edges", (edges) =>
        edges.map((e) => ({ ...e, evidence: "" })),
    );
    await run(page);
    await expect(page.locator("#result")).toContainText("QUALITY BLOCK");
    await fillJson(page, "edges", (edges) => [
        { ...edges[0], target: "unknown" },
    ]);
    await run(page);
    await expect(page.locator("#result")).toContainText(
        "Unknown edge reference",
    );
});
test("clinical provenance and human corrections", async ({ page }) => {
    await open(page, "clinical-document-intelligence");
    await expect(page.locator("#result")).toContainText("QUALITY PASS");
    await expect(page.locator("#result mark")).toHaveCount(5);
    await expect(page.locator("#result")).toContainText("start");
    await page.locator("#corrections").fill('{"participants":200}');
    await run(page);
    await expect(page.locator("#result")).toContainText("User correction");
    await expect(page.locator("#result")).toContainText("80%");
});
for (const [name, replacement] of [
    ["missing ID", (s) => s.replace("Study ID: SYN-204\n", "")],
    ["negative participants", (s) => s.replace("180", "-10")],
    ["fractional participants", (s) => s.replace("180", "12.5")],
])
    test("clinical rejects " + name, async ({ page }) => {
        await open(page, "clinical-document-intelligence");
        await page
            .locator("#document")
            .fill(replacement(await page.locator("#document").inputValue()));
        await run(page);
        await expect(page.locator("#result")).toContainText("QUALITY BLOCK");
    });
test("data executes editable data, privacy and CSV export", async ({
    page,
}) => {
    await open(page, "secure-data-copilot");
    await expect(page.locator("#result")).toContainText(
        "Column name matches contact",
    );
    await page
        .locator("#dataset")
        .fill(
            JSON.stringify({
                customers: [
                    { id: 1, name: "Test", email: "synthetic@example.test" },
                ],
                orders: [
                    {
                        id: 1,
                        customer_id: 1,
                        amount: 42,
                        created_at: "2026-09-20",
                    },
                ],
            }),
        );
    await page.locator("#question").fill("total revenue");
    await run(page);
    await expect(page.locator("#result .data-table").first()).toContainText(
        "42",
    );
    await expect(page.locator("#result")).toContainText("not interpreted");
    const dl = page.waitForEvent("download");
    await page.locator("#export-csv").click();
    expect((await dl).suggestedFilename()).toBe("analytics-results.csv");
});
for (const [question, message] of [
    ["delete orders", "not allowed"],
    ["tell me a joke", "could not map"],
])
    test("data rejects " + question, async ({ page }) => {
        await open(page, "secure-data-copilot");
        await page.locator("#question").fill(question);
        await run(page);
        await expect(page.locator("#result")).toContainText(message);
    });
test("evaluation accepts good cases and blocks forbidden output and regressions", async ({
    page,
}) => {
    await open(page, "llm-eval-observability");
    await expect(page.locator("#result")).toContainText("ACCEPT CANDIDATE");
    await fillJson(page, "candidate", (cases) =>
        cases.map((c) => ({ ...c, output: c.output + " password" })),
    );
    await run(page);
    await expect(page.locator("#result")).toContainText("BLOCK CANDIDATE");
    await expect(page.locator("#result")).toContainText("Forbidden output");
    await expect(page.locator("#result")).toContainText("passRate regression");
});
test("evaluation rejects invalid reliability and blocks latency", async ({
    page,
}) => {
    await open(page, "llm-eval-observability");
    await page.locator("#successes").fill("31");
    await run(page);
    await expect(page.locator("#result")).toContainText(
        "Successes must be between",
    );
    await page.locator("#successes").fill("28");
    await page.locator("#maxlat").fill("1");
    await run(page);
    await expect(page.locator("#result")).toContainText("BLOCK CANDIDATE");
    await expect(page.locator("#result")).toContainText("p95 latency exceeds");
});
test("control lifecycle increases, rolls back, holds and rejects invalid probabilities", async ({
    page,
}) => {
    await open(page, "mlops-control-plane");
    await expect(page.locator("#result")).toContainText("increase");
    await fillJson(page, "candidate", (c) => ({ ...c, error_rate: 0.2 }));
    await run(page);
    await expect(page.locator("#result")).toContainText("rollback");
    await fillJson(page, "candidate", (c) => ({
        ...c,
        error_rate: 0.01,
        requests: 1,
    }));
    await run(page);
    await expect(page.locator("#result")).toContainText("hold");
    await fillJson(page, "candidate", (c) => ({ ...c, error_rate: 1.5 }));
    await run(page);
    await expect(page.locator("#result")).toContainText(
        "Candidate error rate must be between 0 and 1",
    );
});
test("pipeline clean artifact passes, modified artifact fails", async ({
    page,
}) => {
    await open(page, "mlops-production-pipeline");
    await expect(page.locator("#integrity-status")).toContainText(
        "DEPLOYMENT ALLOWED",
    );
    await page.locator("#artifact").fill('{"slope":999}');
    await expect(page.locator("#integrity-status")).toContainText(
        "VERIFICATION REQUIRED",
    );
    await page.locator("#verify-artifact").click();
    await expect(page.locator("#integrity-status")).toContainText(
        "INTEGRITY FAILED",
    );
    await expect(page.locator("#integrity-status")).toContainText(
        "DEPLOYMENT BLOCKED",
    );
});
for (const [name, id, value, message] of [
    ["high error", "eval", "5,90\n6,90\n7,90\n8,90", "MAE exceeds"],
    ["high drift", "actual", "100,0,0,0", "PSI exceeds"],
    [
        "constant feature",
        "train",
        "1,2\n1,3",
        "Feature variance must be non-zero",
    ],
])
    test("pipeline rejects " + name, async ({ page }) => {
        await open(page, "mlops-production-pipeline");
        await page.locator("#" + id).fill(value);
        await run(page);
        await expect(page.locator("#result")).toContainText(message);
    });
test("hub groups all nine products with distinct source and tool links", async ({
    page,
}) => {
    await page.goto("projects/");
    await expect(page.locator(".hub-group")).toHaveCount(5);
    await expect(
        page.getByRole("link", { name: "Open tool →", exact: true }),
    ).toHaveCount(9);
});
