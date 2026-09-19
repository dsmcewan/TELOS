# The Loom on Trial

The flagship runs on native DOM, a pure state reducer and WebGL2. There are no
runtime, development, build or test packages to install. The browser controls
remain usable if WebGL is unavailable. `Export` retains the existing counter
behavior; it does not download a file.

Use Node 22.12 or newer and Git. Browser verification additionally requires an
existing Chromium executable, supplied as an absolute `BROWSER_PATH`. The scripts
never install or upgrade a browser. In WSL, use Linux Node rather than a Windows
npm launcher inherited through `PATH`.

From this directory:

```bash
node native/scripts/server.mjs
node --test native/tests/*.test.mjs scripts/test-*.mjs
node scripts/verify-evidence.mjs
node scripts/build.mjs
node native/scripts/test-browser.mjs dist .verification/browser.json
node scripts/verify-coverage.mjs .verification/browser.json
```

The server binds only `127.0.0.1` (default port 4317). The build checks committed
graph data and copies owned modules/assets into `dist/`, recording each output's
SHA-256. It refuses to replace an unrelated directory. No compiler or bundler is
needed. Browser coverage is based on completed actions against the current build
and harness hashes, rather than command names merely appearing in test source.

For visual evidence, choose a **new** output directory each time:

```bash
node native/scripts/capture.mjs dist .verification/capture-001
node native/scripts/compare.mjs native/tests/baseline .verification/capture-001 .verification/comparison-001.json
node native/scripts/motion-probe.mjs dist .verification/motion-001.json
```

The frozen baseline contains fresh legacy images, never candidate images. Its
receipt records Chrome 149.0.7827.55, SwiftShader, 1440×900 and DPR 1. Comparisons
refuse a different browser/backend/viewport. The limits were fixed before the
port: at most 0.5% of pixels exceed 16 in any RGB channel, mean RGB channel error
at most 1/255, and motion duration error at most two nominal frames. Capture saves
seven stills and three timestamped PNG motion sequences. A sequence is evidence,
not automatically an assertion of parity.

The motion probe independently observes uniforms sent to the GPU. It checks the
1.2-second story dolly, station-camera damping, 1.7-second graph dolly, idle
rotation and 0.45-second selection-shell expansion. Functional browser checks
exercise all sixteen commands, keyboard focus, missing WebGL, context restoration,
resize/DPR, graph deep links and the operating system's reduced-motion setting.
CI runs portable functional verification with its declared browser platform;
the exact-backend visual gate remains a separate, explicit check. A different
browser does not silently create an approved new baseline.

The browser reads `native/live-graph.json` and `native/evidence-ledger.json`.
Regenerate the former with `node scripts/build-live-graph.mjs` only when its
repository inputs intentionally change. The latter pins Git-index blobs and
verbatim excerpts; the verifier deliberately rejects stale or fabricated evidence.

The user-directed migration record is
`../../docs/runs/zero-dependency-flagship-migration-2026-09-17.md`. It does not grant
formal acceptance, implement the registered Narcissus role or enroll this product
into the Iliad. Original source, installed legacy runtime, failed probes and full
baseline motion sequences remain in the originating workspace's
`implementation/phase2/telos/` evidence directory. The older top-level
`screenshots/` and `perf/` artifacts retain their historical meaning.
