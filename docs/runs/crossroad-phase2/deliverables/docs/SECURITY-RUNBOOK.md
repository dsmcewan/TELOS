# Crossroad Threads — Security Runbook

> Scope: Phase 2 storefront controls (SECURITY items 3, 10–13). This runbook is
> forward-looking. The supplied repository is a **static Next.js export** —
> `source/next.config.ts` contains `output: "export"` and has **no `headers()`**
> export/function (see `audit/SECURITY.md`, "Current Posture" items 1, 4, 5). No
> AWS, payment provider SDK, order database, or webhook implementation is present
> in the supplied excerpts (`audit/SECURITY.md` evidence register), so everything
> below is Phase 2 work to be enabled before own-domain launch.

---

## 1. Secrets & Key Management (Secrets Manager + KMS)

### 1.1 Runtime injection only
Secrets are **never** baked into images, committed to the repo, or exposed as
`NEXT_PUBLIC_*` values. Note that `source/next.config.ts` exposes only
`NEXT_PUBLIC_BASE_PATH` — that is a public base path, not a secret, and this
pattern must not be extended to credentials.

All runtime secrets are stored in **AWS Secrets Manager**, encrypted with a
dedicated **KMS** customer-managed key, and injected into containers **at
startup** via the ECS task definition `secrets` block (which resolves
`valueFrom` secret ARNs). The `ecs-execution` role in
`infra/security/iam-policies.json` holds the only `secretsmanager:GetSecretValue`
+ `kms:Decrypt` grant used at container boot; application/worker roles read only
their own secret prefixes. No IAM user or long-lived access key is defined for
any principal.

### 1.2 Per-environment naming
Secret names are namespaced by environment and consumer so a role can be scoped
by ARN prefix (matching the policy `Resource` globs in `iam-policies.json`):

```
crossroadthreads/<env>/app/<name>          e.g. crossroadthreads/prod/app/session-signing-key
crossroadthreads/<env>/payment/<name>      e.g. crossroadthreads/prod/payment/provider-secret
crossroadthreads/<env>/pod/<name>          e.g. crossroadthreads/prod/pod/vendor-api-key
```

`<env>` ∈ { `dev`, `staging`, `prod` }. Each environment uses a **separate KMS
key** and a **separate account or boundary** so a compromised non-prod credential
cannot decrypt prod secrets (KMS grants are conditioned on
`kms:ViaService = secretsmanager.<region>.amazonaws.com`).

### 1.3 Rotation
- **Payment & POD provider secrets**: rotate every 90 days, plus immediately on
  any suspected exposure. Use Secrets Manager rotation with a Lambda where the
  provider supports dual credentials; otherwise perform the manual rotation
  runbook in §4.2.
- **Session/signing keys** (`app/*`): rotate every 90 days with overlap
  (accept N and N-1 during the overlap window) to avoid mass session
  invalidation.
- **KMS key**: enable automatic annual key rotation.
- Rotation must never require a code deploy — because injection is at startup,
  a new task revision picks up the rotated value on the next deployment/restart.

---

## 2. Observability

### 2.1 Correlation IDs
Every inbound request is assigned a correlation ID (`X-Correlation-Id`;
generate if absent, propagate if present). The ID flows: edge → app-task →
SQS message attribute → fulfillment-worker → POD vendor call. All structured
logs include the correlation ID so a single order can be traced end-to-end
across the queue boundary. Never log secret values, full PANs, or full webhook
signatures — log only a hash prefix.

### 2.2 CloudWatch alarms
Metrics are emitted to the `CrossroadThreads/App` and
`CrossroadThreads/Fulfillment` namespaces (the only namespaces the task roles in
`iam-policies.json` may `PutMetricData` to). Minimum alarms:

