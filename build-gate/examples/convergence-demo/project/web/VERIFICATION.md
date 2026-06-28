# Convergence Demo — Verification Evidence

Portable fixture evidence for the TELOS build-gate `convergence-demo` example.
The breakout records re-verified by the gate reference these artifacts:

- `docs/verification/s03-dynamics-discriminator.png` — §03 dynamics discriminator render
- `docs/verification/s04-scorecard.png` — §04 scorecard render
- `web/site/style.css` — carries the cyan brand token `#69e7ff`

These files are committed so the gate's `file_exists` / `file_contains` checks
re-verify deterministically on any platform (no machine-local absolute paths).
