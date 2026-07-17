# AI-START-HERE

You are a fresh model with no memory of this project. This file is your onboarding
protocol. TELOS is a multi-model build-gate and a set of registered components; you are
inheriting an institution, not just source code. **Do not begin from a confident guess —
begin from accumulated truth.**

## Read, in this order

1. **`CURRENT-AUTHORITY.json`** (this directory) — the single machine-readable answer to
   "what governs new work now": the active plan (path + `sha256`), the active
   authorization (`authz-N`), the implementation authority, and the list of **superseded**
   plans/authorizations. **Never treat a superseded plan as normative**, however recent
   its file looks.
2. **`repository-manifest.json`** — the system map: components, their registered roles,
   what each owns and explicitly does **not** own, and which docs are normative vs
   superseded.
3. **The active plan named in `CURRENT-AUTHORITY.json`** — the authoritative frozen scope.
   Not any other plan version.
4. **`docs/institutional-memory/INVARIANTS.md`** and **`docs/institutional-memory/NON-CLAIMS.md`**
   (system-level), then the **component** `memory/INVARIANTS.md` and `memory/NON-CLAIMS.md`
   for whatever you are touching.
5. **The component `memory/DECISIONS/`** — including **`rejected-alternatives.md`**. A
   "considered and rejected" idea is not a novel improvement; do not rediscover it.
6. **`docs/institutional-memory/CHANGE-PROTOCOL.md`** — which change requires which
   governance path.

## Prove you understood it — before you get implementation authority

Reading files is **not** evidence of understanding. Answer the component's
`memory/comprehension-queries.json` and run:

```
node docs/institutional-memory/comprehension-gate.mjs <component>/memory/comprehension-queries.json <your-answers.json>
```

It grades your answers **deterministically** against authority-anchored facts. You have
**no implementation authority until it exits 0.** (Example runs:
`docs/institutional-memory/examples/reader-correct.json` passes;
`reader-hallucinating.json` — which answers "eight packages" and "proves containment" — is
**denied**.)

Also confirm reality matches the records:
```
node docs/institutional-memory/verify-contracts.mjs   # every NORMATIVE contract == the code; plan hashes == disk
```

## Role modules (registered roles with their own memory)

Some registered roles are realized by **code + protocol + run lineage** rather than a
top-level package. Each has a memory dir with the same record set and its own
comprehension queries — load it before touching that role's code or workflow.
`repository-manifest.json#role_modules` is the machine index.

| role | registered meaning | memory dir |
|---|---|---|
| **Daedalus** | collaboratively matures implementation plans | `docs/institutional-memory/daedalus/` |
| **TELOS** | governs review, evidence, authorization, execution boundaries | `docs/institutional-memory/telos/` |
| **Argo** | carries an authorized plan through implementation, verification, documentation | `docs/institutional-memory/argo/` |

**Route by what you are about to do** (load that module's memory dir FIRST, then
pass its `comprehension-queries.json` through the gate):

| about to… | load | you must already know |
|---|---|---|
| change a plan, run a delta, amend a decision | `daedalus/` | convergence ≠ authorization; Eye rulings are fixed inputs |
| touch the gate, council, signing, or an authz run | `telos/` | required trio vs advisory; one dissent blocks; refusals are the system working |
| implement a slice, review, or merge | `argo/` | comprehension gate first; The Eye accepts; the dissent asymmetry |
| touch `clotho/` code | `clotho/memory/` | AM-40 roots; AM-41 profile; advisory/non-sandboxed posture |
| choose tools/seats for a run, or START any task | `loadout/` (+ your task's `TASK-LOADOUTS/task-<id>.json`) | seat routes are pinned; a loadout server can never shadow a seat; missing capabilities must be surfaced, never worked around |

One command re-proves the whole record set against reality (runs the Argo entry
ritual both ways, probes the Daedalus state machine, re-hashes both lineages):

```
node docs/institutional-memory/verify-contracts.mjs
```

## Hard rules

- Do **not** treat superseded plans/authorizations as normative.
- Do **not** infer authority from filenames, dates, or **model consensus**. A model
  approval is not human authority; convergence is not authorization.
- Do **not** silently reinterpret a scope/spec ambiguity — escalate it to **The Eye** via
  `CHANGE-PROTOCOL.md`. (This is how AM-40 and AM-41 came to exist.)
- Do **not** coin a mythological term or claim a capability listed in a `NON-CLAIMS` file.
  Registered terms only (`docs/mythological-vocabulary.md`); unregistered ≠ available.
- Every load-bearing claim you make must terminate in a stable identifier (a plan
  `sha256:`, an `authz-N`, an `AM-N`, a git commit).

## What this layer is

Engineering best practice, not a module: an AI-native institutional-memory record set
(schema in `docs/institutional-memory/SCHEMA.md`) so that a more-capable future model can
understand this system **better** than the models that built it — without being allowed to
rewrite what it has not yet understood.
