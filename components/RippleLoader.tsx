"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * RippleLoader
 * ------------
 * Compact 9x9 animated loader using the same ripple aesthetic as RippleBackground.
 *
 * Behavior:
 *  - Renders a 9x9 grid of small shapes (squares, dots, circles) with 8-way
 *    radial symmetry (mirrored across both axes AND both diagonals).
 *  - On mount: empty canvas, then a ripple wave reveals the first pattern.
 *  - Every `interval` ms, mutates to a new pattern with a center-out wave.
 *    Each pulse changes at least one cell in every grid row and column.
 *  - Unchanged cells stay put during morph — only diffs animate with the wave.
 *  - 12 fps stepped wave; rings fire in even linear order from center outward.
 */

const GRID_SIZE = 9;
const CELL_SIZE = 10;
const SOURCE_SIZE = GRID_SIZE * CELL_SIZE;
const SOURCE_CENTER = SOURCE_SIZE / 2;
const MAX_CELL_RING = Math.floor(GRID_SIZE / 2);
const CORNER_RING = MAX_CELL_RING;

const SHAPE_SIZE = 7;
const DOT_SIZE = 4;
const DOT_RADIUS = 2;
const CIRCLE_RADIUS = 2;

const DEFAULT_COLOR = "#C2BFAF";
const DEFAULT_OPACITY = 0.45;
const DEFAULT_WAVE_DURATION = 700;
const DEFAULT_INTERVAL = 1000;
const PATTERN_COUNT = 12;

type ShapeType = "square" | "dot" | "circle";
type CellMap = Map<string, ShapeType>;
type RandFn = () => number;

interface Shape {
  ring: number;
  groupKey: string;
  draw: (ctx: CanvasRenderingContext2D, scale: number) => void;
}

