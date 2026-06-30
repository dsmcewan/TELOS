# ai-forge — multi-agent pattern run evidence

**What this run proves:** ai-forge forges a coordinating multi-role agent system —
roles · protocol · router · blackboard · orchestrator · aggregator · termination —
plus a verified design. All 8 workstreams converge. Keyless; genuine per-component
executable checks.

## What converged

8 workstreams, all `converged: true`, `finalStatus: meets`:

| Workstream | What the forge generates | Selftest asserts |
| --- | --- | --- |
| `roles` | `agents/roles.mjs` — role registry | >=3 unique, well-formed roles; `getRole` resolves by id |
| `protocol` | `agents/protocol.mjs` — message validator | well-formed messages accepted; missing fields / bad type rejected (fail-closed) |
| `router` | `agents/router.mjs` — capability router | maps task to matching role id; unmatched task → null fallback |
| `blackboard` | `agents/blackboard.mjs` — shared store | put/get round-trip; `post()` gates messages through protocol |
| `orchestrator` | `agents/orchestrator.mjs` — round runner | one output per role in order; blackboard records outputs; lead routed by capability |
| `aggregator` | `agents/aggregate.mjs` — majority vote | majority wins; deterministic lex tie-break; verified against real orchestrator outputs |
| `termination` | `agents/terminate.mjs` — loop guard | stops on convergence; halts runaway at maxRounds; verified with bounded real-orchestrator loop |
| `design` | `DESIGN.md` (generic design workstream) | design doc verified against plan + ledger + built tree |

## How to reproduce

```bash
node docs/runs/ai-forge-multiagent/run.mjs
# → multiagent run: converged=true gate_status=pass workstreams=8
```

No network, no secrets, no timestamps. Keyless and deterministic — the same result
every run.

## What the multi-agent pattern demonstrates

The pattern builds a minimal but complete multi-agent coordination loop:

1. **Roles** define the agent population (researcher · coder · reviewer) with
   capability and lens metadata.
2. **Protocol** validates every inter-agent message — fail-closed: missing fields
   and bad message types are rejected before they reach the blackboard.
3. **Router** maps an incoming task to the capability-matched role; unmatched tasks
   return null (no silent routing errors).
4. **Blackboard** is the shared state store. `put`/`get` is open-access; `post`
   routes through the protocol validator, so the blackboard never holds a malformed
   message.
5. **Orchestrator** runs one round: each role acts on the task in order via a
   caller-injected `callAgent` function; outputs land on a fresh blackboard so
   rounds are isolated.
6. **Aggregator** takes a majority vote over round outputs with a deterministic
   lexicographic tie-break — no randomness, reproducible on every run.
7. **Termination** decides stop/continue: early stop on convergence, hard halt at
   `maxRounds` as a runaway guard. Verified with a real bounded orchestrator loop.

Each component has a genuine executable selftest (`node <file> --selftest`) with
fail sub-cases. The forge's `nodeTest` runner executes these selftests as part of
the gate pipeline — convergence is not asserted; it is observed.

## Key properties

- **Fail-closed gates are real:** protocol selftest rejects missing-payload and
  bad-type messages; router selftest confirms null for unknown capability; blackboard
  selftest confirms invalid post is rejected.
- **Deterministic tie-breaking:** aggregator uses lexicographic order, not random
  shuffle, so repeated runs always produce the same decision.
- **Bounded loop:** termination selftest drives a real orchestrator loop and asserts
  it halts at `maxRounds=3` — the runaway guard is verified, not just declared.
- **Sanitized evidence:** `run-summary.json` contains no `file://` URLs, no absolute
  paths, no secrets, no timestamps — deterministic and safe to commit.
- **Zero new dependencies:** pure Node >= 18 ESM; no external packages.

## Run summary

See [`run-summary.json`](run-summary.json) for the committed, sanitized output
(`converged: true`, `gate_status: "pass"`, 8 workstreams).
