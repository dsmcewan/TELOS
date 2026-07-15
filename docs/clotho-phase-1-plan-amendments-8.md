# Clotho Phase 1 — Plan Amendments, Round 8 (normative deltas to plan v8)

Input to the eighth Daedalus delta workshop, applying The Eye's delta-8 repair
contract (two remaining blockers) and spec v2.6. Requirements are fixed; a
different mechanism is acceptable only when it proves the same or stronger
invariants explicitly. Surgical delta — no unrelated Clotho architecture
changes. `docs/runs/clotho-authorization/*` is immutable historical evidence
and is not touched.

## AM-30 — `executed` means complete source consumption (spec v2.6)

**Defect:** v8 records honest observed counts but still permits
`configured: 10, observed: 9, state: executed` — making downstream absence
claims unsound.

**Spec v2.6 rule (adopted):** a weaver may be recorded as `executed` only when
every required source iterator was exhausted successfully and every observed
count equals the cardinality of its configured source inventory; any
incomplete, excess, or contradictory consumption is fatal and prevents ledger
closure and publication. Frozen states:

```
executed = every required iterator constructed + every iterator exhausted
           + observed count equals configured cardinality + no fatal error
skipped  = no iterator constructed + no iterator consumed + every count is zero
```

Phase 1 has no partial-execution state; partial coverage aborts.

**Plan edits (required):**

- The driver retains, per iterator:
  `{inventory_id, expected_cardinality, observed_count, exhausted}`.
- After a weaver returns and **before edge append or `close()`**, the driver:
  1. confirms every required iterator exists;
  2. confirms every iterator reached normal exhaustion;
  3. confirms `observed_count === expected_cardinality`;
  4. rejects any count-shaped field returned by the weaver;
  5. aborts on any mismatch with a stable fatal code from
     `{incomplete-source-consumption, source-count-mismatch,
     unexpected-source-consumption}`.
- **Edge-append ordering is normative:** no edge from a weaver reaches
  `appendEdge` before that weaver's accounting check succeeds — an incomplete
  weaver must not influence the temporary ledger before rejection.
- **Verifier boundary clarified:** the driver proves iterator construction,
  exhaustion, and expected cardinality; the ledger verifier proves manifest
  structure and rejects nonzero counts for `skipped`; the verifier must not
  claim it can reconstruct runtime iterator exhaustion from the signed ledger
  alone.

**Tests (replace the current under-count expectation):**

1. **Under-consumption** — fixture weaver ignores one handed source → fatal
   accounting failure, no `close()`, no destination, temporary cleaned up.
2. **Early return** — weaver consumes part of an iterator and returns → same.
3. **Expected-cardinality mismatch** — recorded/assembled count differs from
   configured source-list cardinality → closure refused.
4. **Complete consumption** — every iterator exhausted exactly once →
   `executed` accepted.
5. **Skipped** — no iterator constructed → zero counts published.
6. **Skipped iterator construction** — construction alone is a driver
   contradiction, even at zero count.
7. **Skipped nonzero signed fixture** — independent verification fails.
8. **Edges from incomplete weaver** — proven never to reach `appendEdge`.

**Acceptance criterion:** no published manifest can contain `state: executed`
for a weaver that failed to inspect every configured source.

## AM-31 — prohibit constructed module loaders (spec v2.6)

**Defect:** D27 closes direct import/require forms, but an allowed built-in
constructs a new loader:
`import { createRequire as makeLoader } from "node:module"` →
`makeLoader(import.meta.url)("external-package")` — bypassing the
zero-dependency proof.

**Spec v2.6 rule (adopted):** Clotho may not construct, obtain, alias, or
invoke a general-purpose module loader; loader-capable built-ins are governed
by frozen safe-export allowlists; namespace and default access to such modules
is forbidden; any reference to a loader-producing export or API fails closed.

**Scanner design (required), for `node:module` and bare `module`:**

- Permit only a frozen named-export allowlist Clotho actually needs
  (e.g. `builtinModules`, `isBuiltin`).
- Reject: `createRequire` under any local alias; namespace imports; default
  imports; re-exports of forbidden exports; property access obtaining
  `createRequire` from an imported namespace; immediate invocation forms.
- Also reject equivalent built-in acquisition in the supported Node range —
  at minimum `process.getBuiltinModule("module")` where that API exists.
- The scanner recognizes the frozen syntactic forms it prohibits; unsupported
  ambiguous loader construction **fails closed** (no arbitrary data-flow
  analysis is claimed).

Forms that must fail (each with its own synthetic test):

```js
import { createRequire } from "node:module";
import { createRequire as loadFactory } from "node:module";
import * as Module from "node:module";
import Module from "node:module";
const load = Module.createRequire(import.meta.url);
const load = createRequire(import.meta.url);
createRequire(import.meta.url)("external-package");
export { createRequire } from "node:module";
```

**Tests (one synthetic test each):** direct named `createRequire`; aliased
named; namespace import + property access; default import + property access;
immediate invocation; forbidden re-export; bare `"module"` equivalent;
`process.getBuiltinModule("module")`; safe allowed named export (accepted);
ordinary permitted Node built-in (accepted); comments and string lookalikes
that must NOT trigger.

**Acceptance criterion:** no supported syntactic route inside `clotho/`
obtains a general-purpose loader capable of resolving an undeclared external
package.

## Reaffirmed (no change intended)

Everything else in plan v8 as converged — including driver-owned counted
iterators and the frozen inventory-id table (AM-30 strengthens their
semantics), D27's closed specifier allowlist (AM-31 extends it to loader
construction), the frozen publication commit point, physical containment,
abort/descriptor lifecycle, and all decisions as amended.