function seededRandom(seed: number): RandFn {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
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

function symmetricKeyFromGrid(gx: number, gy: number): string {
  const ax = Math.abs(gx);
  const ay = Math.abs(gy);
  return `${Math.min(ax, ay)},${Math.max(ax, ay)}`;
}

function symmetricPositions(gx: number, gy: number): Array<[number, number]> {
  return [
    [gx, gy],
    [-gx, gy],
    [gx, -gy],
    [-gx, -gy],
    [gy, gx],
    [-gy, gx],
    [gy, -gx],
    [-gy, -gx],
  ];
}

function getCell(cells: CellMap, gx: number, gy: number): ShapeType | null {
  return cells.get(`${gx},${gy}`) ?? null;
}

function cloneCells(cells: CellMap): CellMap {
  return new Map(cells);
}

function setCellSymmetric(cells: CellMap, gx: number, gy: number, type: ShapeType) {
  for (const [sx, sy] of symmetricPositions(gx, gy)) {
    if (isBlockedCell(sx, sy)) continue;
    cells.set(`${sx},${sy}`, type);
  }
}

function removeCellSymmetric(cells: CellMap, gx: number, gy: number) {
  for (const [sx, sy] of symmetricPositions(gx, gy)) {
    cells.delete(`${sx},${sy}`);
  }
}

function pickType(ring: number, rand: RandFn): ShapeType {
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

function alternateType(currentType: ShapeType | null, ring: number, rand: RandFn): ShapeType {
  const types: ShapeType[] = ["square", "dot", "circle"];
  let next = pickType(ring, rand);
  if (currentType) {
    while (next === currentType) {
      next = types[Math.floor(rand() * types.length)];
    }
  }
  return next;
}

function ringHasCell(cells: CellMap, ring: number): boolean {
  for (const key of cells.keys()) {
    const [gx, gy] = key.split(",").map(Number);
    if (ringOf(gx, gy) === ring) return true;
  }
  return false;
}

function ensureEveryRing(cells: CellMap, rand: RandFn) {
  for (let ring = 0; ring <= MAX_CELL_RING; ring++) {
    if (ringHasCell(cells, ring)) continue;
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
    setCellSymmetric(cells, pick[0], pick[1], pickType(ring, rand));
  }
}

function buildPattern(seed: number): CellMap {
  const rand = seededRandom(seed);
  const cells: CellMap = new Map();

  setCellSymmetric(cells, 0, 0, pickType(0, rand));

  for (let ring = 1; ring <= MAX_CELL_RING; ring++) {
    const density =
      ring === MAX_CELL_RING ? 0.4 + rand() * 0.25 : 0.65 + rand() * 0.2;
    for (let gy = 0; gy <= ring; gy++) {
      if (isBlockedCell(ring, gy)) continue;
      if (rand() < density) {
        setCellSymmetric(cells, ring, gy, pickType(ring, rand));
      }
    }
  }

  ensureEveryRing(cells, rand);
  ensureSparseBlanks(cells, rand);
  return cells;
}

function rowHasChange(before: CellMap, after: CellMap, gy: number): boolean {
  for (let gx = -MAX_CELL_RING; gx <= MAX_CELL_RING; gx++) {
    if (isBlockedCell(gx, gy)) continue;
    if (getCell(before, gx, gy) !== getCell(after, gx, gy)) return true;
  }
  return false;
}

function colHasChange(before: CellMap, after: CellMap, gx: number): boolean {
  for (let gy = -MAX_CELL_RING; gy <= MAX_CELL_RING; gy++) {
    if (isBlockedCell(gx, gy)) continue;
    if (getCell(before, gx, gy) !== getCell(after, gx, gy)) return true;
  }
  return false;
}

function canClearGroup(cells: CellMap, gx: number, gy: number): boolean {
  if (!getCell(cells, gx, gy)) return false;
  const temp = cloneCells(cells);
  removeCellSymmetric(temp, gx, gy);
  return ringHasCell(temp, ringOf(gx, gy));
}

function countBlankGroups(cells: CellMap): number {
  return getOctantRepresentatives().filter(([gx, gy]) => !getCell(cells, gx, gy)).length;
}

function mutateCellAt(cells: CellMap, gx: number, gy: number, rand: RandFn) {
  const ring = ringOf(gx, gy);
  const currentType = getCell(cells, gx, gy);
  if (!currentType) {
    setCellSymmetric(cells, gx, gy, pickType(ring, rand));
    return;
  }
  if (rand() < 0.3 && canClearGroup(cells, gx, gy)) {
    removeCellSymmetric(cells, gx, gy);
    return;
  }
  setCellSymmetric(cells, gx, gy, alternateType(currentType, ring, rand));
}

function ensureSparseBlanks(cells: CellMap, rand: RandFn) {
  const reps = getOctantRepresentatives();
  const minBlanks = Math.max(2, Math.ceil(reps.length * 0.12));
  let blankCount = countBlankGroups(cells);

  while (blankCount < minBlanks) {
    const clearable = reps.filter(
      ([gx, gy]) => getCell(cells, gx, gy) && canClearGroup(cells, gx, gy)
    );
    if (clearable.length === 0) break;
    const pick = clearable[Math.floor(rand() * clearable.length)];
    removeCellSymmetric(cells, pick[0], pick[1]);
    blankCount = countBlankGroups(cells);
  }
}

function forceGroupDiffFromBefore(
  before: CellMap,
  cells: CellMap,
  gx: number,
  gy: number,
  rand: RandFn
): boolean {
  if (groupDiffers(before, cells, gx, gy)) return true;

  const ring = ringOf(gx, gy);
  const was = getCell(before, gx, gy);

  if (was) {
    if (getCell(cells, gx, gy) && canClearGroup(cells, gx, gy) && rand() < 0.35) {
      removeCellSymmetric(cells, gx, gy);
    } else {
      const types: ShapeType[] = ["square", "dot", "circle"].filter((t) => t !== was);
      setCellSymmetric(cells, gx, gy, types[Math.floor(rand() * types.length)]);
    }
  } else {
    setCellSymmetric(cells, gx, gy, pickType(ring, rand));
  }

  return groupDiffers(before, cells, gx, gy);
}

function getOctantRepresentatives(): Array<[number, number]> {
  const reps: Array<[number, number]> = [];
  const seen = new Set<string>();
  for (let gy = 0; gy <= MAX_CELL_RING; gy++) {
    for (let gx = gy; gx <= MAX_CELL_RING; gx++) {
      if (isBlockedCell(gx, gy)) continue;
      const groupKey = symmetricKeyFromGrid(gx, gy);
      if (seen.has(groupKey)) continue;
      seen.add(groupKey);
      reps.push([gx, gy]);
    }
  }
  return reps;
}

function shuffleArray<T>(arr: T[], rand: RandFn): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function groupDiffers(before: CellMap, after: CellMap, gx: number, gy: number): boolean {
  const groupKey = symmetricKeyFromGrid(gx, gy);
  for (let y = -MAX_CELL_RING; y <= MAX_CELL_RING; y++) {
    for (let x = -MAX_CELL_RING; x <= MAX_CELL_RING; x++) {
      if (isBlockedCell(x, y)) continue;
      if (symmetricKeyFromGrid(x, y) !== groupKey) continue;
      if (getCell(before, x, y) !== getCell(after, x, y)) return true;
    }
  }
  return false;
}

function ringHasGroupChange(before: CellMap, after: CellMap, ring: number): boolean {
  for (const [gx, gy] of getOctantRepresentatives()) {
    if (ringOf(gx, gy) !== ring) continue;
    if (groupDiffers(before, after, gx, gy)) return true;
  }
  return false;
}

function ensureRingChanges(before: CellMap, cells: CellMap, rand: RandFn) {
  for (let ring = 0; ring <= MAX_CELL_RING; ring++) {
    if (ringHasGroupChange(before, cells, ring)) continue;
    const candidates = getOctantRepresentatives().filter(
      ([gx, gy]) => ringOf(gx, gy) === ring
    );
    if (candidates.length === 0) continue;
    const pick = candidates[Math.floor(rand() * candidates.length)];
    forceGroupDiffFromBefore(before, cells, pick[0], pick[1], rand);
  }
}

function pickCellInRow(gy: number, rand: RandFn): [number, number] {
  const rowCells: Array<[number, number]> = [];
  for (let gx = -MAX_CELL_RING; gx <= MAX_CELL_RING; gx++) {
    if (!isBlockedCell(gx, gy)) rowCells.push([gx, gy]);
  }
  rowCells.sort((a, b) => ringOf(a[0], a[1]) - ringOf(b[0], b[1]));
  const inner = rowCells.slice(0, Math.max(1, Math.ceil(rowCells.length * 0.6)));
  return inner[Math.floor(rand() * inner.length)];
}

function pickCellInCol(gx: number, rand: RandFn): [number, number] {
  const colCells: Array<[number, number]> = [];
  for (let gy = -MAX_CELL_RING; gy <= MAX_CELL_RING; gy++) {
    if (!isBlockedCell(gx, gy)) colCells.push([gx, gy]);
  }
  colCells.sort((a, b) => ringOf(a[0], a[1]) - ringOf(b[0], b[1]));
  const inner = colCells.slice(0, Math.max(1, Math.ceil(colCells.length * 0.6)));
  return inner[Math.floor(rand() * inner.length)];
}

function ensureRowColumnChanges(before: CellMap, cells: CellMap, rand: RandFn) {
  for (let gy = -MAX_CELL_RING; gy <= MAX_CELL_RING; gy++) {
    if (rowHasChange(before, cells, gy)) continue;
    const pick = pickCellInRow(gy, rand);
    forceGroupDiffFromBefore(before, cells, pick[0], pick[1], rand);
  }

  for (let gx = -MAX_CELL_RING; gx <= MAX_CELL_RING; gx++) {
    if (colHasChange(before, cells, gx)) continue;
    const pick = pickCellInCol(gx, rand);
    forceGroupDiffFromBefore(before, cells, pick[0], pick[1], rand);
  }
}

function mutatePattern(fromCells: CellMap, randFn: RandFn = Math.random): CellMap {
  const before = cloneCells(fromCells);
  const cells = cloneCells(fromCells);
  const reps = getOctantRepresentatives();
  const shuffled = shuffleArray(reps, randFn);
  const targetFlips = Math.max(
    Math.ceil(reps.length * 0.5),
    MAX_CELL_RING + 1
  );

  for (let i = 0; i < shuffled.length && i < targetFlips; i++) {
    mutateCellAt(cells, shuffled[i][0], shuffled[i][1], randFn);
  }

  ensureRingChanges(before, cells, randFn);
  ensureRowColumnChanges(before, cells, randFn);
  ensureEveryRing(cells, randFn);
  ensureSparseBlanks(cells, randFn);
  ensurePulseChange(before, cells, randFn);
  return cells;
}

function computeChangingKeys(before: CellMap, after: CellMap): Set<string> {
  const changing = new Set<string>();
  const groupKeys = new Set<string>();

  for (const key of before.keys()) {
    const [gx, gy] = key.split(",").map(Number);
    groupKeys.add(symmetricKeyFromGrid(gx, gy));
  }
  for (const key of after.keys()) {
    const [gx, gy] = key.split(",").map(Number);
    groupKeys.add(symmetricKeyFromGrid(gx, gy));
  }

  for (const groupKey of groupKeys) {
    let differs = false;
    for (let gy = -MAX_CELL_RING; gy <= MAX_CELL_RING && !differs; gy++) {
      for (let gx = -MAX_CELL_RING; gx <= MAX_CELL_RING; gx++) {
        if (isBlockedCell(gx, gy)) continue;
        if (symmetricKeyFromGrid(gx, gy) !== groupKey) continue;
        if (getCell(before, gx, gy) !== getCell(after, gx, gy)) {
          differs = true;
          break;
        }
      }
    }
    if (differs) changing.add(groupKey);
  }

  return changing;
}

function ensurePulseChange(before: CellMap, cells: CellMap, rand: RandFn) {
  if (computeChangingKeys(before, cells).size > 0) return;

  const reps = shuffleArray(getOctantRepresentatives(), rand);
  for (const [gx, gy] of reps) {
    if (forceGroupDiffFromBefore(before, cells, gx, gy, rand)) return;
  }

  if (reps.length === 0) return;
  const [gx, gy] = reps[0];
  const was = getCell(before, gx, gy);
  if (was) {
    const types: ShapeType[] = ["square", "dot", "circle"].filter((t) => t !== was);
    setCellSymmetric(cells, gx, gy, types[0]);
  } else {
    setCellSymmetric(cells, gx, gy, pickType(ringOf(gx, gy), rand));
  }
}

const SEED_PATTERNS: CellMap[] = [];
for (let i = 0; i < PATTERN_COUNT; i++) {
  SEED_PATTERNS.push(buildPattern(i * 1337 + 42));
}

function cellsToShapes(cells: CellMap): Shape[] {
  const shapes: Shape[] = [];

  for (const [key, type] of cells) {
    const [gx, gy] = key.split(",").map(Number);
    const cx = SOURCE_CENTER + gx * CELL_SIZE;
    const cy = SOURCE_CENTER + gy * CELL_SIZE;
    const groupKey = symmetricKeyFromGrid(gx, gy);
    const ring = ringOf(gx, gy);

    if (type === "square") {
      shapes.push({
        ring,
        groupKey,
        draw: (ctx, scale) => {
          roundRect(
            ctx,
            (cx - SHAPE_SIZE / 2) * scale,
            (cy - SHAPE_SIZE / 2) * scale,
            SHAPE_SIZE * scale,
            SHAPE_SIZE * scale,
            1.2 * scale
          );
          ctx.fill();
        },
      });
    } else if (type === "dot") {
      shapes.push({
        ring,
        groupKey,
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
    } else {
      shapes.push({
        ring,
        groupKey,
        draw: (ctx, scale) => {
          ctx.beginPath();
          ctx.arc(cx * scale, cy * scale, CIRCLE_RADIUS * scale, 0, Math.PI * 2);
          ctx.fill();
        },
      });
    }
  }

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

export interface RippleLoaderProps {
  size?: number;
  color?: string;
  opacity?: number;
  interval?: number;
  waveDuration?: number;
  className?: string;
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
    currentCells: cloneCells(SEED_PATTERNS[0]),
    nextCells: null as CellMap | null,
    currentShapes: cellsToShapes(SEED_PATTERNS[0]),
    nextShapes: null as Shape[] | null,
    morphChangingKeys: null as Set<string> | null,
    waveStartTime: 0,
    mode: "reveal" as "reveal" | "morph",
    rafId: null as number | null,
    waveToken: 0,
    intervalId: null as ReturnType<typeof setInterval> | null,
    scale: 1,
    dpr: 1,
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

  const easeOutCubic = useCallback((t: number) => 1 - Math.pow(1 - t, 3), []);

  const isRingRevealed = useCallback(
    (ring: number, elapsed: number) => {
      if (elapsed >= waveDuration) return true;
      const t = Math.min(1, Math.max(0, elapsed / waveDuration));
      const progress = easeOutCubic(t);
      const threshold = ring / (MAX_CELL_RING + 1);
      return progress >= threshold;
    },
    [waveDuration, easeOutCubic]
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

      const animateKeys = s.morphChangingKeys;

      if (s.mode === "reveal") {
        for (const shape of s.currentShapes) {
          if (isRingRevealed(shape.ring, elapsed)) shape.draw(ctx, s.scale);
        }
        ctx.restore();
        return;
      }

      for (const shape of s.currentShapes) {
        if (animateKeys && !animateKeys.has(shape.groupKey)) {
          shape.draw(ctx, s.scale);
          continue;
        }
        if (!isRingRevealed(shape.ring, elapsed)) shape.draw(ctx, s.scale);
      }

      if (s.nextShapes) {
        for (const shape of s.nextShapes) {
          if (animateKeys && !animateKeys.has(shape.groupKey)) continue;
          if (isRingRevealed(shape.ring, elapsed)) shape.draw(ctx, s.scale);
        }
      }

      ctx.restore();
    },
    [color, opacity, isRingRevealed]
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
    if (s.mode === "morph" && s.nextCells) {
      s.currentCells = s.nextCells;
      s.currentShapes = s.nextShapes ?? cellsToShapes(s.currentCells);
      s.nextCells = null;
      s.nextShapes = null;
      s.morphChangingKeys = null;
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

    const render = (now: number) => {
      if (myToken !== s.waveToken) return;
      const elapsed = Math.min(waveDuration, now - s.waveStartTime);
      drawFrame(elapsed);
      if (elapsed < waveDuration) {
        s.rafId = requestAnimationFrame(render);
      } else {
        if (s.mode === "morph" && s.nextCells) {
          s.currentCells = s.nextCells;
          s.currentShapes = s.nextShapes ?? cellsToShapes(s.currentCells);
          s.nextCells = null;
          s.nextShapes = null;
          s.morphChangingKeys = null;
          s.mode = "reveal";
        }
        s.rafId = null;
      }
    };
    s.rafId = requestAnimationFrame(render);
  }, [waveDuration, drawFrame]);

  const triggerReveal = useCallback(() => {
    commitPendingMorph();
    const s = stateRef.current;
    s.mode = "reveal";
    s.morphChangingKeys = null;
    startWave();
  }, [commitPendingMorph, startWave]);

  const triggerShift = useCallback(() => {
    const s = stateRef.current;
    commitPendingMorph();

    let nextCells = s.currentCells;
    let changingKeys = new Set<string>();

    for (let attempt = 0; attempt < 8; attempt++) {
      nextCells = mutatePattern(s.currentCells);
      changingKeys = computeChangingKeys(s.currentCells, nextCells);
      if (changingKeys.size > 0) break;
    }

    s.nextCells = nextCells;
    s.nextShapes = cellsToShapes(s.nextCells);
    s.morphChangingKeys = changingKeys;
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
