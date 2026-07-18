# LEXI real design tokens (reality-grounded — cloned + read source, not inferred)

Extracted from `github.com/dsmcewan/LEXI` @ `lexi-dashboard/frontend/src/styles/tokens.css`,
`tailwind.config.js`, and `src/orb/` (react-three-fiber ferrofluid orb). Supersedes the inferred parts of
`lexi-study.md`. This is the precise aesthetic reference the Narcissus reflection loop targets.

## Dark theme (primary)
- surfaces: `--surface #0b0f1a` · `--surface-raised #111827` · `--surface-sunken #080b14` · `--page #05070b`
- edges: `--edge #151c2c` · `--edge-strong #253347`
- foreground: `--fg #f1f5f9` · `--fg-muted #cbd5e1` · `--fg-faint #94a3b8`
- **accent (signature LEXI red): `--accent #ef4444` · `--accent-strong #b91c1c`** · alert `--alert #f59e0b` (amber)
- **glow:** `--shadow-glow 0 0 24px rgba(248,113,113,0.5)` (red bloom); raised `0 8px 24px rgba(0,0,0,0.5)`

## Light theme (secondary)
- surface `#ffffff` / raised `#fbfcfe`; fg `#1e293b`; accent `#007aff` (blue); glow `rgba(0,229,255,.45)` (cyan)
- AppShell header gradient `#333e52 → #171e2b`, header fg `#edf1f7`

## Type
- **display: Inter** · **mono: JetBrains Mono** (`--font-display` / `--font-mono`)

## Signature hero — ferrofluid orb
- `src/orb/FerrofluidOrb.ts` + `shaders.ts`, react-three-fiber (`OrbCanvas.tsx`), behavior in `useOrbBehavior.ts`.
- GLSL uniforms: `uTime, uNoiseScale, uSpikeIntensity, uPulse, uMousePos, uMouseInfluence, uThemeMix` — a
  **simplex-noise-driven, mouse-reactive, pulsing ferrofluid sphere**, theme-aware (light/dark).

## Design language (now precise)
Dark near-black canvas; **signature red/crimson accent with red bloom-glow**; amber for alerts; Inter +
JetBrains Mono; noise/grain texture; a living mouse-reactive ferrofluid WebGL hero; full light/dark theming.
The evidence-vs-uncertainty forensic ethos maps directly onto TELOS's own "convergence != truth."

**For Narcissus:** these are the concrete tokens to open the reflection loop against — inherit the palette +
ferrofluid hero as the floor; reach past LEXI to Awwwards-SOTY immersion (`award-references.md`).
Clone kept at (ephemeral) job tmp; re-clone at implementation for live screenshots.
