"use strict";
(() => {
  const body = document.body;
  const loading = document.querySelector("#loading-screen");
  const loadingRule = document.querySelector("#loading-rule");
  const loadingStatus = document.querySelector("#loading-status");
  const intro = document.querySelector("#intro");
  const initiate = document.querySelector("#initiate");
  const skip = document.querySelector(".skip-link");
  const chapters = Array.from(document.querySelectorAll(".chapter"));
  const backgrounds = Array.from(document.querySelectorAll("[data-background]"));
  const progressLinks = Array.from(document.querySelectorAll(".side-progress a"));
  const chapterCounter = document.querySelector("#chapter-counter");
  const hudLabel = document.querySelector("#hud-label");
  const hudPercent = document.querySelector("#hud-percent");
  const soundButton = document.querySelector("#audio-toggle");
  const soundLabel = document.querySelector("#audio-label");
  const dialog = document.querySelector("#systems-dialog");
  const search = document.querySelector("#system-search");
  const directoryLinks = Array.from(document.querySelectorAll("#system-directory a"));
  const noResults = document.querySelector("#dialog-empty");
  const sceneNames = ["ORBITAL INTELLIGENCE","KNOWLEDGE NETWORKS","SECURE INTELLIGENCE","MODEL GOVERNANCE","MULTIMODAL FRONTIER","THE BUILDER"];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const imageURLs = ["assets/orbit.png","assets/network.png","assets/datacenter.png","assets/core.png"];
  let booted = false;
  let activeIndex = -1;
  let scrollScheduled = false;
  let soundEnabled = false;
  let audioContext = null;
  let ambientNodes = null;
  let starAnimation = 0;

  function preloadImage(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  }

  function revealIntro() {
    if (booted) return;
    booted = true;
    loadingRule.style.width = "100%";
    loadingStatus.textContent = "Ready to initiate";
    intro.hidden = false;
    requestAnimationFrame(() => loading.classList.add("is-finished"));
    window.setTimeout(() => { loading.hidden = true; }, 650);
  }

  // Progress reflects resolved assets, never a fictitious timer percentage.
  Promise.all(imageURLs.map(async (url) => {
    const result = await preloadImage(url);
    const done = Number(loadingRule.dataset.done || "0") + 1;
    loadingRule.dataset.done = String(done);
    loadingRule.style.width = (done / imageURLs.length * 100) + "%";
    loadingStatus.textContent = result ? "Loading environments · " + done + "/" + imageURLs.length : "Preparing fallback · " + done + "/" + imageURLs.length;
    return result;
  })).then(revealIntro).catch(revealIntro);
  window.setTimeout(revealIntro, 5500);

  function enterExperience() {
    if (!booted) revealIntro();
    if (body.classList.contains("started")) return;
    body.classList.add("started");
    intro.hidden = true;
    window.scrollTo({ top: 0, behavior: "instant" });
    updateScroll();
    if (!reducedMotion) startStars();
  }
  initiate.addEventListener("click", enterExperience);
  skip.addEventListener("click", (event) => {
    if (!body.classList.contains("started")) {
      event.preventDefault();
      enterExperience();
      chapters[0].focus({ preventScroll: true });
    }
  });

  function setActiveChapter(index) {
    if (index === activeIndex) return;
    activeIndex = index;
    const chapter = chapters[index];
    if (!chapter) return;
    const scene = chapter.dataset.scene;
    backgrounds.forEach((el) => el.classList.toggle("is-active", el.dataset.background === scene));
    progressLinks.forEach((link, i) => {
      const on = i === index;
      link.classList.toggle("is-current", on);
      if (on) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
    chapterCounter.textContent = String(index + 1).padStart(2, "0");
    hudLabel.textContent = sceneNames[index] || "MAK'MA LABS";
  }
  function updateScroll() {
    scrollScheduled = false;
    if (!body.classList.contains("started")) return;
    const anchor = window.scrollY + window.innerHeight * .48;
    let index = 0;
    for (let i = 0; i < chapters.length; i++) {
      if (chapters[i].offsetTop <= anchor) index = i;
    }
    setActiveChapter(index);
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = Math.max(0, Math.min(1, window.scrollY / maxScroll));
    hudPercent.textContent = String(Math.round(progress * 100)).padStart(3, "0") + "%";
    if (!reducedMotion) {
      const shift = Math.round((progress - .5) * 45);
      document.documentElement.style.setProperty("--stage-shift", shift + "px");
    }
  }
  function queueScroll() {
    if (scrollScheduled) return;
    scrollScheduled = true;
    requestAnimationFrame(updateScroll);
  }
  window.addEventListener("scroll", queueScroll, { passive: true });
  window.addEventListener("resize", queueScroll, { passive: true });
  progressLinks.forEach((link) => link.addEventListener("click", enterExperience));

  function openDirectory() {
    if (!body.classList.contains("started")) enterExperience();
    search.value = "";
    filterDirectory();
    if (!dialog.open) dialog.showModal();
    window.setTimeout(() => search.focus(), 50);
  }
  function closeDirectory() {
    if (dialog.open) dialog.close();
  }
  function filterDirectory() {
    const query = search.value.trim().toLowerCase();
    let count = 0;
    directoryLinks.forEach((link) => {
      const matches = !query || (link.dataset.search || "").includes(query) || link.textContent.toLowerCase().includes(query);
      link.hidden = !matches;
      if (matches) count++;
    });
    noResults.hidden = count !== 0;
  }
  document.querySelector("#systems-open").addEventListener("click", openDirectory);
  document.querySelector("#open-all").addEventListener("click", openDirectory);
  document.querySelector("#systems-close").addEventListener("click", closeDirectory);
  search.addEventListener("input", filterDirectory);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDirectory();
  });
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (dialog.open) closeDirectory(); else openDirectory();
    }
  });

  // Audio is user-initiated, local and optional. No tracking or external media requests.
  function stopAmbient() {
    if (!audioContext || !ambientNodes) return;
    const now = audioContext.currentTime;
    ambientNodes.gain.gain.cancelScheduledValues(now);
    ambientNodes.gain.gain.setTargetAtTime(0, now, .24);
    window.setTimeout(() => {
      if (ambientNodes) {
        ambientNodes.oscillators.forEach((osc) => { try { osc.stop(); } catch (_) {} });
        ambientNodes = null;
      }
      if (audioContext) { audioContext.close().catch(() => {}); audioContext = null; }
    }, 900);
  }
  async function startAmbient() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return false;
    audioContext = new Context();
    try {
      await audioContext.resume();
      const gain = audioContext.createGain();
      gain.gain.value = 0;
      gain.connect(audioContext.destination);
      const filter = audioContext.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 440;
      filter.connect(gain);
      const oscillators = [55,82.41,110].map((frequency, index) => {
        const osc = audioContext.createOscillator();
        osc.type = index === 1 ? "sine" : "triangle";
        osc.frequency.value = frequency;
        osc.connect(filter);
        osc.start();
        return osc;
      });
      gain.gain.setTargetAtTime(.025, audioContext.currentTime, .8);
      ambientNodes = { gain, oscillators };
      return true;
    } catch (_) {
      if (audioContext) audioContext.close().catch(() => {});
      audioContext = null;
      return false;
    }
  }
  soundButton.addEventListener("click", async () => {
    if (soundEnabled) {
      soundEnabled = false;
      soundButton.setAttribute("aria-pressed", "false");
      soundButton.setAttribute("aria-label", "Enable optional sound");
      soundLabel.textContent = "SOUND OFF";
      body.classList.remove("sound-on");
      stopAmbient();
      return;
    }
    const started = await startAmbient();
    if (started) {
      soundEnabled = true;
      soundButton.setAttribute("aria-pressed", "true");
      soundButton.setAttribute("aria-label", "Disable optional sound");
      soundLabel.textContent = "SOUND ON";
      body.classList.add("sound-on");
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && soundEnabled && audioContext) audioContext.suspend().catch(() => {});
    else if (!document.hidden && soundEnabled && audioContext) audioContext.resume().catch(() => {});
  });

  // Lightweight atmospheric particles. They never obscure readable content.
  const canvas = document.querySelector("#star-canvas");
  const ctx = canvas.getContext("2d", { alpha: true });
  let stars = [];
  let width = 0, height = 0, ratio = 1;
  let pointerX = 0, pointerY = 0;
  function seedStars() {
    if (!ctx) return;
    ratio = Math.min(2, window.devicePixelRatio || 1);
    width = Math.max(1, canvas.clientWidth);
    height = Math.max(1, canvas.clientHeight);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    let seed = 9427;
    const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const count = Math.min(140, Math.round(width * height / 11000));
    stars = Array.from({ length: count }, () => ({
      x: random() * width, y: random() * height, size: .3 + random() * 1.1,
      alpha: .18 + random() * .62, speed: .03 + random() * .15, phase: random() * 6.283
    }));
  }
  function drawStars(time) {
    if (!ctx || !body.classList.contains("started")) return;
    ctx.clearRect(0, 0, width, height);
    const t = time * .00015;
    const shiftY = window.scrollY * .016;
    stars.forEach((star) => {
      const x = (star.x + pointerX * star.speed + width) % width;
      const y = (star.y + shiftY * star.speed + pointerY * star.speed + height) % height;
      const twinkle = reducedMotion ? 1 : .75 + .25 * Math.sin(t + star.phase);
      ctx.fillStyle = "rgba(220,235,247," + (star.alpha * twinkle).toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(x, y, star.size, 0, Math.PI * 2);
      ctx.fill();
    });
    if (!reducedMotion && !document.hidden) starAnimation = requestAnimationFrame(drawStars);
  }
  function startStars() {
    if (!ctx) return;
    seedStars();
    cancelAnimationFrame(starAnimation);
    starAnimation = requestAnimationFrame(drawStars);
  }
  window.addEventListener("pointermove", (event) => {
    pointerX = (event.clientX / Math.max(1, width) - .5) * 35;
    pointerY = (event.clientY / Math.max(1, height) - .5) * 35;
  }, { passive: true });
  window.addEventListener("resize", () => {
    if (body.classList.contains("started")) {
      seedStars();
      if (reducedMotion) drawStars(0);
    }
  }, { passive: true });
  if (reducedMotion && ctx) {
    body.addEventListener("click", () => { if (body.classList.contains("started")) { seedStars(); drawStars(0); } }, { once: true });
  }
})();
