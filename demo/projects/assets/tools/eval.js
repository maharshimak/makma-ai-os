"use strict";
(() => {
    const M = window.MAKMA,
        D = window.MAKMA_DOMAIN,
        W = window.WORKBENCH,
        { field: F, read: R, n: N, section: S } = W;
    const cases = [
        {
            id: "retrieval",
            prompt: "How is evidence retrieved?",
            output: "Hybrid retrieval combines lexical and vector search [doc-1].",
            expected_terms: ["retrieval", "search"],
            expected_citations: ["[doc-1]"],
            forbidden: ["password"],
            latency_ms: 850,
            input_tokens: 900,
            output_tokens: 180,
        },
        {
            id: "safety",
            prompt: "How are tools controlled?",
            output: "Tool permissions enforce an allowlist [doc-2].",
            expected_terms: ["permissions", "allowlist"],
            expected_citations: ["[doc-2]"],
            forbidden: ["secret key"],
            latency_ms: 700,
            input_tokens: 700,
            output_tokens: 120,
        },
    ];
    W.mount(
        S(
            "Baseline and candidate experiments",
            F(
                "baseline",
                "Baseline cases JSON",
                JSON.stringify(cases, null, 2),
                "textarea",
            ) +
                F(
                    "candidate",
                    "Candidate cases JSON",
                    JSON.stringify(cases, null, 2),
                    "textarea",
                ),
        ) +
            S(
                "Release thresholds",
                F("minrel", "Minimum relevance", 0.75, "number") +
                    F("mincite", "Minimum citation coverage", 1, "number") +
                    F(
                        "maxlat",
                        "Maximum p95 / case latency ms",
                        5000,
                        "number",
                    ) +
                    F("maxcost", "Maximum average cost USD", 0.01, "number") +
                    F("minpass", "Minimum pass rate", 0.9, "number") +
                    F("minsamples", "Minimum sample count", 2, "number") +
                    F(
                        "inprice",
                        "Input USD per million tokens",
                        0.15,
                        "number",
                    ) +
                    F(
                        "outprice",
                        "Output USD per million tokens",
                        0.6,
                        "number",
                    ),
            ) +
            S(
                "Regression budgets",
                F("passdrop", "Maximum pass-rate drop", 0.02, "number") +
                    F("reldrop", "Maximum relevance drop", 0.03, "number") +
                    F(
                        "citedrop",
                        "Maximum citation-coverage drop",
                        0,
                        "number",
                    ) +
                    F("latdelta", "Maximum p95 increase ms", 500, "number") +
                    F(
                        "costdelta",
                        "Maximum mean cost increase USD",
                        0.001,
                        "number",
                    ),
            ) +
            S(
                "Separate reported reliability sample",
                F("samples", "Reported sample count", 30, "number") +
                    F("successes", "Reported successful samples", 28, "number"),
            ),
        async () => {
            const baseCases = D.json(R("baseline"), "Baseline cases"),
                candidateCases = D.json(R("candidate"), "Candidate cases");
            const definitions = (cases) =>
                D.array(cases, "Cases")
                    .map((c) =>
                        D.canonical({
                            id: c.id,
                            prompt: c.prompt,
                            expected_terms: c.expected_terms || [],
                            expected_citations: c.expected_citations || [],
                            forbidden: c.forbidden || [],
                        }),
                    )
                    .sort();
            if (
                D.canonical(definitions(baseCases)) !==
                D.canonical(definitions(candidateCases))
            )
                throw Error(
                    "Baseline and candidate must use the same case IDs, prompts and judgments.",
                );
            const p = {
                minRelevance: N("minrel", "Min relevance"),
                minCitation: N("mincite", "Min citation"),
                maxLatency: N("maxlat", "Max latency"),
                maxCost: N("maxcost", "Max cost"),
                minPass: N("minpass", "Min pass rate"),
                minSamples: N("minsamples", "Min samples"),
                inPrice: N("inprice", "Input price"),
                outPrice: N("outprice", "Output price"),
            };
            const base = D.evaluateCases(baseCases, p),
                candidate = D.evaluateCases(candidateCases, p),
                comparison = D.compare(base.summary, candidate.summary, {
                    passDrop: N("passdrop", "Pass drop"),
                    relevanceDrop: N("reldrop", "Relevance drop"),
                    citationDrop: N("citedrop", "Citation drop"),
                    latencyIncrease: N("latdelta", "Latency increase"),
                    costIncrease: N("costdelta", "Cost increase"),
                }),
                reported = D.wilson(
                    N("successes", "Successes"),
                    N("samples", "Samples"),
                ),
                reasons = [...candidate.reasons, ...comparison.reasons],
                allowed = !reasons.length;
            M.setHTML(
                "#result",
                W.status(allowed, "ACCEPT CANDIDATE", "BLOCK CANDIDATE") +
                    W.reasons(reasons) +
                    S(
                        "Baseline vs candidate",
                        M.table(
                            Object.keys(comparison.delta).map((metric) => ({
                                metric,
                                baseline: base.summary[metric],
                                candidate: candidate.summary[metric],
                                delta: comparison.delta[metric],
                            })),
                        ),
                    ) +
                    S(
                        "Candidate case decisions",
                        M.table(
                            candidate.rows.map((r) => ({
                                ...r,
                                reasons: r.reasons.join(", "),
                                missing: r.missing.join(", "),
                                missingCites: r.missingCites.join(", "),
                                forbidden: r.forbidden.join(", "),
                            })),
                        ),
                    ) +
                    S(
                        "Reliability confidence",
                        M.metrics([
                            ["Evaluated cases", candidate.summary.samples],
                            ["Successful cases", candidate.summary.successes],
                            [
                                "Pass rate",
                                (100 * candidate.summary.passRate).toFixed(1) +
                                    "%",
                            ],
                            [
                                "Wilson lower",
                                (100 * candidate.confidence.lower).toFixed(1) +
                                    "%",
                            ],
                            [
                                "Wilson upper",
                                (100 * candidate.confidence.upper).toFixed(1) +
                                    "%",
                            ],
                        ]),
                    ) +
                    S(
                        "Reported reliability (separate population)",
                        W.json(reported),
                    ) +
                    '<p class="notice">All latencies and token counts are supplied observations, not measurements made by this page. Release decisions use the case dataset; manually reported reliability is shown separately. Relevance uses phrase containment, while the Python legacy metric uses token membership. Neither is a semantic model judge.</p>',
            );
            M.trace([
                {
                    label: "evaluate",
                    title: "Per-case evaluation",
                    text: "Expected concepts, citations, forbidden phrases, latency and cost evaluated for every case.",
                },
                {
                    label: "slo",
                    title: "Observed experiment SLO",
                    text: "p95 uses nearest rank; success rate and confidence derive from actual case decisions.",
                },
                {
                    label: "compare",
                    title: "Baseline regression gate",
                    text: allowed
                        ? "All release and regression policies passed."
                        : reasons.join("; "),
                },
            ]);
            return { base, candidate, comparison, reported, allowed, reasons };
        },
        "Evaluate release candidate",
        "eval-workspace",
    );
})();
