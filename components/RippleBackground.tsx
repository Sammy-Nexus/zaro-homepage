"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * RippleBackground
 * ----------------
 * Animated canvas-based background pattern that ripples outward from center.
 *
 * Behavior:
 *  - On mount: canvas starts EMPTY. Ripple wave reveals shapes from center
 *    outward, settling on pattern index 0.
 *  - On click of any element with `data-ripple-trigger`: shifts to a random
 *    new pattern (1 of 8 pre-generated, 4-fold symmetric variants). Each
 *    pixel that's changing pops in/out as the wave passes it.
 *  - Wave runs at a low frame rate (default 12fps) for a stepped, pixely feel.
 *  - Per-shape timing noise adds organic variation while preserving 4-fold
 *    symmetry. Noise is bounded — noisy shapes finish before the wave ends,
 *    leaving a clean tail.
 *
 * Implementation notes:
 *  - Pure HTML <canvas>; no SVG, no animation libraries.
 *  - DPR-aware for sharp rendering on retina displays.
 *  - Race-safe: rapid clicks cancel in-flight animations cleanly.
 *  - Respects prefers-reduced-motion (no wave, just paints final state).
 *  - Idle when not animating — animation only runs during a wave.
 */

// --- Config -----------------------------------------------------------------

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
const DEFAULT_NOISE_ENDS_AT = 0.90;
const PATTERN_COUNT = 8;

// --- Easing helpers ---------------------------------------------------------

function inverseEaseOutCubic(y: number): number {
  return 1 - Math.cbrt(1 - y);
}

// --- Pattern generation -----------------------------------------------------

type ShapeType = "square" | "dot" | "circle";

interface Pattern {
  rects: Array<[number, number, number, number]>;
  dots: Array<[number, number]>;
  circles: Array<[number, number]>;
}

interface Shape {
  dist: number;
  groupKey: string;
  draw: (ctx: CanvasRenderingContext2D, scale: number) => void;
}

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function buildPattern(seed: number, maxRing = 10): Pattern {
  const rand = seededRandom(seed);
  const cells = new Map<string, ShapeType>();

  const setCell = (gx: number, gy: number, type: ShapeType) => {
    const key = `${gx},${gy}`;
    if (!cells.has(key)) cells.set(key, type);
  };
  const placeSymmetric = (gx: number, gy: number, type: ShapeType) => {
    setCell(gx, gy, type);
    setCell(-gx, gy, type);
    setCell(gx, -gy, type);
    setCell(-gx, -gy, type);
  };

  const pickType = (ring: number): ShapeType => {
    const r = rand();
    if (ring <= 2) {
      if (r < 0.55) return "dot";
      if (r < 0.90) return "square";
      return "circle";
    } else if (ring <= 5) {
      if (r < 0.65) return "square";
      if (r < 0.85) return "circle";
      return "dot";
    } else {
      if (r < 0.55) return "square";
      if (r < 0.90) return "circle";
      return "dot";
    }
  };

  for (let ring = 1; ring <= maxRing; ring++) {
    const density = ring <= 3 ? 0.55 + rand() * 0.25 : 0.30 + rand() * 0.35;
    for (let i = 0; i <= ring; i++) {
      if (rand() < density) placeSymmetric(i, ring, pickType(ring));
      if (i < ring && rand() < density) placeSymmetric(ring, i, pickType(ring));
    }
  }

  const rects: Pattern["rects"] = [];
  const dots: Pattern["dots"] = [];
  const circles: Pattern["circles"] = [];
  for (const [key, type] of cells) {
    const [gx, gy] = key.split(",").map(Number);
    const cx = SOURCE_CENTER + gx * GRID_STEP;
    const cy = SOURCE_CENTER + gy * GRID_STEP;
    if (type === "square") {
      rects.push([cx - SHAPE_SIZE / 2, cy - SHAPE_SIZE / 2, cx + SHAPE_SIZE / 2, cy + SHAPE_SIZE / 2]);
    } else if (type === "dot") {
      dots.push([cx, cy]);
    } else {
      circles.push([cx, cy]);
    }
  }
  return { rects, dots, circles };
}

const PATTERNS: Pattern[] = [];
const PATTERN_SEEDS = [1, 7, 23, 101, 404, 777, 1234, 9999];
for (let i = 0; i < PATTERN_COUNT; i++) {
  PATTERNS.push(buildPattern(PATTERN_SEEDS[i]));
}

