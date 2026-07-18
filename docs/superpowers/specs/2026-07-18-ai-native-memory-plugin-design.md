# Design: `ai-native-memory` — the AI-native institutional-memory standard as a Claude Code plugin

**Date:** 2026-07-18 · **Approved by:** The Eye (section-by-section, this session)
**Source standard:** `docs/institutional-memory/SCHEMA.md` + the practices proven across the TELOS quests
(Lachesis, Atropos, the flagship), generalized and hardened with eight additions earned from real failures.

## Purpose

Documentation whose inheritor is an AI model. The standard's own premise: a memoryless, more-capable
successor must **reconstruct the system's intended reality without filling gaps with plausible invention** —
machine-first records are the source of truth, human docs are rendered projections, and every claim of
correctness has an executable oracle. This plugin packages that standard — the docs, the oracles, the
governance lifecycle, and the agents — so any repository can adopt it.

## Decisions (The Eye's, this session)

| Decision | Ruling |
|---|---|
| Scope | **Full lifecycle** — standard + portable tooling + governance workflow |
| Naming | **Plain language.** TELOS's mythological vocabulary is a reserved namespace and stays home; the plugin speaks portably (a host repo may layer its own names) |
| Hardenings | **All eight** (below) — each traces to a failure caught in real operation, not speculation |
| Location | **In the TELOS monorepo**: `ai-native-memory/` at root, classified into `package_roots_exclude` (a product beside the spine, like the flagship) |
| Structure | **Full agent suite** — skills + commands + plugin-owned zero-dep oracles + three agents |

## The eight hardenings (additions to the source standard)

1. **Query-freshness oracle** — comprehension `expected` facts must be derived from / checked against the
   machine contracts they anchor to. (Failure: Clotho's queries + example answers drifted in lockstep —
   still naming 5 package roots after enrollment made it 7; invisible to the gate.)
2. **Three-representation auditor** — a load-bearing claim missing its machine record or oracle ref is a
   FAIL. (Failure: both newest modules shipped prose-only `INVARIANTS.md`/`NON-CLAIMS.md`; queries cited
   invariant IDs that existed in no machine file.)
3. **Truthful-lifecycle field** — every hashed record states the ACTUAL build order (docs-first vs
   build-first-then-ratified); exceptions live inside the hash, not beside it. (Failure: Atropos council
   round 1 — codex refused a plan whose hash claimed a false docs-first history.)
4. **Mirror-sync checks** — a declared mirror of another component's closed set carries a checkable source
   anchor + equality check. (Failure: Lachesis mirrors Clotho's edge kinds "with a change_rule to re-sync"
   that nothing enforces.)
5. **Staleness sweep** — do anchors resolve at HEAD, `as_of` distance, snapshot currency. (Failure: a
   70-commit-stale session state; the weave going a day stale unnoticed.)
6. **Reviewer-drift monitor** — adversarial loops self-score with proven discriminators: objection count
   trending down = converging; re-raising a verified-false finding = malfunction; out-of-lane threads
   (design escalated to governance) = drift, quarantined + escalated once. (Failure: ~6 of Atropos's 13
   workshop rounds were reviewer drift on a ruled point; codex twice re-raised a disproven regex claim.)
7. **Load-order manifest** — "complete at load" requires a defined minimal reading order
   (START-HERE → authority → component identity → contracts) with token-budget guidance, so a fresh model
   loads slim.
8. **Decision provenance** — every ruling records `decided_by: human | model-advisory-adopted-by-human`.
   Human authority is never delegated to a model; consulting a peer model is collaboration, and the record
   says which happened.

## Layout

```
ai-native-memory/
├── .claude-plugin/plugin.json      # name, version, description
├── skills/
│   ├── memory-standard/SKILL.md    # THE standard (generalized SCHEMA.md + the 8 hardenings)
│   ├── memory-authoring/SKILL.md   # practitioner's guide: writing records
│   └── memory-lifecycle/SKILL.md   # the governance workflow, plain-named
├── commands/
│   ├── memory-init.md              # scaffold a record set
│   ├── memory-audit.md             # the sweep (hardenings 1,2,4,5 + taxonomy integrity)
│   ├── memory-verify.md            # contracts == code/reality
│   └── memory-gate.md              # deterministic comprehension gate
├── agents/
│   ├── memory-auditor.md
│   ├── comprehension-grader.md
│   └── adversarial-reviewer.md
├── scripts/                        # zero-dep Node oracles (stdlib only)
│   ├── init.mjs · audit.mjs · verify.mjs · gate.mjs
│   └── lib/ (canonicalize, sha256hex, record parsing — vendored, no imports from TELOS packages)
├── memory/                         # the plugin's OWN record set, in its own format (dogfood)
├── tests/                          # fixture trees: one passing + one violating per audit branch
└── package.json                    # "type":"module", dependencies: {}
```

## Skills

- **`memory-standard`** — purpose (succession interface); the five disciplines (authority-anchored;
  NORMATIVE-requires-oracle; three representations; machine-first/human-rendered; reading ≠ understanding);
  closed record kinds (`mechanism · decision · rejected-alternative · non-claim · invariant ·
  open-question · contract · evidence`); the six-dimension record fields; the status taxonomy
  (`NORMATIVE-CURRENT · SUPERSEDED · SPECIFIED-PENDING-IMPLEMENTATION (+becomes_normative_when) ·
  MODEL-PROPOSAL · REJECTED-ALTERNATIVE · OPEN-QUESTION · HUMAN-AUTHORIZED-EXCEPTION · ADVISORY` — plus
  `RATIFICATION-PENDING` for the deferred path); preserve rejected alternatives; the eight hardenings as
  first-class rules.
