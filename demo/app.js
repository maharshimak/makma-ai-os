"use strict";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function readLocalJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

const state = {
    mode: "demo",
    apiBase: "",
    sessionId: readLocalJson("makma-session-key", null) || newSessionId(),
    memory: readLocalJson("makma-demo-memory", []),
    conversation: readLocalJson("makma-demo-conversation", []),
    runs: readLocalJson("makma-demo-runs", []),
    telemetry: readLocalJson("makma-demo-telemetry", []),
    lastResult: null,
    busy: false,
};

state.memory = Array.isArray(state.memory)
    ? state.memory
          .filter(
              (x) =>
                  x &&
                  typeof x.content === "string" &&
                  typeof x.role === "string",
          )
          .slice(-200)
    : [];
state.telemetry = Array.isArray(state.telemetry)
    ? state.telemetry
          .filter(
              (x) =>
                  x &&
                  Number.isFinite(x.latency_ms) &&
                  typeof x.success === "boolean",
          )
          .slice(-200)
    : [];

state.conversation = Array.isArray(state.conversation)
    ? state.conversation
          .filter(
              (x) =>
                  x &&
                  typeof x.content === "string" &&
                  typeof x.role === "string",
          )
          .slice(-200)
    : [];
state.runs = Array.isArray(state.runs) ? state.runs.slice(-100) : [];

const els = {
    messages: $("#messages"),
    composer: $("#composer"),
    input: $("#message-input"),
    send: $("#send-button"),
    sessionId: $("#session-id"),
    runId: $("#run-id-value"),
    provider: $("#provider-value"),
    version: $("#version-value"),
    latency: $("#latency-value"),
    toolCount: $("#tool-count-value"),
    modeLabel: $("#mode-label"),
    runtimeLabel: $("#runtime-label"),
    statusDot: $("#status-dot"),
    plan: $("#plan-content"),
    tools: $("#tools-content"),
    memory: $("#memory-content"),
    telemetry: $("#telemetry-content"),
    memoryQuery: $("#memory-query"),
    memorySearch: $("#memory-search-button"),
    newSession: $("#new-session-button"),
    clear: $("#clear-button"),
    connect: $("#connect-button"),
    dialog: $("#connection-dialog"),
    apiBase: $("#api-base"),
    feedback: $("#connection-feedback"),
    testConnection: $("#test-connection-button"),
    disconnect: $("#disconnect-button"),
    exportSession: $("#export-session-button"),
};

function newSessionId() {
    if (globalThis.crypto && crypto.randomUUID) {
        return "console-" + crypto.randomUUID().slice(0, 8);
    }
    return "console-" + Math.random().toString(36).slice(2, 10);
}

function newRunId() {
    if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "run-" + Date.now().toString(36);
}

function persistDemoState() {
    try {
        localStorage.setItem(
            "makma-session-key",
            JSON.stringify(state.sessionId),
        );
        localStorage.setItem(
            "makma-demo-memory",
            JSON.stringify(state.memory.slice(-200)),
        );
        localStorage.setItem(
            "makma-demo-conversation",
            JSON.stringify(state.conversation.slice(-200)),
        );
        localStorage.setItem(
            "makma-demo-runs",
            JSON.stringify(state.runs.slice(-100)),
        );
        localStorage.setItem(
            "makma-demo-telemetry",
            JSON.stringify(state.telemetry.slice(-200)),
        );
    } catch {
        // Browser storage is optional; runtime functionality must not depend on it.
    }
}

