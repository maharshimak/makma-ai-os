"use strict";
const { test } = require("node:test"),
    assert = require("node:assert/strict"),
    fs = require("node:fs"),
    vm = require("node:vm");
const D = require("../../demo/projects/assets/domain.js"),
    fixture = require("../fixtures/python-parity.json");
const crypto = require("node:crypto").webcrypto;
const context = vm.createContext({
    window: { MAKMA_TEST: true },
    crypto,
    TextEncoder,
    console,
});
vm.runInContext(
    fs.readFileSync("demo/projects/assets/core.js", "utf8"),
    context,
);
vm.runInContext(
    fs.readFileSync("demo/projects/assets/tools/rag.js", "utf8"),
    context,
);
const rag = context.window.MAKMA.rag;
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} != ${b}`);
for (const value of ["", null, undefined, NaN, Infinity, true, [], [1], {}])
    test("numeric rejection " + String(value), () =>
        assert.throws(() => D.number(value, "value")),
    );
test("probability, counts and distribution boundaries", () => {
    assert.equal(D.normalize("constructor"), "constructor");
    assert.throws(() => D.probability(1.1, "rate"));
    assert.throws(() => D.integer(2.5, "count"));
    assert.throws(() => D.psi([1], [1, 2]));
    assert.throws(() => D.psi([0], [0]));
    assert.throws(() => D.psi([1e308, 1e308], [1, 1]));
});
test("SHA256 token vectors match Python including Unicode and empty input", async () => {
    for (let i = 0; i < fixture.texts.length; i++) {
        const actual = await rag.vector(fixture.texts[i]);
        assert.equal(actual.length, 256);
        actual.forEach((n, j) => close(n, fixture.vectors[i][j]));
    }
});
test("BM25, semantic, RRF, reranking and evaluation match Python", async () => {
    const lex = rag.bm25(fixture.docs, fixture.query),
        sem = await rag.semantic(fixture.docs, fixture.query),
        fused = rag.rrf([lex, sem]),
        ranked = rag.rerank(fixture.query, fused, 3);
    for (const [actual, expected] of [
        [lex, fixture.lexical],
        [sem, fixture.semantic],
        [fused, fixture.fused],
        [ranked, fixture.ranked],
    ]) {
        assert.equal(actual.length, expected.length);
        actual.forEach((r, i) => {
            assert.equal(r.doc.id, expected[i].id);
            close(r.score, expected[i].score);
        });
    }
    for (const f of fixture.metrics) {
        const actual = rag.retrievalMetrics(ranked, new Set(f.relevant));
        for (const [a, b] of [
            ["recall", "recall_at_k"],
            ["precision", "precision_at_k"],
            ["mrr", "mrr"],
            ["hit", "hit_rate_at_k"],
        ])
            close(actual[a], f.result[b]);
    }
});
test("OLS, PSI, SHA256 bytes and canary match Python fixtures", async () => {
    close(D.psi(fixture.psi.expected, fixture.psi.actual), fixture.psi.value);
    const model = D.pipeline(
        "1,2\n2,4\n3,6\n4,8",
        "5,10\n6,12",
        1,
        1,
        2,
        [1, 1],
        [1, 1],
    );
    close(model.model.slope, fixture.model.slope);
    close(model.model.intercept, fixture.model.intercept);
    close(model.mae, fixture.model.mae);
    assert.equal(await D.digest(fixture.sha256.payload), fixture.sha256.value);
    const c = fixture.canary,
        r = D.control(
            {
                name: "n",
                version: "v",
                artifact_uri: "local",
                dataset_fingerprint: "f",
            },
            [{ metric: "q", value: 1, threshold: 0.5, higher_is_better: true }],
            c.production,
            c.candidate,
            20,
            [1, 1],
            [1, 1],
        );
    assert.equal(r.action, c.decision.action);
    assert.equal(r.next, c.decision.next_traffic_percent);
});
const entities = [
        { id: "a", name: "Alpha Engine", kind: "tool" },
        { id: "b", name: "Beta Engine", kind: "tool" },
    ],
    edges = [
        { source: "a", target: "b", relation: "USES", evidence: "contract" },
    ];
test("graph nonsense never resolves at default threshold; directed paths only", () => {
    const r = D.graph(
        entities,
        edges,
        "zzzzrandomunknown",
        0.82,
        2,
        0.8,
        false,
        "a",
        "b",
    );
    assert.equal(r.resolved, null);
    assert.equal(r.path[0].target, "b");
    assert.equal(
        D.graph(entities, edges, "Alpha Engine", 0.82, 2, 0.8, false, "b", "a")
            .path,
        null,
    );
});
test("graph rejects duplicates, unknown references and missing evidence gate", () => {
    assert.throws(() => D.graph([...entities, entities[0]], edges, "a"));
    assert.throws(() => D.graph(entities, [{ ...edges[0], target: "x" }], "a"));
    assert.ok(
        D.graph(entities, [{ ...edges[0], evidence: "" }], "Alpha Engine")
            .reasons.length,
    );
});
test("media source, output, retiming and budget all affect decisions", () => {
    const run = (prompt, w = 1920, budget = 1e9) =>
        D.media(prompt, 1920, 1080, 30, 30, budget, w, 1080, 0.5);
    assert.equal(run("unsupported operation").allowed, false);
    assert.ok(run("slow motion").outputFrames > run("denoise").outputFrames);
    assert.ok(run("denoise", 3840).workload > run("denoise").workload);
    assert.equal(run("denoise", 1920, 1).allowed, false);
    assert.ok(
        run("replace background").warnings.some((x) =>
            x.includes("replacement asset"),
        ),
    );
});
const study =
    "Study ID: X\nPhase: III\nParticipants: 180\nIntervention: A\nPrimary Endpoint: B";
test("clinical evidence offsets and human provenance remain distinct", () => {
    const r = D.clinical(study, { participants: 200 }, 1);
    assert.equal(r.allowed, true);
    assert.equal(r.evidenceCoverage, 0.8);
    assert.equal(r.changes.length, 1);
    for (const e of r.evidence)
        assert.equal(study.slice(e.start, e.end), e.raw);
    assert.equal(D.clinical(study.replace("180", "12.5")).allowed, false);
    assert.equal(D.clinical(study.replace("Study ID: X\n", "")).allowed, false);
});
const policy = {
        minRelevance: 1,
        minCitation: 1,
        maxLatency: 100,
        maxCost: 1,
        minPass: 1,
        minSamples: 1,
        inPrice: 1,
        outPrice: 1,
    },
    cases = [
        {
            id: "safe",
            prompt: "Provide a safe answer",
            output: "Safe answer [1]",
            expected_terms: ["safe"],
            expected_citations: ["[1]"],
            latency_ms: 10,
            input_tokens: 1,
            output_tokens: 1,
            forbidden: ["secret"],
        },
    ];
test("evaluation blocks forbidden phrases, latency and sample shortfalls", () => {
    assert.equal(D.evaluateCases(cases, policy).allowed, true);
    for (const c of [
        { ...cases[0], output: "secret" },
        { ...cases[0], latency_ms: 101 },
    ])
        assert.equal(D.evaluateCases([c], policy).allowed, false);
    assert.equal(
        D.evaluateCases(cases, { ...policy, minSamples: 2 }).allowed,
        false,
    );
    assert.throws(() =>
        D.evaluateCases([{ ...cases[0], input_tokens: -1 }], policy),
    );
    assert.throws(() => D.wilson(3, 2));
});
test("pipeline blocks high error and drift; rejects constant features", () => {
    assert.equal(
        D.pipeline("1,2\n2,4", "3,90", 1, 1, 1, [1, 1], [1, 1]).allowed,
        false,
    );
    assert.equal(
        D.pipeline("1,2\n2,4", "3,6", 1, 0.01, 1, [1, 100], [100, 1]).allowed,
        false,
    );
    assert.throws(() => D.pipeline("1,2\n1,3", "3,6", 1, 1, 1, [1], [1]));
});
test("calculator matches Python power precedence and modulo sign", () => {
    const source = fs.readFileSync("demo/app.js", "utf8"),
        start = source.indexOf("function parseExpression("),
        end = source.indexOf("\nfunction demoPlan", start),
        fn = vm.runInNewContext(source.slice(start, end) + ";parseExpression");
    assert.equal(fn("-2**2"), -4);
    assert.equal(fn("2**3**2"), 512);
    assert.equal(fn("-5%3"), 1);
    assert.throws(() => fn("1/0"));
    assert.throws(() => fn("alert(1)"));
});
