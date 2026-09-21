/* Pure browser-domain functions. No network, DOM or fabricated inference. */
"use strict";
(() => {
    const number = (
        v,
        name,
        {
            min = -Number.MAX_VALUE,
            max = Number.MAX_VALUE,
            integer = false,
        } = {},
    ) => {
        if (!["number", "string"].includes(typeof v) || String(v).trim() === "")
            throw Error(name + " is required.");
        const n = Number(v);
        if (!Number.isFinite(n)) throw Error(name + " must be finite.");
        if (integer && !Number.isSafeInteger(n))
            throw Error(name + " must be an integer.");
        if (n < min || n > max)
            throw Error(name + " must be between " + min + " and " + max + ".");
        return n;
    };
    const text = (v, name, max = 100000) => {
        if (typeof v !== "string" || !v.trim())
            throw Error(name + " is required.");
        if (v.length > max)
            throw Error(name + " exceeds " + max + " characters.");
        return v.trim();
    };
    const probability = (v, n) => number(v, n, { min: 0, max: 1 });
    const nonnegative = (v, n) => number(v, n, { min: 0 });
    const integer = (v, n, min = 0, max = 1000000) =>
        number(v, n, { min, max, integer: true });
    const json = (v, n) => {
        text(v, n);
        try {
            return JSON.parse(v);
        } catch {
            throw Error(n + " must be valid JSON.");
        }
    };
    const array = (v, n, max = 1000) => {
        if (!Array.isArray(v) || v.length > max)
            throw Error(
                n + " must be an array with at most " + max + " entries.",
            );
        return v;
    };
    const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    const canonical = (v) =>
        JSON.stringify(v, (_k, x) =>
            x && typeof x === "object" && !Array.isArray(x)
                ? Object.fromEntries(
                      Object.keys(x)
                          .sort()
                          .map((k) => [k, x[k]]),
                  )
                : x,
        );
    const digest = async (v) => {
        if (!globalThis.crypto?.subtle)
            throw Error("SHA-256 requires a secure browser context.");
        const bytes = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(typeof v === "string" ? v : canonical(v)),
        );
        return [...new Uint8Array(bytes)]
            .map((x) => x.toString(16).padStart(2, "0"))
            .join("");
    };
    const psi = (e, a) => {
        array(e, "Expected bins");
        array(a, "Actual bins");
        if (!e.length || e.length !== a.length)
            throw Error(
                "Expected and actual distributions must contain the same non-zero number of bins.",
            );
        e = e.map((v) => nonnegative(v, "Expected bin"));
        a = a.map((v) => nonnegative(v, "Actual bin"));
        const et = e.reduce((s, v) => s + v, 0),
            at = a.reduce((s, v) => s + v, 0);
        if (!Number.isFinite(et) || !Number.isFinite(at) || et <= 0 || at <= 0)
            throw Error("Distribution totals must be finite and positive.");
        return e.reduce((s, v, i) => {
            const x = Math.max(v / et, 1e-6),
                y = Math.max(a[i] / at, 1e-6);
            return s + (y - x) * Math.log(y / x);
        }, 0);
    };
    const normalize = (v) =>
        text(v, "Entity name", 500)
            .normalize("NFKD")
            .replace(/\p{M}/gu, "")
            .toLowerCase()
            .match(/[a-z0-9]+/g)
            ?.map(
                (t) =>
                    ({
                        corporation: "corp",
                        company: "co",
                        limited: "ltd",
                        incorporated: "inc",
                    })[t] || t,
            )
            .join(" ") || "";
    // Browser resolver uses normalized Levenshtein + Jaccard; Python uses SequenceMatcher.
    const similarity = (a, b) => {
        a = normalize(a);
        b = normalize(b);
        if (!a || !b) return 0;
        if (a === b) return 1;
        let row = Array.from({ length: b.length + 1 }, (_, i) => i);
        for (let i = 1; i <= a.length; i++) {
            const next = [i];
            for (let j = 1; j <= b.length; j++)
                next[j] = Math.min(
                    next[j - 1] + 1,
                    row[j] + 1,
                    row[j - 1] + (a[i - 1] !== b[j - 1]),
                );
            row = next;
        }
        const A = new Set(a.split(" ")),
            B = new Set(b.split(" ")),
            over = [...A].filter((x) => B.has(x)).length;
        return (
            0.7 * (1 - row[b.length] / Math.max(a.length, b.length)) +
            (0.3 * over) / new Set([...A, ...B]).size
        );
    };
    function graph(
        entities,
        edges,
        query,
        threshold = 0.82,
        depth = 2,
        minEvidence = 0.8,
        allowOrphans = false,
        from = "",
        to = "",
    ) {
        array(entities, "Entities", 200);
        if (!entities.length) throw Error("At least one entity is required.");
        array(edges, "Edges", 1000);
        probability(threshold, "Resolution threshold");
        probability(minEvidence, "Minimum evidence");
        integer(depth, "Depth", 0, 10);
        text(query, "Query", 500);
        const map = new Map();
        for (const e of entities) {
            if (!e || typeof e !== "object")
                throw Error("Each entity must be an object.");
            text(e.id, "Entity ID", 100);
            text(e.name, "Entity name", 500);
            text(e.kind || e.type, "Entity type", 100);
            if (map.has(e.id))
                throw Error('Entity ID "' + e.id + '" appears more than once.');
            map.set(e.id, e);
        }
        const adj = new Map([...map.keys()].map((id) => [id, []])),
            und = new Map([...map.keys()].map((id) => [id, new Set()])),
            used = new Set(),
            signatures = new Set();
        let duplicates = 0,
            evidence = 0;
        for (const e of edges) {
            if (!e || typeof e !== "object")
                throw Error("Each relationship must be an object.");
            text(e.relation, "Relation", 100);
            if (!map.has(e.source) || !map.has(e.target))
                throw Error(
                    "Unknown edge reference: " + e.source + " → " + e.target,
                );
            if (e.evidence !== undefined && typeof e.evidence !== "string")
                throw Error("Evidence must be text.");
            adj.get(e.source).push(e);
            und.get(e.source).add(e.target);
            und.get(e.target).add(e.source);
            used.add(e.source);
            used.add(e.target);
            const key = JSON.stringify([e.source, e.relation, e.target]);
            if (signatures.has(key)) duplicates++;
            signatures.add(key);
            if (e.evidence?.trim()) evidence++;
        }
        const candidates = entities
            .map((e) => ({
                id: e.id,
                name: e.name,
                score: similarity(query, e.name),
                exact: normalize(query) === normalize(e.name),
            }))
            .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
        const resolved =
            candidates[0]?.score >= threshold ? candidates[0] : null;
        const terms = query.toLowerCase().split(/\s+/);
        const search = entities.filter((e) =>
            terms.some((t) =>
                (e.name + " " + (e.description || ""))
                    .toLowerCase()
                    .includes(t),
            ),
        );
        const seen = new Set(),
            queue = resolved ? [[resolved.id, 0]] : [];
        for (let i = 0; i < queue.length; i++) {
            const [id, d] = queue[i];
            if (seen.has(id)) continue;
            seen.add(id);
            if (d < depth)
                adj.get(id).forEach((e) => queue.push([e.target, d + 1]));
        }
        const visited = new Set();
        let components = 0;
        for (const id of map.keys()) {
            if (visited.has(id)) continue;
            components++;
            const stack = [id];
            while (stack.length) {
                const n = stack.pop();
                if (visited.has(n)) continue;
                visited.add(n);
                stack.push(...und.get(n));
            }
        }
        const quality = {
            entities: map.size,
            edges: edges.length,
            orphans: [...map.keys()].filter((id) => !used.has(id)),
            duplicates,
            evidence: edges.length ? evidence / edges.length : 1,
            components,
        };
        const reasons = [];
        if (quality.evidence < minEvidence)
            reasons.push("Evidence coverage below threshold");
        if (duplicates) reasons.push("Duplicate relationships");
        if (quality.orphans.length && !allowOrphans)
            reasons.push("Orphan entities are disallowed");
        let path = null;
        if (from || to) {
            if (!map.has(from) || !map.has(to))
                throw Error("Path endpoints must be existing entity IDs.");
            const paths = [[from, []]],
                done = new Set();
            for (let i = 0; i < paths.length; i++) {
                const [id, p] = paths[i];
                if (id === to) {
                    path = p;
                    break;
                }
                if (done.has(id)) continue;
                done.add(id);
                adj.get(id).forEach((e) => paths.push([e.target, [...p, e]]));
            }
        }
        return {
            resolved,
            candidates: candidates.slice(0, 5),
            search,
            neighborhood: [...seen],
            relationships: edges.filter(
                (e) => seen.has(e.source) && seen.has(e.target),
            ),
            quality,
            reasons,
            path,
        };
    }
    const operationSpecs = [
        [
            "background_segmentation",
            "vision",
            2.5,
            /remove background|replace background|background segmentation/i,
            { mode: "subject" },
        ],
        [
            "retime",
            "temporal",
            1.3,
            /slow motion|slow-mo|retime/i,
            { speed: 0.5 },
        ],
        [
            "color_grade",
            "color",
            1.1,
            /teal|cinematic|color grade/i,
            { preset: "cinematic-teal" },
        ],
        ["audio_denoise", "audio", 0.2, /denoise|noise/i, { strength: 0.7 }],
        ["subtitles", "overlay", 0.3, /subtitle|caption/i, { mode: "auto" }],
    ];
    function media(
        prompt,
        width,
        height,
        duration,
        fps,
        budget,
        outWidth,
        outHeight,
        speed = 0.5,
    ) {
        text(prompt, "Edit request", 5000);
        width = integer(width, "Width", 1, 16384);
        height = integer(height, "Height", 1, 16384);
        outWidth = integer(outWidth, "Output width", 1, 16384);
        outHeight = integer(outHeight, "Output height", 1, 16384);
        duration = number(duration, "Duration", { min: 0.01, max: 7200 });
        fps = number(fps, "FPS", { min: 1, max: 240 });
        budget = number(budget, "Render budget", { min: 0.01 });
        speed = number(speed, "Speed factor", { min: 0.1, max: 4 });
        const operations = operationSpecs
            .filter((o) => o[3].test(prompt))
            .map(([operation, stage, weight, , parameters]) => ({
                operation,
                stage,
                weight,
                parameters: {
                    ...parameters,
                    ...(operation === "retime" ? { speed } : {}),
                },
            }));
        const warnings = [
            "Planning estimate only; no rendering or inference is performed.",
        ];
        if (!operations.length)
            warnings.push("No supported operations were detected.");
        if (/replace background/i.test(prompt))
            warnings.push(
                "Background replacement requires a replacement asset and compositor; this plan includes segmentation only.",
            );
        if (operations.some((o) => o.operation === "subtitles"))
            warnings.push(
                "Automatic subtitles require a speech transcription backend.",
            );
        const unknown = prompt
            .split(/,|;|\band\b/i)
            .map((x) => x.trim())
            .filter((x) => x && !operationSpecs.some((o) => o[3].test(x)));
        if (unknown.length)
            warnings.push(
                "Unsupported or unrecognized clauses: " + unknown.join("; "),
            );
        const frames = Math.ceil(duration * fps),
            outputFrames = Math.ceil(
                (duration * fps) /
                    (operations.some((o) => o.operation === "retime")
                        ? speed
                        : 1),
            ),
            mp = (width * height) / 1e6,
            outMp = (outWidth * outHeight) / 1e6;
        const base = outMp * outputFrames;
        for (const o of operations)
            o.workload =
                o.weight *
                (o.stage === "vision" ? mp * frames : outMp * outputFrames);
        const workload = base + operations.reduce((s, o) => s + o.workload, 0);
        if (!Number.isFinite(workload))
            throw Error("Workload exceeds numeric capacity.");
        if (workload > budget)
            warnings.push(
                "Render budget exceeded. Reduce output resolution, duration or expensive operations.",
            );
        if (outputFrames > frames)
            warnings.push("Retiming increases output frame workload.");
        return {
            operations,
            frames,
            outputFrames,
            sourceMegapixels: mp,
            outputMegapixels: outMp,
            baseWorkload: base,
            workload,
            complexity: workload / base,
            budgetUtilization: (100 * workload) / budget,
            allowed: operations.length > 0 && workload <= budget,
            warnings,
            unsupported: unknown,
        };
    }
    function clinical(source, overrides = {}, threshold = 0.8) {
        text(source, "Study document");
        probability(threshold, "Completeness threshold");
        const patterns = {
            study_id: /^Study(?: ID)?[ \t]*:[ \t]*([^\r\n]*)/im,
            phase: /^Phase[ \t]*:[ \t]*([^\r\n]*)/im,
            participants: /^Participants?[ \t]*:[ \t]*([^\r\n]*)/im,
            intervention: /^Intervention[ \t]*:[ \t]*([^\r\n]*)/im,
            primary_endpoint: /^Primary Endpoint[ \t]*:[ \t]*([^\r\n]*)/im,
        };
        const original = {},
            evidence = [];
        for (const [field, re] of Object.entries(patterns)) {
            const m = re.exec(source);
            let value = m?.[1].trim() || null;
            if (value && field === "phase")
                value =
                    { I: "1", II: "2", III: "3", IV: "4" }[
                        value.toUpperCase()
                    ] || value;
            if (value && field === "participants")
                value = /^\d+$/.test(value) ? Number(value) : value;
            original[field] = value;
            if (m && m[1].trim()) {
                const start = m.index + m[0].length - m[1].length;
                evidence.push({
                    field,
                    raw: m[1],
                    normalized: value,
                    start,
                    end: start + m[1].length,
                });
            }
        }
        if (
            !overrides ||
            Array.isArray(overrides) ||
            typeof overrides !== "object"
        )
            throw Error("Corrections must be a JSON object.");
        for (const key of Object.keys(overrides))
            if (!Object.hasOwn(patterns, key))
                throw Error("Unknown correction field: " + key);
        const record = { ...original, ...overrides };
        const errors = [];
        if (typeof record.study_id !== "string" || !record.study_id.trim())
            errors.push("study_id is required");
        if (
            record.phase !== null &&
            !["1", "2", "3", "4"].includes(String(record.phase))
        )
            errors.push("phase must be 1, 2, 3 or 4");
        if (
            record.participants !== null &&
            (!Number.isSafeInteger(record.participants) ||
                record.participants <= 0)
        )
            errors.push("participants must be a positive integer");
        for (const k of ["intervention", "primary_endpoint"])
            if (
                record[k] !== null &&
                (typeof record[k] !== "string" || !record[k].trim())
            )
                errors.push(k + " must be non-empty text");
        const missing = Object.keys(patterns).filter(
                (k) => record[k] === null || record[k] === "",
            ),
            changes = Object.keys(overrides)
                .filter((k) => overrides[k] !== original[k])
                .map((field) => ({
                    field,
                    original: original[field],
                    corrected: overrides[field],
                    provenance: "User correction; not extracted evidence",
                }));
        const coverage = 1 - missing.length / 5,
            verified = evidence.filter(
                (e) => record[e.field] === original[e.field],
            ).length;
        return {
            original,
            record,
            evidence,
            changes,
            missing,
            errors,
            completeness: coverage,
            schemaCoverage: evidence.length / 5,
            evidenceCoverage:
                5 - missing.length ? verified / (5 - missing.length) : 0,
            allowed: !errors.length && coverage >= threshold,
        };
    }
    function wilson(successes, total) {
        integer(total, "Samples", 1);
        integer(successes, "Successes", 0, total);
        const p = successes / total,
            z = 1.96,
            z2 = z * z,
            den = 1 + z2 / total,
            center = (p + z2 / (2 * total)) / den,
            margin =
                (z *
                    Math.sqrt(
                        (p * (1 - p)) / total + z2 / (4 * total * total),
                    )) /
                den;
        return {
            lower: Math.max(0, center - margin),
            upper: Math.min(1, center + margin),
        };
    }
    function evaluateCases(cases, policy) {
        array(cases, "Evaluation cases", 500);
        if (!cases.length)
            throw Error("At least one evaluation case is required.");
        const minRel = probability(policy.minRelevance, "Minimum relevance"),
            minCite = probability(
                policy.minCitation,
                "Minimum citation coverage",
            ),
            maxLatency = nonnegative(policy.maxLatency, "Maximum latency"),
            maxCost = nonnegative(policy.maxCost, "Maximum average cost"),
            minPass = probability(policy.minPass, "Minimum pass rate"),
            minSamples = integer(policy.minSamples, "Minimum samples", 1),
            inPrice = nonnegative(policy.inPrice, "Input price"),
            outPrice = nonnegative(policy.outPrice, "Output price");
        const ids = new Set();
        const rows = cases.map((c, i) => {
            const id = text(c.id, "Case ID", 200),
                prompt = text(c.prompt, "Case prompt", 20000);
            if (ids.has(id)) throw Error("Duplicate evaluation case ID: " + id);
            ids.add(id);
            const answer = text(c.output, "Case " + (i + 1) + " output", 20000),
                terms = [
                    ...new Set(
                        array(c.expected_terms || [], "Expected terms").map(
                            (t) => text(t, "Expected term").toLowerCase(),
                        ),
                    ),
                ],
                cites = [
                    ...new Set(
                        array(
                            c.expected_citations || [],
                            "Expected citations",
                        ).map((t) => text(t, "Citation")),
                    ),
                ];
            const missing = terms.filter(
                    (t) => !answer.toLowerCase().includes(t),
                ),
                missingCites = cites.filter((t) => !answer.includes(t)),
                forbidden = array(
                    c.forbidden || [],
                    "Forbidden phrases",
                ).filter((t) =>
                    answer
                        .toLowerCase()
                        .includes(text(t, "Forbidden phrase").toLowerCase()),
                );
            const latency = nonnegative(c.latency_ms, "Case latency"),
                input = integer(c.input_tokens, "Input tokens"),
                output = integer(c.output_tokens, "Output tokens"),
                cost = number(
                    (input * inPrice + output * outPrice) / 1e6,
                    "Estimated cost",
                ),
                relevance = terms.length
                    ? 1 - missing.length / terms.length
                    : 1,
                citation = cites.length
                    ? 1 - missingCites.length / cites.length
                    : 1,
                reasons = [];
            if (relevance < minRel) reasons.push("relevance");
            if (citation < minCite) reasons.push("citation coverage");
            if (forbidden.length) reasons.push("forbidden output");
            if (latency > maxLatency) reasons.push("latency");
            return {
                id,
                prompt,
                relevance,
                citation,
                latency,
                cost,
                passed: !reasons.length,
                reasons,
                missing,
                missingCites,
                forbidden,
            };
        });
        const successes = rows.filter((r) => r.passed).length,
            ordered = rows.map((r) => r.latency).sort((a, b) => a - b),
            summary = {
                samples: rows.length,
                successes,
                passRate: successes / rows.length,
                relevance: mean(rows.map((r) => r.relevance)),
                citation: mean(rows.map((r) => r.citation)),
                p95: ordered[Math.ceil(rows.length * 0.95) - 1],
                cost: mean(rows.map((r) => r.cost)),
            },
            reasons = [];
        if (summary.samples < minSamples)
            reasons.push("Insufficient sample size");
        if (summary.passRate < minPass) reasons.push("Pass rate below minimum");
        if (summary.p95 > maxLatency)
            reasons.push("p95 latency exceeds maximum");
        if (summary.cost > maxCost)
            reasons.push("Average cost exceeds maximum");
        if (rows.some((r) => r.forbidden.length))
            reasons.push("Forbidden output detected");
        return {
            rows,
            summary,
            reasons,
            allowed: !reasons.length,
            confidence: wilson(successes, rows.length),
        };
    }
    function compare(base, candidate, budget) {
        const limits = {
            passRate: nonnegative(budget.passDrop, "Pass-rate drop budget"),
            relevance: nonnegative(
                budget.relevanceDrop,
                "Relevance drop budget",
            ),
            citation: nonnegative(budget.citationDrop, "Citation drop budget"),
            p95: nonnegative(budget.latencyIncrease, "Latency increase budget"),
            cost: nonnegative(budget.costIncrease, "Cost increase budget"),
        };
        const delta = {},
            reasons = [];
        for (const k of Object.keys(limits)) {
            delta[k] =
                number(candidate[k], "Candidate " + k) -
                number(base[k], "Baseline " + k);
            if (
                ["p95", "cost"].includes(k)
                    ? delta[k] > limits[k]
                    : delta[k] < -limits[k]
            )
                reasons.push(k + " regression exceeds budget");
        }
        return { delta, reasons, allowed: !reasons.length };
    }
    function control(
        model,
        evaluations,
        production,
        candidate,
        traffic,
        expected,
        actual,
        minEvaluations = 1,
    ) {
        for (const k of [
            "name",
            "version",
            "artifact_uri",
            "dataset_fingerprint",
        ])
            text(model[k], k, 500);
        array(evaluations, "Evaluations", 100);
        integer(minEvaluations, "Required evaluations", 1, 100);
        integer(traffic, "Traffic percentage", 0, 100);
        const names = new Set(),
            rows = evaluations.map((e) => {
                text(e.metric, "Metric name", 100);
                if (names.has(e.metric))
                    throw Error("Duplicate metric " + e.metric);
                names.add(e.metric);
                const value = number(e.value, "Metric value"),
                    threshold = number(e.threshold, "Metric threshold");
                if (typeof e.higher_is_better !== "boolean")
                    throw Error("higher_is_better must be boolean");
                const baseline =
                    e.baseline === undefined
                        ? null
                        : number(e.baseline, "Baseline metric");
                return {
                    ...e,
                    value,
                    threshold,
                    passed: e.higher_is_better
                        ? value >= threshold
                        : value <= threshold,
                    delta: baseline === null ? null : value - baseline,
                };
            });
        for (const [name, s] of [
            ["Production", production],
            ["Candidate", candidate],
        ]) {
            integer(s.requests, name + " requests");
            probability(s.error_rate, name + " error rate");
            number(s.p95_latency_ms, name + " latency", { min: 0.001 });
            probability(s.quality_score, name + " quality");
        }
        const reasons = [];
        if (rows.length < minEvaluations)
            reasons.push("Insufficient evaluations");
        if (rows.some((e) => !e.passed))
            reasons.push(
                "Failed metrics: " +
                    rows
                        .filter((e) => !e.passed)
                        .map((e) => e.metric)
                        .join(", "),
            );
        const drift = psi(expected, actual),
            canaryReasons = [],
            rollbackReasons = [];
        let action = "hold",
            next = traffic;
        if (candidate.requests < 100)
            canaryReasons.push("Insufficient candidate traffic");
        else {
            if (candidate.error_rate - production.error_rate > 0.01)
                canaryReasons.push("error-rate regression");
            if (candidate.p95_latency_ms - production.p95_latency_ms > 250)
                canaryReasons.push("latency regression");
            if (production.quality_score - candidate.quality_score > 0.02)
                canaryReasons.push("quality regression");
            if (candidate.error_rate > 0.05)
                rollbackReasons.push("absolute error rate high");
            if (candidate.error_rate - production.error_rate > 0.02)
                rollbackReasons.push("error-rate increase high");
            if (candidate.p95_latency_ms / production.p95_latency_ms > 1.5)
                rollbackReasons.push("latency ratio high");
            if (canaryReasons.length || rollbackReasons.length) {
                action = "rollback";
                next = 0;
            } else if (reasons.length || drift >= 0.25) {
                canaryReasons.push(
                    "Promotion or drift gate blocks advancement",
                );
            } else {
                next = Math.min(100, traffic + 20);
                action = next === 100 ? "promote" : "increase";
            }
        }
        return {
            model,
            rows,
            promotion: !reasons.length,
            reasons,
            drift,
            severity:
                drift < 0.1 ? "stable" : drift < 0.25 ? "warning" : "critical",
            action,
            next,
            canaryReasons,
            rollbackReasons,
            manifest: {
                model_key: model.name + ":" + model.version,
                artifact_uri: model.artifact_uri,
                dataset_fingerprint: model.dataset_fingerprint,
                evaluation_count: rows.length,
                evaluations: rows,
                stage:
                    action === "promote"
                        ? "production"
                        : action === "rollback"
                          ? "rollback"
                          : "candidate",
            },
        };
    }
    const xy = (value) => {
        const rows = text(value, "Dataset")
            .split(/\n+/)
            .map((line) => line.trim().split(/[ ,;\t]+/));
        if (rows.length > 10000) throw Error("Dataset exceeds 10000 rows.");
        return rows.map((r) => {
            if (r.length !== 2)
                throw Error(
                    "Each row must contain exactly two finite x,y numbers.",
                );
            return r.map((v) => number(v, "Observation"));
        });
    };
    function pipeline(
        training,
        evaluation,
        maxMae,
        maxPsi,
        minRows,
        expected,
        actual,
    ) {
        const tr = xy(training),
            ev = xy(evaluation);
        nonnegative(maxMae, "Maximum MAE");
        nonnegative(maxPsi, "Maximum PSI");
        integer(minRows, "Minimum evaluation rows", 1, 10000);
        if (tr.length < 2)
            throw Error("At least two training rows are required.");
        const xb = mean(tr.map((r) => r[0])),
            yb = mean(tr.map((r) => r[1])),
            den = tr.reduce((s, r) => s + (r[0] - xb) ** 2, 0);
        if (!den) throw Error("Feature variance must be non-zero.");
        const slope =
                tr.reduce((s, r) => s + (r[0] - xb) * (r[1] - yb), 0) / den,
            intercept = yb - slope * xb;
        number(slope, "Slope");
        number(intercept, "Intercept");
        const rows = ev.map(([x, y]) => {
                const prediction = number(slope * x + intercept, "Prediction");
                return {
                    x,
                    actual: y,
                    prediction,
                    absolute_error: number(
                        Math.abs(prediction - y),
                        "Absolute error",
                    ),
                };
            }),
            mae = number(mean(rows.map((r) => r.absolute_error)), "MAE"),
            drift = psi(expected, actual),
            reasons = [];
        if (ev.length < minRows) reasons.push("Insufficient evaluation rows");
        if (mae > maxMae) reasons.push("MAE exceeds threshold");
        if (drift > maxPsi) reasons.push("PSI exceeds threshold");
        return {
            model: { slope, intercept, version: "1.0.0" },
            rows,
            mae,
            drift,
            reasons,
            train_rows: tr.length,
            eval_rows: ev.length,
            allowed: !reasons.length,
        };
    }
    const api = {
        number,
        text,
        probability,
        nonnegative,
        integer,
        json,
        array,
        mean,
        canonical,
        digest,
        psi,
        normalize,
        similarity,
        graph,
        media,
        clinical,
        wilson,
        evaluateCases,
        compare,
        control,
        xy,
        pipeline,
    };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else window.MAKMA_DOMAIN = api;
})();