function exportSession() {
    const payload = {
        exported_at: new Date().toISOString(),
        mode: state.mode,
        session_id: state.sessionId,
        memory: state.memory,
        telemetry: state.telemetry,
        last_result: state.lastResult,
        conversation: state.conversation,
        runs: state.runs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "makma-session-" + state.sessionId + ".json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function setBusy(value) {
    state.busy = value;
    els.send.disabled = value;
    els.input.disabled = value;
    els.send.textContent = value ? "Running" : "Run request";
}

function addMessage(role, content, error = false) {
    state.conversation.push({
        role,
        content,
        created_at: new Date().toISOString(),
    });
    state.conversation = state.conversation.slice(-200);
    const article = document.createElement("article");
    article.className =
        "message message-" + role + (error ? " message-error" : "");
    const meta =
        role === "user" ? "You" : role === "assistant" ? "Mak'ma" : "Runtime";
    article.innerHTML =
        '<div class="message-meta">' +
        escapeHtml(meta) +
        "</div>" +
        '<div class="message-body">' +
        escapeHtml(content) +
        "</div>";
    els.messages.appendChild(article);
    els.messages.scrollTop = els.messages.scrollHeight;
}

function renderPlan(plan) {
    if (!plan || !plan.length) {
        els.plan.innerHTML =
            '<div class="empty-state"><span>NO ACTIVE PLAN</span><p>No planning steps were emitted.</p></div>';
        return;
    }

    els.plan.innerHTML =
        '<div class="trace-list">' +
        plan
            .map((step, index) => {
                const args =
                    step.arguments && Object.keys(step.arguments).length
                        ? '<code class="trace-code">' +
                          escapeHtml(JSON.stringify(step.arguments, null, 2)) +
                          "</code>"
                        : "";
                return (
                    '<article class="trace-step">' +
                    '<div class="trace-step-head">' +
                    '<div><span class="trace-index">' +
                    String(index + 1).padStart(2, "0") +
                    "</span>" +
                    '<div class="trace-title">' +
                    escapeHtml(
                        step.kind === "tool" ? step.tool_name : "respond",
                    ) +
                    "</div></div>" +
                    '<span class="badge">' +
                    escapeHtml(step.kind) +
                    "</span>" +
                    "</div>" +
                    "<p>" +
                    escapeHtml(step.description) +
                    "</p>" +
                    args +
                    "</article>"
                );
            })
            .join("") +
        "</div>";
}

function renderTools(results) {
    if (!results || !results.length) {
        els.tools.innerHTML =
            '<div class="empty-state"><span>NO TOOL EXECUTION</span><p>This run completed without a tool call.</p></div>';
        return;
    }

    els.tools.innerHTML =
        '<div class="tool-list">' +
        results
            .map(
                (result) =>
                    '<article class="tool-result">' +
                    '<div class="tool-result-head">' +
                    '<div class="tool-name">' +
                    escapeHtml(result.tool_name) +
                    "</div>" +
                    '<span class="badge ' +
                    (result.ok ? "badge-success" : "badge-failure") +
                    '">' +
                    (result.ok ? "success" : "failed") +
                    "</span>" +
                    "</div>" +
                    "<p>" +
                    escapeHtml(
                        result.ok
                            ? result.output
                            : result.error || "Tool failed",
                    ) +
                    "</p>" +
                    '<code class="trace-code">latency_ms: ' +
                    escapeHtml(formatNumber(result.latency_ms || 0, 3)) +
                    "</code>" +
                    "</article>",
            )
            .join("") +
        "</div>";
}

function renderMemory(matches) {
    if (!matches || !matches.length) {
        els.memory.innerHTML =
            '<div class="empty-state"><span>NO MATCHES</span><p>No relevant session memories were found for this query.</p></div>';
        return;
    }

    els.memory.innerHTML =
        '<div class="memory-list">' +
        matches
            .map(
                (match) =>
                    '<article class="memory-match">' +
                    '<div class="memory-match-head">' +
                    '<div class="memory-role">' +
                    escapeHtml(match.role) +
                    "</div>" +
                    '<span class="memory-score">score ' +
                    escapeHtml(formatNumber(match.score || 0, 3)) +
                    "</span>" +
                    "</div>" +
                    "<p>" +
                    escapeHtml(match.content) +
                    "</p>" +
                    (match.created_at
                        ? '<code class="trace-code">' +
                          escapeHtml(match.created_at) +
                          "</code>"
                        : "") +
                    "</article>",
            )
            .join("") +
        "</div>";
}

function renderTelemetry(summary) {
    const count = Number(summary.count || 0);
    const failures = Number(summary.failures || 0);
    const successRate = count ? ((count - failures) / count) * 100 : null;

    els.telemetry.innerHTML =
        '<div class="telemetry-stat"><span>Runtime P50</span><strong>' +
        escapeHtml(formatNumber(summary.p50_latency_ms || 0, 2)) +
        " ms</strong></div>" +
        '<div class="telemetry-stat"><span>Runtime P95</span><strong>' +
        escapeHtml(formatNumber(summary.p95_latency_ms || 0, 2)) +
        " ms</strong></div>" +
        '<div class="telemetry-stat"><span>Success rate</span><strong>' +
        (successRate === null
            ? "N/A"
            : escapeHtml(formatNumber(successRate, 1)) + "%") +
        "</strong></div>" +
        '<div class="telemetry-stat"><span>Runs observed</span><strong>' +
        escapeHtml(count) +
        "</strong></div>";
}

function formatNumber(value, digits = 1) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "0";
    return number
        .toFixed(digits)
        .replace(/\.0+$/, "")
        .replace(/(\.\d*?)0+$/, "$1");
}

