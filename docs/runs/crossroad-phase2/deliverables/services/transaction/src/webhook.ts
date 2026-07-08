/**
 * transaction-service :: webhook.ts
 *
 * Payment provider webhook handler with raw-body signature verification
 * (Stripe constructEvent-style), timestamp tolerance, replay protection,
 * provider event-ID dedupe, amount/currency/order validation, redacted
 * logging, and refund/dispute routing.
 *
 * Implements audit/SECURITY.md Current Posture item 7, which explicitly names
 * the missing controls: "no evidenced payment boundary, order state machine,
 * webhook verification, secrets management". This handler is that webhook
 * verification + order state boundary.
 * Also supports audit/COMMERCE-GAP.md items 7-8 (order success recorded only
 * from a verified provider event, never from the browser checkout call).
 *
 * CRITICAL INVARIANT:
 *   Order success is recorded ONLY here, from a signature-verified webhook.
 *   checkout.ts merely creates a session; it NEVER marks an order paid.
 *
 * Standalone: uses only Node's built-in `crypto`. No other imports.
 */

import { createHmac, timingSafeEqual } from 'crypto';

// ---------------------------------------------------------------------------
// Config (secrets injected via env — never hard-coded, per SECURITY.md).
// ---------------------------------------------------------------------------
const SIGNING_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';
const TOLERANCE_SECONDS = 300; // 5-minute timestamp tolerance window

// ---------------------------------------------------------------------------
// Replay protection + event dedupe stores. In production these are durable
// (e.g. Redis/DB with TTL); in-process Maps here keep the file standalone.
// ---------------------------------------------------------------------------
const seenEventIds = new Set<string>(); // provider event-ID dedupe
const recordedOrders = new Map<string, OrderRecord>();

interface OrderRecord {
  orderId: string;
  status: 'paid' | 'refunded' | 'disputed';
  amount: number;
  currency: string;
  eventId: string;
  recordedAt: string;
}

export interface WebhookResult {
  ok: boolean;
  status: number;
  message: string;
  routed?: 'order.paid' | 'refund' | 'dispute' | 'ignored';
}

// ---------------------------------------------------------------------------
// Redacted logging: never emit signatures, secrets, or full PANs.
// ---------------------------------------------------------------------------
function redact(value: string | undefined): string {
  if (!value) return '<none>';
  if (value.length <= 8) return '****';
  return `${value.slice(0, 4)}...${value.slice(-2)}`;
}
function logRedacted(event: string, detail: Record<string, unknown>): void {
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(detail)) {
    // Redact any sensitive-looking field.
    if (/secret|signature|sig|token|pan|card/i.test(k)) {
      safe[k] = redact(String(v));
    } else {
      safe[k] = v;
    }
  }
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ level: 'info', event, ...safe }));
}

// ---------------------------------------------------------------------------
// parseSignatureHeader — Stripe-style "t=...,v1=..." header parsing.
// ---------------------------------------------------------------------------
function parseSignatureHeader(header: string): { t?: number; v1: string[] } {
  const out: { t?: number; v1: string[] } = { v1: [] };
  for (const part of header.split(',')) {
    const [k, v] = part.split('=');
    if (k === 't') out.t = Number(v);
    else if (k === 'v1' && v) out.v1.push(v);
  }
  return out;
}

