/**
 * RippleLoader — vanilla port of components/RippleLoader.tsx
 * 9×9 loader for the builder view; 5×5 compact variant for the status pill.
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
  const DEFAULT_INTERVAL = 1000;
  const DEFAULT_GRID_SIZE = 9;
  const FPS = 12;
  const NOISE = 0.35;
  const NOISE_ENDS_AT = 0.9;
  const PATTERN_COUNT = 12;

  const gridEngines = new Map();

  function inverseEaseOutCubic(y) {
    return 1 - Math.cbrt(1 - y);
  }

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
    const MAX_CELL_RING = Math.floor(gridSize / 2);
    const CORNER_RING = MAX_CELL_RING;
    const MAX_DIST = Math.hypot(
      MAX_CELL_RING * CELL_SIZE,
      (MAX_CELL_RING - 1) * CELL_SIZE
    );

    function isBlockedCell(gx, gy) {
      const ax = Math.abs(gx);
      const ay = Math.abs(gy);
      if (ax === CORNER_RING && ay === CORNER_RING) return true;
      if (ax === CORNER_RING && ay === CORNER_RING - 1) return true;
      if (ax === CORNER_RING - 1 && ay === CORNER_RING) return true;
      return false;
    }

    function ringOf(gx, gy) {
      return Math.max(Math.abs(gx), Math.abs(gy));
    }

    function buildPattern(seed) {
      const rand = seededRandom(seed);
      const cells = new Map();

      const setCell = (gx, gy, type) => {
        if (isBlockedCell(gx, gy)) return;
        const key = `${gx},${gy}`;
        if (!cells.has(key)) cells.set(key, type);
      };

      const placeSymmetric = (gx, gy, type) => {
        setCell(gx, gy, type);
        setCell(-gx, gy, type);
        setCell(gx, -gy, type);
        setCell(-gx, -gy, type);
        setCell(gy, gx, type);
        setCell(-gy, gx, type);
        setCell(gy, -gx, type);
        setCell(-gy, -gx, type);
      };

      const ringHasCell = (ring) => {
        for (const key of cells.keys()) {
          const [gx, gy] = key.split(",").map(Number);
          if (ringOf(gx, gy) === ring) return true;
        }
        return false;
      };

      const pickType = (ring) => {
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
      };

      setCell(0, 0, pickType(0));

      for (let ring = 1; ring <= MAX_CELL_RING; ring++) {
        const density =
          ring === MAX_CELL_RING ? 0.4 + rand() * 0.25 : 0.65 + rand() * 0.2;
        for (let gy = 0; gy <= ring; gy++) {
          if (isBlockedCell(ring, gy)) continue;
          if (rand() < density) placeSymmetric(ring, gy, pickType(ring));
        }
      }

      for (let ring = 0; ring <= MAX_CELL_RING; ring++) {
        if (ringHasCell(ring)) continue;
        const candidates = [];
        if (ring === 0) {
          candidates.push([0, 0]);
        } else {
          for (let gy = 0; gy <= ring; gy++) {
            if (!isBlockedCell(ring, gy)) candidates.push([ring, gy]);
          }
        }
        if (candidates.length === 0) continue;
        const pick = candidates[Math.floor(rand() * candidates.length)];
        placeSymmetric(pick[0], pick[1], pickType(ring));
      }

      const rects = [];
      const dots = [];
      const circles = [];
      for (const [key, type] of cells) {
        const [gx, gy] = key.split(",").map(Number);
        const cx = SOURCE_CENTER + gx * CELL_SIZE;
        const cy = SOURCE_CENTER + gy * CELL_SIZE;
        if (type === "square") {
          rects.push([
            cx - SHAPE_SIZE / 2,
            cy - SHAPE_SIZE / 2,
            cx + SHAPE_SIZE / 2,
            cy + SHAPE_SIZE / 2,
          ]);
        } else if (type === "dot") {
          dots.push([cx, cy]);
        } else {
          circles.push([cx, cy]);
        }
      }
      return { rects, dots, circles };
    }

    const patterns = Array.from({ length: PATTERN_COUNT }, (_, i) =>
      buildPattern(i * 1337 + 42)
    );

    function symmetricKey(cx, cy) {
      const gx = Math.round((cx - SOURCE_CENTER) / CELL_SIZE);
      const gy = Math.round((cy - SOURCE_CENTER) / CELL_SIZE);
      const ax = Math.abs(gx);
      const ay = Math.abs(gy);
      return `${Math.min(ax, ay)},${Math.max(ax, ay)}`;
    }

    function patternToShapes(pattern) {
      const shapes = [];

      pattern.dots.forEach(([cx, cy]) => {
        shapes.push({
          dist: Math.hypot(cx - SOURCE_CENTER, cy - SOURCE_CENTER),
          groupKey: symmetricKey(cx, cy),
          draw(ctx, scale) {
            roundRect(
              ctx,
              (cx - DOT_SIZE / 2) * scale,
              (cy - DOT_SIZE / 2) * scale,
              DOT_SIZE * scale,
              DOT_SIZE * scale,
              DOT_RADIUS * scale
            );
            ctx.fill();
          },
        });
      });

      pattern.rects.forEach(([x1, y1, x2, y2]) => {
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        shapes.push({
          dist: Math.hypot(cx - SOURCE_CENTER, cy - SOURCE_CENTER),
          groupKey: symmetricKey(cx, cy),
          draw(ctx, scale) {
            roundRect(
              ctx,
              x1 * scale,
              y1 * scale,
              (x2 - x1) * scale,
              (y2 - y1) * scale,
              1.2 * scale
            );
            ctx.fill();
          },
        });
      });

      pattern.circles.forEach(([cx, cy]) => {
        shapes.push({
          dist: Math.hypot(cx - SOURCE_CENTER, cy - SOURCE_CENTER),
          groupKey: symmetricKey(cx, cy),
          draw(ctx, scale) {
            ctx.beginPath();
            ctx.arc(cx * scale, cy * scale, CIRCLE_RADIUS * scale, 0, Math.PI * 2);
            ctx.fill();
          },
        });
      });

      return shapes;
    }

    return {
      SOURCE_SIZE,
      SOURCE_CENTER,
      MAX_DIST,
      patterns,
      patternToShapes,
    };
  }

  function getGridEngine(gridSize) {
    const size = gridSize === 5 ? 5 : DEFAULT_GRID_SIZE;
    if (!gridEngines.has(size)) {
      gridEngines.set(size, createGridEngine(size));
    }
    return gridEngines.get(size);
  }

  function createRippleLoader(container, options = {}) {
    const color = options.color ?? DEFAULT_COLOR;
    const opacity = options.opacity ?? DEFAULT_OPACITY;
    const interval = options.interval ?? DEFAULT_INTERVAL;
    const waveDuration = options.waveDuration ?? DEFAULT_WAVE_DURATION;
    const onPulse = typeof options.onPulse === "function" ? options.onPulse : null;
    const onIntroComplete =
      typeof options.onIntroComplete === "function" ? options.onIntroComplete : null;
    const gridSize = options.gridSize === 5 ? 5 : DEFAULT_GRID_SIZE;
    const { SOURCE_SIZE, MAX_DIST, patterns, patternToShapes } = getGridEngine(gridSize);

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
      currentPatternIdx: 0,
      currentShapes: patternToShapes(patterns[0]),
      nextShapes: null,
      waveStartTime: 0,
      mode: "reveal",
      rafId: null,
      waveToken: 0,
      intervalId: null,
      bootRafId: null,
      scale: 1,
      dpr: 1,
      shapeTimings: new Map(),
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

    function regenerateTimings(shapes) {
      state.shapeTimings = new Map();
      const frameInterval = 1000 / FPS;
      const totalFrames = Math.max(2, Math.floor(waveDuration / frameInterval));
      const noiseEndFrame = Math.max(
        1,
        Math.round(NOISE_ENDS_AT * (totalFrames - 1))
      );
      const halfNoiseMs = (NOISE * waveDuration) / 2;
      const baseByKey = new Map();

      for (const shape of shapes) {
        if (!baseByKey.has(shape.groupKey)) {
          const normRadius = Math.min(1, shape.dist / MAX_DIST);
          const cleanReachMs = inverseEaseOutCubic(normRadius) * waveDuration;
          baseByKey.set(shape.groupKey, cleanReachMs);
        }
      }

      for (const [key, cleanReachMs] of baseByKey) {
        const jitterMs = (Math.random() * 2 - 1) * halfNoiseMs;
        const noisyMs = cleanReachMs + jitterMs;
        const frameIdx = Math.round(noisyMs / frameInterval);
        const clamped = Math.max(0, Math.min(noiseEndFrame, frameIdx));
        state.shapeTimings.set(key, clamped * frameInterval);
      }
    }

    function drawFrame(elapsed) {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      const patternPx = SOURCE_SIZE * state.scale;
      ctx.translate(
        (canvas.width - patternPx) / 2,
        (canvas.height - patternPx) / 2
      );
      ctx.fillStyle = color;
      ctx.globalAlpha = opacity;

      const isRevealed = (shape) =>
        elapsed >= (state.shapeTimings.get(shape.groupKey) ?? 0);

      if (state.mode === "reveal") {
        for (const shape of state.currentShapes) {
          if (isRevealed(shape)) shape.draw(ctx, state.scale);
        }
      } else {
        for (const shape of state.currentShapes) {
          if (!isRevealed(shape)) shape.draw(ctx, state.scale);
        }
        if (state.nextShapes) {
          for (const shape of state.nextShapes) {
            if (isRevealed(shape)) shape.draw(ctx, state.scale);
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
      ctx.translate(
        (canvas.width - patternPx) / 2,
        (canvas.height - patternPx) / 2
      );
      ctx.fillStyle = color;
      ctx.globalAlpha = opacity;
      for (const shape of state.currentShapes) shape.draw(ctx, state.scale);
      ctx.restore();
    }

    function commitPendingMorph() {
      if (state.mode === "morph" && state.nextShapes) {
        state.currentShapes = state.nextShapes;
        state.nextShapes = null;
      }
      state.mode = "reveal";
    }

    function startWave() {
      if (state.destroyed) return;
      onPulse?.();

      if (state.rafId !== null) {
        cancelAnimationFrame(state.rafId);
        state.rafId = null;
      }

      state.waveToken++;
      state.waveStartTime = performance.now();
      const myToken = state.waveToken;
      const shapesForTiming = state.nextShapes
        ? [...state.currentShapes, ...state.nextShapes]
        : state.currentShapes;
      regenerateTimings(shapesForTiming);

      const frameInterval = 1000 / FPS;
      const totalFrames = Math.max(2, Math.floor(waveDuration / frameInterval));
      let lastDrawnFrame = -1;

      function render(now) {
        if (state.destroyed || myToken !== state.waveToken) return;
        const elapsed = now - state.waveStartTime;
        const currentFrame = Math.floor(elapsed / frameInterval);
        if (currentFrame > lastDrawnFrame) {
          lastDrawnFrame = currentFrame;
          drawFrame(currentFrame * frameInterval);
        }
        if (lastDrawnFrame < totalFrames - 1) {
          state.rafId = requestAnimationFrame(render);
        } else {
          const wasInitialReveal = state.mode === "reveal" && !state.nextShapes;
          if (state.mode === "morph" && state.nextShapes) {
            state.currentShapes = state.nextShapes;
            state.nextShapes = null;
            state.mode = "reveal";
          }
          state.rafId = null;
          if (wasInitialReveal) emitIntroComplete();
        }
      }

      state.rafId = requestAnimationFrame(render);
    }

    function triggerReveal() {
      commitPendingMorph();
      state.mode = "reveal";
      startWave();
    }

    function triggerShift() {
      commitPendingMorph();
      let nextIdx;
      do {
        nextIdx = Math.floor(Math.random() * patterns.length);
      } while (nextIdx === state.currentPatternIdx);
      state.currentPatternIdx = nextIdx;
      state.nextShapes = patternToShapes(patterns[nextIdx]);
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

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            resize();
            if (
              state.rafId === null &&
              !state.intervalId &&
              window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ) {
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
        if (state.intervalId !== null) window.clearInterval(state.intervalId);
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