function tokens(text) {
    return new Set(
        (
            String(text)
                .toLowerCase()
                .match(/[a-z0-9_]+/g) || []
        ).filter(Boolean),
    );
}

function rankMemory(query, limit = 5) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    const queryTokens = tokens(normalized);

    return state.memory
        .map((item, index) => {
            const content = item.content.toLowerCase();
            const contentTokens = tokens(content);
            const overlap = [...queryTokens].filter((token) =>
                contentTokens.has(token),
            ).length;
            if (!overlap && !content.includes(normalized)) return null;
            const coverage = overlap / Math.max(queryTokens.size, 1);
            const phraseBonus = content.includes(normalized) ? 1 : 0;
            const provenanceBonus = item.role === "user" ? 0.25 : 0;
            const recencyBonus = 0.15 / (state.memory.length - index);
            return {
                role: item.role,
                content: item.content,
                score: phraseBonus + coverage + provenanceBonus + recencyBonus,
                created_at: item.created_at,
            };
        })
        .filter((item) => item && item.score > 0.15)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

function parseExpression(input) {
    const source = input.replace(/\s+/g, "");
    if (!source || source.length > 200 || !/^[0-9+\-*/().%]+$/.test(source)) {
        throw new Error("Unsupported arithmetic expression.");
    }

    let index = 0;

    function peek() {
        return source[index] || "";
    }

    function consume(char) {
        if (peek() === char) {
            index += 1;
            return true;
        }
        return false;
    }

    function number() {
        const start = index;
        while (/[0-9.]/.test(peek())) index += 1;
        const raw = source.slice(start, index);
        if (!raw || raw === "." || (raw.match(/\./g) || []).length > 1) {
            throw new Error("Invalid number.");
        }
        const value = Number(raw);
        if (!Number.isFinite(value)) throw new Error("Number is out of range.");
        return value;
    }

    function primary() {
        if (consume("(")) {
            const value = expression();
            if (!consume(")")) throw new Error("Missing closing parenthesis.");
            return value;
        }
        return number();
    }

    function unary() {
        if (consume("+")) return unary();
        if (consume("-")) return -unary();
        return power();
    }
    function power() {
        const left = primary();
        if (source.slice(index, index + 2) === "**") {
            index += 2;
            const right = unary();
            if (Math.abs(right) > 10) throw new Error("Exponent is too large.");
            return left ** right;
        }
        return left;
    }

    function term() {
        let left = unary();
        while (true) {
            if (source.slice(index, index + 2) === "//") {
                index += 2;
                const divisor = unary();
                if (divisor === 0) throw new Error("Division by zero.");
                left = Math.floor(left / divisor);
            } else if (consume("*")) {
                left *= unary();
            } else if (consume("/")) {
                const divisor = unary();
                if (divisor === 0) throw new Error("Division by zero.");
                left /= divisor;
            } else if (consume("%")) {
                const divisor = unary();
                if (divisor === 0) throw new Error("Division by zero.");
                left = left - Math.floor(left / divisor) * divisor;
            } else {
                break;
            }
        }
        return left;
    }

    function expression() {
        let left = term();
        while (true) {
            if (consume("+")) left += term();
            else if (consume("-")) left -= term();
            else break;
        }
        return left;
    }

    const result = expression();
    if (index !== source.length || !Number.isFinite(result)) {
        throw new Error("Invalid or out-of-range arithmetic expression.");
    }
    return result;
}

