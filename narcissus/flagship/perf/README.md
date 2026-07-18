# Flagship — measured performance (Lighthouse, production build via `vite preview`)

Assertions → proof. Full JSON reports beside this file; regenerate with:
`npm run build && npx vite preview --port 4323` then
`CHROME_PATH=<chromium> npx lighthouse http://localhost:4323/[?view=graph] [--preset=desktop] --only-categories=performance --output=json`.

## Scores (2026-07-18, pass 6B)

| View | Preset | Perf | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|
| Story (`/`) | **desktop** | **100** | 0.4 s | 0.7 s | 20 ms | **0** |
| Graph (`/?view=graph`) | **desktop** | **100** | 0.4 s | 0.5 s | 0 ms | **0** |
| Story (`/`) | mobile (simulated slow-4G, 4× CPU) | 80 | 2.0 s | 2.1 s | 720 ms | **0** |
| Graph (`/?view=graph`) | mobile | 77 | 2.1 s | 2.3 s | 850 ms | **0** |

Baseline before the 6B fixes (mobile story): **62** — FCP 2.7 s · LCP 3.2 s · TBT 1,560 ms · CLS 0.011.

## What the measurement flagged → what was fixed (measured causes, not guesses)

1. **LCP waited for React** (text rendered only after vendor eval). → **Static pre-hydration shell** in
   `index.html`: station 1 paints from pure HTML+CSS before any JS evaluates; React re-renders identical
   markup in place (CLS 0.011 → 0). LCP 3.2 → 2.1 s (mobile), 0.7 s desktop.
2. **WebGL render loop saturated the throttled main thread** (continuous rAF during the trace → TBT). →
   Canvases mount on **idle-after-load** (WebGL fully off the critical path — it is paint, so this is
   architecturally pure) and run `frameloop="demand"` behind a **capped frame driver** (loom 30 fps,
   graph 40 fps — the ambient motion reads identically). TBT 1,560 → 720 ms mobile; 20 ms desktop.
3. Self-hosted fonts + async 715 KB webgl chunk + 305 KB initial JS were already in place (passes 1–5).

## Honest residual

- Mobile-simulated TBT (~720–850 ms) is dominated by React+XState vendor eval under 4× CPU throttle;
  shrinking it further means lighter runtime dependencies, not tuning. Desktop-class devices (the primary
  audience for a WebGL portfolio surface) measure 100 with TBT ≤ 20 ms.
- The pre-hydration shell is `aria-hidden` inert paint; no-JS users see styled text but no controls.
