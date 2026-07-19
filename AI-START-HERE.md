# AI-START-HERE

> **AI Systems Architects Best Practices Suite: Rapid Full Deployment and SDLC
> Recursive Suite** — the suite's mantra (The Eye, 2026-07-17). Rapid full
> deployment: policy as data, pinned loadout, harvest-first, parallel
> disjoint-writer builds merged under the merkle-dag discipline. SDLC recursive:
> the lifecycle applies to itself — this layer was built under the governance it
> defines, and every record here proves it.

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
`memory/comprehension-queries.json`. For TELOS role/component records, run:

```
node docs/institutional-memory/comprehension-gate.mjs <path-to-memory-dir>/comprehension-queries.json <your-answers.json>
```

`ai-native-memory` is a portable plugin with its own query schema and authority
record, so its dogfood gate is intentionally routed through the plugin oracle:

```
node ai-native-memory/scripts/gate.mjs ai-native-memory/memory/comprehension-queries.json <your-answers.json> --authority ai-native-memory/CURRENT-AUTHORITY.json
```

Both routes grade answers **deterministically**. In the TELOS gate, facts carrying
`authority_anchor.pointer` are additionally live-resolved against
`CURRENT-AUTHORITY.json`; other anchor metadata is an evidence citation, not a runtime
authority resolver. The plugin gate validates its separate query schema and grades
against the plugin's reviewed expectations; `ai-native-memory/scripts/audit.mjs`
separately re-derives those `derived_from` anchors from sibling records. Exit 0 is a
required entry precondition; it does not
replace The Eye's implementation-authority decision. (Example runs:
`docs/institutional-memory/examples/reader-correct.json` passes the entry ritual;
`reader-hallucinating.json` — which includes every package and "proves containment" — is
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
| **The Iliad** | lifecycle umbrella for enrolled sub-systems (pre-review → enroll → retrospective) | `docs/institutional-memory/iliad/` |

## Current implementation classification

**Clotho Phase 1 is complete.** **Argo has accepted slices 4a, 4b, 5, 6, and
7; no next or pending slice remains.** **Lachesis and Atropos are implemented
and enrolled** as zero-dependency spine packages, with their component memory
under `lachesis/memory/` and `atropos/memory/`.

**`ai-native-memory` is an implemented portable plugin/product component.** It
has no mythological role, and its Iliad enrollment remains deferred under AM-40;
its dogfood records live under `ai-native-memory/memory/`.

The module/product boundary is deliberate: **The Narcissus module remains
registered and unimplemented**, while **`narcissus/flagship` is an implemented
product** that remains deferred pending conscious Iliad enrollment. Filesystem
proximity and a product directory do not implement or enroll the registered
Narcissus role.

**Future modules (registered, UNIMPLEMENTED)** — names reserved WITH meaning; no code
exists. Do not coin them for other purposes, and do not assume the components exist:
**Hermes** (API management & inter-system communication) · **Medusa** (defensive edge
enforcement) · **Narcissus** (production of full-rollout front-ends through iterative
UI rendering and visual review). Machine index:
`repository-manifest.json#future_modules` (verify-contracts cross-checks it against
the vocabulary verbatim). Implementing one: CHANGE-PROTOCOL + the Iliad lifecycle.

**Route by what you are about to do** (load that module's memory dir FIRST, then
pass its `comprehension-queries.json` through the gate):

| about to… | load | you must already know |
|---|---|---|
| change a plan, run a delta, amend a decision | `daedalus/` | convergence ≠ authorization; Eye rulings are fixed inputs |
| touch the gate, council, signing, or an authz run | `telos/` | required trio vs advisory; one dissent blocks; refusals are the system working |
| implement a slice, review, or merge | `argo/` | comprehension gate first; The Eye accepts; the dissent asymmetry |
| touch `clotho/` code | `clotho/memory/` | AM-40 roots; AM-41 profile; advisory/non-sandboxed posture |
| measure dependencies, relevance, risk, or blast radius | `lachesis/memory/` | measurement only; risk class advisory; no Clotho identity or signature-chain overclaim |
| verify recorded supersession consistency | `atropos/memory/` | cycle 1 is read-only; retirement action remains human-governed |
| choose tools/seats for a run, or START any task | `loadout/` (+ your task's `TASK-LOADOUTS/task-<id>.json`) | seat routes are pinned; a loadout server can never shadow a seat; missing capabilities must be surfaced, never worked around |
| create a NEW implementation / sub-system | `iliad/` (pre-review first; read the latest retrospective) | lifecycle: pre-review → enrolled sub-system → retrospective; 'delivered' is refused without the retrospective |

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
