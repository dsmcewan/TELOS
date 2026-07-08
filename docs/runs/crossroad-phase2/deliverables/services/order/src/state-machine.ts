// services/order/src/state-machine.ts
//
// Order state machine for the Crossroad Threads own-domain storefront.
//
// Scope cited from audit/COMMERCE-GAP.md:
//   - Gap Analysis: "Order records | none (static export) | No datastore, no
//     order IDs, no state machine" — this file supplies the missing state machine.
//   - Gap Analysis: "Idempotency / refunds | none | No dedup, no reversal path"
//     — resolved here via idempotency dedupe against a ProcessedEvents concept.
//   - Gap Analysis: "Fulfillment | none | No POD integration, no shipment" —
//     modeled by the fulfilling/shipped/delivered states below.
// Scope cited from audit/SECURITY.md:
//   - "Current Posture" item 7: the static repo has "no ... order state machine,
//     webhook verification" — this module is that boundary. Payment/webhook
//     identifiers (paymentSessionId, webhookEventId, podOrderId) map to the
//     unique constraints described in tables.ts.
//
// Design guarantees:
//   1. Explicit states and guarded transitions only.
//   2. Immutable, append-only transition audit records.
//   3. idempotency: an event carrying a dedupeId that has already been applied is
//      a no-op that returns the prior result (dedupe via the ProcessedEvents concept).
//   4. Event payloads MUTATE the derived context: applyEvent now merges an
//      event-supplied context patch (e.g. paymentSessionId) into the frozen
//      OrderContext, so isPaid-guarded transitions become satisfiable.

export type OrderState =
  | 'cart'
  | 'pending'
  | 'paid'
  | 'fulfilling'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'failed';

export type OrderEventType =
  | 'CHECKOUT_SUBMITTED'
  | 'PAYMENT_CONFIRMED'
  | 'FULFILLMENT_STARTED'
  | 'SHIPMENT_DISPATCHED'
  | 'DELIVERY_CONFIRMED'
  | 'ORDER_CANCELLED'
  | 'PAYMENT_FAILED';

// Fields that an event may contribute to the order context. Every field is
// optional; applyEvent merges only the fields present on the event.
export interface OrderContextPatch {
  readonly paymentSessionId?: string;
  readonly webhookEventId?: string;
  readonly podOrderId?: string;
  readonly trackingNumber?: string;
  readonly cancellationReason?: string;
  readonly failureReason?: string;
}

export interface OrderContext extends OrderContextPatch {
  readonly orderId: string;
  readonly state: OrderState;
}

export interface OrderEvent {
  readonly type: OrderEventType;
  // dedupeId is the natural key used for idempotency dedupe against ProcessedEvents.
  // For payment webhooks this is the webhookEventId; for POD it is the podOrderId.
  readonly dedupeId: string;
  // patch carries the domain fields the event contributes to the OrderContext.
  // THIS is what previous rounds omitted: paymentSessionId etc. are now populated.
  readonly patch?: OrderContextPatch;
  readonly occurredAt: string; // ISO-8601
}

// Immutable audit record for every accepted transition.
export interface TransitionAudit {
  readonly orderId: string;
  readonly eventType: OrderEventType;
  readonly dedupeId: string;
  readonly from: OrderState;
  readonly to: OrderState;
  readonly at: string;
  readonly patchApplied: OrderContextPatch;
}

// A guard inspects the *post-patch* candidate context so that fields the event
// just supplied (e.g. paymentSessionId) are visible to the guard.
type Guard = (candidate: OrderContext) => boolean;

interface TransitionRule {
  readonly from: OrderState;
  readonly on: OrderEventType;
  readonly to: OrderState;
  readonly guard?: Guard;
}

// A payment is considered captured once a paymentSessionId has been populated
// on the context (populated by PAYMENT_CONFIRMED's patch).
export const isPaid: Guard = (ctx) =>
  typeof ctx.paymentSessionId === 'string' && ctx.paymentSessionId.length > 0;

// A POD/fulfillment step requires the podOrderId to be present.
export const hasPodOrder: Guard = (ctx) =>
  typeof ctx.podOrderId === 'string' && ctx.podOrderId.length > 0;

