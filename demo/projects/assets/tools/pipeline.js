"use strict";
(() => {
    const M = window.MAKMA,
        D = window.MAKMA_DOMAIN,
        W = window.WORKBENCH,
        { field: F, read: R, n: N, section: S } = W;
    let artifactOrigin = null;
    W.mount(
        S(
            "Train and evaluate",
            F(
                "train",
                "Training data · x,y per line",
                "1,2\n2,4\n3,6\n4,8",
                "textarea",
            ) +
                F(
                    "eval",
                    "Held-out data · x,y per line",
                    "5,10\n6,12\n7,14\n8,16",
                    "textarea",
                ),
        ) +
            S(
                "Deployment policy",
                F("maxmae", "Max MAE", 0.5, "number") +
                    F("maxpsi", "Max PSI", 0.25, "number") +
                    F("minrows", "Min evaluation rows", 4, "number") +
                    F("expected", "Expected distribution bins", "25,25,25,25") +
                    F("actual", "Actual distribution bins", "24,26,27,23"),
            ),
        async () => {
            const r = D.pipeline(
                    R("train"),
                    R("eval"),
                    N("maxmae", "Max MAE"),
                    N("maxpsi", "Max PSI"),
                    N("minrows", "Minimum rows"),
                    W.list("expected"),
                    W.list("actual"),
                ),
                payload = D.canonical(r.model),
                fp = await D.digest(payload);
            artifactOrigin = { ...r, artifact: payload, expectedDigest: fp };
            M.setHTML(
                "#result",
                S("Held-out predictions", M.table(r.rows)) +
                    M.metrics([
                        ["Slope", r.model.slope],
                        ["Intercept", r.model.intercept],
                        ["MAE", r.mae.toFixed(6)],
                        ["PSI", r.drift.toFixed(6)],
                    ]) +
                    S(
                        "Artifact integrity",
                        F(
                            "artifact",
                            "Artifact payload (edit to test tampering)",
                            payload,
                            "textarea",
                        ) +
                            F("expected-digest", "Expected SHA-256", fp) +
                            '<button id="verify-artifact" class="btn primary">Verify artifact + deployment gate</button><div id="integrity-status" role="status" aria-live="polite"></div>',
                    ) +
                    S("Run manifest", W.json({ ...r, model_fingerprint: fp })) +
                    '<p class="notice">Compact browser OLS lifecycle. Artifact verification hashes the exact UTF-8 payload bytes. The expected digest is a user-controlled reference, not a digital signature or trusted registry.</p>',
            );
            const verify = async () => {
                const actual = await D.digest(R("artifact")),
                    expected = D.text(R("expected-digest"), "Expected digest");
                if (!/^[a-f0-9]{64}$/i.test(expected))
                    throw Error(
                        "Expected digest must be 64 hexadecimal characters.",
                    );
                const valid = actual === expected.toLowerCase(),
                    sameTrainingArtifact = expected.toLowerCase() === fp,
                    allowed = valid && sameTrainingArtifact && r.allowed,
                    reasons = [
                        ...r.reasons,
                        ...(!valid ? ["Artifact bytes changed"] : []),
                        ...(!sameTrainingArtifact
                            ? ["Expected digest differs from this training run"]
                            : []),
                    ];
                M.setHTML(
                    "#integrity-status",
                    W.status(
                        valid && sameTrainingArtifact,
                        "ARTIFACT VERIFIED",
                        "INTEGRITY FAILED",
                    ) +
                        " " +
                        W.status(
                            allowed,
                            "DEPLOYMENT ALLOWED",
                            "DEPLOYMENT BLOCKED",
                        ) +
                        W.reasons(reasons),
                );
                Object.assign(artifactOrigin, {
                    actualDigest: actual,
                    integrity: valid && sameTrainingArtifact,
                    allowed,
                    reasons,
                });
            };
            const invalidate = () => {
                Object.assign(artifactOrigin, {
                    integrity: false,
                    allowed: false,
                    reasons: ["Artifact verification required after editing"],
                });
                M.setHTML(
                    "#integrity-status",
                    W.status(false, "", "VERIFICATION REQUIRED"),
                );
            };
            M.$("#artifact").oninput = invalidate;
            M.$("#expected-digest").oninput = invalidate;
            M.$("#verify-artifact").onclick = () =>
                verify().catch((e) => {
                    Object.assign(artifactOrigin, {
                        integrity: false,
                        allowed: false,
                        reasons: [e.message],
                    });
                    M.setHTML("#integrity-status", M.esc(e.message));
                });
            await verify();
            M.trace([
                {
                    label: "train",
                    title: "TRAINED",
                    text: "Ordinary least squares over finite paired observations.",
                },
                {
                    label: "evaluate",
                    title: "EVALUATED",
                    text:
                        r.eval_rows + " held-out rows; MAE " + r.mae.toFixed(6),
                },
                {
                    label: "drift",
                    title: "DRIFT CHECKED",
                    text: "Normalized PSI " + r.drift.toFixed(6),
                },
                {
                    label: "integrity",
                    title: "Artifact and deployment gate",
                    text: "A byte change or substituted digest blocks this run. Verification can be repeated after editing the artifact.",
                },
            ]);
            return artifactOrigin;
        },
        "Train + evaluate + verify",
        "pipeline-workspace",
    );
})();
