"use strict";
(() => {
    const M = window.MAKMA,
        D = window.MAKMA_DOMAIN,
        W = window.WORKBENCH,
        { field: F, read: R, n: N, section: S } = W;
    W.mount(
        S(
            "Edit request",
            F(
                "prompt",
                "Edit prompt",
                "cinematic slow motion, denoise audio, add subtitles and remove background",
                "textarea",
            ),
        ) +
            S(
                "Source media",
                F("width", "Width", 1920, "number") +
                    F("height", "Height", 1080, "number") +
                    F("duration", "Duration (seconds)", 30, "number") +
                    F("fps", "FPS", 30, "number"),
            ) +
            S(
                "Output and budget",
                F("outwidth", "Output width", 1920, "number") +
                    F("outheight", "Output height", 1080, "number") +
                    F("speed", "Retime speed factor", 0.5, "number") +
                    F(
                        "budget",
                        "Max weighted megapixel-frames",
                        250000,
                        "number",
                    ),
            ),
        async () => {
            const r = D.media(
                    R("prompt"),
                    N("width", "Width"),
                    N("height", "Height"),
                    N("duration", "Duration"),
                    N("fps", "FPS"),
                    N("budget", "Budget"),
                    N("outwidth", "Output width"),
                    N("outheight", "Output height"),
                    N("speed", "Speed"),
                ),
                fp = await D.digest(r);
            M.setHTML(
                "#result",
                W.status(r.allowed, "PREFLIGHT PASS", "PREFLIGHT BLOCK") +
                    M.metrics([
                        ["Source frames", r.frames],
                        ["Output frames", r.outputFrames],
                        ["Source MP", r.sourceMegapixels.toFixed(2)],
                        ["Weighted MP-frames", r.workload.toFixed(1)],
                        [
                            "Budget utilization",
                            r.budgetUtilization.toFixed(1) + "%",
                        ],
                        ["Complexity factor", r.complexity.toFixed(2)],
                    ]) +
                    S(
                        r.operations.length
                            ? "Validated edit plan"
                            : "No supported operations were detected.",
                        M.table(
                            r.operations.map((o, i) => ({
                                order: i + 1,
                                operation: o.operation,
                                stage: o.stage,
                                parameters: JSON.stringify(o.parameters),
                                weighted_workload: o.workload.toFixed(1),
                            })),
                        ),
                    ) +
                    S("Warnings and dependencies", W.reasons(r.warnings)) +
                    S("Plan fingerprint", W.json(fp)) +
                    '<p class="notice">Workload units are heuristic weighted megapixel-frames, not GPU seconds, VRAM requirements or a measured render benchmark. Source segmentation and output processing use their respective resolutions.</p>',
            );
            M.trace([
                {
                    label: "parse",
                    title: "Supported intent matching",
                    text:
                        r.operations.length +
                        " operations identified; unrecognized clauses are disclosed.",
                },
                {
                    label: "order",
                    title: "Vision → temporal → color → audio → overlay",
                    text: "Retiming changes output duration and downstream workload.",
                },
                {
                    label: "gate",
                    title: "Render preflight",
                    text: r.allowed
                        ? "Plan is within the configured workload budget."
                        : "Resolve warnings or reduce workload before rendering.",
                },
            ]);
            return { ...r, fingerprint: fp };
        },
        "Build media preflight",
        "media-workspace",
    );
})();
