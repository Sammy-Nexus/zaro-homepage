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
  const PATTERN_COUNT = 12;

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
    const MAX_CELL_RING = Math.floor(gridSize / 2);
    const CORNER_RING = MAX_CELL_RING;

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

    function symmetricKeyFromGrid(gx, gy) {
      const ax = Math.abs(gx);
      const ay = Math.abs(gy);
      return `${Math.min(ax, ay)},${Math.max(ax, ay)}`;
    }

    function symmetricPositions(gx, gy) {
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

    function getCell(cells, gx, gy) {
      return cells.get(`${gx},${gy}`) ?? null;
    }

    function cloneCells(cells) {
      return new Map(cells);
    }

    function setCellSymmetric(cells, gx, gy, type) {
      for (const [sx, sy] of symmetricPositions(gx, gy)) {
        if (isBlockedCell(sx, sy)) continue;
        cells.set(`${sx},${sy}`, type);
      }
    }

    function removeCellSymmetric(cells, gx, gy) {
      for (const [sx, sy] of symmetricPositions(gx, gy)) {
        cells.delete(`${sx},${sy}`);
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

    function alternateType(currentType, ring, rand) {
      const types = ["square", "dot", "circle"];
      let next = pickType(ring, rand);
      if (currentType) {
        while (next === currentType) {
          next = types[Math.floor(rand() * types.length)];
        }
      }
      return next;
    }

    function ringHasCell(cells, ring) {
      for (const key of cells.keys()) {
        const [gx, gy] = key.split(",").map(Number);
        if (ringOf(gx, gy) === ring) return true;
      }
      return false;
    }

    function ensureEveryRing(cells, rand) {
      for (let ring = 0; ring <= MAX_CELL_RING; ring++) {
        if (ringHasCell(cells, ring)) continue;
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
        setCellSymmetric(cells, pick[0], pick[1], pickType(ring, rand));
      }
    }

    function buildPattern(seed) {
      const rand = seededRandom(seed);
      const cells = new Map();

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

    function rowHasChange(before, after, gy) {
      for (let gx = -MAX_CELL_RING; gx <= MAX_CELL_RING; gx++) {
        if (isBlockedCell(gx, gy)) continue;
        if (getCell(before, gx, gy) !== getCell(after, gx, gy)) return true;
      }
      return false;
    }

    function colHasChange(before, after, gx) {
      for (let gy = -MAX_CELL_RING; gy <= MAX_CELL_RING; gy++) {
        if (isBlockedCell(gx, gy)) continue;
        if (getCell(before, gx, gy) !== getCell(after, gx, gy)) return true;
      }
      return false;
    }

    function canClearGroup(cells, gx, gy) {
      if (!getCell(cells, gx, gy)) return false;
      const temp = cloneCells(cells);
      removeCellSymmetric(temp, gx, gy);
      return ringHasCell(temp, ringOf(gx, gy));
    }

    function countBlankGroups(cells) {
      return getOctantRepresentatives().filter(
        ([gx, gy]) => !getCell(cells, gx, gy)
      ).length;
    }

    function mutateCellAt(cells, gx, gy, rand) {
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
      setCellSymmetric(
        cells,
        gx,
        gy,
        alternateType(currentType, ring, rand)
      );
    }

    function ensureSparseBlanks(cells, rand) {
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

    function forceGroupDiffFromBefore(before, cells, gx, gy, rand) {
      if (groupDiffers(before, cells, gx, gy)) return true;

      const ring = ringOf(gx, gy);
      const was = getCell(before, gx, gy);

      if (was) {
        if (
          getCell(cells, gx, gy) &&
          canClearGroup(cells, gx, gy) &&
          rand() < 0.35
        ) {
          removeCellSymmetric(cells, gx, gy);
        } else {
          const types = ["square", "dot", "circle"].filter((t) => t !== was);
          setCellSymmetric(
            cells,
            gx,
            gy,
            types[Math.floor(rand() * types.length)]
          );
        }
      } else {
        setCellSymmetric(cells, gx, gy, pickType(ring, rand));
      }

      return groupDiffers(before, cells, gx, gy);
    }

    function ensurePulseChange(before, cells, rand) {
      if (computeChangingKeys(before, cells).size > 0) return;

      const reps = shuffleArray(getOctantRepresentatives(), rand);
      for (const [gx, gy] of reps) {
        if (forceGroupDiffFromBefore(before, cells, gx, gy, rand)) return;
      }

      if (reps.length === 0) return;
      const [gx, gy] = reps[0];
      const was = getCell(before, gx, gy);
      if (was) {
        const types = ["square", "dot", "circle"].filter((t) => t !== was);
        setCellSymmetric(cells, gx, gy, types[0]);
      } else {
        setCellSymmetric(cells, gx, gy, pickType(ringOf(gx, gy), rand));
      }
    }

    function getOctantRepresentatives() {
      const reps = [];
      const seen = new Set();
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

    function shuffleArray(arr, rand) {
      const copy = arr.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    }

    function groupDiffers(before, after, gx, gy) {
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

    function ringHasGroupChange(before, after, ring) {
      for (const [gx, gy] of getOctantRepresentatives()) {
        if (ringOf(gx, gy) !== ring) continue;
        if (groupDiffers(before, after, gx, gy)) return true;
      }
      return false;
    }

    function ensureRingChanges(before, cells, rand) {
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

    function pickCellInRow(gy, rand) {
      const rowCells = [];
      for (let gx = -MAX_CELL_RING; gx <= MAX_CELL_RING; gx++) {
        if (!isBlockedCell(gx, gy)) rowCells.push([gx, gy]);
      }
      rowCells.sort(
        (a, b) => ringOf(a[0], a[1]) - ringOf(b[0], b[1])
      );
      const inner = rowCells.slice(
        0,
        Math.max(1, Math.ceil(rowCells.length * 0.6))
      );
      return inner[Math.floor(rand() * inner.length)];
    }

    function pickCellInCol(gx, rand) {
      const colCells = [];
      for (let gy = -MAX_CELL_RING; gy <= MAX_CELL_RING; gy++) {
        if (!isBlockedCell(gx, gy)) colCells.push([gx, gy]);
      }
      colCells.sort(
        (a, b) => ringOf(a[0], a[1]) - ringOf(b[0], b[1])
      );
      const inner = colCells.slice(
        0,
        Math.max(1, Math.ceil(colCells.length * 0.6))
      );
      return inner[Math.floor(rand() * inner.length)];
    }

    function ensureRowColumnChanges(before, cells, rand) {
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

    function getDiagonalRepresentatives() {
      const reps = [];
      for (let r = 1; r <= MAX_CELL_RING; r++) {
        if (!isBlockedCell(r, r)) reps.push([r, r]);
      }
      return reps;
    }

    function ensureAlternateDiagonalPulse(before, cells, rand, pulseIndex) {
      if (gridSize !== 5) return;

      const diagonals = getDiagonalRepresentatives();
      if (diagonals.length === 0) return;

      const [gx, gy] = diagonals[0];
      const ring = ringOf(gx, gy);
      const wantPresent = pulseIndex % 2 === 0;
      const isPresent = !!getCell(cells, gx, gy);

      if (wantPresent) {
        if (!isPresent) {
          setCellSymmetric(cells, gx, gy, pickType(ring, rand));
        }
      } else if (isPresent && canClearGroup(cells, gx, gy)) {
        removeCellSymmetric(cells, gx, gy);
      }

      if (!groupDiffers(before, cells, gx, gy)) {
        const wasPresent = !!getCell(before, gx, gy);
        if (wantPresent && !wasPresent) {
          setCellSymmetric(cells, gx, gy, pickType(ring, rand));
        } else if (!wantPresent && wasPresent) {
          removeCellSymmetric(cells, gx, gy);
        } else {
          forceGroupDiffFromBefore(before, cells, gx, gy, rand);
        }
      }
    }

    function mutatePattern(fromCells, randFn, pulseIndex = 0) {
      const rand =
        typeof randFn === "function"
          ? randFn
          : () => Math.random();
      const before = cloneCells(fromCells);
      const cells = cloneCells(fromCells);
      const reps = getOctantRepresentatives();
      const shuffled = shuffleArray(reps, rand);
      const targetFlips = Math.max(
        Math.ceil(reps.length * 0.5),
        MAX_CELL_RING + 1
      );

      for (let i = 0; i < shuffled.length && i < targetFlips; i++) {
        mutateCellAt(cells, shuffled[i][0], shuffled[i][1], rand);
      }

      ensureRingChanges(before, cells, rand);
      ensureRowColumnChanges(before, cells, rand);
      ensureEveryRing(cells, rand);
      ensureSparseBlanks(cells, rand);
      ensureAlternateDiagonalPulse(before, cells, rand, pulseIndex);
      ensurePulseChange(before, cells, rand);
      return cells;
    }

    function computeChangingKeys(before, after) {
      const changing = new Set();
      const groupKeys = new Set();

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

    const seedPatterns = Array.from({ length: PATTERN_COUNT }, (_, i) =>
      buildPattern(i * 1337 + 42)
    );

    function symmetricKey(cx, cy) {
      const gx = Math.round((cx - SOURCE_CENTER) / CELL_SIZE);
      const gy = Math.round((cy - SOURCE_CENTER) / CELL_SIZE);
      return symmetricKeyFromGrid(gx, gy);
    }

    function cellRing(cx, cy) {
      const gx = Math.round((cx - SOURCE_CENTER) / CELL_SIZE);
      const gy = Math.round((cy - SOURCE_CENTER) / CELL_SIZE);
      return ringOf(gx, gy);
    }

    function cellsToShapes(cells) {
      const shapes = [];

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
            draw(ctx, scale) {
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
        } else {
          shapes.push({
            ring,
            groupKey,
            draw(ctx, scale) {
              ctx.beginPath();
              ctx.arc(
                cx * scale,
                cy * scale,
                CIRCLE_RADIUS * scale,
                0,
                Math.PI * 2
              );
              ctx.fill();
            },
          });
        }
      }

      return shapes;
    }

    return {
      SOURCE_SIZE,
      SOURCE_CENTER,
      MAX_CELL_RING,
      seedPatterns,
      mutatePattern,
      computeChangingKeys,
      cellsToShapes,
      cloneCells,
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
    const {
      SOURCE_SIZE,
      MAX_CELL_RING,
      seedPatterns,
      mutatePattern,
      computeChangingKeys,
      cellsToShapes,
      cloneCells,
    } = getGridEngine(gridSize);

    container.replaceChildren();

    const wrapper = document.createElement("div");
    wrapper.className = "ripple-loader";
    wrapper.setAttribute("role", "status");
    wrapper.setAttribute("aria-label", "Loading");

    const canvas = document.createElement("canvas");
    canvas.className = "ripple-loader__canvas";
    wrapper.appendChild(canvas);
    container.appendChild(wrapper);

    const initialCells = cloneCells(seedPatterns[0]);

    const state = {
      currentCells: initialCells,
      nextCells: null,
      currentShapes: cellsToShapes(initialCells),
      nextShapes: null,
      morphChangingKeys: null,
      pulseCount: 0,
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

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function isRingRevealed(ring, elapsed) {
      if (elapsed >= waveDuration) return true;
      const t = Math.min(1, Math.max(0, elapsed / waveDuration));
      const progress = easeOutCubic(t);
      const threshold = ring / (MAX_CELL_RING + 1);
      return progress >= threshold;
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

      const animateKeys = state.morphChangingKeys;

      if (state.mode === "reveal") {
        for (const shape of state.currentShapes) {
          if (isRingRevealed(shape.ring, elapsed)) shape.draw(ctx, state.scale);
        }
        return void ctx.restore();
      }

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
      if (state.mode === "morph" && state.nextCells) {
        state.currentCells = state.nextCells;
        state.currentShapes = state.nextShapes ?? cellsToShapes(state.currentCells);
        state.nextCells = null;
        state.nextShapes = null;
        state.morphChangingKeys = null;
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

      function render(now) {
        if (state.destroyed || myToken !== state.waveToken) return;
        const elapsed = Math.min(waveDuration, now - state.waveStartTime);
        drawFrame(elapsed);
        if (elapsed < waveDuration) {
          state.rafId = requestAnimationFrame(render);
        } else {
          const wasInitialReveal = state.mode === "reveal" && !state.nextShapes;
          if (state.mode === "morph" && state.nextCells) {
            state.currentCells = state.nextCells;
            state.currentShapes =
              state.nextShapes ?? cellsToShapes(state.currentCells);
            state.nextCells = null;
            state.nextShapes = null;
            state.morphChangingKeys = null;
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
      state.morphChangingKeys = null;
      startWave();
    }

    function triggerShift() {
      commitPendingMorph();
      const pulseIndex = state.pulseCount;
      state.pulseCount += 1;
      let nextCells = state.currentCells;
      let changingKeys = new Set();

      for (let attempt = 0; attempt < 8; attempt++) {
        nextCells = mutatePattern(state.currentCells, Math.random, pulseIndex);
        changingKeys = computeChangingKeys(state.currentCells, nextCells);
        if (changingKeys.size > 0) break;
      }

      state.nextCells = nextCells;
      state.nextShapes = cellsToShapes(state.nextCells);
      state.morphChangingKeys = changingKeys;
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