function demoPlan(message) {
    const text = message.trim();
    const candidates = [];

    const mathPattern =
        /\b(?:calculate|compute|evaluate)\s+([0-9\s+\-*/().%]+)/gi;
    for (const match of text.matchAll(mathPattern)) {
        const expression = match[1].trim();
        if (expression) {
            candidates.push({
                position: match.index || 0,
                step: {
                    id: newRunId(),
                    kind: "tool",
                    description:
                        "Calculate the requested arithmetic expression.",
                    tool_name: "calculator",
                    arguments: { expression },
                },
            });
        }
    }

    if (
        !candidates.length &&
        /^[0-9\s+\-*/().%]+$/.test(text) &&
        /\d/.test(text)
    ) {
        candidates.push({
            position: 0,
            step: {
                id: newRunId(),
                kind: "tool",
                description: "Evaluate the arithmetic expression.",
                tool_name: "calculator",
                arguments: { expression: text },
            },
        });
    }

    const memoryMatch =
        /\b(?:(?:search|check|look in|find in)\s+(?:my\s+)?memory(?:\s+for)?|recall)\s*(.*)/i.exec(
            text,
        );
    if (memoryMatch) {
        const raw = (memoryMatch[1] || "").trim();
        const query =
            raw
                .split(/\s+and\s+(?=(?:calculate|compute|evaluate)\b)/i, 1)[0]
                .trim() || text;
        candidates.push({
            position: memoryMatch.index || 0,
            step: {
                id: newRunId(),
                kind: "tool",
                description: "Recall relevant persisted session memories.",
                tool_name: "memory_search",
                arguments: { query },
            },
        });
    }

    const remember =
        /\bremember(?: that)?\s+(.+?)(?=\s+and\s+(?:calculate|compute|evaluate|recall)\b|$)/i.exec(
            text,
        );
    if (remember)
        candidates.push({
            position: remember.index,
            step: {
                id: newRunId(),
                kind: "tool",
                tool_name: "memory_store",
                description: "Store an explicit session fact.",
                arguments: { fact: remember[1] },
            },
        });
    candidates.sort((a, b) => a.position - b.position);
    const steps = candidates.slice(0, 4).map((item) => item.step);
    steps.push({
        id: newRunId(),
        kind: "respond",
        description: "Synthesize a final answer from context and tool results.",
        tool_name: null,
        arguments: {},
    });
    return steps;
}

async function runDemo(message) {
    const started = performance.now();
    const plan = demoPlan(message);
    const results = [];

    for (const step of plan) {
        if (step.kind !== "tool") continue;
        const toolStarted = performance.now();

        if (step.tool_name === "memory_store") {
            state.memory.push({
                role: "user",
                content: step.arguments.fact,
                created_at: new Date().toISOString(),
            });
            results.push({
                tool_name: "memory_store",
                ok: true,
                output: "Remembered: " + step.arguments.fact,
                latency_ms: performance.now() - toolStarted,
            });
        }
        if (step.tool_name === "calculator") {
            try {
                const value = parseExpression(step.arguments.expression);
                const rendered = Number.isInteger(value)
                    ? String(value)
                    : String(Number(value.toFixed(10)));
                results.push({
                    tool_name: "calculator",
                    ok: true,
                    output: step.arguments.expression + " = " + rendered,
                    error: null,
                    latency_ms: performance.now() - toolStarted,
                });
            } catch (error) {
                results.push({
                    tool_name: "calculator",
                    ok: false,
                    output: "",
                    error:
                        error instanceof Error
                            ? error.message
                            : "Calculator failed.",
                    latency_ms: performance.now() - toolStarted,
                });
            }
        }

        if (step.tool_name === "memory_search") {
            const matches = rankMemory(step.arguments.query);
            results.push({
                tool_name: "memory_search",
                ok: true,
                output: matches.length
                    ? matches
                          .map(
                              (item) =>
                                  "[score=" +
                                  formatNumber(item.score, 3) +
                                  "] " +
                                  item.role +
                                  ": " +
                                  item.content,
                          )
                          .join(" | ")
                    : "No matching memories found.",
                error: null,
                latency_ms: performance.now() - toolStarted,
            });
        }
    }

    const now = new Date().toISOString();
    state.memory.push({ role: "user", content: message, created_at: now });

    let response;
    const successful = results.filter((result) => result.ok);
    if (successful.length) {
        response =
            "Mak'ma completed the requested tool work: " +
            successful.map((result) => result.output).join(" | ");
    } else if (results.length) {
        response = "Mak'ma could not complete the requested tool work safely.";
    } else {
        response =
            "Browser Demo Mode recorded this message in session memory. Connect a Mak'ma API to run the real backend provider.";
    }

    state.memory.push({
        role: "assistant",
        content: response,
        created_at: new Date().toISOString(),
    });

    state.memory = state.memory.slice(-200);
    const latency = performance.now() - started;
    const result = {
        response,
        session_id: state.sessionId,
        run_id: newRunId(),
        provider: "browser-demo",
        latency_ms: latency,
        plan,
        tool_results: results,
        metrics: {
            provider_latency_ms: 0, // Browser mode makes no provider call.
            tool_latency_ms: results.reduce(
                (sum, item) => sum + Number(item.latency_ms || 0),
                0,
            ),
            tool_calls: results.length,
            successful_tool_calls: successful.length,
            failed_tool_calls: results.length - successful.length,
        },
    };

    state.telemetry.push({
        latency_ms: latency,
        success: results.every((item) => item.ok),
    });
    state.telemetry = state.telemetry.slice(-200);
    persistDemoState();
    return result;
}

