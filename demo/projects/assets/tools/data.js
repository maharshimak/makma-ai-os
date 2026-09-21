"use strict";
(() => {
    const M = window.MAKMA,
        {
            $,
            num,
            clamp,
            metrics,
            badge,
            setHTML,
            trace,
            error,
            shell,
            finish,
            table,
            esc,
        } = M;
    const CUSTOMERS = [
        {
            id: 1,
            name: "Northwind Labs",
            region: "EU",
            email: "ops@northwind.test",
        },
        { id: 2, name: "Atlas Retail", region: "EU", email: "data@atlas.test" },
        {
            id: 3,
            name: "Orion Health",
            region: "US",
            email: "analyst@orion.test",
        },
        {
            id: 4,
            name: "Nova Foods",
            region: "APAC",
            email: "finance@nova.test",
        },
    ];
    const ORDERS = [
        { id: 101, customer_id: 1, amount: 82000, created_at: "2026-09-18" },
        { id: 102, customer_id: 1, amount: 102000, created_at: "2026-09-19" },
        { id: 103, customer_id: 2, amount: 139000, created_at: "2026-09-19" },
        { id: 104, customer_id: 3, amount: 97000, created_at: "2026-09-20" },
        { id: 105, customer_id: 4, amount: 61000, created_at: "2026-09-20" },
    ];
    const FORBIDDEN = new Set([
        "insert",
        "update",
        "delete",
        "drop",
        "alter",
        "create",
        "replace",
        "truncate",
        "attach",
        "detach",
        "pragma",
        "vacuum",
        "reindex",
        "grant",
        "revoke",
        "commit",
        "rollback",
        "savepoint",
    ]);
    function validateSQL(sql, maxRows) {
        const n = sql.trim().replace(/;+$/, "").replace(/\s+/g, " ");
        if (!n) throw new Error("SQL cannot be empty.");
        if (n.includes(";"))
            throw new Error("Multiple statements are not allowed.");
        const first = n.toLowerCase().split(/\s+/, 1)[0];
        if (!["select", "with"].includes(first))
            throw new Error("Only SELECT or WITH queries are allowed.");
        const t = new Set(n.toLowerCase().match(/[a-z_]+/g) || []),
            blocked = [...t].filter((x) => FORBIDDEN.has(x));
        if (blocked.length)
            throw new Error(
                "Forbidden SQL operation(s): " + blocked.sort().join(", "),
            );
        return (
            "SELECT * FROM (\n" + n + "\n) AS bounded_result LIMIT " + maxRows
        );
    }
    function risk(sql) {
        const l = sql.toLowerCase();
        let score = 0,
            f = [];
        const add = (c, p, s) => {
                if (c) {
                    score += p;
                    f.push(s);
                }
            },
            joins = (l.match(/\bjoin\b/g) || []).length,
            selects = (l.match(/\bselect\b/g) || []).length;
        add(/\bselect\s+\*/.test(l), 10, "wildcard projection");
        add(joins >= 2, Math.min(24, joins * 8), "multiple joins");
        add(/\bcross\s+join\b/.test(l), 30, "cross join");
        add(/\bunion(?:\s+all)?\b/.test(l), 20, "set union");
        add(selects > 1, Math.min(24, (selects - 1) * 12), "nested query");
        add(l.includes("--") || l.includes("/*"), 10, "SQL comments");
        add(/\border\s+by\s+random\s*\(/.test(l), 20, "random ordering");
        add(l.startsWith("with "), 8, "CTE");
        score = Math.min(score, 100);
        return {
            score,
            level: score < 20 ? "low" : score < 50 ? "medium" : "high",
            factors: f,
        };
    }
    function privacy(columns) {
        const rules = [
                [
                    "credential",
                    "critical",
                    [
                        "password",
                        "passwd",
                        "secret",
                        "token",
                        "api_key",
                        "apikey",
                    ],
                ],
                [
                    "government_id",
                    "high",
                    [
                        "ssn",
                        "social_security",
                        "passport",
                        "national_id",
                        "tax_id",
                    ],
                ],
                [
                    "financial",
                    "high",
                    [
                        "iban",
                        "swift",
                        "card_number",
                        "credit_card",
                        "bank_account",
                    ],
                ],
                [
                    "contact",
                    "medium",
                    ["email", "phone", "mobile", "telephone"],
                ],
                [
                    "location",
                    "medium",
                    [
                        "address",
                        "street_address",
                        "latitude",
                        "longitude",
                        "gps",
                    ],
                ],
                [
                    "health",
                    "high",
                    [
                        "diagnosis",
                        "medical_record",
                        "mrn",
                        "condition",
                        "medication",
                    ],
                ],
            ],
            weight = { low: 1, medium: 2, high: 4, critical: 8 },
            findings = [];
        columns.forEach((column) => {
            const snake = column
                    .replace(/(?<!^)(?=[A-Z])/g, "_")
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "_")
                    .replace(/^_|_$/g, ""),
                parts = snake.split("_").filter(Boolean),
                variants = new Set([snake, ...parts]);
            for (let i = 0; i < parts.length - 1; i++)
                variants.add(parts.slice(i, i + 2).join("_"));
            rules.forEach(([category, severity, indicators]) => {
                if (indicators.some((x) => variants.has(x)))
                    findings.push({
                        column,
                        category,
                        severity,
                        reason:
                            "Column name matches " + category + " indicators",
                    });
            });
        });
        findings.sort(
            (a, b) =>
                weight[b.severity] - weight[a.severity] ||
                a.column.localeCompare(b.column),
        );
        return {
            findings,
            score: findings.reduce((s, x) => s + weight[x.severity], 0),
        };
    }
    function plan(q) {
        const l = q.toLowerCase();
        if (
            [...FORBIDDEN].some((word) =>
                new RegExp("\\b" + word + "\\b").test(l),
            )
        )
            throw new Error(
                "Mutation or administrative intent is not allowed in read-only mode.",
            );
        if (l.includes("customer") && /(top|highest|revenue|sales)/.test(l))
            return {
                sql: "SELECT c.name, SUM(o.amount) AS revenue FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.id, c.name ORDER BY revenue DESC",
                why: "Aggregate order value by customer and rank descending.",
                kind: "top",
            };
        if (l.includes("revenue"))
            return {
                sql: "SELECT SUM(amount) AS total_revenue FROM orders",
                why: "Sum the order amount column.",
                kind: "revenue",
            };
        if (l.includes("order"))
            return {
                sql: "SELECT * FROM orders ORDER BY created_at DESC",
                why: "Return recent orders.",
                kind: "orders",
            };
        if (l.includes("customer"))
            return {
                sql: "SELECT * FROM customers",
                why: "Question references customers.",
                kind: "customers",
            };
        throw new Error(
            "Planner could not map the question. Try top customers by revenue, total revenue, recent orders, or customers.",
        );
    }
    function execute(kind) {
        if (kind === "revenue")
            return [
                { total_revenue: ORDERS.reduce((s, o) => s + o.amount, 0) },
            ];
        if (kind === "orders")
            return [...ORDERS].sort((a, b) =>
                b.created_at.localeCompare(a.created_at),
            );
        if (kind === "customers") return CUSTOMERS;
        if (kind === "top")
            return CUSTOMERS.filter((c) =>
                ORDERS.some((o) => o.customer_id === c.id),
            )
                .map((c) => ({
                    name: c.name,
                    revenue: ORDERS.filter(
                        (o) => o.customer_id === c.id,
                    ).reduce((s, o) => s + o.amount, 0),
                }))
                .sort((a, b) => b.revenue - a.revenue);
        return [];
    }
    function summarize(rows) {
        const out = { row_count: rows.length, numeric: {} };
        if (!rows.length) return out;
        const values = Object.create(null);
        rows.forEach((r) =>
            Object.entries(r).forEach(([k, v]) => {
                if (typeof v === "number" && Number.isFinite(v))
                    (values[k] || (values[k] = [])).push(v);
            }),
        );
        Object.entries(values).forEach(
            ([k, a]) =>
                (out.numeric[k] = {
                    min: Math.min(...a),
                    max: Math.max(...a),
                    mean: a.reduce((s, v) => s + v, 0) / a.length,
                    sum: a.reduce((s, v) => s + v, 0),
                }),
        );
        return out;
    }
    function run() {
        const started = performance.now();
        try {
            const question = window.MAKMA_DOMAIN.text(
                    $("#question").value,
                    "Question",
                    2000,
                ),
                maxRows = M.readNumber("#maxrows", "Max rows", {
                    min: 1,
                    max: 1000,
                    integer: true,
                }),
                maxRisk = M.readNumber("#maxrisk", "Max risk", {
                    min: 0,
                    max: 100,
                    integer: true,
                }),
                p = plan(question),
                bounded = validateSQL(p.sql, maxRows),
                r = risk(p.sql);
            if (r.score > maxRisk)
                throw new Error(
                    "Query risk " +
                        r.score +
                        " exceeds configured maximum " +
                        maxRisk +
                        ": " +
                        (r.factors.join(", ") || "policy"),
                );
            const source = window.MAKMA_DOMAIN.json(
                $("#dataset").value,
                "Synthetic dataset",
            );
            if (
                !source ||
                !Array.isArray(source.customers) ||
                !Array.isArray(source.orders)
            )
                throw Error(
                    "Dataset must contain customers and orders arrays.",
                );
            if (source.customers.length > 1000 || source.orders.length > 10000)
                throw Error("Dataset exceeds browser row limits.");
            const ids = new Set();
            for (const c of source.customers) {
                window.MAKMA_DOMAIN.integer(c.id, "Customer ID", 1);
                window.MAKMA_DOMAIN.text(c.name, "Customer name");
                if (ids.has(c.id)) throw Error("Duplicate customer ID");
                ids.add(c.id);
            }
            const orderIds = new Set();
            for (const o of source.orders) {
                window.MAKMA_DOMAIN.integer(o.id, "Order ID", 1);
                if (orderIds.has(o.id)) throw Error("Duplicate order ID");
                orderIds.add(o.id);
                if (!ids.has(o.customer_id))
                    throw Error("Order references an unknown customer");
                window.MAKMA_DOMAIN.nonnegative(o.amount, "Order amount");
                if (typeof o.amount !== "number")
                    throw Error("Order amount must be a JSON number");
                if (
                    !/^\d{4}-\d{2}-\d{2}$/.test(o.created_at) ||
                    !Number.isFinite(Date.parse(o.created_at)) ||
                    new Date(o.created_at).toISOString().slice(0, 10) !==
                        o.created_at
                )
                    throw Error("Order date must use YYYY-MM-DD");
            }
            CUSTOMERS.splice(0, CUSTOMERS.length, ...source.customers);
            ORDERS.splice(0, ORDERS.length, ...source.orders);
            const rows = execute(p.kind).slice(0, maxRows);
            for (const row of rows)
                for (const v of Object.values(row))
                    if (typeof v === "number" && !Number.isFinite(v))
                        throw Error("Aggregate exceeds numeric capacity");
            const summary = summarize(rows),
                priv = privacy([
                    ...new Set(
                        [...CUSTOMERS, ...ORDERS].flatMap((row) =>
                            Object.keys(row),
                        ),
                    ),
                ]);
            setHTML(
                "#result",
                metrics([
                    ["Planner", "Rule-based"],
                    [
                        "Risk",
                        r.score + " · " + r.level,
                        r.level === "high"
                            ? "bad"
                            : r.level === "medium"
                              ? "warn"
                              : "good",
                    ],
                    ["Rows", rows.length],
                    ["Privacy score", priv.score, priv.score ? "warn" : "good"],
                ]) +
                    '<p class="notice">Structured local query engine: SQL is displayed for inspection but is not interpreted in this browser. The Python backend executes SQLite.</p><div class="section-title">Query plan</div><code class="code">' +
                    esc(p.sql) +
                    '</code><p class="muted">' +
                    esc(p.why) +
                    "</p>" +
                    '<div class="section-title">Bounded read-only SQL</div><code class="code">' +
                    esc(bounded) +
                    '</code><div class="section-title">Executed result</div>' +
                    table(rows) +
                    '<div class="section-title">Numeric summary</div><code class="code">' +
                    esc(JSON.stringify(summary, null, 2)) +
                    "</code>" +
                    '<div class="row"><button id="export-data" class="btn">Export rows JSON</button><button id="export-csv" class="btn">Export rows CSV</button></div><div class="section-title">Schema privacy scan</div>' +
                    priv.findings
                        .map(
                            (f) =>
                                '<div class="card compact"><strong>' +
                                esc(f.column) +
                                "</strong> " +
                                badge(f.category) +
                                " " +
                                badge(
                                    f.severity,
                                    f.severity === "critical" ||
                                        f.severity === "high"
                                        ? "bad"
                                        : "warn",
                                ) +
                                "<p>" +
                                esc(f.reason) +
                                "</p></div>",
                        )
                        .join(""),
            );
            $("#export-data").onclick = () =>
                window.WORKBENCH.download(rows, "analytics-results");
            $("#export-csv").onclick = () => {
                const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))],
                    cell = (v) =>
                        '\"' +
                        String(v ?? "")
                            .replace(/^[=+@-]/, "'$&")
                            .replace(/\"/g, '\"\"') +
                        '\"';
                window.WORKBENCH.download(
                    [
                        cols.map(cell).join(","),
                        ...rows.map((r) =>
                            cols.map((c) => cell(r[c])).join(","),
                        ),
                    ].join("\n"),
                    "analytics-results",
                    "csv",
                );
            };
            trace([
                {
                    label: "planner",
                    title: "Schema-aware deterministic planner",
                    text: p.why,
                },
                {
                    label: "safety",
                    title: "Read-only SQL validation",
                    text: "Single SELECT/WITH only; write, DDL and administrative operations are forbidden; outer row bound is enforced.",
                },
                {
                    label: "risk",
                    title: "Query-risk budget",
                    text:
                        "Score " +
                        r.score +
                        "/100 (" +
                        r.level +
                        "); maximum " +
                        maxRisk +
                        ". " +
                        (r.factors.join(", ") || "No risk factors."),
                },
                {
                    label: "privacy",
                    title: "Schema privacy scan",
                    text:
                        "Detected " +
                        priv.findings.length +
                        " sensitive-column signal(s); weighted score " +
                        priv.score +
                        ".",
                },
                {
                    label: "execute",
                    title: "Local synthetic execution",
                    text:
                        "Executed the validated plan over " +
                        CUSTOMERS.length +
                        " customers and " +
                        ORDERS.length +
                        " orders.",
                },
            ]);
        } catch (e) {
            error(e.message);
            trace([
                {
                    label: "blocked",
                    title: "Fail-closed policy",
                    text: e.message,
                },
            ]);
        }
        finish(started);
    }
    shell(
        '<div class="field"><label>Synthetic dataset JSON</label><textarea id="dataset" class="tall">' +
            esc(
                JSON.stringify(
                    { customers: CUSTOMERS, orders: ORDERS },
                    null,
                    2,
                ),
            ) +
            '</textarea></div><p class="notice">Schema: customers(id, name, region, email); orders(id, customer_id, amount, created_at). Questions support customer revenue, total revenue, recent orders and customer listing.</p><div class="field"><label>Business question</label><textarea id="question">Show the top customers by revenue</textarea></div><div class="control-grid"><div class="field"><label>Max rows</label><input id="maxrows" type="number" min="1" max="1000" value="200"></div><div class="field"><label>Max query risk</label><input id="maxrisk" type="number" min="0" max="100" value="40"></div></div><div class="quick-actions"><button class="btn sample" data-q="What is total revenue?">Total revenue</button><button class="btn sample" data-q="Show recent orders">Recent orders</button><button class="btn sample" data-q="Show customers">Customers</button></div><button id="run" class="btn primary">Plan + validate + execute safely</button>',
    );
    document.querySelectorAll(".sample").forEach(
        (b) =>
            (b.onclick = () => {
                $("#question").value = b.dataset.q;
                run();
            }),
    );
    $("#result").setAttribute("aria-live", "polite");
    const initialDataset = JSON.stringify(
        { customers: CUSTOMERS, orders: ORDERS },
        null,
        2,
    );
    $("#dataset").parentElement.insertAdjacentHTML(
        "beforebegin",
        '<div class="field"><label for="sample-dataset">Choose dataset</label><select id="sample-dataset"><option value="retail">Synthetic retail sample</option><option value="empty">Empty dataset starter</option></select></div>',
    );
    $("#sample-dataset").onchange = () => {
        $("#dataset").value =
            $("#sample-dataset").value === "retail"
                ? initialDataset
                : JSON.stringify({ customers: [], orders: [] }, null, 2);
        run();
    };
    $("#run").onclick = run;
    run();
})();