| Alarm | Condition | Action |
|---|---|---|
| Failed-webhook rate | webhook signature-verification failures > 0 in 5 min | Page on-call; see §4.3 |
| Failed-webhook backlog | webhook processing errors sustained > 5 min | Page on-call |
| POD DLQ depth | `crossroadthreads-pod-dlq` `ApproximateNumberOfMessagesVisible` ≥ 1 | Page fulfillment on-call |
| Fulfillment queue age | oldest message age > 15 min | Investigate worker health |
| 5xx rate | app-task 5xx > 1% of requests over 5 min | Page on-call |
| KMS/Secrets denial | `secretsmanager:GetSecretValue` AccessDenied observed | Investigate rotation/IAM drift |

### 2.3 Failed-webhook & POD DLQ alerts
- **Failed webhooks**: webhooks with an invalid signature are rejected (never
  processed) and counted. A non-zero count is an alarm because it indicates a
  spoofing attempt or a misconfigured provider secret (§4.2/§4.3).
- **POD dead-letter queue**: messages the `fulfillment-worker` cannot process
  are sent to `crossroadthreads-pod-dlq` (the only queue the worker may
  `SendMessage` to besides consuming the main queue). Any DLQ message pages
  fulfillment on-call and triggers the provider-outage runbook if the vendor is
  the cause (§4.3).

---

## 3. Pre-launch trust surface note
Per `audit/SECURITY.md` item 6, `crossroad_imgs/` (344 MB) and `public/` (18 MB)
must pass EXIF/metadata + malware screening before publish. The
`static-asset-publisher` role in `iam-policies.json` is the only principal that
writes the assets bucket, and it runs *after* screening.

---

## 4. Runbooks

### 4.1 Refund
1. Verify the request: locate the order by correlation ID / order ID and confirm
   original payment succeeded.
2. Authorize per refund policy (confirm policy owner — open item per
   `audit/SECURITY.md` HYPOTHESIS H1 validation plan).
3. Issue refund through the payment provider using credentials read at runtime
   from `crossroadthreads/prod/payment/*` (never a personal/long-lived key).
4. If the order was already sent to the POD vendor, check whether production can
   be cancelled; if not, record the loss and proceed with the customer refund.
5. Log the refund with correlation ID, actor, amount, and reason. Never log the
   full card number or provider secret.

### 4.2 Secret rotation
1. Create the new secret version in **Secrets Manager** under the same
   per-environment name (§1.2). For providers supporting dual keys, add the new
   key while the old one is still valid.
2. Force a new ECS task revision / rolling restart so containers pick up the new
   value at startup (injection-only; no code change).
3. Verify health: 5xx rate normal, no `GetSecretValue` AccessDenied alarm.
4. Revoke/deactivate the old provider key.
5. Record rotation time; confirm the 90-day clock resets.

### 4.3 Provider outage (payment or POD)
1. Confirm scope via CloudWatch: failed-webhook alarm and/or POD DLQ depth alarm
   (§2.2/§2.3), and the provider status page.
2. **Payment provider down**: put checkout into a graceful "try again shortly"
   state; do not accept orders you cannot charge. Do not retry indefinitely
   against a failing provider.
3. **POD vendor down**: messages accumulate in the fulfillment queue (bounded by
   queue age alarm) and poison messages land in `crossroadthreads-pod-dlq`.
   Pause the worker if the vendor is hard-down to avoid burning retries.
4. When the provider recovers, **replay** DLQ messages back onto the
   fulfillment queue in controlled batches and confirm queue age drains.
5. Post-incident: record correlation IDs affected, customer comms, and whether a
   secret rotation (§4.2) is warranted if credentials were exposed during triage.

---

## 5. Cross-references
- Hosting headers (CSP report-only → enforce, HSTS, nosniff, Referrer-Policy,
  Permissions-Policy) live in `infra/security/headers.ts`. They must be attached
  at the hosting/edge layer because `source/next.config.ts` uses
  `output: "export"` with no `headers()` (`audit/SECURITY.md` items 4–5).
- IAM least-privilege role documents live in `infra/security/iam-policies.json`.
- Findings & hypotheses: `audit/SECURITY.md`.
