"use strict";
(() => {
    const M = window.MAKMA,
        D = window.MAKMA_DOMAIN,
        W = window.WORKBENCH,
        { field: F, read: R, n: N, section: S } = W;
    const entities = [
        {
            id: "makma",
            kind: "runtime",
            name: "Mak'ma AI OS",
            description: "Permission-aware runtime",
        },
        {
            id: "rag",
            kind: "retriever",
            name: "Agentic RAG Engine",
            description: "Retrieves supporting knowledge",
        },
        {
            id: "eval",
            kind: "evaluator",
            name: "Evaluation Layer",
            description: "Measures quality before release",
        },
    ];
    const edges = [
        {
            source: "makma",
            relation: "USES",
            target: "rag",
            evidence:
                "Synthetic architecture example: retrieval tool registration",
        },
        {
            source: "rag",
            relation: "MEASURED_BY",
            target: "eval",
            evidence: "Synthetic evaluation contract",
        },
    ];
    W.mount(
        S(
            "Graph data",
            F(
                "entities",
                "Entities JSON",
                JSON.stringify(entities, null, 2),
                "textarea",
            ) +
                F(
                    "edges",
                    "Relationships JSON",
                    JSON.stringify(edges, null, 2),
                    "textarea",
                ),
        ) +
            S(
                "Resolve and explore",
                F("query", "Entity name", "Agentic RAG Engine") +
                    F("threshold", "Minimum resolution score", 0.82, "number") +
                    F("depth", "Traversal depth", 2, "number") +
                    F("from", "Path from entity ID", "makma") +
                    F("to", "Path to entity ID", "eval"),
            ) +
            S(
                "Quality policy",
                F("evidence", "Minimum evidence coverage", 0.8, "number") +
                    '<div class="field"><label for="orphans">Orphan policy</label><select id="orphans"><option value="false">Disallow orphans</option><option value="true">Allow orphans</option></select></div>',
            ),
        async () => {
            const E = D.json(R("entities"), "Entities"),
                ED = D.json(R("edges"), "Relationships"),
                r = D.graph(
                    E,
                    ED,
                    R("query"),
                    N("threshold", "Resolution threshold"),
                    N("depth", "Depth"),
                    N("evidence", "Evidence threshold"),
                    R("orphans") === "true",
                    R("from"),
                    R("to"),
                );
            M.setHTML(
                "#result",
                S(
                    "Graph quality",
                    W.status(
                        !r.reasons.length,
                        "QUALITY PASS",
                        "QUALITY BLOCK",
                    ) +
                        M.metrics([
                            ["Entities", r.quality.entities],
                            ["Edges", r.quality.edges],
                            ["Orphans", r.quality.orphans.length],
                            [
                                "Evidence",
                                (100 * r.quality.evidence).toFixed(1) + "%",
                            ],
                            ["Components", r.quality.components],
                            ["Duplicates", r.quality.duplicates],
                        ]) +
                        W.reasons(r.reasons),
                ) +
                    S(
                        "Resolved entity",
                        r.resolved
                            ? "<p>" +
                                  M.esc(r.resolved.name) +
                                  " · " +
                                  r.resolved.score.toFixed(3) +
                                  (r.resolved.exact ? " · exact match" : "") +
                                  "</p>"
                            : "<p>No confident entity resolution</p>",
                    ) +
                    S(
                        "Top resolution candidates",
                        M.table(
                            r.candidates.map((c) => ({
                                ...c,
                                score: c.score.toFixed(3),
                            })),
                        ),
                    ) +
                    S(
                        "Keyword search (separate from resolution)",
                        M.table(r.search),
                    ) +
                    S(
                        "Directed path",
                        r.path === null
                            ? "<p>No directed path exists.</p>"
                            : r.path.length
                              ? M.table(r.path)
                              : "<p>Start and destination are the same entity.</p>",
                    ) +
                    S(
                        "Inspect nodes",
                        E.map(
                            (e) =>
                                '<button class="btn inspect-node" data-id="' +
                                M.esc(e.id) +
                                '">' +
                                M.esc(e.name) +
                                "</button>",
                        ).join("") + '<div id="node-details"></div>',
                    ) +
                    S(
                        "Directed neighborhood",
                        M.table(E.filter((e) => r.neighborhood.includes(e.id))),
                    ) +
                    S("Relationship evidence", M.table(r.relationships)) +
                    '<p class="notice">Browser fuzzy matching uses normalized Levenshtein + token overlap. Python uses SequenceMatcher + token overlap. Scores are mode-specific; both require an explicit confidence threshold.</p>',
            );
            document
                .querySelectorAll(".inspect-node")
                .forEach(
                    (b) =>
                        (b.onclick = () =>
                            M.setHTML(
                                "#node-details",
                                W.json(E.find((e) => e.id === b.dataset.id)) +
                                    M.table(
                                        ED.filter(
                                            (e) =>
                                                e.source === b.dataset.id ||
                                                e.target === b.dataset.id,
                                        ),
                                    ),
                            )),
                );
            M.trace([
                {
                    label: "validate",
                    title: "Graph boundaries",
                    text: "Unique IDs and existing endpoints enforced.",
                },
                {
                    label: "resolve",
                    title: "Confidence gate",
                    text: r.resolved
                        ? "Name similarity reached the configured threshold."
                        : "No candidate reached the confidence threshold.",
                },
                {
                    label: "traverse",
                    title: "Directed BFS",
                    text: "Path uses the fewest directed edges. Relationship evidence remains inspectable.",
                },
            ]);
            return r;
        },
        "Resolve + find path + audit",
        "graph-workspace",
    );
})();
