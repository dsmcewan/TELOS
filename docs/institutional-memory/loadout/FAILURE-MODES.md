---
type: reference
topic/architecture: telos
status: living
note: How the loadout fails. Most modes are designed and fail-closed; the one silent mode is recorded honestly with its rationale.
---

# Loadout — failure modes

| mode | trigger | outcome |
|---|---|---|
| **Unrouted tool** | a council tool not in the registry | throws BEFORE any spawn — no backend contacted (fail-closed) |
| **Unregistered namespaced server** | `callTool("name:tool")` for an undeclared server | fails closed |
| **Missing plugin server** | a route points at a `<TELOS_PLUGINS_DIR>` server that isn't installed | the seat call fails → the seat produces no packet → the gate honest-blocks that seat (never borrows) |
| **Capability gap** | `missing_capabilities` not presented, or an open `must_request_user_or_install` item | gate blocks the build until surfaced/resolved |
| **Malformed loadout file** | unparseable `TELOS_LOADOUT` / `~/.telos/loadout.json` | **silent** — proceeds programmatic-only; seats unaffected, extra tools quietly absent. Recorded in `NON-CLAIMS.json#loadout-file-errors-are-silent`; a warning is a candidate improvement |
| **Shadow attempt** | a loadout server named like a seat server | registry wins structurally; the attempt has no effect |

**Interpretation rule:** a seat failing because its backend is absent is the
trust model working (no packet → honest block), not a loadout bug to route
around.
