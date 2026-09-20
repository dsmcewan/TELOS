# signed-pass — the certified DEFAULT path

This example demonstrates the **fail-closed default** (Eye ruling 2026-09-19): with no
`trust_mode` gymnastics, cryptographically **signed**, provenance-bound approvals certify
the gate. `dossier.json` sets `trust_mode: "signed"` explicitly, but the same packets
would certify with the field omitted entirely — absent `trust_mode` is signed enforcement.

The three approval packets in `packets/` are HMAC-signed (see `../../sign.mjs`) and carry
unique, real-shaped provenance. To reproduce a certified `"pass"` you must export the
**fixed test secrets** these packets were signed with (these are keyless HMAC secrets, NOT
API keys, and are published here only so this example is reproducible):

```bash
export TELOS_SECRET_CLAUDE=signed-example-claude-secret
export TELOS_SECRET_AGY=signed-example-agy-secret
export TELOS_SECRET_CODEX=signed-example-codex-secret

node ../../gate.mjs validate dossier.json packets
# -> "gate_status": "pass", "certified": true, "trust_mode": "signed", exit 0
```

Remove any one secret (or tamper with any signed packet field) and the gate **fails
closed** — `gate_status: "blocked"`, exit 1. Never commit real `TELOS_SECRET_*` values;
these demo secrets exist solely to make this fixture self-verifying.