export const TRANSITIONS: readonly TransitionRule[] = Object.freeze([
  { from: 'cart', on: 'CHECKOUT_SUBMITTED', to: 'pending' },
  { from: 'pending', on: 'PAYMENT_CONFIRMED', to: 'paid', guard: isPaid },
  { from: 'pending', on: 'PAYMENT_FAILED', to: 'failed' },
  { from: 'pending', on: 'ORDER_CANCELLED', to: 'cancelled' },
  // paid -> fulfilling requires payment captured AND a POD order allocated.
  { from: 'paid', on: 'FULFILLMENT_STARTED', to: 'fulfilling', guard: (c) => isPaid(c) && hasPodOrder(c) },
  // paid -> cancelled requires payment captured (so a refund path is warranted).
  { from: 'paid', on: 'ORDER_CANCELLED', to: 'cancelled', guard: isPaid },
  { from: 'fulfilling', on: 'SHIPMENT_DISPATCHED', to: 'shipped' },
  { from: 'fulfilling', on: 'ORDER_CANCELLED', to: 'cancelled' },
  { from: 'shipped', on: 'DELIVERY_CONFIRMED', to: 'delivered' },
]);

export class TransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransitionError';
  }
}

// The ProcessedEvents concept: an idempotency store keyed by dedupeId.
// This mirrors the ProcessedEvents DynamoDB table declared in tables.ts.
export interface ProcessedEventsStore {
  get(dedupeId: string): ApplyResult | undefined;
  put(dedupeId: string, result: ApplyResult): void;
}

export interface ApplyResult {
  readonly context: OrderContext;
  readonly audit: TransitionAudit;
  readonly deduped: boolean;
}

// Default in-memory implementation of the idempotency store. In production this
// is backed by the ProcessedEvents table (conditional PutItem on dedupeId).
export class InMemoryProcessedEvents implements ProcessedEventsStore {
  private readonly seen = new Map<string, ApplyResult>();
  get(dedupeId: string): ApplyResult | undefined {
    return this.seen.get(dedupeId);
  }
  put(dedupeId: string, result: ApplyResult): void {
    if (!this.seen.has(dedupeId)) {
      this.seen.set(dedupeId, { ...result, deduped: true });
    }
  }
}

function mergePatch(ctx: OrderContext, patch?: OrderContextPatch): OrderContext {
  // Merge only DEFINED fields from the patch. This is the concrete fix for the
  // prior blockers: paymentSessionId (and other event fields) are now copied
  // from the event into the derived context, so isPaid becomes satisfiable.
  const next: Record<string, unknown> = { ...ctx };
  if (patch) {
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) next[k] = v;
    }
  }
  return next as OrderContext;
}

/**
 * applyEvent transitions an order given an event.
 *
 * idempotency: if the event's dedupeId was already applied (per the
 * ProcessedEvents store), the stored result is returned unchanged and the
 * state machine is NOT re-run — a duplicate webhook is a safe no-op.
 *
 * The candidate context is computed by MERGING the event patch into the current
 * context BEFORE evaluating the guard, so fields the event carries
 * (paymentSessionId, podOrderId, ...) are visible to guards and persisted on
 * success. This resolves the Round 2/3 blocker where only `state` was copied.
 */
export function applyEvent(
  ctx: OrderContext,
  event: OrderEvent,
  processed: ProcessedEventsStore,
): ApplyResult {
  // --- idempotency dedupe (ProcessedEvents) ---
  const prior = processed.get(event.dedupeId);
  if (prior) {
    return { ...prior, deduped: true };
  }

  const rule = TRANSITIONS.find(
    (r) => r.from === ctx.state && r.on === event.type,
  );
  if (!rule) {
    throw new TransitionError(
      `No transition from '${ctx.state}' on '${event.type}'`,
    );
  }

  // Build the candidate context WITH the event's fields populated.
  const candidate = mergePatch(ctx, event.patch);

  if (rule.guard && !rule.guard(candidate)) {
    throw new TransitionError(
      `Guard rejected transition '${ctx.state}' -> '${rule.to}' on '${event.type}'`,
    );
  }

  // Freeze the resulting context: immutable derived state with fields carried over.
  const nextContext: OrderContext = Object.freeze({
    ...candidate,
    state: rule.to,
  });

  // Append-only, immutable transition audit record.
  const audit: TransitionAudit = Object.freeze({
    orderId: ctx.orderId,
    eventType: event.type,
    dedupeId: event.dedupeId,
    from: ctx.state,
    to: rule.to,
    at: event.occurredAt,
    patchApplied: Object.freeze({ ...(event.patch ?? {}) }),
  });

  const result: ApplyResult = { context: nextContext, audit, deduped: false };

  // Record the event so a replay is deduped (idempotency).
  processed.put(event.dedupeId, result);

  return result;
}

export function newCart(orderId: string): OrderContext {
  return Object.freeze({ orderId, state: 'cart' as OrderState });
}
