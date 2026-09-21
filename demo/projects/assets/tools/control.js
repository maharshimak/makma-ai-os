"use strict";
(() => {
    const M = window.MAKMA,
        D = window.MAKMA_DOMAIN,
        W = window.WORKBENCH,
        { field: F, read: R, n: N, section: S } = W;
    const metrics = [
        {
            metric: "auc",
            value: 0.91,
            threshold: 0.85,
            higher_is_better: true,
            baseline: 0.9,
        },
        {
            metric: "loss",
            value: 0.12,
            threshold: 0.2,
            higher_is_better: false,
            baseline: 0.15,
        },
    ];
    const prod = {
            requests: 2000,
            error_rate: 0.015,
            p95_latency_ms: 620,
            quality_score: 0.9,
        },
        cand = {
            requests: 350,
            error_rate: 0.018,
            p95_latency_ms: 710,
            quality_score: 0.91,
        };
    W.mount(
        S(
            "1 · Candidate artifact",
            F("name", "Model name", "fraud-model") +
                F("version", "Model version", "2.0") +
                F(
                    "uri",
                    "Artifact URI",
                    "s3://synthetic-models/fraud/2.0/model.json",
                ) +
                F("fingerprint", "Dataset fingerprint", "synthetic-dataset-v2"),
        ) +
            S(
                "2 · Evaluation policy",
                F(
                    "evaluations",
                    "Evaluation metrics JSON",
                    JSON.stringify(metrics, null, 2),
                    "textarea",
                ) + F("require", "Required evaluation count", 2, "number"),
            ) +
            S(
                "3 · Drift distributions",
                F("expected", "Expected bins", "20,30,30,20") +
                    F("actual", "Actual bins", "18,31,32,19"),
            ) +
            S(
                "4 · Canary snapshots",
                F(
                    "production",
                    "Production snapshot JSON",
                    JSON.stringify(prod, null, 2),
                    "textarea",
                ) +
                    F(
                        "candidate",
                        "Candidate snapshot JSON",
                        JSON.stringify(cand, null, 2),
                        "textarea",
                    ) +
                    F("traffic", "Candidate traffic percent", 20, "number"),
            ),
        async () => {
            const r = D.control(
                {
                    name: R("name"),
                    version: R("version"),
                    artifact_uri: R("uri"),
                    dataset_fingerprint: R("fingerprint"),
                },
                D.json(R("evaluations"), "Evaluations"),
                D.json(R("production"), "Production"),
                D.json(R("candidate"), "Candidate"),
                N("traffic", "Traffic"),
                W.list("expected"),
                W.list("actual"),
                N("require", "Required evaluations"),
            );
            const fp = await D.digest(r.manifest);
            M.setHTML(
                "#result",
                S(
                    "Promotion decision",
                    W.status(
                        r.promotion,
                        "PROMOTION ALLOWED",
                        "PROMOTION BLOCKED",
                    ) + W.reasons(r.reasons),
                ) +
                    S(
                        "Evaluation evidence and baseline regressions",
                        M.table(r.rows),
                    ) +
                    S(
                        "Drift and rollout",
                        M.metrics([
                            ["PSI", r.drift.toFixed(6)],
                            ["Drift classification", r.severity],
                            ["Canary decision", r.action],
                            ["Next traffic", r.next + "%"],
                        ]) + W.reasons(r.canaryReasons),
                    ) +
                    S(
                        "Rollback guard",
                        W.status(
                            !r.rollbackReasons.length,
                            "NO ROLLBACK TRIGGER",
                            "ROLLBACK",
                        ) + W.reasons(r.rollbackReasons),
                    ) +
                    S(
                        "Governance manifest",
                        W.json({ ...r.manifest, fingerprint: fp }),
                    ) +
                    '<p class="notice">Policy evaluation only. This tool does not deploy models or change traffic. Failed promotion or critical drift prevents advancement; rollback signals take precedence. Artifact URIs and dataset fingerprints are caller-supplied metadata, not verified remote assets.</p>',
            );
            M.trace([
                {
                    label: "candidate",
                    title: "Artifact identity",
                    text: r.manifest.model_key,
                },
                {
                    label: "quality",
                    title: "Promotion policy",
                    text: r.rows.length + " evaluation records inspected.",
                },
                {
                    label: "rollout",
                    title: "Combined rollout decision",
                    text:
                        r.action +
                        " → " +
                        r.next +
                        "% candidate traffic; no infrastructure operation executed.",
                },
                {
                    label: "manifest",
                    title: "SHA-256 governance record",
                    text: fp,
                },
            ]);
            return { ...r, fingerprint: fp };
        },
        "Evaluate lifecycle decision",
        "control-workspace",
    );
})();
