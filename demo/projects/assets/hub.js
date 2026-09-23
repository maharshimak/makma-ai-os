"use strict";

(() => {
    const cards = [...document.querySelectorAll(".hub-system-card")];
    const filters = [...document.querySelectorAll("[data-filter]")];
    const search = document.querySelector("#hub-search-input");
    const empty = document.querySelector("#hub-empty");
    const reset = document.querySelector("#hub-reset");
    let activeFilter = "all";

    const normalize = (value) => String(value || "").toLowerCase().trim();

    function applyFilters() {
        const query = normalize(search && search.value);
        let visible = 0;

        cards.forEach((card) => {
            const category = card.dataset.category;
            const text = normalize(card.textContent);
            const matchCategory = activeFilter === "all" || category === activeFilter;
            const matchQuery = !query || text.includes(query);
            const show = matchCategory && matchQuery;
            card.classList.toggle("is-hidden", !show);
            card.setAttribute("aria-hidden", String(!show));
            if (show) visible += 1;
        });

        if (empty) empty.hidden = visible !== 0;
    }

    filters.forEach((button) => {
        button.addEventListener("click", () => {
            activeFilter = button.dataset.filter || "all";
            filters.forEach((item) => {
                const selected = item === button;
                item.classList.toggle("is-active", selected);
                item.setAttribute("aria-pressed", String(selected));
            });
            applyFilters();
        });
    });

    if (search) search.addEventListener("input", applyFilters);

    if (reset) {
        reset.addEventListener("click", () => {
            activeFilter = "all";
            if (search) search.value = "";
            filters.forEach((item) => {
                const selected = item.dataset.filter === "all";
                item.classList.toggle("is-active", selected);
                item.setAttribute("aria-pressed", String(selected));
            });
            applyFilters();
            if (search) search.focus();
        });
    }

    cards.forEach((card) => {
        card.addEventListener("pointermove", (event) => {
            const rect = card.getBoundingClientRect();
            card.style.setProperty("--mx", ((event.clientX - rect.left) / rect.width * 100) + "%");
            card.style.setProperty("--my", ((event.clientY - rect.top) / rect.height * 100) + "%");
        });
    });

    const overlay = document.querySelector("[data-command-overlay]");
    const openButton = document.querySelector("[data-command-open]");
    const commandSearch = document.querySelector("#command-search");
    const results = document.querySelector("#command-results");
    let resultButtons = [];
    let selectedIndex = 0;

    const systems = cards.map((card, index) => {
        const launch = card.querySelector(".hub-launch");
        const name = card.dataset.systemName || card.querySelector("h3").textContent.trim();
        const path = card.querySelector(".hub-card-path").textContent.trim();
        return {
            index: String(index + 1).padStart(2, "0"),
            name,
            path,
            href: launch ? launch.getAttribute("href") : "#"
        };
    });

    function renderCommandResults(query) {
        if (!results) return;
        const term = normalize(query);
        const matches = systems.filter((system) => normalize(system.name + " " + system.path).includes(term));
        results.innerHTML = matches.map((system, index) =>
            '<button type="button" class="hub-command-item' + (index === 0 ? ' is-selected' : '') + '" data-href="' +
            system.href.replace(/"/g, "&quot;") + '">' +
            '<span class="hub-command-item-index">' + system.index + '</span>' +
            '<span><strong>' + system.name + '</strong><small>' + system.path + '</small></span>' +
            '<span>↗</span></button>'
        ).join("");

        resultButtons = [...results.querySelectorAll(".hub-command-item")];
        selectedIndex = 0;

        resultButtons.forEach((button, index) => {
            button.addEventListener("mouseenter", () => setSelected(index));
            button.addEventListener("click", () => navigate(button.dataset.href));
        });
    }

    function setSelected(index) {
        if (!resultButtons.length) return;
        selectedIndex = Math.max(0, Math.min(index, resultButtons.length - 1));
        resultButtons.forEach((button, i) => button.classList.toggle("is-selected", i === selectedIndex));
        resultButtons[selectedIndex].scrollIntoView({ block: "nearest" });
    }

    function navigate(href) {
        if (!href) return;
        closePalette();
        window.location.href = href;
    }

    function openPalette() {
        if (!overlay || !commandSearch) return;
        overlay.hidden = false;
        document.body.style.overflow = "hidden";
        commandSearch.value = "";
        renderCommandResults("");
        requestAnimationFrame(() => commandSearch.focus());
    }

    function closePalette() {
        if (!overlay) return;
        overlay.hidden = true;
        document.body.style.overflow = "";
        if (openButton) openButton.focus();
    }

    if (openButton) openButton.addEventListener("click", openPalette);

    if (overlay) {
        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) closePalette();
        });
    }

    if (commandSearch) {
        commandSearch.addEventListener("input", () => renderCommandResults(commandSearch.value));
        commandSearch.addEventListener("keydown", (event) => {
            if (event.key === "ArrowDown") {
                event.preventDefault();
                setSelected(selectedIndex + 1);
            } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setSelected(selectedIndex - 1);
            } else if (event.key === "Enter" && resultButtons[selectedIndex]) {
                event.preventDefault();
                navigate(resultButtons[selectedIndex].dataset.href);
            }
        });
    }

    document.addEventListener("keydown", (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
            event.preventDefault();
            if (overlay && !overlay.hidden) closePalette();
            else openPalette();
        } else if (event.key === "Escape" && overlay && !overlay.hidden) {
            closePalette();
        }
    });

    filters.forEach((item) => item.setAttribute("aria-pressed", String(item.classList.contains("is-active"))));
    applyFilters();

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const topbar = document.querySelector(".hub-topbar");
    const progress = document.querySelector(".hub-scroll-progress i");
    let scrollFrame = 0;

    function updateScrollUI() {
        scrollFrame = 0;
        const y = window.scrollY || document.documentElement.scrollTop;
        if (topbar) topbar.classList.toggle("is-scrolled", y > 16);
        if (progress) {
            const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
            progress.style.transform = "scaleX(" + Math.min(1, Math.max(0, y / max)) + ")";
        }
    }

    window.addEventListener("scroll", () => {
        if (scrollFrame) return;
        scrollFrame = requestAnimationFrame(updateScrollUI);
    }, { passive: true });
    window.addEventListener("resize", updateScrollUI, { passive: true });
    updateScrollUI();

    if (!reducedMotion && "IntersectionObserver" in window) {
        const staggered = [
            ...document.querySelectorAll(".hub-metrics article"),
            ...document.querySelectorAll(".hub-system-card"),
            ...document.querySelectorAll(".hub-principle-grid article"),
            ...document.querySelectorAll(".hub-profile-badges span")
        ];

        staggered.forEach((node, index) => {
            node.classList.add("hub-reveal");
            node.style.setProperty("--reveal-delay", ((index % 4) * 55) + "ms");
        });

        [
            document.querySelector(".hub-section-heading"),
            document.querySelector(".hub-controls"),
            document.querySelector(".hub-principles-copy"),
            document.querySelector(".hub-profile-main"),
            document.querySelector(".hub-profile-terminal")
        ].filter(Boolean).forEach((node) => node.classList.add("hub-reveal-soft"));

        document.body.classList.add("hub-motion-ready");

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            });
        }, {
            rootMargin: "0px 0px -8% 0px",
            threshold: 0.08
        });

        document.querySelectorAll(".hub-reveal,.hub-reveal-soft").forEach((node) => observer.observe(node));
    }
})();
