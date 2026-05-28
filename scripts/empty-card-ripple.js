/**
 * Empty category cards — per-category pixel art with neutral palette + ripple.
 * Visual: cloud-600 full opacity; each square rests at ~20% and pulses brighter.
 */
(function () {
  const WAVE_INTERVAL_MS = 2000;
  const WAVE_DURATION_MS = 900;
  const WAVE_NOISE = 0.35;
  const VIEW_CENTER = 50;
  const MAX_VIEW_DIST = Math.hypot(VIEW_CENTER, VIEW_CENTER);

  const FILL_HIGHLIGHT = "#ecebe5";
  const FILL_SHADOW = "#aaa38d";
  /** Per-pixel rest (replaces whole-visual 20% fade) */
  const SHADOW_BASE = 0.2;
  const SHADOW_PEAK = 0.45;
  const HIGHLIGHT_BASE = 0.24;
  const HIGHLIGHT_PEAK = 0.72;
  const PULSE_MS = 320;

  const activeVisuals = new Set();
  let intervalId = null;
  let prefersReducedMotion = false;

  function inverseEaseOutCubic(y) {
    return 1 - Math.cbrt(1 - y);
  }

  function getRawFillOpacity(el) {
    const attr = el.getAttribute("fill-opacity");
    if (attr != null && attr !== "") return parseFloat(attr);
    return 1;
  }

  function isHighlightPixel(raw) {
    return raw >= 0.9;
  }

  function styleEmptyPixel(el, raw) {
    const highlight = isHighlightPixel(raw);
    el.setAttribute("fill", highlight ? FILL_HIGHLIGHT : FILL_SHADOW);
    if (highlight) {
      return { base: HIGHLIGHT_BASE, peakBoost: HIGHLIGHT_PEAK };
    }
    return { base: SHADOW_BASE, peakBoost: SHADOW_PEAK };
  }

  function buildReachTimes(shapes) {
    const baseByDist = new Map();
    for (const shape of shapes) {
      const norm = shape.dist / MAX_VIEW_DIST;
      const cleanReach = inverseEaseOutCubic(norm) * WAVE_DURATION_MS;
      const key = Math.round(norm * 100);
      if (!baseByDist.has(key)) baseByDist.set(key, cleanReach);
    }

    const halfNoise = (WAVE_NOISE * WAVE_DURATION_MS) / 2;
    for (const shape of shapes) {
      const key = Math.round((shape.dist / MAX_VIEW_DIST) * 100);
      const cleanReach = baseByDist.get(key) ?? 0;
      const jitter = (Math.random() * 2 - 1) * halfNoise;
      shape.reachMs = Math.max(0, Math.min(WAVE_DURATION_MS, cleanReach + jitter));
    }
  }

  function opacityAt(elapsed, shape) {
    const t = elapsed - shape.reachMs;
    if (t < 0) return shape.base;
    if (t < PULSE_MS) {
      const phase = t / PULSE_MS;
      return Math.min(1, shape.base + shape.peakBoost * Math.sin(phase * Math.PI));
    }
    return shape.base;
  }

  function runWave(visual) {
    const shapes = visual._rippleShapes;
    if (!shapes?.length) return;

    buildReachTimes(shapes);
    const start = performance.now();

    function frame(now) {
      if (!activeVisuals.has(visual)) return;
      const elapsed = now - start;
      if (elapsed > WAVE_DURATION_MS + 280) return;

      for (const shape of shapes) {
        shape.el.setAttribute("fill-opacity", String(opacityAt(elapsed, shape)));
      }
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  function runAllWaves() {
    activeVisuals.forEach((visual) => runWave(visual));
  }

  function startLoop() {
    if (intervalId !== null || prefersReducedMotion) return;
    runAllWaves();
    intervalId = window.setInterval(runAllWaves, WAVE_INTERVAL_MS);
  }

  function stopLoop() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function measureShapes(svg) {
    const paths = [...svg.querySelectorAll("path")];
    const shapes = [];

    for (const el of paths) {
      let dist = VIEW_CENTER;
      try {
        const box = el.getBBox();
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        dist = Math.hypot(cx - VIEW_CENTER, cy - VIEW_CENTER);
      } catch {
        /* getBBox unavailable */
      }

      const raw = getRawFillOpacity(el);
      const styled = styleEmptyPixel(el, raw);
      shapes.push({
        el,
        dist,
        ...styled,
      });
    }

    return shapes;
  }

  async function setupVisual(visual) {
    if (!(visual instanceof HTMLElement) || visual.dataset.rippleReady === "true") {
      return;
    }

    const img = visual.querySelector(".category-card__art");
    if (!img) return;

    const src = img.getAttribute("src");
    if (!src) return;

    let svgText;
    try {
      const res = await fetch(src);
      if (!res.ok) return;
      svgText = await res.text();
    } catch {
      return;
    }

    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return;

    visual.dataset.rippleSrc = src;
    img.remove();

    svg.classList.add("category-card__art", "category-card__art-svg");
    svg.setAttribute("width", "100");
    svg.setAttribute("height", "100");
    svg.setAttribute("aria-hidden", "true");
    visual.appendChild(svg);

    const shapes = measureShapes(svg);
    if (!shapes.length) {
      teardownVisual(visual);
      return;
    }

    shapes.forEach((shape) => {
      shape.el.setAttribute("fill-opacity", String(shape.base));
    });

    visual._rippleShapes = shapes;
    visual.dataset.rippleReady = "true";
    visual.classList.add("category-card__visual--ripple");
    activeVisuals.add(visual);

    if (activeVisuals.size === 1) startLoop();
  }

  function teardownVisual(visual) {
    if (!(visual instanceof HTMLElement)) return;

    activeVisuals.delete(visual);
    if (activeVisuals.size === 0) stopLoop();

    const svg = visual.querySelector(".category-card__art-svg");
    if (svg) svg.remove();

    const src = visual.dataset.rippleSrc;
    if (src) {
      const img = document.createElement("img");
      img.className = "category-card__art";
      img.src = src;
      img.width = 100;
      img.height = 100;
      img.alt = "";
      visual.appendChild(img);
    }

    delete visual._rippleShapes;
    visual.classList.remove("category-card__visual--ripple");
    visual.removeAttribute("data-ripple-ready");
    visual.removeAttribute("data-ripple-src");
  }

  function syncCard(card) {
    const visual = card.querySelector(".category-card__visual");
    if (!visual) return;

    if (card.classList.contains("category-card--empty")) {
      if (visual.dataset.rippleReady !== "true") setupVisual(visual);
      return;
    }

    if (visual.dataset.rippleReady === "true") teardownVisual(visual);
  }

  function refresh() {
    document.querySelectorAll(".category-card").forEach(syncCard);
  }

  const cards = [...document.querySelectorAll(".category-card")];
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  function onMotionChange() {
    prefersReducedMotion = motionQuery.matches;
    if (prefersReducedMotion) {
      stopLoop();
      activeVisuals.forEach((visual) => {
        const shapes = visual._rippleShapes;
        if (!shapes) return;
        shapes.forEach((shape) => {
          shape.el.setAttribute("fill-opacity", String(shape.base));
        });
      });
      return;
    }
    if (activeVisuals.size > 0) startLoop();
  }

  motionQuery.addEventListener("change", onMotionChange);
  onMotionChange();

  cards.forEach((card) => {
    syncCard(card);
    new MutationObserver(() => syncCard(card)).observe(card, {
      attributes: true,
      attributeFilter: ["class"],
    });
  });

  window.EmptyCardRipple = { refresh, setupVisual, teardownVisual };
})();