- **`memory-authoring`** — scaffold layout; authoring each kind; content addressing
  (`sha256:` + `sha256hex(canonicalize(record minus id))`); anchor schemes (content hash, repo file@commit,
  git commit, ledger entry — plain-named generalizations of TELOS's `sha256:`/`file:@`/`git:`/`ledger:#`);
  mirrored-set declarations (source anchor + equality check); `decided_by` provenance; the load-order
  manifest + token-budget guidance; render/drift discipline (machine → rendered `.md`, checked).
- **`memory-lifecycle`** — stage order: pre-review → adversarial plan workshop → authorization council →
  comprehension-gated implementation authority → oracles green → integration into the host's index (the
  repository manifest at minimum; a knowledge graph if the host maintains one) → retrospective.
  Deferred ratification as a first-class RECORDED exception (build-first is legitimate when the human
  authority directs it; the record must say so inside the hash, and the default order reasserts).
  Supersession protocol: registry entry + `must_not_govern_new_work: true` + successor link; retired
  authority must never look like a second valid authority. Human authority gate: a role the host repo
  assigns to a human; models advise, humans rule, records attribute.

## Commands & oracles (all fail-closed; findings as JSON + human line; exit 0 clean / 2 findings / 1 cannot-run)

- **`/memory-init [component-dir]`** → `init.mjs`: scaffolds the per-component set (`IDENTITY.md`,
  `INVARIANTS.json+.md`, `CONTRACTS/`, `DECISIONS/` incl. `rejected-alternatives`, `NON-CLAIMS.json+.md`,
  `FAILURE-MODES.md`, `EVIDENCE/`, `comprehension-queries.json`, rendered `README.md`) and, first run,
  repo-level `AI-START-HERE.md`, `CURRENT-AUTHORITY.json`, repository manifest, load-order manifest.
  Templates start `SPECIFIED-PENDING-IMPLEMENTATION` with empty `becomes_normative_when` — honest about
  being unproven from minute one. The ONLY writing command.
- **`/memory-audit [scope]`** → `audit.mjs`: three-representation check; query-freshness; mirror-sync;
  staleness (anchors resolve, `as_of` distance WARN, snapshot currency); taxonomy integrity (NORMATIVE
  without passing oracle FAIL; SUPERSEDED without successor + `must_not_govern_new_work` FAIL).
- **`/memory-verify`** → `verify.mjs`: generalized verify-contracts. Host repo supplies `verify-map.json`
  (contract → oracle pairs); the script runs each oracle; exit 0 only if all green.
- **`/memory-gate <component> <answers.json>`** → `gate.mjs`: the deterministic comprehension gate, ported:
  grades answers (`set`/`boolean`/`enum` vs `expected`), verifies the active authority hash against disk,
  requires superseded authorities excluded, writes the GRANTED/DENIED artifact.

## Agents

- **`memory-auditor`** — runs audit+verify, then interprets: ranks findings by blast, traces root causes
  (contract moved vs mirror rotted), proposes the minimal fix set. Read-only; reports, never edits.
- **`comprehension-grader`** — authors deterministic queries FROM the machine records (every `expected`
  terminates in a stable identifier), generates negative fixtures (each flips exactly one answer), proves
  pass→0 / negatives→nonzero via `/memory-gate`, and re-derives queries when contracts change (keeps
  hardening #1 alive over time).
- **`adversarial-reviewer`** — the workshop seat with the drift monitor built in: reviews candidates
  adversarially AND self-scores each round against the discriminators; reports
  converged / needs-work / **I-am-drifting** honestly; auto-flags re-raised verified-false findings;
  quarantines out-of-lane threads and escalates them once to the human gate.

## Dogfooding & testing (acceptance)

- The plugin's own `memory/` is authored in the standard it ships.
- `npm test` (zero-dep): per-branch fixture trees for every audit check (one passing + one violating);
  the gate's pass + negative examples; and the DOGFOOD run — `/memory-audit` over `ai-native-memory/`
  exits clean, its own comprehension queries pass the gate with negatives DENIED, its contracts
  `/memory-verify` green. The inheritance claim is demonstrated, not asserted: a fresh model onboards to
  the plugin using the plugin.
- No check ships without a fixture proving it can fail.

## Error handling

Fail-closed throughout. Structured findings; deterministic exit codes; the gate refuses to run (exit 1)
when the authority record itself is drifted ("a drifted authority cannot certify anyone"); no check ever
reports "looks fine" without an oracle behind it.

## Non-goals

- No export of TELOS's mythological vocabulary (reserved namespace stays home).
- No runtime dependencies anywhere (stdlib-only Node; skills/commands/agents are markdown).
- The plugin does not import from TELOS packages — needed primitives (canonicalize/sha256hex) are vendored
  into `scripts/lib/` so the plugin is fully portable.
- No enforcement wired into host repos beyond what the host opts into (the commands report; the host's CI
  chooses to gate on exit codes).
- Marketplace publication is a later step, from this monorepo, after the plugin survives its own quest.

## Open questions (deferred to implementation plan)

- Whether `/memory-audit` reads a small host config (paths to record sets) or discovers by convention
  (`**/memory/` + repo-root files). Lean: convention with config override.
- Exact `verify-map.json` schema (minimal: `[{contract, oracle, cwd}]`).
