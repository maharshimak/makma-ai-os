"use strict";
(() => {
    const M = window.MAKMA,
        D = window.MAKMA_DOMAIN;
    const field = (id, label, value = "", type = "text") =>
        '<div class="field"><label for="' +
        M.esc(id) +
        '">' +
        M.esc(label) +
        "</label>" +
        (type === "textarea"
            ? '<textarea id="' +
              M.esc(id) +
              '" spellcheck="false">' +
              M.esc(value) +
              "</textarea>"
            : '<input id="' +
              M.esc(id) +
              '" type="' +
              type +
              '" value="' +
              M.esc(value) +
              '">') +
        "</div>";
    const read = (id) => M.$("#" + id).value;
    const n = (id, label, options) => D.number(read(id), label, options);
    const list = (id) => {
        const raw = D.text(read(id), id);
        return raw.split(/[\s,]+/).map((v) => D.nonnegative(v, id));
    };
    const section = (title, html) =>
        '<section class="workflow-section"><h3>' +
        M.esc(title) +
        "</h3>" +
        html +
        "</section>";
    const status = (allowed, yes = "PASS", no = "BLOCK") =>
        M.badge(allowed ? yes : no, allowed ? "ok" : "bad");
    const reasons = (items) =>
        items.length
            ? "<ul>" +
              items.map((x) => "<li>" + M.esc(x) + "</li>").join("") +
              "</ul>"
            : "<p>All configured checks passed.</p>";
    const json = (value) =>
        '<pre class="code">' + M.esc(JSON.stringify(value, null, 2)) + "</pre>";
    const download = (value, name, format = "json") => {
        const blob = new Blob(
                [format === "json" ? JSON.stringify(value, null, 2) : value],
                {
                    type:
                        format === "json"
                            ? "application/json"
                            : "text/csv;charset=utf-8",
                },
            ),
            url = URL.createObjectURL(blob),
            a = document.createElement("a");
        a.href = url;
        a.download = name + "." + format;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    function mount(html, run, button = "Run workflow", layout = "workflow") {
        let busy = false,
            last = null;
        M.shell(
            html +
                '<div class="quick-actions"><button id="run" class="btn primary">' +
                M.esc(button) +
                '</button><button id="reset-inputs" class="btn">Reset sample</button><button id="export-result" class="btn" disabled>Export result JSON</button></div>',
        );
        M.$("#tool-root").classList.add(layout);
        M.$("#result").setAttribute("aria-live", "polite");
        M.$("#result").setAttribute("role", "status");
        const initial = [
            ...document.querySelectorAll(
                ".tool-input input,.tool-input textarea,.tool-input select",
            ),
        ].map((el) => [el, el.value]);
        const execute = async () => {
            if (busy) return;
            busy = true;
            last = null;
            M.$("#export-result").disabled = true;
            M.$("#run").disabled = true;
            M.$("#result").setAttribute("aria-busy", "true");
            M.setHTML("#trace", "");
            const start = performance.now();
            try {
                last = await run();
                M.$("#export-result").disabled = false;
            } catch (e) {
                M.error(e.message);
            } finally {
                M.finish(start);
                busy = false;
                M.$("#run").disabled = false;
                M.$("#result").setAttribute("aria-busy", "false");
            }
        };
        M.$("#run").onclick = execute;
        M.$("#reset-inputs").onclick = () => {
            if (busy) return;
            initial.forEach(([el, v]) => (el.value = v));
            execute();
        };
        M.$("#export-result").onclick = () => {
            if (last)
                download(
                    last,
                    location.pathname.split("/").filter(Boolean).pop() +
                        "-result",
                );
        };
        execute();
    }
    window.WORKBENCH = {
        field,
        read,
        n,
        list,
        section,
        status,
        reasons,
        json,
        download,
        mount,
    };
})();
