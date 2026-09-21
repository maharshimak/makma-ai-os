"use strict";
(() => {
    const M = window.MAKMA,
        D = window.MAKMA_DOMAIN,
        W = window.WORKBENCH,
        { field: F, read: R, n: N, section: S } = W;
    W.mount(
        F(
            "document",
            "Synthetic study document",
            "Study ID: SYN-204\nPhase: III\nParticipants: 180\nIntervention: Example compound A\nPrimary Endpoint: Change from baseline at week 12",
            "textarea",
        ) +
            F(
                "corrections",
                "Human corrections JSON (optional)",
                "{}",
                "textarea",
            ) +
            F("complete", "Minimum completeness", 0.8, "number"),
        async () => {
            const source = R("document"),
                r = D.clinical(
                    source,
                    D.json(R("corrections"), "Corrections"),
                    N("complete", "Completeness"),
                ),
                fp = await D.digest(r.record);
            let highlighted = "",
                offset = 0;
            for (const e of [...r.evidence].sort((a, b) => a.start - b.start)) {
                highlighted +=
                    M.esc(source.slice(offset, e.start)) +
                    '<mark title="' +
                    M.esc(e.field) +
                    '">' +
                    M.esc(source.slice(e.start, e.end)) +
                    "</mark>";
                offset = e.end;
            }
            highlighted += M.esc(source.slice(offset));
            M.setHTML(
                "#result",
                W.status(r.allowed, "QUALITY PASS", "QUALITY BLOCK") +
                    M.metrics([
                        [
                            "Completeness",
                            (100 * r.completeness).toFixed(0) + "%",
                        ],
                        [
                            "Schema coverage",
                            (100 * r.schemaCoverage).toFixed(0) + "%",
                        ],
                        [
                            "Evidence coverage",
                            (100 * r.evidenceCoverage).toFixed(0) + "%",
                        ],
                    ]) +
                    S(
                        "Validation",
                        W.reasons([
                            ...r.errors,
                            ...r.missing.map((k) => "Missing: " + k),
                        ]),
                    ) +
                    S(
                        "Evidence in source",
                        '<pre class="evidence-text">' + highlighted + "</pre>",
                    ) +
                    S("Structured record", W.json(r.record)) +
                    S("Field provenance", M.table(r.evidence)) +
                    S("Human review changes", M.table(r.changes)) +
                    S("Record fingerprint", W.json(fp)) +
                    '<p class="notice">Synthetic document engineering demonstration. Not medical advice and not a clinical decision system. Offsets use browser UTF-16 code units; Python offsets count Unicode code points. Corrections do not inherit extraction evidence.</p>',
            );
            M.trace([
                {
                    label: "extract",
                    title: "Labeled study metadata",
                    text: "The complete field value is parsed; partial participant counts are rejected.",
                },
                {
                    label: "review",
                    title: "Human corrections",
                    text:
                        r.changes.length +
                        " overridden fields retain separate review provenance.",
                },
                {
                    label: "validate",
                    title: "Schema and completeness",
                    text: r.allowed
                        ? "Quality gate passed."
                        : "Correct invalid or missing fields.",
                },
            ]);
            return { ...r, fingerprint: fp };
        },
        "Extract + review + validate",
        "clinical-workspace",
    );
})();
