/**
 * Vanilla port of RippleBackground.tsx (filesv2) for the static prototype.
 */
(function () {
  const SOURCE_SIZE = 609;
  const SOURCE_CENTER = SOURCE_SIZE / 2;
  const MAX_DIST = Math.hypot(SOURCE_CENTER, SOURCE_CENTER);
  const SHAPE_SIZE = 21.107;
  const CIRCLE_RADIUS = 5.277;
  const GRID_STEP = 29.363;
  const DOT_SIZE = 10.5;
  const DOT_RADIUS = 5;
  const WAVE_DURATION = 900;
  const DEFAULT_COLOR = "#C2BFAF";
  const DEFAULT_OPACITY = 0.15;
  const DEFAULT_FPS = 12;
  const DEFAULT_NOISE = 0.35;
  const DEFAULT_NOISE_ENDS_AT = 0.9;
  const DISPLAY_SCALE = 0.45;
  const PATTERN_COUNT = 8;
  const PATTERN_SEEDS = [1, 7, 23, 101, 404, 777, 1234, 9999];

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

  function buildPattern(seed, maxRing = 10) {
    const rand = seededRandom(seed);
    const cells = new Map();

    const setCell = (gx, gy, type) => {
      const key = `${gx},${gy}`;
      if (!cells.has(key)) cells.set(key, type);
    };
    const placeSymmetric = (gx, gy, type) => {
      setCell(gx, gy, type);
      setCell(-gx, gy, type);
      setCell(gx, -gy, type);
      setCell(-gx, -gy, type);
    };

    const pickType = (ring) => {
      const r = rand();
      if (ring <= 2) {
        if (r < 0.55) return "dot";
        if (r < 0.9) return "square";
        return "circle";
      }
      if (ring <= 5) {
        if (r < 0.65) return "square";
        if (r < 0.85) return "circle";
        return "dot";
      }
      if (r < 0.55) return "square";
      if (r < 0.9) return "circle";
      return "dot";
    };

    for (let ring = 1; ring <= maxRing; ring++) {
      const density = ring <= 3 ? 0.55 + rand() * 0.25 : 0.3 + rand() * 0.35;
      for (let i = 0; i <= ring; i++) {
        if (rand() < density) placeSymmetric(i, ring, pickType(ring));
        if (i < ring && rand() < density) placeSymmetric(ring, i, pickType(ring));
      }
    }

    const rects = [];
    const dots = [];
    const circles = [];
    for (const [key, type] of cells) {
      const [gx, gy] = key.split(",").map(Number);
      const cx = SOURCE_CENTER + gx * GRID_STEP;
      const cy = SOURCE_CENTER + gy * GRID_STEP;
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

  const PATTERNS = PATTERN_SEEDS.map((seed) => buildPattern(seed));

  function symmetricKey(cx, cy) {
    const gx = Math.round((cx - SOURCE_CENTER) / GRID_STEP);
    const gy = Math.round((cy - SOURCE_CENTER) / GRID_STEP);
    return `${Math.abs(gx)},${Math.abs(gy)}`;
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
          ctx.fillRect(
            x1 * scale,
            y1 * scale,
            (x2 - x1) * scale,
            (y2 - y1) * scale
          );
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

  function createRippleBackground(container, options = {}) {
    const color = options.color ?? DEFAULT_COLOR;
    const opacity = options.opacity ?? DEFAULT_OPACITY;
    const fps = options.fps ?? DEFAULT_FPS;
    const noise = options.noise ?? DEFAULT_NOISE;
    const noiseEndsAt = options.noiseEndsAt ?? DEFAULT_NOISE_ENDS_AT;
    const waveDuration = options.waveDuration ?? WAVE_DURATION;

    const canvas = document.createElement("canvas");
    canvas.className = "ripple-background__canvas";
    container.appendChild(canvas);

    const state = {
      currentPatternIdx: 0,
      currentShapes: patternToShapes(PATTERNS[0]),
      nextShapes: null,
      waveStartTime: 0,
      mode: "reveal",
      rafId: null,
      waveToken: 0,
      scale: 1,
      dpr: 1,
      shapeTimings: new Map(),
    };

    const waveEndListeners = new Set();

    function notifyWaveEnd() {
      for (const listener of waveEndListeners) {
        listener();
      }
      waveEndListeners.clear();
    }

    function onWaveEnd(listener) {
      waveEndListeners.add(listener);
      return () => waveEndListeners.delete(listener);
    }

    function resize() {
      const rect = container.getBoundingClientRect();
      state.dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * state.dpr;
      canvas.height = rect.height * state.dpr;
      const fitSize = Math.min(rect.width, rect.height);
      state.scale = (fitSize / SOURCE_SIZE) * state.dpr * DISPLAY_SCALE;
    }

    function centerTransform(ctx) {
      const patternPixelSize = SOURCE_SIZE * state.scale;
      const offsetX = (canvas.width - patternPixelSize) / 2;
      const offsetY = (canvas.height - patternPixelSize) / 2;
      ctx.translate(offsetX, offsetY);
    }

    function regenerateTimings(shapes) {
      state.shapeTimings = new Map();
      const frameInterval = 1000 / fps;
      const totalFrames = Math.max(2, Math.floor(waveDuration / frameInterval));
      const noiseEndFrame = Math.max(1, Math.round(noiseEndsAt * (totalFrames - 1)));
      const halfNoiseMs = (noise * waveDuration) / 2;
      const baseByKey = new Map();

      for (const shape of shapes) {
        if (!baseByKey.has(shape.groupKey)) {
          const normRadius = shape.dist / MAX_DIST;
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
      centerTransform(ctx);
      ctx.fillStyle = color;
      ctx.globalAlpha = opacity;

      const isRevealed = (shape) => {
        const reachTime = state.shapeTimings.get(shape.groupKey) ?? 0;
        return elapsed >= reachTime;
      };

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
      centerTransform(ctx);
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
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (state.rafId !== null) {
        cancelAnimationFrame(state.rafId);
        state.rafId = null;
      }
      waveEndListeners.clear();
      state.waveToken++;
      state.waveStartTime = performance.now();
      const myToken = state.waveToken;

      const shapesForTiming = state.nextShapes
        ? [...state.currentShapes, ...state.nextShapes]
        : state.currentShapes;
      regenerateTimings(shapesForTiming);

      const frameInterval = 1000 / fps;
      const totalFrames = Math.max(2, Math.floor(waveDuration / frameInterval));
      let lastDrawnFrame = -1;

      function render(now) {
        if (myToken !== state.waveToken) return;
        const elapsed = now - state.waveStartTime;
        const currentFrame = Math.floor(elapsed / frameInterval);

        if (currentFrame > lastDrawnFrame) {
          lastDrawnFrame = currentFrame;
          drawFrame(currentFrame * frameInterval);
        }

        if (lastDrawnFrame < totalFrames - 1) {
          state.rafId = requestAnimationFrame(render);
        } else {
          if (state.mode === "morph" && state.nextShapes) {
            state.currentShapes = state.nextShapes;
            state.nextShapes = null;
            state.mode = "reveal";
          }
          state.rafId = null;
          notifyWaveEnd();
        }
      }

      state.rafId = requestAnimationFrame(render);
    }

    function reveal() {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        commitPendingMorph();
        paintStatic();
        return;
      }
      commitPendingMorph();
      state.mode = "reveal";
      startWave();
    }

    function shift() {
      let nextIdx;
      do {
        nextIdx = Math.floor(Math.random() * PATTERNS.length);
      } while (nextIdx === state.currentPatternIdx);

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        state.currentPatternIdx = nextIdx;
        state.currentShapes = patternToShapes(PATTERNS[nextIdx]);
        paintStatic();
        notifyWaveEnd();
        return;
      }

      commitPendingMorph();
      state.currentPatternIdx = nextIdx;
      state.nextShapes = patternToShapes(PATTERNS[nextIdx]);
      state.mode = "morph";
      startWave();
    }

    resize();
    requestAnimationFrame(reveal);

    const onResize = () => {
      resize();
      if (state.rafId === null) paintStatic();
    };
    window.addEventListener("resize", onResize);

    const onClick = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("[data-ripple-trigger]")) shift();
    };
    document.addEventListener("click", onClick);

    return {
      reveal,
      shift,
      onWaveEnd,
      waveDuration,
      destroy() {
        window.removeEventListener("resize", onResize);
        document.removeEventListener("click", onClick);
        if (state.rafId !== null) cancelAnimationFrame(state.rafId);
        canvas.remove();
      },
    };
  }

  const container = document.querySelector(".main__pattern-wrap");
  if (!container) return;

  window.RippleBackground = createRippleBackground(container);
})();
