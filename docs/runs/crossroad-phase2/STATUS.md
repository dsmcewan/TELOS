# Crossroad Threads — Phase 2 Build (Status)

**Build the own-domain commerce infrastructure from the certified launch-audit
gap lists.** Phase 1 (`docs/runs/crossroad-threads`) audited the static
museum-brochure and PASSED, enumerating buildable Phase-2 work items in each
artifact. This run authored the real deliverables — grounded against those
certified audits and the CrossroadThreads source (both read-only evidence) —
through the same forge machinery: manifest-validated workstreams, ratchet,
adversarial claim-graded bouts, gemini referee, market gate.

## Result: PASS — all 7 workstreams certified. 🏗️

`gate_status: pass` · three-seat provenance (claude `msg_011Ccof…`, agy
`agy-44cb…`, codex `chatcmpl-DzA…`).

| Workstream | Deliverables |
| --- | --- |
| `infra-static` ✅ | AWS CDK static plane — `infra/cdk/lib/static-stack.ts` (S3+CloudFront+OAC+ACM+Route53+CloudFront Function), `bin/app.ts`, `README.md` |
| `order-service` ✅ | `services/order/` — order state machine, DynamoDB tables (Orders/Carts/ProcessedEvents), Dockerfile |
| `transaction-service` ✅ | `services/transaction/` — server-authoritative checkout + signature-verified webhook (refunds), Dockerfile |
| `pod-service` ✅ | `services/pod/` — SQS worker (DLQ, tracking reconciliation), variant sync, Dockerfile |
| `security-controls` ✅ | `infra/security/headers.ts` (CSP/HSTS/…), `iam-policies.json` (least-privilege), `docs/SECURITY-RUNBOOK.md` |
| `ci-deploy` ✅ | `.github/workflows/deploy-aws.yml` (OIDC→ECR→S3 sync→CloudFront invalidation), `docs/DEPLOY.md` |
| `ads-campaign-plan` ✅ | `ads/campaign-plan.json` (kill/scale rules, budget shares), `ads/catalog-feed-spec.md` |

The certified artifacts are copied under `deliverables/` (the run workdir is
git-ignored). Every artifact survived a dual-adversary (grok + agy) breakout
against the certified audit and source, refereed by gemini.

## Three engine hardening fixes this build surfaced (all tested)

The build stress-tested the seat transport under concurrency and produced three
fixes, each an instance of the session's core principle — *never let
infrastructure masquerade as substance*:

1. **MCP transport errors are transient** (`forge/ratchet.mjs` `NETWORK_FLAKE`
   + `INFRA_ERROR`) — JSON-RPC `-32603`/`-32000` internal errors, seen when
   several large generations hit the plugin servers concurrently, now retry with
   backoff (which also staggers the load that provoked them) and never bank as
   artifact blockers. A single large call reproduced fine; only concurrency
   raced.
2. **Transport noise is filtered from the blocker set** (`saas-forge/live.mjs`
   `makeCouncilFactFns`) — a "blocker" that is actually a crashed co-challenger
   (`agy CLI failed: exit code 2`), an MCP hiccup, or a quota message is
   infrastructure, not an artifact defect; it is dropped before it can enter a
   bout and deadlock it. (The agy co-challenger CLI can exit non-zero on
   oversized prompts.)
3. Together with the existing call-level retry and non-banking, seat/transport
   failures are now caught in depth: retried at the call, not banked at the
   halt, and filtered at the bout.

## Deploy note

These are certified, self-consistent artifacts faithful to the certified gap
lists — the buildable spec realized. They are not yet wired to a live AWS
account: provisioning (real ACM cert, Route 53 hosted zone, Stripe/POD provider
keys in Secrets Manager, ECR repos) is the operator's go-live step, for which
`docs/DEPLOY.md` and `docs/SECURITY-RUNBOOK.md` are the runbooks.
