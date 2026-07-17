---
type: reference
topic/architecture: telos
status: living
note: Human view of NON-CLAIMS.json — honest boundaries of the loadout, including its one silent failure mode.
---

# Loadout — non-claims

- **Session skills are not pinned.** The repo pins the trust surface (seat routes,
  declared loadout servers, capability packets) — not an interactive agent's
  personal skills, editor plugins, or MCP servers.
- **The registry names backends, not models.** Model ids are env/per-call;
  strengths and placement live in `model-profiles.mjs`.
- **Task-loadout reviews are advisory.** Their opportunities are judgments;
  the gate-enforced form is capability packets on the dossier.
- **Plugin bytes are not verified.** The repo verifies routes to
  `~/claude-plugins` servers, not their contents; seat trust rests on the
  provenance envelope + HMAC + the gate.
- **Malformed loadout files fail silently** (programmatic-only fallback; seats
  unaffected). Known, recorded, and a candidate for a warning line — not a trust
  defect.
