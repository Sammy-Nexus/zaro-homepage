/**
 * RippleLoader — slim version
 *
 * 9×9 (or 5×5) animated loader. Pre-generates a pool of patterns at module
 * load and cycles through them randomly on each pulse — no per-pulse
 * mutation logic. Ripple expands outward from center ring-by-ring with an
 * eased curve. Only the cells that differ between the previous and next
 * pattern actually re-animate during a morph.
 *
 * Public API:
 *   window.RippleLoader.mount(container, options?)
 *   window.RippleLoader.mountSmall(container, options?)   // 5×5
 *
 * Options:
 *   color          (default "#C2BFAF")
 *   opacity        (default 0.45)
 *   interval       (default 1000ms — set to waveDuration for continuous)
 *   waveDuration   (default 700ms)
 *   gridSize       (9 or 5; default 9)
 *   onPulse, onIntroComplete: callbacks
 *
 * Returns: { destroy() }
 */
(function () {
  const CELL_SIZE = 10;
  const SHAPE_SIZE = 7;
  const DOT_SIZE = 4;
  const DOT_RADIUS = 2;
  const CIRCLE_RADIUS = 2;

  const DEFAULT_COLOR = "#C2BFAF";
  const DEFAULT_OPACITY = 0.45;
  const DEFAULT_WAVE_DURATION = 700;
  const DEFAULT_INTERVAL = 800;
  const DEFAULT_GRID_SIZE = 9;
  const PATTERN_COUNT = 16;

  const gridEngines = new Map();

  function seededRandom(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function createGridEngine(gridSize) {
    const SOURCE_SIZE = gridSize * CELL_SIZE;
    const SOURCE_CENTER = SOURCE_SIZE / 2;
    const MAX_RING = Math.floor(gridSize / 2);
    const CORNER = MAX_RING;

    function isBlocked(gx, gy) {
      const ax = Math.abs(gx);
      const ay = Math.abs(gy);
      if (ax === CORNER && ay === CORNER) return true;
      if (ax === CORNER && ay === CORNER - 1) return true;
      if (ax === CORNER - 1 && ay === CORNER) return true;
      return false;
    }

    function ringOf(gx, gy) {
      return Math.max(Math.abs(gx), Math.abs(gy));
    }

    function symKey(gx, gy) {
      const ax = Math.abs(gx);
      const ay = Math.abs(gy);
      return `${Math.min(ax, ay)},${Math.max(ax, ay)}`;
    }

    function placeSymmetric(cells, gx, gy, type) {
      const positions = [
        [gx, gy], [-gx, gy], [gx, -gy], [-gx, -gy],
        [gy, gx], [-gy, gx], [gy, -gx], [-gy, -gx],
      ];
      for (const [sx, sy] of positions) {
        if (isBlocked(sx, sy)) continue;
        const key = `${sx},${sy}`;
        if (!cells.has(key)) cells.set(key, type);
      }
    }

    function pickType(ring, rand) {
      const r = rand();
      if (ring <= 1) {
        if (r < 0.55) return "dot";
        if (r < 0.8) return "circle";
        return "square";
      }
      if (ring === 2) {
        if (r < 0.55) return "square";
        if (r < 0.8) return "dot";
        return "circle";
      }
      if (r < 0.7) return "square";
      if (r < 0.9) return "circle";
      return "dot";
    }

    function buildPattern(seed) {
      const rand = seededRandom(seed);
      const cells = new Map();

      // Always include center
      placeSymmetric(cells, 0, 0, pickType(0, rand));

      // Walk one octant; symmetry fills the rest
      for (let ring = 1; ring <= MAX_RING; ring++) {
        const density = ring === MAX_RING ? 0.45 + rand() * 0.25 : 0.65 + rand() * 0.2;
        for (let gy = 0; gy <= ring; gy++) {
          if (isBlocked(ring, gy)) continue;
          if (rand() < density) {
            placeSymmetric(cells, ring, gy, pickType(ring, rand));
          }
        }
      }

      // Guarantee every ring has at least one cell so the wave never has a gap
      for (let ring = 0; ring <= MAX_RING; ring++) {
        let hasCell = false;
        for (const key of cells.keys()) {
          const [gx, gy] = key.split(",").map(Number);
          if (ringOf(gx, gy) === ring) { hasCell = true; break; }
        }
        if (hasCell) continue;
        const candidates = ring === 0 ? [[0, 0]] : (() => {
          const arr = [];
          for (let gy = 0; gy <= ring; gy++) {
            if (!isBlocked(ring, gy)) arr.push([ring, gy]);
          }
          return arr;
        })();
        if (candidates.length === 0) continue;
        const pick = candidates[Math.floor(rand() * candidates.length)];
        placeSymmetric(cells, pick[0], pick[1], pickType(ring, rand));
      }

      return cells;
    }

    const patterns = Array.from({ length: PATTERN_COUNT }, (_, i) =>
      buildPattern(i * 1337 + 42)
    );

    function cellsToShapes(cells) {
      const shapes = [];
      for (const [key, type] of cells) {
        const [gx, gy] = key.split(",").map(Number);
        const cx = SOURCE_CENTER + gx * CELL_SIZE;
        const cy = SOURCE_CENTER + gy * CELL_SIZE;
        const groupKey = symKey(gx, gy);
        const ring = ringOf(gx, gy);

        let draw;
        if (type === "square") {
          draw = (ctx, scale) => {
            roundRect(ctx, (cx - SHAPE_SIZE / 2) * scale, (cy - SHAPE_SIZE / 2) * scale,
              SHAPE_SIZE * scale, SHAPE_SIZE * scale, 1.2 * scale);
            ctx.fill();
          };
        } else if (type === "dot") {
          draw = (ctx, scale) => {
            roundRect(ctx, (cx - DOT_SIZE / 2) * scale, (cy - DOT_SIZE / 2) * scale,
              DOT_SIZE * scale, DOT_SIZE * scale, DOT_RADIUS * scale);
            ctx.fill();
          };
        } else {
          draw = (ctx, scale) => {
            ctx.beginPath();
            ctx.arc(cx * scale, cy * scale, CIRCLE_RADIUS * scale, 0, Math.PI * 2);
            ctx.fill();
          };
        }
        shapes.push({ ring, groupKey, draw });
      }
      return shapes;
    }

    function computeChangingKeys(before, after) {
      const changing = new Set();
      const allKeys = new Set([...before.keys(), ...after.keys()]);
      for (const key of allKeys) {
        if (before.get(key) !== after.get(key)) {
          const [gx, gy] = key.split(",").map(Number);
          changing.add(symKey(gx, gy));
        }
      }
      return changing;
    }

    return {
      SOURCE_SIZE,
      MAX_RING,
      patterns,
      cellsToShapes,
      computeChangingKeys,
    };
  }

  function getGridEngine(gridSize) {
    const size = gridSize === 5 ? 5 : DEFAULT_GRID_SIZE;
    if (!gridEngines.has(size)) gridEngines.set(size, createGridEngine(size));
    return gridEngines.get(size);
  }

  function createRippleLoader(container, options = {}) {
    const color = options.color ?? DEFAULT_COLOR;
    const opacity = options.opacity ?? DEFAULT_OPACITY;
    const interval = options.interval ?? DEFAULT_INTERVAL;
    const waveDuration = options.waveDuration ?? DEFAULT_WAVE_DURATION;
    const onPulse = typeof options.onPulse === "function" ? options.onPulse : null;
    const onIntroComplete = typeof options.onIntroComplete === "function" ? options.onIntroComplete : null;
    const gridSize = options.gridSize === 5 ? 5 : DEFAULT_GRID_SIZE;
    const { SOURCE_SIZE, MAX_RING, patterns, cellsToShapes, computeChangingKeys } = getGridEngine(gridSize);

    container.replaceChildren();
    const wrapper = document.createElement("div");
    wrapper.className = "ripple-loader";
    wrapper.setAttribute("role", "status");
    wrapper.setAttribute("aria-label", "Loading");
    const canvas = document.createElement("canvas");
    canvas.className = "ripple-loader__canvas";
    wrapper.appendChild(canvas);
    container.appendChild(wrapper);

    const state = {
      currentIdx: 0,
      currentShapes: cellsToShapes(patterns[0]),
      nextShapes: null,
      morphChangingKeys: null,
      waveStartTime: 0,
      mode: "reveal",
      rafId: null,
      waveToken: 0,
      intervalId: null,
      bootRafId: null,
      scale: 1,
      dpr: 1,
      destroyed: false,
      introCompleteEmitted: false,
    };

    function emitIntroComplete() {
      if (state.introCompleteEmitted || state.destroyed) return;
      state.introCompleteEmitted = true;
      onIntroComplete?.();
    }

    function resize() {
      const rect = wrapper.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      state.dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * state.dpr;
      canvas.height = rect.height * state.dpr;
      const fit = Math.min(rect.width, rect.height);
      state.scale = (fit / SOURCE_SIZE) * state.dpr;
    }

    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

    function isRingRevealed(ring, elapsed) {
      if (elapsed >= waveDuration) return true;
      const t = Math.min(1, elapsed / waveDuration);
      return easeOutCubic(t) >= ring / (MAX_RING + 1);
    }

    function drawFrame(elapsed) {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      const patternPx = SOURCE_SIZE * state.scale;
      ctx.translate((canvas.width - patternPx) / 2, (canvas.height - patternPx) / 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = opacity;

      const animateKeys = state.morphChangingKeys;

      if (state.mode === "reveal") {
        for (const shape of state.currentShapes) {
          if (isRingRevealed(shape.ring, elapsed)) shape.draw(ctx, state.scale);
        }
      } else {
        // Morph: static shapes stay drawn, only changing ones animate.
        for (const shape of state.currentShapes) {
          if (animateKeys && !animateKeys.has(shape.groupKey)) {
            shape.draw(ctx, state.scale);
            continue;
          }
          if (!isRingRevealed(shape.ring, elapsed)) shape.draw(ctx, state.scale);
        }
        if (state.nextShapes) {
          for (const shape of state.nextShapes) {
            if (animateKeys && !animateKeys.has(shape.groupKey)) continue;
            if (isRingRevealed(shape.ring, elapsed)) shape.draw(ctx, state.scale);
          }
        }
      }
      ctx.restore();
    }

    function paintStatic() {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      const patternPx = SOURCE_SIZE * state.scale;
      ctx.translate((canvas.width - patternPx) / 2, (canvas.height - patternPx) / 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = opacity;
      for (const shape of state.currentShapes) shape.draw(ctx, state.scale);
      ctx.restore();
    }

    function startWave() {
      if (state.destroyed) return;
      onPulse?.();
      if (state.rafId !== null) cancelAnimationFrame(state.rafId);
      state.waveToken++;
      state.waveStartTime = performance.now();
      const myToken = state.waveToken;

      function render(now) {
        if (state.destroyed || myToken !== state.waveToken) return;
        const elapsed = Math.min(waveDuration, now - state.waveStartTime);
        drawFrame(elapsed);
        if (elapsed < waveDuration) {
          state.rafId = requestAnimationFrame(render);
        } else {
          const wasInitial = state.mode === "reveal" && !state.nextShapes;
          if (state.mode === "morph" && state.nextShapes) {
            state.currentShapes = state.nextShapes;
            state.nextShapes = null;
            state.morphChangingKeys = null;
            state.mode = "reveal";
          }
          state.rafId = null;
          if (wasInitial) emitIntroComplete();
        }
      }
      state.rafId = requestAnimationFrame(render);
    }

    function triggerReveal() {
      state.mode = "reveal";
      state.morphChangingKeys = null;
      startWave();
    }

    function triggerShift() {
      // If a previous morph hasn't committed yet, commit it
      if (state.mode === "morph" && state.nextShapes) {
        state.currentShapes = state.nextShapes;
        state.nextShapes = null;
        state.morphChangingKeys = null;
      }

      let nextIdx;
      do {
        nextIdx = Math.floor(Math.random() * patterns.length);
      } while (nextIdx === state.currentIdx);

      const beforeCells = patterns[state.currentIdx];
      const afterCells = patterns[nextIdx];
      state.currentIdx = nextIdx;
      state.nextShapes = cellsToShapes(afterCells);
      state.morphChangingKeys = computeChangingKeys(beforeCells, afterCells);
      state.mode = "morph";
      startWave();
    }

    function boot() {
      resize();
      const rect = wrapper.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) {
        state.bootRafId = requestAnimationFrame(boot);
        return;
      }
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        paintStatic();
        onPulse?.();
        emitIntroComplete();
        return;
      }
      state.bootRafId = requestAnimationFrame(() => triggerReveal());
      state.intervalId = window.setInterval(() => triggerShift(), interval);
    }

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          resize();
          if (state.rafId === null && !state.intervalId
              && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            paintStatic();
          }
        })
      : null;
    resizeObserver?.observe(wrapper);

    boot();

    return {
      destroy() {
        state.destroyed = true;
        if (state.bootRafId !== null) cancelAnimationFrame(state.bootRafId);
        if (state.rafId !== null) cancelAnimationFrame(state.rafId);
        if (state.intervalId !== null) clearInterval(state.intervalId);
        resizeObserver?.disconnect();
        container.replaceChildren();
      },
      interval,
      waveDuration,
      gridSize,
    };
  }

  function mount(container, options = {}) {
    if (!container) return null;
    return createRippleLoader(container, options);
  }

  function mountSmall(container, options = {}) {
    return mount(container, { ...options, gridSize: 5 });
  }

  window.RippleLoader = {
    mount,
    mountSmall,
    PULSE_INTERVAL_MS: DEFAULT_INTERVAL,
    WAVE_DURATION_MS: DEFAULT_WAVE_DURATION,
  };

  window.BuilderLoader = {
    mount,
    mountSmall,
    PULSE_INTERVAL_MS: DEFAULT_INTERVAL,
    WAVE_DURATION_MS: DEFAULT_WAVE_DURATION,
  };
})();