function symmetricKey(cx: number, cy: number): string {
  const gx = Math.round((cx - SOURCE_CENTER) / GRID_STEP);
  const gy = Math.round((cy - SOURCE_CENTER) / GRID_STEP);
  return `${Math.abs(gx)},${Math.abs(gy)}`;
}

function patternToShapes(pattern: Pattern): Shape[] {
  const shapes: Shape[] = [];

  pattern.dots.forEach(([cx, cy]) => {
    shapes.push({
      dist: Math.hypot(cx - SOURCE_CENTER, cy - SOURCE_CENTER),
      groupKey: symmetricKey(cx, cy),
      draw: (ctx, scale) => {
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
      draw: (ctx, scale) => {
        ctx.fillRect(x1 * scale, y1 * scale, (x2 - x1) * scale, (y2 - y1) * scale);
      },
    });
  });

  pattern.circles.forEach(([cx, cy]) => {
    shapes.push({
      dist: Math.hypot(cx - SOURCE_CENTER, cy - SOURCE_CENTER),
      groupKey: symmetricKey(cx, cy),
      draw: (ctx, scale) => {
        ctx.beginPath();
        ctx.arc(cx * scale, cy * scale, CIRCLE_RADIUS * scale, 0, Math.PI * 2);
        ctx.fill();
      },
    });
  });

  return shapes;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// --- Component --------------------------------------------------------------

export interface RippleBackgroundProps {
  /** Hex color of shapes. Default '#C2BFAF'. */
  color?: string;
  /** Resting opacity for the pattern (0–1). Default 0.15. */
  opacity?: number;
  /** Animation frame rate. Lower = chunkier. Default 12. */
  fps?: number;
  /** Per-shape timing noise (0–1). Default 0.35. */
  noise?: number;
  /** Fraction of wave duration by which all noise must finish (0.5–1). Default 0.90. */
  noiseEndsAt?: number;
  /** Total wave duration in ms (center to corner). Default 900. */
  waveDuration?: number;
  /** Extra className for the wrapping div. */
  className?: string;
  /** Inline style overrides for the wrapping div. */
  style?: React.CSSProperties;
}

const RippleBackground = ({
  color = DEFAULT_COLOR,
  opacity = DEFAULT_OPACITY,
  fps = DEFAULT_FPS,
  noise = DEFAULT_NOISE,
  noiseEndsAt = DEFAULT_NOISE_ENDS_AT,
  waveDuration = WAVE_DURATION,
  className,
  style,
}: RippleBackgroundProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const stateRef = useRef({
    currentPatternIdx: 0,
    currentShapes: patternToShapes(PATTERNS[0]),
    nextShapes: null as Shape[] | null,
    waveStartTime: 0,
    mode: "reveal" as "reveal" | "morph",
    rafId: null as number | null,
    waveToken: 0,
    scale: 1,
    dpr: 1,
    shapeTimings: new Map<string, number>(), // groupKey -> ms reach time
  });

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const s = stateRef.current;
    s.dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * s.dpr;
    canvas.height = rect.height * s.dpr;
    const fitSize = Math.min(rect.width, rect.height);
    s.scale = (fitSize / SOURCE_SIZE) * s.dpr;
  }, []);

  const centerTransform = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const s = stateRef.current;
    const patternPixelSize = SOURCE_SIZE * s.scale;
    const offsetX = (canvas.width - patternPixelSize) / 2;
    const offsetY = (canvas.height - patternPixelSize) / 2;
    ctx.translate(offsetX, offsetY);
  }, []);

  // Compute per-shape reach times for the current wave: clean radial time
  // (in eased ms) + uniform millisecond jitter, snapped to frame index,
  // clamped to noiseEndsAt boundary.
  const regenerateTimings = useCallback(
    (shapes: Shape[]) => {
      const s = stateRef.current;
      s.shapeTimings = new Map();
      const frameInterval = 1000 / fps;
      const totalFrames = Math.max(2, Math.floor(waveDuration / frameInterval));
      const noiseEndFrame = Math.max(1, Math.round(noiseEndsAt * (totalFrames - 1)));
      const halfNoiseMs = (noise * waveDuration) / 2;

      const baseByKey = new Map<string, number>();
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
        s.shapeTimings.set(key, clamped * frameInterval);
      }
    },
    [fps, noise, noiseEndsAt, waveDuration]
  );

  const drawFrame = useCallback(
    (elapsed: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const s = stateRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      centerTransform(ctx, canvas);
      ctx.fillStyle = color;
      ctx.globalAlpha = opacity;

      const isRevealed = (shape: Shape) => {
        const reachTime = s.shapeTimings.get(shape.groupKey) ?? 0;
        return elapsed >= reachTime;
      };

      if (s.mode === "reveal") {
        for (const shape of s.currentShapes) {
          if (isRevealed(shape)) shape.draw(ctx, s.scale);
        }
      } else {
        for (const shape of s.currentShapes) {
          if (!isRevealed(shape)) shape.draw(ctx, s.scale);
        }
        if (s.nextShapes) {
          for (const shape of s.nextShapes) {
            if (isRevealed(shape)) shape.draw(ctx, s.scale);
          }
        }
      }
      ctx.restore();
    },
    [color, opacity, centerTransform]
  );

  const paintStatic = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    centerTransform(ctx, canvas);
    ctx.fillStyle = color;
    ctx.globalAlpha = opacity;
    for (const shape of s.currentShapes) shape.draw(ctx, s.scale);
    ctx.restore();
  }, [color, opacity, centerTransform]);

  const commitPendingMorph = useCallback(() => {
    const s = stateRef.current;
    if (s.mode === "morph" && s.nextShapes) {
      s.currentShapes = s.nextShapes;
      s.nextShapes = null;
    }
    s.mode = "reveal";
  }, []);

  const startWave = useCallback(() => {
    const s = stateRef.current;
    if (s.rafId !== null) {
      cancelAnimationFrame(s.rafId);
      s.rafId = null;
    }
    s.waveToken++;
    s.waveStartTime = performance.now();
    const myToken = s.waveToken;
    const shapesForTiming = s.nextShapes ? [...s.currentShapes, ...s.nextShapes] : s.currentShapes;
    regenerateTimings(shapesForTiming);

    const frameInterval = 1000 / fps;
    const totalFrames = Math.max(2, Math.floor(waveDuration / frameInterval));

    let lastDrawnFrame = -1;
    const render = (now: number) => {
      if (myToken !== s.waveToken) return;
      const elapsed = now - s.waveStartTime;
      const currentFrame = Math.floor(elapsed / frameInterval);
      if (currentFrame > lastDrawnFrame) {
        lastDrawnFrame = currentFrame;
        drawFrame(currentFrame * frameInterval);
      }
      if (lastDrawnFrame < totalFrames - 1) {
        s.rafId = requestAnimationFrame(render);
      } else {
        if (s.mode === "morph" && s.nextShapes) {
          s.currentShapes = s.nextShapes;
          s.nextShapes = null;
          s.mode = "reveal";
        }
        s.rafId = null;
      }
    };
    s.rafId = requestAnimationFrame(render);
  }, [fps, waveDuration, regenerateTimings, drawFrame]);

  const reveal = useCallback(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      commitPendingMorph();
      paintStatic();
      return;
    }
    commitPendingMorph();
    stateRef.current.mode = "reveal";
    startWave();
  }, [commitPendingMorph, paintStatic, startWave]);

  const shift = useCallback(() => {
    const s = stateRef.current;
    let nextIdx: number;
    do {
      nextIdx = Math.floor(Math.random() * PATTERNS.length);
    } while (nextIdx === s.currentPatternIdx);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      s.currentPatternIdx = nextIdx;
      s.currentShapes = patternToShapes(PATTERNS[nextIdx]);
      paintStatic();
      return;
    }

    commitPendingMorph();
    s.currentPatternIdx = nextIdx;
    s.nextShapes = patternToShapes(PATTERNS[nextIdx]);
    s.mode = "morph";
    startWave();
  }, [commitPendingMorph, paintStatic, startWave]);

  // Mount: size + fire initial reveal from empty canvas
  useEffect(() => {
    resize();
    const id = requestAnimationFrame(() => reveal());

    const onResize = () => {
      resize();
      if (stateRef.current.rafId === null) paintStatic();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", onResize);
      if (stateRef.current.rafId !== null) {
        cancelAnimationFrame(stateRef.current.rafId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Delegated click listener: any [data-ripple-trigger] click → shift
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-ripple-trigger]")) shift();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [shift]);

  return (
    <div
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        ...style,
      }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
        }}
      />
    </div>
  );
};

export default RippleBackground;