function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// ---------------------------------------------------------------------------
// constructEvent — verify signature over the RAW body. Stripe-style HMAC of
// `${timestamp}.${rawBody}`. Returns the parsed event or throws.
// ---------------------------------------------------------------------------
export function constructEvent(
  rawBody: string | Buffer,
  sigHeader: string,
  secret: string = SIGNING_SECRET,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): any {
  if (!secret) throw new Error('Webhook signing secret not configured');
  if (!sigHeader) throw new Error('Missing signature header');

  const raw = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
  const parsed = parseSignatureHeader(sigHeader);

  // 1. Timestamp tolerance check (replay defense window).
  if (!parsed.t || Number.isNaN(parsed.t)) {
    throw new Error('Invalid signature timestamp');
  }
  if (Math.abs(nowSeconds - parsed.t) > TOLERANCE_SECONDS) {
    throw new Error('Signature timestamp outside tolerance');
  }

  // 2. Recompute the expected signature over the raw body.
  const signedPayload = `${parsed.t}.${raw}`;
  const expected = createHmac('sha256', secret).update(signedPayload).digest('hex');

  // 3. Constant-time compare against any provided v1 signature.
  const matched = parsed.v1.some((candidate) => safeEqualHex(candidate, expected));
  if (!matched) {
    throw new Error('Signature verification failed');
  }

  // Only parse AFTER signature verification succeeds.
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// validateAmountCurrencyOrder — reject malformed / mismatched payloads.
// ---------------------------------------------------------------------------
function validatePayment(obj: any): { orderId: string; amount: number; currency: string } | null {
  const orderId = String(obj?.metadata?.orderId ?? obj?.orderId ?? '');
  const amount = Number(obj?.amount ?? obj?.amount_total);
  const currency = String(obj?.currency ?? '').toLowerCase();
  if (!orderId) return null;
  if (!Number.isInteger(amount) || amount <= 0) return null;
  if (currency !== 'usd') return null;
  return { orderId, amount, currency };
}

// ---------------------------------------------------------------------------
// handleWebhook — the full pipeline.
// ---------------------------------------------------------------------------
export function handleWebhook(
  rawBody: string | Buffer,
  sigHeader: string,
  now: number = Math.floor(Date.now() / 1000),
): WebhookResult {
  // 1. signature verification (raw body, timestamp tolerance inside).
  let event: any;
  try {
    event = constructEvent(rawBody, sigHeader, SIGNING_SECRET, now);
  } catch (err) {
    logRedacted('webhook.verify_failed', {
      signature: sigHeader,
      reason: (err as Error).message,
    });
    return { ok: false, status: 400, message: 'signature verification failed' };
  }

  const eventId = String(event?.id ?? '');
  const type = String(event?.type ?? '');

  if (!eventId) {
    return { ok: false, status: 400, message: 'missing event id' };
  }

  // 2. Replay protection / provider event-ID dedupe.
  if (seenEventIds.has(eventId)) {
    logRedacted('webhook.duplicate', { eventId, type });
    return { ok: true, status: 200, message: 'duplicate event ignored', routed: 'ignored' };
  }
  seenEventIds.add(eventId);

  const dataObject = event?.data?.object ?? {};

  // 3. Route by event type.
  switch (type) {
    case 'checkout.session.completed':
    case 'payment_intent.succeeded': {
      const valid = validatePayment(dataObject);
      if (!valid) {
        logRedacted('webhook.invalid_payment', { eventId, type });
        return { ok: false, status: 422, message: 'amount/currency/order validation failed' };
      }
      // ORDER SUCCESS IS RECORDED ONLY HERE — from the verified webhook.
      recordedOrders.set(valid.orderId, {
        orderId: valid.orderId,
        status: 'paid',
        amount: valid.amount,
        currency: valid.currency,
        eventId,
        recordedAt: new Date().toISOString(),
      });
      logRedacted('webhook.order_paid', {
        eventId,
        orderId: valid.orderId,
        amount: valid.amount,
        currency: valid.currency,
      });
      return { ok: true, status: 200, message: 'order recorded paid', routed: 'order.paid' };
    }

    // refund routing (charge.refunded / refund events).
    case 'charge.refunded':
    case 'refund.updated':
    case 'charge.refund.updated': {
      const orderId = String(dataObject?.metadata?.orderId ?? dataObject?.orderId ?? '');
      const existing = orderId ? recordedOrders.get(orderId) : undefined;
      if (existing) {
        existing.status = 'refunded';
        existing.eventId = eventId;
      }
      logRedacted('webhook.refund', { eventId, orderId, type });
      return { ok: true, status: 200, message: 'refund routed', routed: 'refund' };
    }

    // dispute routing (chargebacks).
    case 'charge.dispute.created':
    case 'charge.dispute.updated': {
      const orderId = String(dataObject?.metadata?.orderId ?? dataObject?.orderId ?? '');
      const existing = orderId ? recordedOrders.get(orderId) : undefined;
      if (existing) {
        existing.status = 'disputed';
        existing.eventId = eventId;
      }
      logRedacted('webhook.dispute', { eventId, orderId, type });
      return { ok: true, status: 200, message: 'dispute routed', routed: 'dispute' };
    }

    default:
      logRedacted('webhook.unhandled', { eventId, type });
      return { ok: true, status: 200, message: 'event acknowledged', routed: 'ignored' };
  }
}

// Read-only accessor for ops/tests — never mutates state.
export function getOrder(orderId: string): OrderRecord | undefined {
  return recordedOrders.get(orderId);
}
