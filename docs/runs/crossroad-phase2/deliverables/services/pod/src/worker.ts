// services/pod/src/worker.ts
//
// SQS-consumer worker (ECS Fargate) for POD fulfillment. It submits ONLY paid
// orders to the POD provider, using idempotency keys, retry-with-backoff, a
// dead letter queue, shipment-tracking-webhook reconciliation, and
// manual-review support.
//
// Cited evidence:
//   audit/COMMERCE-GAP.md — Gap Analysis rows: "Fulfillment | none | No POD
//     integration, no shipment"; "Payment capture | none in deps | No provider";
//     "Idempotency / refunds | none | No dedup, no reversal path"; and
//     "Webhooks | none (static host) | Static Pages cannot receive webhooks".
//     This worker is the dynamic tier COMMERCE-GAP says must be built (the audit's
//     "new API/eventing tier").
//   audit/OPERATIONS.md §1.2 CI stages step 4 — "Docker path: build service image ->
//     push to ECR (for any dynamic/order/POD services)." This worker is that service.
//
// READ-ONLY: never writes to disk; all config/fixtures inline.

export type PaymentStatus = "paid" | "pending" | "failed" | "refunded";

export interface OrderMessage {
  orderId: string;
  ourSku: string;
  paymentStatus: PaymentStatus;
  // Deterministic idempotency key so re-delivered SQS messages never double-submit.
  idempotencyKey: string;
  attempts?: number;
}

export interface PodSubmission {
  orderId: string;
  podOrderId: string;
}

// Shipment tracking record reconciled from the provider's webhook.
export interface TrackingUpdate {
  podOrderId: string;
  trackingNumber: string;
  carrier: string;
  status: "label_created" | "in_transit" | "delivered" | "exception";
}

export const MAX_ATTEMPTS = 5;
export const BASE_BACKOFF_MS = 200;

export function backoffMs(attempt: number, base = BASE_BACKOFF_MS): number {
  const ceiling = base * Math.pow(2, Math.max(0, attempt - 1));
  return Math.floor(Math.random() * ceiling);
}

export interface PodClient {
  submitOrder(input: {
    orderId: string;
    ourSku: string;
    idempotencyKey: string;
  }): Promise<PodSubmission>;
}

// The dead letter queue sink: messages that exhaust retries land here for replay.
export interface DeadLetterQueue {
  send(message: OrderMessage, reason: string): Promise<void>;
}

// Manual-review queue: orders that must not auto-submit (e.g. unpaid, flagged).
export interface ManualReviewQueue {
  flag(message: OrderMessage, reason: string): Promise<void>;
}

export class IdempotencyStore {
  private seen = new Map<string, PodSubmission>();
  has(key: string): boolean {
    return this.seen.has(key);
  }
  get(key: string): PodSubmission | undefined {
    return this.seen.get(key);
  }
  record(key: string, value: PodSubmission): void {
    this.seen.set(key, value);
  }
}

// Tracking store keyed by podOrderId; reconciled by the tracking webhook.
export class TrackingStore {
  private byPodOrder = new Map<string, TrackingUpdate>();
  reconcile(update: TrackingUpdate): void {
    this.byPodOrder.set(update.podOrderId, update);
  }
  get(podOrderId: string): TrackingUpdate | undefined {
    return this.byPodOrder.get(podOrderId);
  }
}

export interface WorkerDeps {
  client: PodClient;
  idempotency: IdempotencyStore;
  dlq: DeadLetterQueue;
  review: ManualReviewQueue;
  sleep?: (ms: number) => Promise<void>;
}

export type ProcessResult =
  | { status: "submitted"; submission: PodSubmission }
  | { status: "duplicate"; submission?: PodSubmission }
  | { status: "manual-review" }
  | { status: "dead-lettered" };

// Process one SQS order message.
// SECURITY item 9 / COMMERCE-GAP: submit ONLY paid orders. Anything not clearly
// paid is diverted to manual review — never auto-submitted to the POD provider.
export async function processOrder(
  message: OrderMessage,
  deps: WorkerDeps
): Promise<ProcessResult> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  // Idempotency: a re-delivered message for an already-submitted order is a no-op.
  if (deps.idempotency.has(message.idempotencyKey)) {
    return { status: "duplicate", submission: deps.idempotency.get(message.idempotencyKey) };
  }

  // Gate: only paid orders reach the provider.
  if (message.paymentStatus !== "paid") {
    await deps.review.flag(message, `not paid: paymentStatus=${message.paymentStatus}`);
    return { status: "manual-review" };
  }

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const submission = await deps.client.submitOrder({
        orderId: message.orderId,
        ourSku: message.ourSku,
        idempotencyKey: message.idempotencyKey,
      });
      deps.idempotency.record(message.idempotencyKey, submission);
      return { status: "submitted", submission };
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_ATTEMPTS) await sleep(backoffMs(attempt));
    }
  }

  // Retries exhausted -> route to the dead letter queue for later replay.
  await deps.dlq.send(
    { ...message, attempts: MAX_ATTEMPTS },
    lastErr instanceof Error ? lastErr.message : String(lastErr)
  );
  return { status: "dead-lettered" };
}

// Shipment-tracking-webhook reconciliation entry point.
// Called by the tracking webhook handler to reconcile provider shipment state
// back onto the order's tracking record.
export function reconcileTracking(
  update: TrackingUpdate,
  store: TrackingStore
): TrackingUpdate {
  store.reconcile(update);
  return update;
}

// Drain a batch of SQS messages (the Fargate consumer loop body).
export async function processBatch(
  messages: OrderMessage[],
  deps: WorkerDeps
): Promise<ProcessResult[]> {
  const out: ProcessResult[] = [];
  for (const m of messages) {
    out.push(await processOrder(m, deps));
  }
  return out;
}

// Standalone entry: exits 0. Runs no live SQS poll in the artifact (no network,
// read-only), it simply proves the module loads and self-checks cleanly.
if (require.main === module) {
  // Minimal smoke self-check with inline fixtures.
  const idempotency = new IdempotencyStore();
  const tracking = new TrackingStore();
  const noopSubmission: PodSubmission = { orderId: "o1", podOrderId: "pod_o1" };
  idempotency.record("k1", noopSubmission);
  reconcileTracking(
    { podOrderId: "pod_o1", trackingNumber: "TRK123", carrier: "USPS", status: "in_transit" },
    tracking
  );
  const ok =
    idempotency.has("k1") && tracking.get("pod_o1")?.trackingNumber === "TRK123";
  // eslint-disable-next-line no-console
  console.log(`pod worker self-check: ${ok ? "ok" : "failed"}`);
  process.exit(ok ? 0 : 1);
}
