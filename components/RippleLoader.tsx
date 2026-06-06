"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * RippleLoader
 * ------------
 * Compact 9x9 animated loader using the same ripple aesthetic as RippleBackground.
 *
 * Behavior:
 *  - Renders a 9x9 grid of small shapes (squares, dots, circles) with 8-way
 *    radial symmetry (mirrored across both axes AND both diagonals), so the
 *    silhouette always reads as visually square — never oblong.
 *  - The 4 extreme corner cells are always empty, giving the overall shape a
 *    softer rounded character so it never reads as a hard square.
 *  - The cardinal-adjacent cells beside each corner (up/down/left/right, not
 *    diagonals) are also kept empty.
 *  - Every ring always has at least one shape — no completely empty rings.
 *  - On mount: empty canvas, then a ripple wave reveals the first pattern.
 *  - Every `interval` ms (default 1000), shifts to a new random pattern with
 *    the same ripple-morph effect. 12 patterns in the pool.
 *  - 12 fps stepped wave with 35% timing noise (noise settled by 90% of wave).
 *
 * Implementation notes:
 *  - Pure HTML <canvas>; no SVG, no animation libraries.
 *  - DPR-aware for sharp rendering on retina.
 *  - Self-contained; animation pauses cleanly on unmount.
 *  - Respects prefers-reduced-motion (paints a static pattern instead).
 */

// --- Config -----------------------------------------------------------------

const GRID_SIZE = 9;
const CELL_SIZE = 10;
const SOURCE_SIZE = GRID_SIZE * CELL_SIZE;       // 90
const SOURCE_CENTER = SOURCE_SIZE / 2;
const MAX_CELL_RING = Math.floor(GRID_SIZE / 2); // 4 for 9x9
const CORNER_RING = MAX_CELL_RING;
// Diagonal distance from center to the furthest non-corner cell
const MAX_DIST = Math.hypot(MAX_CELL_RING * CELL_SIZE, (MAX_CELL_RING - 1) * CELL_SIZE);

const SHAPE_SIZE = 7;
const DOT_SIZE = 4;
const DOT_RADIUS = 2;
const CIRCLE_RADIUS = 2;

const DEFAULT_COLOR = "#C2BFAF";
const DEFAULT_OPACITY = 0.45;
const DEFAULT_WAVE_DURATION = 700;
const DEFAULT_INTERVAL = 1000;
const FPS = 12;
const NOISE = 0.35;
const NOISE_ENDS_AT = 0.90;
const PATTERN_COUNT = 12;

// --- Helpers ----------------------------------------------------------------

function inverseEaseOutCubic(y: number): number {
  return 1 - Math.cbrt(1 - y);
}

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// --- Pattern generation (8-way symmetric) -----------------------------------

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

function isBlockedCell(gx: number, gy: number): boolean {
  const ax = Math.abs(gx);
  const ay = Math.abs(gy);
  if (ax === CORNER_RING && ay === CORNER_RING) return true;
  if (ax === CORNER_RING && ay === CORNER_RING - 1) return true;
  if (ax === CORNER_RING - 1 && ay === CORNER_RING) return true;
  return false;
}

function ringOf(gx: number, gy: number): number {
  return Math.max(Math.abs(gx), Math.abs(gy));
}

