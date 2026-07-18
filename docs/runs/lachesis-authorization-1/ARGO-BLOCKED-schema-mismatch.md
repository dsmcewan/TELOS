# Argo BLOCKED — authorized plan's ingestion schema does not match the real snapshot

**Stage:** Argo implementation of `authz-lachesis-1` (matured approach rev10, `sha256:2ff64472…`).
**Status:** BLOCKED at implementation reconnaissance, before any code was written. Held for The Eye.
**Discovered:** 2026-07-18, reading the pinned input `docs/runs/clotho-self-weave/thread-ledger.snapshot.jsonl`.

## The mismatch (load-bearing, in the most-reviewed section §2)

| Plan (rev10 §1–§2) assumed | Actual committed snapshot |
|---|---|
| node ids are `sha256:<64hex>` | **bare 64-hex** — 0 `sha256:`-prefixed, 8002 bare on edges |
| edge-kind field is `kind` | **`edge_kind`** |
| standalone NODE records exist; edges satisfy `reference integrity` against them | **0 node records** — nodes are implied by `from_locator`/`to_locator` embedded in edges |
| flat stream of node/edge records | **header** (`clotho_weave_header`, incl. `pub_key`, `repo_head`) + 4001 signed EDGE records + **trailer** (`clotho_weave_trailer`) |
| "if the snapshot carries a hash-chain, verify it, ELSE note the limitation" (punted) | the snapshot **is** a signed Ed25519 hash-chain: every edge carries `prev_hash`/`record_hash`/`signature`; the header carries the `pub_key` |

`edge_kind` distribution (7 of the 8 `EDGE_KINDS`; no `supersedes` present): depends-on 1673,
documented-in 1089, verified-by 706, introduced-by 529, discharges 2, evidenced-by 1, motivated-by 1.
Raw-byte digest of the snapshot: `sha256:ea3ca462790c09ed3fe17463feb27b6983a24174e2632f9d72eb82298c2f769f`.

## Why this blocks (fail-closed, not a bug to code around)

- Implementing §2 faithfully rejects **100%** of real records (no `kind`, no `sha256:` prefix, no node records).
- "Correcting" the schema in code would silently discard the exact ingestion contract the council certified
  across rounds 4–9 and the `authz-lachesis-1` gate — an unauthorized deviation from the approved plan.

## What it demonstrates (the gate working, per The Eye)

The plan survived 10 adversarial Daedalus rounds AND a 5-seat signed council, and STILL carried a wrong model
of its input — because no reviewer (nor the author) re-derived the actual snapshot format; they reviewed the
plan on its own terms. Contact with ground truth at implementation time is what caught it — exactly the
"execution-time re-verification re-reads ground truth regardless of what the plan promised" limit. Convergence
and authorization were not correctness.

## Recommended routing (for The Eye)

1. **Back to Daedalus** to correct the plan against the real snapshot: bare-hex node ids; `edge_kind`;
   node-less edge-stream (nodes = locator content-addresses); header/trailer envelope; and — importantly — the
   snapshot is ALREADY a signed hash-chain, which is a STRONGER trust root than the rev10 manifest→digest
   design (verify the weave's own Ed25519 chain against the header `pub_key`, likely reusing merkle-dag
   primitives). That may simplify §1 substantially.
2. **Re-authorize** the corrected plan (the ingestion schema + trust root were load-bearing in what the council
   approved), then resume Argo.

No code written. No plan edited. No enrollment touched. Awaiting The Eye's routing.
