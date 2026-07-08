// services/pod/src/variant-sync.ts
//
// Idempotent variant sync: maps our SKU -> POD provider variant (ourSku -> podVariant),
// with retry/backoff and a DLQ + replay.
//
// Cited evidence:
//   audit/COMMERCE-GAP.md — Gap Analysis: "Fulfillment | none | No POD integration, no
//     shipment" and "Idempotency / refunds | none | No dedup, no reversal path". This module
//     supplies the SKU->variant mapping + dedup the POD integration requires.
//   audit/OPERATIONS.md §2 (Docker Build) — the POD service is the "Service image (if
//     order/POD services are dynamic)" packaged by services/pod/Dockerfile.
//
// READ-ONLY: this module never writes to disk. All fixtures/config are inline.

export interface OurVariant {
  ourSku: string;
  title: string;
  color?: string;
  size?: string;
}

export interface PodVariant {
  podVariantId: string;
  ourSku: string;
}

export interface VariantSyncEvent {
  ourSku: string;
  // Deterministic key so re-delivery of the same variant is a no-op.
  idempotencyKey: string;
  attempts?: number;
}

// Inline mapping table (ourSku -> podVariant). In production this is backed by a
// datastore; embedded here because the artifact must be self-contained.
const VARIANT_MAP: Record<string, string> = {
  "CT-TEE-BLK-M": "pod_v_1001",
  "CT-TEE-BLK-L": "pod_v_1002",
  "CT-HOOD-GRY-M": "pod_v_2001",
};

export const MAX_ATTEMPTS = 5;
export const BASE_BACKOFF_MS = 250;

// Full-jitter exponential backoff.
export function backoffMs(attempt: number, base = BASE_BACKOFF_MS): number {
  const ceiling = base * Math.pow(2, Math.max(0, attempt - 1));
  return Math.floor(Math.random() * ceiling);
}

export interface PodVariantClient {
  // Idempotent upsert against the POD provider keyed by idempotencyKey.
  upsertVariant(input: {
    ourSku: string;
    podVariantId: string;
    idempotencyKey: string;
  }): Promise<PodVariant>;
}

export interface DeadLetterSink {
  send(event: VariantSyncEvent, reason: string): Promise<void>;
}

// Tracks processed idempotency keys so replays are safe (in-memory for the artifact).
export class IdempotencyStore {
  private seen = new Map<string, PodVariant>();
  has(key: string): boolean {
    return this.seen.has(key);
  }
  get(key: string): PodVariant | undefined {
    return this.seen.get(key);
  }
  record(key: string, value: PodVariant): void {
    this.seen.set(key, value);
  }
}

export class VariantSyncError extends Error {}

// Resolve our SKU to the POD provider variant id.
export function resolvePodVariant(ourSku: string): string {
  const podVariantId = VARIANT_MAP[ourSku];
  if (!podVariantId) {
    throw new VariantSyncError(`No podVariant mapping for ourSku=${ourSku}`);
  }
  return podVariantId;
}

// Sync one variant. Idempotent: same idempotencyKey never double-applies.
// Retries with backoff; on exhaustion routes to the DLQ for replay.
export async function syncVariant(
  event: VariantSyncEvent,
  deps: {
    client: PodVariantClient;
    idempotency: IdempotencyStore;
    dlq: DeadLetterSink;
    sleep?: (ms: number) => Promise<void>;
  }
): Promise<{ status: "synced" | "duplicate" | "dead-lettered"; variant?: PodVariant }> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  if (deps.idempotency.has(event.idempotencyKey)) {
    return { status: "duplicate", variant: deps.idempotency.get(event.idempotencyKey) };
  }

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const podVariantId = resolvePodVariant(event.ourSku);
      const variant = await deps.client.upsertVariant({
        ourSku: event.ourSku,
        podVariantId,
        idempotencyKey: event.idempotencyKey,
      });
      deps.idempotency.record(event.idempotencyKey, variant);
      return { status: "synced", variant };
    } catch (err) {
      lastErr = err;
      // Permanent mapping errors are not retryable — dead-letter immediately.
      if (err instanceof VariantSyncError) break;
      if (attempt < MAX_ATTEMPTS) await sleep(backoffMs(attempt));
    }
  }

  await deps.dlq.send(
    { ...event, attempts: MAX_ATTEMPTS },
    lastErr instanceof Error ? lastErr.message : String(lastErr)
  );
  return { status: "dead-lettered" };
}

// Replay a batch of DLQ variant events back through syncVariant.
export async function replayVariants(
  events: VariantSyncEvent[],
  deps: {
    client: PodVariantClient;
    idempotency: IdempotencyStore;
    dlq: DeadLetterSink;
    sleep?: (ms: number) => Promise<void>;
  }
): Promise<Array<{ ourSku: string; status: string }>> {
  const results: Array<{ ourSku: string; status: string }> = [];
  for (const ev of events) {
    const r = await syncVariant(ev, deps);
    results.push({ ourSku: ev.ourSku, status: r.status });
  }
  return results;
}
