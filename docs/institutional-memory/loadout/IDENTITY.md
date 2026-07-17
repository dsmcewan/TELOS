---
type: reference
topic/architecture: telos
status: living
note: What the development loadout IS — the tools, seat backends, plugins, and review harness an agent works WITH — and where each piece is pinned, declared, or deliberately left unpinned. "Loadout" is the code's own term (seat-registry.mjs#withLoadout), not a mythological name.
---

# Loadout — identity (capability module)

The **development loadout** is everything an agent brings to a task: model seat
backends, MCP plugin servers, review workflows, and per-task tooling. It is a
**capability module**, not a registered role — the name comes from the code
itself (`withLoadout`), so no vocabulary registration applies.

The organizing principle: **the loadout is part of the trust surface.** Which
process answers a seat call determines whose provenance lands in an approval
packet. So the trust-relevant routes are pinned in-repo and machine-verified;
convenience tooling is declared and namespaced; session tooling is explicitly
left to the operator.

## Three tiers

| tier | what | pinned by |
|---|---|---|
| **Pinned (trust surface)** | seat→backend routes; `claude_ask`/`agy_checkpoint` local; router fail-closed | `build-gate/seat-registry.mjs` + `breakout/seat_router.mjs`, verified by `CONTRACTS/seat-backends.json` |
| **Declared (convenience)** | extra MCP servers (docs, search, anything) via `withLoadout` / `TELOS_LOADOUT` — namespaced `name:tool`, structurally unable to shadow a seat | the loadout file/args; invariant probed |
| **Unpinned (operator's)** | an interactive agent's session skills, editor plugins, personal MCP servers | nothing — see `NON-CLAIMS.json#session-skills-not-pinned` |

## The review harness (also loadout)

- `.github/workflows/ci.yml` — every package × Node 18/20.
- `.github/workflows/claude.yml` + `code-review.yml` — the `@claude` action and
  automated PR review, funded by `CLAUDE_CODE_OAUTH_TOKEN` (the ONLY repo CI
  secret; local API keys are a separate thing — see `CLAUDE.md`).
- The signed council itself (`telos/` module) when a change needs seats.

## Per-task optimization review

`TASK-LOADOUTS/task-<id>.json` — one ADVISORY review per pending slice: entry
ritual, oracles the slice will flip, what to reuse, and optimization
opportunities. Reviewed **at slice start, before code**. A review that surfaces
a genuinely missing external capability graduates into gate-enforced
**capability packets** on the dossier (`CONTRACTS/capability-packet.json`).

## Artifact map

| artifact | path |
|---|---|
| seat registry + loadout mechanism | `build-gate/seat-registry.mjs` |
| multi-server router (fail-closed) | `breakout/seat_router.mjs` |
| registry/router oracles | `build-gate/scripts/test-seat-registry.mjs`, `breakout/scripts/test-seat-router.mjs` |
| capability packet fixtures | `build-gate/examples/{capability-blocked,prototype-pass}/` |
| machine contracts | `CONTRACTS/seat-backends.json`, `CONTRACTS/capability-packet.json` |
| per-task reviews | `TASK-LOADOUTS/task-{4b,5,6,7}.json` |
