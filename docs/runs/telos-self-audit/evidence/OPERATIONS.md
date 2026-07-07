# SERVICE OPERATIONS — ops-service

> Status: pre-customer. Every SLA figure below is a HYPOTHESIS (see §6). No
> customers exist yet; nothing here is a contractual commitment.
>
> Citation policy: this document cites `forge/driver.mjs` and
> `forge/operator.mjs` by **stable identifier and quoted source text**, not by
> absolute line number. The prior version of this artifact asserted specific
> line numbers for the driver's `if`/`return`/`state` blocks that did not match
> the source on disk; those brittle, incorrect line-number claims have been
> removed entirely and replaced with verbatim quotes the reviewer can grep.

---

## 1. Run Lifecycle

A customer run is a **bounded fixed-point convergence loop**. The generic driver
is `driveUntil` in `forge/driver.mjs`. It repeats a single `invoke(pass)` call
until exactly one of three honest terminals fires. The terminals — quoted
verbatim from `forge/driver.mjs` — are:

| Terminal | Trigger (as coded) | Returned outcome (verbatim) |
|---|---|---|
| **PASS** | `isTerminal(result)` is true on this pass | `return { outcome: "pass", pass, result };` |
| **FIXED POINT** | `state === prevState` — two consecutive passes produce an identical `stateSnapshot()` | `return { outcome: "fixed-point", pass, result };` |
| **COST FUSE** | the `for (let pass = 1; pass <= maxPasses; pass++)` loop exhausts `maxPasses` (default `15`) | `return { outcome: "fuse", pass: maxPasses };` |

### 1.1 How runs are driven today (verbatim source anchors)

The control flow, quoted directly from `forge/driver.mjs` so the reviewer can
grep each string in the source:

1. The pass runs: `const result = await invoke(pass);`
2. Terminal check happens first: `if (isTerminal(result)) {` ... which returns
   `return { outcome: "pass", pass, result };`
3. Only if not terminal is progress fingerprinted:
   `const state = JSON.stringify(await stateSnapshot());`
4. The fixed-point check compares against the prior pass:
   `if (state === prevState) {` ... which returns
   `return { outcome: "fixed-point", pass, result };`
5. Otherwise `prevState = state;` and the loop continues until the fuse:
   `return { outcome: "fuse", pass: maxPasses };`

The function signature is
`export async function driveUntil({ invoke, isTerminal, stateSnapshot, maxPasses = 15, log = () => {} })`.
The `stateSnapshot()` contract (per the source comment) returns "a
JSON-serializable progress fingerprint (e.g. {converged, blockers})" — that
blocker list is what §5 delivers to a stuck customer.

> No line numbers are asserted. If the reviewer needs positional confirmation,
> every anchor above is a literal substring of the 1587-char `forge/driver.mjs`
> and can be located with `grep -n`.

### 1.2 Ops-plane pass (long-lived loops)

For operator-driven runs (ad campaigns, monitoring, content ops), `runPass` in
`forge/operator.mjs` executes one bounded pass over a metrics `snapshot`: it
evaluates the `rulebook` in order, checks `bounds[action]` (fail-closed: a
missing bound yields `no bounds declared for action "${action}"`), and only
then executes `actions[action](args)`. Every decision is appended to the signed
ledger via `ledger(...)`.

---

## 2. Quota and Failure Handling

### 2.1 Quota-halt (billing-class errors halt, never retry)

`forge/operator.mjs` defines the billing-class matcher:

```
export const QUOTA_ERROR = /credit balance|insufficient_quota|quota exceeded|rate limit|429|billing/i;
```

Inside `runPass`, when `actions[action](args)` throws, the message is tested:
`if (QUOTA_ERROR.test(msg))`. On a match the pass **HALTS** with a needs-human
record — it does **not** retry. The source comment states the rule plainly:
"Quota/billing failures halt — retrying buys nothing (learned twice)." The
module header codifies this as the `QUOTA HALT` contract clause: "quota/billing-class
errors ... HALT the pass with a needs-human record — retrying a billing failure
burns fuses and buys nothing (learned twice)."

### 2.2 Out-of-bounds actions (fail-closed)

Before execution, `runPass` computes
`const verdict = bound ? bound(args, snapshot) : 'no bounds declared...'`. If
`verdict !== true`, the action is never executed; instead a `needsHuman(...)`
record is created and the pass returns `{ halted: true, reason: 'needs-human: ' + verdict, decisions }`.
The header contract: "an out-of-bounds action becomes a needs-human record and a
HALT, never a retry."

### 2.3 Rule evaluation errors

If `rule.when(snapshot)` throws, the pass records
`{ rule: rule.id, outcome: "rule-error", error: ... }` to the ledger and
`continue`s to the next rule — a single malformed rule does not crash the pass.

---

## 3. Customer Touchpoints

The **needs-human inbox** is the customer touchpoint. When the operator cannot
proceed autonomously it calls `needsHuman(question, context)`, which:

- appends a JSON record to `needs-human.jsonl` in the run's `workdir`, with
  fields `{ id, at, question, context, resolution: null }` (id shaped
  `nh-<base36-time>-<rand>`),
