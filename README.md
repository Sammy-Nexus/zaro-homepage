# Zaro Homepage

Implementation of the **Home / Default** screen from [Nexus Product Design (Figma)](https://www.figma.com/design/d6Qa64OpJiyGvMT05j8KL1/Nexus-Product-Design?node-id=6270-110290).

## Typography

Uses **Saans** (primary brand font) from your local assets, copied to `public/fonts/`.

## Background

The dotted grid behind the cards is **RippleBackground**: a canvas wave reveal on load, and a morph to a new random pattern when any category card is clicked (`data-ripple-trigger`). Category cards also spiral in on first paint via `cards-intro.js`.

## Run locally

No build step required. From this folder:

```bash
# Python
python3 -m http.server 5173

# Or Node (if available)
npx serve .
```

Open http://localhost:5173

## Structure

- `index.html` — layout (sidebar + category orbit + chat bar)
- `styles/` — design tokens and component styles
- `assets/` — SVG icons
- `components/RippleBackground.tsx` — animated canvas background (React)
- `scripts/ripple-background.js` — same behavior wired into the static prototype
- `public/fonts/` — Saans WOFF2 files