async function runConnected(message) {
    const response = await fetch(state.apiBase + "/v1/chat", {
        signal: AbortSignal.timeout(30000),
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            message,
            session_id: state.sessionId,
            approvals: [],
            tools_enabled: true,
        }),
    });

    if (!response.ok) {
        throw new Error("Runtime returned HTTP " + response.status + ".");
    }

    return response.json();
}

function demoTelemetrySummary() {
    const latencies = state.telemetry
        .map((event) => event.latency_ms)
        .sort((a, b) => a - b);
    const count = latencies.length;
    const percentile = (p) => {
        if (!count) return 0;
        const rank = Math.max(1, Math.ceil(p * count));
        return latencies[rank - 1];
    };
    const failures = state.telemetry.filter((event) => !event.success).length;
    return {
        count,
        failures,
        successes: count - failures,
        failure_rate: count ? failures / count : 0,
        p50_latency_ms: percentile(0.5),
        p95_latency_ms: percentile(0.95),
    };
}

async function refreshTelemetry() {
    if (state.mode === "connected") {
        try {
            const response = await fetch(
                state.apiBase + "/v1/telemetry?operation=runtime.run",
                { signal: AbortSignal.timeout(10000) },
            );
            if (!response.ok) throw new Error();
            renderTelemetry(await response.json());
            return;
        } catch {
            renderTelemetry({
                count: 0,
                failures: 0,
                p50_latency_ms: 0,
                p95_latency_ms: 0,
            });
            return;
        }
    }
    renderTelemetry(demoTelemetrySummary());
}

async function recall(query) {
    const normalized = query.trim();
    if (!normalized) {
        renderMemory([]);
        return;
    }

    if (state.mode === "connected") {
        const url =
            state.apiBase +
            "/v1/sessions/" +
            encodeURIComponent(state.sessionId) +
            "/recall?q=" +
            encodeURIComponent(normalized);
        const response = await fetch(url, {
            signal: AbortSignal.timeout(10000),
        });
        if (!response.ok)
            throw new Error("Recall returned HTTP " + response.status + ".");
        renderMemory(await response.json());
        return;
    }

    renderMemory(rankMemory(normalized));
}