function buildPattern(seed: number): Pattern {
  const rand = seededRandom(seed);
  const cells = new Map<string, ShapeType>();

  const setCell = (gx: number, gy: number, type: ShapeType) => {
    if (isBlockedCell(gx, gy)) return;
    const key = `${gx},${gy}`;
    if (!cells.has(key)) cells.set(key, type);
  };

  const placeSymmetric = (gx: number, gy: number, type: ShapeType) => {
    setCell(gx, gy, type);
    setCell(-gx, gy, type);
    setCell(gx, -gy, type);
    setCell(-gx, -gy, type);
    setCell(gy, gx, type);
    setCell(-gy, gx, type);
    setCell(gy, -gx, type);
    setCell(-gy, -gx, type);
  };

  const ringHasCell = (ring: number) => {
    for (const key of cells.keys()) {
      const [gx, gy] = key.split(",").map(Number);
      if (ringOf(gx, gy) === ring) return true;
    }
    return false;
  };

  const pickType = (ring: number): ShapeType => {
    const r = rand();
    if (ring <= 1) {
      if (r < 0.55) return "dot";
      if (r < 0.80) return "circle";
      return "square";
    } else if (ring === 2) {
      if (r < 0.55) return "square";
      if (r < 0.80) return "dot";
      return "circle";
    } else {
      if (r < 0.70) return "square";
      if (r < 0.90) return "circle";
      return "dot";
    }
  };

  setCell(0, 0, pickType(0));

  for (let ring = 1; ring <= MAX_CELL_RING; ring++) {
    const density = ring === MAX_CELL_RING
      ? 0.40 + rand() * 0.25
      : 0.65 + rand() * 0.20;
    for (let gy = 0; gy <= ring; gy++) {
      if (isBlockedCell(ring, gy)) continue;
      if (rand() < density) {
        placeSymmetric(ring, gy, pickType(ring));
      }
    }
  }

  for (let ring = 0; ring <= MAX_CELL_RING; ring++) {
    if (ringHasCell(ring)) continue;
    const candidates: Array<[number, number]> = [];
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

  const rects: Pattern["rects"] = [];
  const dots: Pattern["dots"] = [];
  const circles: Pattern["circles"] = [];
  for (const [key, type] of cells) {
    const [gx, gy] = key.split(",").map(Number);
    const cx = SOURCE_CENTER + gx * CELL_SIZE;
    const cy = SOURCE_CENTER + gy * CELL_SIZE;
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
for (let i = 0; i < PATTERN_COUNT; i++) {
  PATTERNS.push(buildPattern(i * 1337 + 42));
}

function symmetricKey(cx: number, cy: number): string {
  const gx = Math.round((cx - SOURCE_CENTER) / CELL_SIZE);
  const gy = Math.round((cy - SOURCE_CENTER) / CELL_SIZE);
  const ax = Math.abs(gx);
  const ay = Math.abs(gy);
  return `${Math.min(ax, ay)},${Math.max(ax, ay)}`;
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
        roundRect(ctx, x1 * scale, y1 * scale, (x2 - x1) * scale, (y2 - y1) * scale, 1.2 * scale);
        ctx.fill();
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

export interface RippleLoaderProps {
  /** Rendered size in px (loader is always square). Default 80. */
  size?: number;
  /** Hex color of shapes. Default '#C2BFAF'. */
  color?: string;
  /** Resting opacity (0–1). Default 0.45. */
  opacity?: number;
  /** ms between pattern shifts. Default 1000. */
  interval?: number;
  /** Ripple duration in ms. Should be ≤ interval. Default 700. */
  waveDuration?: number;
  /** Extra className for the wrapping div. */
  className?: string;
  /** Inline style overrides for the wrapping div. */
  style?: React.CSSProperties;
}

const RippleLoader = ({
  size = 80,
  color = DEFAULT_COLOR,
  opacity = DEFAULT_OPACITY,
  interval = DEFAULT_INTERVAL,
  waveDuration = DEFAULT_WAVE_DURATION,
  className,
  style,
}: RippleLoaderProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const stateRef = useRef({
    currentPatternIdx: 0,
    currentShapes: patternToShapes(PATTERNS[0]),
    nextShapes: null as Shape[] | null,
    waveStartTime: 0,
    mode: "reveal" as "reveal" | "morph",
    rafId: null as number | null,
    waveToken: 0,
    intervalId: null as ReturnType<typeof setInterval> | null,
    scale: 1,
    dpr: 1,
    shapeTimings: new Map<string, number>(),
  });

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const s = stateRef.current;
    s.dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * s.dpr;
    canvas.height = rect.height * s.dpr;
    const fit = Math.min(rect.width, rect.height);
    s.scale = (fit / SOURCE_SIZE) * s.dpr;
  }, []);

  const regenerateTimings = useCallback(
    (shapes: Shape[]) => {
      const s = stateRef.current;
      s.shapeTimings = new Map();
      const frameInterval = 1000 / FPS;
      const totalFrames = Math.max(2, Math.floor(waveDuration / frameInterval));
      const noiseEndFrame = Math.max(1, Math.round(NOISE_ENDS_AT * (totalFrames - 1)));
      const halfNoiseMs = (NOISE * waveDuration) / 2;

      const baseByKey = new Map<string, number>();
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
        s.shapeTimings.set(key, clamped * frameInterval);
      }
    },
    [waveDuration]
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
      const patternPx = SOURCE_SIZE * s.scale;
      ctx.translate((canvas.width - patternPx) / 2, (canvas.height - patternPx) / 2);
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
    [color, opacity]
  );

  const paintStatic = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    const patternPx = SOURCE_SIZE * s.scale;
    ctx.translate((canvas.width - patternPx) / 2, (canvas.height - patternPx) / 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = opacity;
    for (const shape of s.currentShapes) shape.draw(ctx, s.scale);
    ctx.restore();
  }, [color, opacity]);

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

    const frameInterval = 1000 / FPS;
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
  }, [waveDuration, regenerateTimings, drawFrame]);

  const triggerReveal = useCallback(() => {
    commitPendingMorph();
    stateRef.current.mode = "reveal";
    startWave();
  }, [commitPendingMorph, startWave]);

  const triggerShift = useCallback(() => {
    const s = stateRef.current;
    commitPendingMorph();
    let nextIdx: number;
    do {
      nextIdx = Math.floor(Math.random() * PATTERNS.length);
    } while (nextIdx === s.currentPatternIdx);
    s.currentPatternIdx = nextIdx;
    s.nextShapes = patternToShapes(PATTERNS[nextIdx]);
    s.mode = "morph";
    startWave();
  }, [commitPendingMorph, startWave]);

  useEffect(() => {
    resize();
    const s = stateRef.current;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      paintStatic();
      return () => {};
    }

    const rafId = requestAnimationFrame(() => triggerReveal());
    s.intervalId = setInterval(() => triggerShift(), interval);

    return () => {
      cancelAnimationFrame(rafId);
      if (s.intervalId) clearInterval(s.intervalId);
      if (s.rafId !== null) cancelAnimationFrame(s.rafId);
      s.intervalId = null;
      s.rafId = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interval]);

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        display: "inline-block",
        ...style,
      }}
      role="status"
      aria-label="Loading"
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </div>
  );
};

export default RippleLoader;
