# TELOS SaaS Forge

Point the forge at a project and it drives that project toward **market-ready**
through TELOS's existing discipline — research, generate, verify, gate — looping
until the gate certifies it.

This is the **generator layer wired into `merkle-dag`'s `dispatch`**: the seam the
engine was always built for. `runBuild` already plans the work, isolates each
task (Rule 1), verifies every artifact by its own test (Rule 3), settles a
signed ledger, and forward-invalidates by hash. The forge supplies the missing
piece — a `dispatch` that *generates real artifacts* — and wraps it in a cycle.

## The loop (`forge.mjs`)

```
research ──▶ plan ──▶ generate (dispatch) ──▶ verify (test) ──▶ signed ledger ──▶ market gate
   ▲                                                                                   │
   └──────────────────────────── repeat until gate = pass ─────────────────────────────┘
```

1. **Research breakout** (`research.mjs`) — derive the capability domains a SaaS
   needs (UI / DB / infra / auth / evals) from the required market workstreams,
   and resolve each to a concrete library + current guidance via an **injected
   `docsFor`** adapter. Live = **Context7** (`resolve-library-id` → `query-docs`);
   offline = a curated fallback so the forge runs keyless. Emits `ARCHITECTURE.md`.
2. **Plan** (`plan.mjs`) — one merkle-dag node per workstream; each *writes*
   concrete files and carries a deterministic *test*. Dependencies order the build.
3. **Generate** (`generator.mjs`) — `generatorDispatch` turns each node spec into
   real files. Live = model seats via `ai-peer-mcp`; tests = deterministic
   generators. The seat never says "done" — the node's test does.
4. **Verify + settle** — `runBuild` runs each node's test and only writes a
   signed ledger entry if it passes.
5. **Gate** — the market-bound TELOS gate re-verifies the *generated* artifacts on
   disk (the market packet's breakout checks point at them). `pass` ⇒ market-ready.

## Run it

```bash
npm test          # keyless end-to-end: converges on the fixture + proves fail-closed
```

```js
import { forge } from "./forge.mjs";
const result = await forge({
  projectRoot: "/abs/path/to/convergence-demo",
  telos: "Make the convergence demo market-ready.",
  dossierMeta: {
    build_id: "saas-forge-convergence", idea_id: "idea-convergence",
    use_case: "forge-convergence-demo", objective: "Forge the convergence demo.",
    required_market_workstreams: ["frontend-brand-experience"]
  }
});
// result.converged === true, result.verdict.gate_status === "pass"
```

## Going live (wiring the injected boundaries)

- **Context7 research:** pass `docsFor: makeContext7DocsFor({ resolve, queryDocs })`
  so the architecture is grounded in up-to-date docs instead of the offline KB.
- **Model-seat generation:** replace `makeDemoGenerators` with a producer that
  calls `ai-peer-mcp` seats (`claude_ask` / `codex_ask` / `agy_checkpoint`) to
  write each workstream's files, so artifacts are model-authored, then
  test-verified and signed.
- **Real project root:** point `projectRoot` at the actual convergence-demo tree
  (where its files live), not the fixture.

## Scope today

This slice ships two workstreams end-to-end — `architecture` and
`frontend-brand-experience` — proving the whole loop on the fixture with a green,
keyless test (and a fail-closed test: drop the brand token and it never settles).
The remaining workstreams (`business-positioning`, `backend-schema`,
`security-trust`, `accuracy-evals`, `scale-operations`) are the *same pattern* —
add a node with files + a test and a generator, and the loop covers them.
