---
type: reference
topic/architecture: telos
status: living
note: Unresolved questions a future model is ALLOWED to investigate and propose on (via the governance path in CHANGE-PROTOCOL.md). These are OPEN-QUESTION status — not settled facts, not rejected alternatives.
---

# TELOS — open questions

- **Should Daedalus mature machine-first contracts instead of prose plans?** The
  institutional-memory layer inverts the doc hierarchy (machine records are source of
  truth; the human README is rendered). Whether Daedalus should mature the machine-first
  *contract* directly — with the human plan as the rendered projection — is proposed but
  not yet ruled. *(Investigate; route via CHANGE-PROTOCOL.)*
- **Should the comprehension gate be wired in front of TELOS implementation authority?**
  Currently `docs/institutional-memory/comprehension-gate.mjs` is a standalone harness
  proven on the Task 4a pilot. Making a passing reader-validation artifact a precondition
  for implementation authority is the intended follow-on.
- **How should the institutional-memory record set generalize to the other components**
  (breakout, build-gate, connectors/ai-peer-mcp, merkle-dag) and to Tasks 4b–7? The Task
  4a pilot is the single worked example; generalization is deferred until it is proven.
- **Should the human README be generated (Argo renders it) or hand-written and
  gated-against the records?** The pilot renders `clotho/memory/README.md` by hand from
  the records; an automated renderer + a drift gate is a candidate.