function updateRun(result) {
    state.lastResult = result;
    state.runs.push(result);
    state.runs = state.runs.slice(-100);
    persistDemoState();
    els.runId.textContent = result.run_id || "unknown";
    els.provider.textContent =
        result.provider ||
        (state.mode === "connected" ? "remote" : "browser-demo");
    els.latency.textContent = formatNumber(result.latency_ms || 0, 2) + " ms";
    els.toolCount.textContent = String(
        result.metrics?.tool_calls ?? result.tool_results?.length ?? 0,
    );
    renderPlan(result.plan || []);
    renderTools(result.tool_results || []);
    refreshTelemetry();

    const memoryTool = (result.tool_results || []).find(
        (item) => item.tool_name === "memory_search",
    );
    if (memoryTool && memoryTool.ok) {
        const plannedMemory = (result.plan || []).find(
            (step) => step.tool_name === "memory_search",
        );
        if (plannedMemory?.arguments?.query) {
            els.memoryQuery.value = plannedMemory.arguments.query;
            recall(plannedMemory.arguments.query).catch(() => {});
        }
    }
}

async function submitMessage(message) {
    const normalized = message.trim();
    if (!normalized || state.busy) return;
    if (normalized.length > 10000) {
        addMessage("system", "Request exceeds 10000 characters.", true);
        return;
    }

    addMessage("user", normalized);
    els.input.value = "";
    setBusy(true);

    try {
        const result =
            state.mode === "connected"
                ? await runConnected(normalized)
                : await runDemo(normalized);
        updateRun(result);
        addMessage(
            "assistant",
            result.response || "Runtime completed without a text response.",
        );
        persistDemoState();
    } catch (error) {
        const messageText =
            error instanceof Error ? error.message : "Runtime request failed.";
        addMessage("system", messageText, true);
    } finally {
        setBusy(false);
        els.input.focus();
    }
}

function switchTab(name) {
    $$(".tab").forEach((tab) => {
        const active = tab.dataset.tab === name;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    $$(".inspector-view").forEach((view) => {
        view.classList.toggle("is-active", view.id === "view-" + name);
    });
}

function applyMode() {
    const connected = state.mode === "connected";
    els.modeLabel.textContent = connected
        ? "Connected Runtime"
        : "Browser Demo Mode";
    els.runtimeLabel.textContent = connected
        ? state.apiBase
        : "Deterministic runtime simulation";
    els.statusDot.classList.toggle("connected", connected);
    els.provider.textContent = connected ? "remote" : "browser-demo";
}

async function verifyConnection() {
    const base = els.apiBase.value.trim().replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(base)) {
        els.feedback.className = "connection-feedback error";
        els.feedback.textContent = "Enter a valid HTTP or HTTPS base URL.";
        return;
    }

    els.testConnection.disabled = true;
    els.feedback.className = "connection-feedback";
    els.feedback.textContent = "Checking runtime health...";

    try {
        const response = await fetch(base + "/health", {
            signal: AbortSignal.timeout(10000),
        });
        if (!response.ok)
            throw new Error(
                "Health endpoint returned HTTP " + response.status + ".",
            );
        const health = await response.json();
        if (health.status !== "ok")
            throw new Error("Runtime health response is not OK.");

        state.mode = "connected";
        state.apiBase = base;
        try {
            localStorage.setItem("makma-api-base", base);
        } catch {}
        els.provider.textContent = health.provider || "remote";
        els.version.textContent = health.version || "unknown";
        els.feedback.className = "connection-feedback success";
        els.feedback.textContent =
            "Connected. Real runtime requests are now enabled.";
        applyMode();
        setTimeout(() => els.dialog.close(), 650);
    } catch (error) {
        els.feedback.className = "connection-feedback error";
        els.feedback.textContent =
            error instanceof Error
                ? error.message + " Check that CORS allows this site."
                : "Could not connect to the runtime.";
    } finally {
        els.testConnection.disabled = false;
    }
}

function disconnect() {
    state.mode = "demo";
    state.apiBase = "";
    try {
        localStorage.removeItem("makma-api-base");
    } catch {}
    els.apiBase.value = "";
    els.version.textContent = "2.0.0";
    applyMode();
    els.feedback.className = "connection-feedback";
    els.feedback.textContent = "Browser Demo Mode is active.";
}

function resetSession() {
    if (state.busy) return;
    state.sessionId = newSessionId();
    state.memory = [];
    state.telemetry = [];
    state.lastResult = null;
    state.runs = [];
    state.conversation = [];
    persistDemoState();
    els.sessionId.textContent = state.sessionId;
    els.runId.textContent = "not-started";
    els.latency.textContent = "0 ms";
    els.toolCount.textContent = "0";
    els.plan.innerHTML =
        '<div class="empty-state"><span>NO ACTIVE PLAN</span><p>Run a request to inspect ordered planning steps.</p></div>';
    els.tools.innerHTML =
        '<div class="empty-state"><span>NO TOOL EXECUTION</span><p>Tool results, status and latency will appear here.</p></div>';
    els.memory.innerHTML =
        '<div class="empty-state"><span>SESSION MEMORY</span><p>Search the current session to inspect ranked memory matches.</p></div>';
    renderTelemetry(demoTelemetrySummary());
    clearConversation();
}

function clearConversation() {
    state.conversation = [];
    persistDemoState();
    els.messages.innerHTML =
        '<article class="message message-system">' +
        '<div class="message-meta">Runtime</div>' +
        '<div class="message-body">Mak\'ma is ready. Run a scenario or send a request. Every supported tool action is exposed through the execution inspector.</div>' +
        "</article>";
}

els.composer.addEventListener("submit", (event) => {
    event.preventDefault();
    submitMessage(els.input.value);
});

els.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        els.composer.requestSubmit();
    }
});

