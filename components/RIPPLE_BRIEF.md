# Cursor handoff: replace static SVG background with animated RippleBackground

## What's being replaced

In the current prototype there's a static SVG of a dotted/squared background pattern sitting behind the centered "Ask anything..." input and the ring of category cards (Sales, Marketing, Operations, Design, HR + Legal, Finance, Product, Personal). It's an SVG element rendered inline or as an `<img>` / `<Image>` source.

That static SVG needs to be swapped for a new animated React component: `RippleBackground.tsx` (provided alongside this file).

## What the new component does

- Renders a `<canvas>` background pattern in the same visual style as the current SVG (small squares, dots, and circles at 15% opacity in `#C2BFAF`).
- **On page load**: canvas starts empty. A wave radiates from center outward, popping each shape into existence as it passes. The wave runs at 12fps for a deliberately stepped, pixely feel, with subtle per-shape timing noise (35%) for organic variation.
- **On click of any element tagged `data-ripple-trigger`**: shifts to a new randomly-selected pattern (1 of 8 pre-generated 4-fold symmetric variants). Each changed pixel pops in/out as the wave passes it.
- Rapid clicks are race-safe — a new wave cleanly cancels any in-flight animation.
- Respects `prefers-reduced-motion` (skips animations, paints final state directly).

## Integration steps

### 1. Drop the component in

Place `RippleBackground.tsx` in your components directory (e.g. `components/RippleBackground.tsx`).

### 2. Find and remove the current static SVG

Search for the existing background SVG. Likely candidates:
- An `<svg>` element with the pattern paths inline
- An `<img src="..." />` or Next.js `<Image />` pointing to a `.svg` file
- A `background-image: url(...)` on the page/section container

Remove it from the layout but keep its **container** — the relatively-positioned wrapper that holds the centered input and surrounding cards.

### 3. Mount RippleBackground in its place

The component is `position: absolute; inset: 0; pointer-events: none;` — it fills its parent and never blocks clicks. The parent must be `position: relative` (it probably already is, since the cards are absolutely positioned around the center).

```tsx
import RippleBackground from "@/components/RippleBackground";

<section style={{ position: "relative", minHeight: "100vh" }}>
  <RippleBackground />

  {/* existing centered input + ring of category cards */}
  <div style={{ position: "relative", zIndex: 1 }}>
    {/* ...existing content... */}
  </div>
</section>
```

Cards/input should layer above the canvas via `position: relative` or `z-index: 1`.

### 4. Tag the category cards as triggers

Each of the 8 cards (Sales, Marketing, Operations, Design, HR + Legal, Finance, Product, Personal) needs `data-ripple-trigger` on its clickable root element. This is a delegated listener — no callback wiring needed.

```tsx
<button data-ripple-trigger onClick={...existing handler...}>
  {/* card content */}
</button>
```

Works the same way on `<div>` or `<a>` elements. The component listens at document level and fires a pattern shift when any click bubbles up from a `[data-ripple-trigger]` element.

Existing card click handlers (navigation, panel open, etc.) keep working unchanged. The ripple trigger is additive.

### 5. Defaults are already tuned

The component ships with these defaults baked in (no props needed):

| Prop | Default | What it does |
|---|---|---|
| `color` | `#C2BFAF` | Shape color, matches current SVG |
| `opacity` | `0.15` | Resting opacity, matches current SVG |
| `fps` | `12` | Frame rate — chunky stepped feel |
| `noise` | `0.35` | Per-shape timing variation |
| `noiseEndsAt` | `0.90` | Noisy shapes settled by 90% of wave duration |
| `waveDuration` | `900` | Total wave length in ms |

If you want to override anything later:

```tsx
<RippleBackground fps={24} noise={0.2} />
```

## Things to verify after wiring

- [ ] Background appears empty on hard refresh, then the wave reveals it
- [ ] The wave has a visibly stepped/pixely quality (not smooth 60fps)
- [ ] Clicking any of the 8 category cards triggers a new pattern morph
- [ ] Cards remain clickable and existing handlers still fire
- [ ] No "lone pixel" landing after the wave's main motion has finished — the wave should end cleanly
- [ ] Mobile canvas fills container and stays crisp

## Performance notes

- Single canvas redraw per animation frame; no per-shape DOM mutation
- Animation only runs during a wave (~900ms after each trigger), then idles
- 8 patterns × ~200 shapes each = pre-generated once at module load
- All shape coordinates are numbers, no string parsing in the hot path
- At 12fps, the render loop only redraws ~11 times per wave