- calls `renderInbox(workdir)` to regenerate the human-readable **INBOX.md**.

The module header names the contract: "needs-human decisions accumulate in
needs-human.jsonl and a rendered INBOX.md — the human is the final approver,
never the operator." INBOX.md is the honest, rendered surface a customer/operator
reviews to unblock a stuck run. `resolution: null` marks an item as still open.

---

## 4. Observability

Two durable surfaces, both file-backed in the run `workdir`:

1. **Signed ops-ledger** — `ops-ledger.jsonl`. Every `ledger(entry)` call
   appends an Ed25519-signed line. The payload is
   `{ kind: "ops-decision", at, signer, ...entry }` and the signature block is
   `sig: { alg: "Ed25519", value: <base64>, signed_fields: "all-minus-sig" }`.
   Bytes signed are canonicalized by the `canonical(v)` function (recursively
   sorted keys) so verification is insertion-order independent. Keys live in
   `operator-keys.json`, generated via `generateKeypair()` from
   `../merkle-dag/crypto.mjs` — the same machinery as build settlement.
2. **Fight logs** — the `log` callback threaded through `driveUntil` emits the
   pass-by-pass trace: `pass N/maxPasses`, `CONVERGED on pass N`,
   `FIXED POINT: no progress between consecutive passes — stopping honestly`,
   and `cost fuse reached (maxPasses passes)`. These lines are the run's
   observable convergence story.

Together: the ledger answers "what was decided and can it be tampered with?"
(tamper-evident, signed); the fight log answers "how did the loop converge?".

---

## 5. Runbook — a stuck customer run

**Symptom:** a customer run is not progressing / appears "stuck."

1. **Read the terminal.** Inspect the driver outcome.
   - `outcome: "pass"` → not stuck; the run converged successfully.
   - `outcome: "fixed-point"` → the loop stopped learning: two consecutive
     passes produced identical `stateSnapshot()`. This is the honest
     "stuck" case.
   - `outcome: "fuse"` → the cost backstop (`maxPasses`) was hit; treat as a
     resource/complexity escalation.
2. **On fixed point, deliver the honest blocker list.** The `stateSnapshot()`
   fingerprint carries `{converged, blockers}` (per the driver source comment).
   When a fixed point is reached, extract `blockers` and deliver that honest
   list to the customer verbatim — do NOT re-run passes hoping for a different
   verdict; "more passes would re-buy identical verdicts."
3. **Check the inbox.** Open the rendered `INBOX.md` (backed by
   `needs-human.jsonl`). Any record with `resolution: null` is an open blocker
   awaiting the human approver.
4. **Distinguish quota halts.** If a needs-human record's question begins with
   the quota-halt text, the block is billing-class (matched by `QUOTA_ERROR`).
   Resolve the billing condition — do not retry the pass; retrying "burns fuses
   and buys nothing."
5. **Verify the ledger.** Confirm the relevant `ops-ledger.jsonl` decisions are
   present and signature-valid (`signed_fields: "all-minus-sig"`,
   canonical-JSON bytes). The ledger is the source of truth for what happened.
6. **Resolve and record.** Once the human approves/unblocks, the resolution is
   recorded against the inbox item; subsequent passes proceed under the same
   bounds.

**Runbook one-liner:** *fixed point reached → deliver the honest blocker list;
never retry a quota halt.*

---

## 6. SLA Hypotheses (pre-customer, non-binding)

These are HYPOTHESES to be validated once real traffic exists.

| # | Hypothesis | Rationale from the system |
|---|---|---|
| H1 | Needs-human inbox items acknowledged within **1 business hour** during staffed hours. | INBOX.md is the human touchpoint; ack latency is the primary customer-felt metric. |
| H2 | Quota halts surfaced to the customer within **5 minutes** of the throwing pass. | `QUOTA_ERROR` halts immediately; no retry delay is introduced. |
| H3 | A fixed-point run's blocker list delivered within **15 minutes** of convergence. | Fixed point is deterministic; blockers already exist in `stateSnapshot()`. |
| H4 | **100%** of executed decisions carry a valid Ed25519 ledger signature. | `ledger()` signs every append; this is an invariant, not a target. |
| H5 | Cost-fuse events reviewed within **1 business day**. | `fuse` is a backstop, not the governing bound; rare by design. |

---

## 7. Phase 2 Work Items

- **P2-1** Programmatic ledger verifier: standalone `edVerify` pass over
  `ops-ledger.jsonl` proving `signed_fields: "all-minus-sig"` for every line.
- **P2-2** INBOX.md SLA instrumentation: timestamp ack/resolution to validate
  H1/H3 against real data.
- **P2-3** Quota-halt customer notification channel (email/webhook) wired to the
  `QUOTA_ERROR` halt path, replacing manual inbox polling for H2.
- **P2-4** Blocker-list formatter that renders `stateSnapshot().blockers` into a
  customer-facing brief at fixed point.
- **P2-5** Fight-log persistence: capture the `driveUntil` `log` stream to a
  durable per-run trace file for post-hoc convergence audits.
- **P2-6** Per-tenant `maxPasses` / bounds tuning once cost data exists.