$$(".scenario-button").forEach((button) => {
    button.addEventListener("click", () => {
        const prompt = button.dataset.prompt || "";
        els.input.value = prompt;
        submitMessage(prompt);
    });
});

$$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});

els.memorySearch.addEventListener("click", () => {
    recall(els.memoryQuery.value).catch((error) => {
        renderMemory([]);
        addMessage(
            "system",
            error instanceof Error ? error.message : "Memory recall failed.",
            true,
        );
    });
});

els.memoryQuery.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        els.memorySearch.click();
    }
});

els.newSession.addEventListener("click", resetSession);
els.clear.addEventListener("click", clearConversation);

els.connect.addEventListener("click", () => {
    els.apiBase.value = state.apiBase;
    els.feedback.className = "connection-feedback";
    els.feedback.textContent =
        state.mode === "connected"
            ? "Currently connected to " + state.apiBase
            : "Browser Demo Mode is active.";
    els.dialog.showModal();
});

els.testConnection.addEventListener("click", verifyConnection);
els.disconnect.addEventListener("click", disconnect);
if (els.exportSession)
    els.exportSession.addEventListener("click", exportSession);

let savedApiBase = null;
try {
    savedApiBase = localStorage.getItem("makma-api-base");
} catch {}
if (savedApiBase) {
    els.apiBase.value = savedApiBase;
    state.apiBase = savedApiBase;
}

els.sessionId.textContent = state.sessionId;
persistDemoState();
applyMode();
renderTelemetry(demoTelemetrySummary());

const smokeMode = new URLSearchParams(window.location.search).get("smoke");
if (smokeMode === "1") {
    setTimeout(() => submitMessage("calculate 19 * 23"), 0);
}

const restoredConversation = [...state.conversation];
state.conversation = [];
restoredConversation.forEach((item) => addMessage(item.role, item.content));
els.messages.setAttribute("aria-live", "polite");

// Browser-only destructive tool demonstration with an explicit local approval.
const memoryControls = document.createElement("div");
memoryControls.innerHTML =
    '<label><input id="approve-memory-delete" type="checkbox"> Approve deleting browser session memory</label><button id="delete-session-memory" type="button">Delete session memory</button><p id="memory-permission-status" role="status"></p>';
els.memory.parentElement.appendChild(memoryControls);
$("#delete-session-memory").onclick = () => {
    if (state.mode !== "demo") {
        $("#memory-permission-status").textContent =
            "Memory deletion is only implemented in browser mode.";
        return;
    }
    if (!$("#approve-memory-delete").checked) {
        $("#memory-permission-status").textContent =
            "Approval required: session memory was not deleted.";
        return;
    }
    state.memory = [];
    persistDemoState();
    renderMemory([]);
    $("#approve-memory-delete").checked = false;
    $("#memory-permission-status").textContent =
        "Browser session memory deleted with approval.";
};
