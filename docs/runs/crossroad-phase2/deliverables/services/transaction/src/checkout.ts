/**
 * transaction-service :: checkout.ts
 *
 * Server-authoritative checkout-session creation.
 *
 * Implements audit/COMMERCE-GAP.md items 7-8 and audit/SECURITY.md items 6-7:
 *  - SECURITY.md Current Posture item 7 flags that the supplied repo has
 *    "no evidenced payment boundary, order state machine, webhook
 *    verification, secrets management". This file establishes the payment
 *    boundary with server-side re-pricing.
 *  - SECURITY.md item 6 flags asset/trust-surface review; here we ensure no
 *    secrets or internal pricing internals leak in the response body.
 *  - SECURITY.md audit note that `checkout` hits in `.github/workflows/deploy.yml`
 *    and `content/designs.json` are NOT a real payment implementation; this is.
 *
 * CORE RULES:
 *  1. NEVER trust browser-supplied amounts. The server re-prices every line
 *     from an authoritative in-process catalog.
 *  2. idempotency keys prevent duplicate session/charge creation on retry.
 *  3. SKU + quantity + amount validation before any session is created.
 *  4. No secrets ever appear in the response.
 *
 * Standalone: no external imports; catalog is embedded inline per build rules.
 */

// ---------------------------------------------------------------------------
// Authoritative catalog (embedded inline — never read from disk / never from
// the browser). Amounts are in minor units (cents) to avoid float drift.
// ---------------------------------------------------------------------------
export interface CatalogEntry {
  sku: string;
  title: string;
  unitAmount: number; // minor units (cents)
  currency: 'usd';
  active: boolean;
}

const CATALOG: Readonly<Record<string, CatalogEntry>> = Object.freeze({
  'CT-TEE-001': { sku: 'CT-TEE-001', title: 'Crossroad Threads Tee', unitAmount: 2800, currency: 'usd', active: true },
  'CT-HOOD-001': { sku: 'CT-HOOD-001', title: 'Crossroad Threads Hoodie', unitAmount: 5400, currency: 'usd', active: true },
  'CT-CAP-001': { sku: 'CT-CAP-001', title: 'Crossroad Threads Cap', unitAmount: 2200, currency: 'usd', active: true },
});

const MAX_QTY_PER_LINE = 25;
const MAX_LINES = 50;
const MAX_ORDER_TOTAL = 500000; // $5,000.00 sanity ceiling

// ---------------------------------------------------------------------------
// Request / response contracts
// ---------------------------------------------------------------------------
export interface CheckoutLineInput {
  sku: string;
  quantity: number;
  // NOTE: any client-supplied `amount`/`price` field is deliberately IGNORED.
}

export interface CheckoutRequest {
  idempotencyKey: string;
  currency: string;
  lines: CheckoutLineInput[];
}

export interface CheckoutLineResolved {
  sku: string;
  title: string;
  quantity: number;
  unitAmount: number;
  lineAmount: number;
}

export interface CheckoutSession {
  sessionId: string;
  status: 'created';
  currency: string;
  lines: CheckoutLineResolved[];
  amountTotal: number; // server-computed, authoritative
  createdAt: string;
}

export interface CheckoutError {
  error: string;
  code:
    | 'INVALID_IDEMPOTENCY_KEY'
    | 'INVALID_CURRENCY'
    | 'EMPTY_CART'
    | 'TOO_MANY_LINES'
    | 'UNKNOWN_SKU'
    | 'INACTIVE_SKU'
    | 'INVALID_QUANTITY'
    | 'ORDER_TOO_LARGE';
}

// ---------------------------------------------------------------------------
// Idempotency store. In production this is backed by a durable store keyed on
// the idempotency key; here it is an in-process Map. The SAME idempotency key
// always returns the SAME session and never creates a duplicate charge.
// ---------------------------------------------------------------------------
const idempotencyStore = new Map<string, CheckoutSession>();

function isValidIdempotencyKey(key: unknown): key is string {
  return typeof key === 'string' && /^[A-Za-z0-9._:-]{8,128}$/.test(key);
}

function newSessionId(): string {
  // Opaque, non-guessable id. No secret material is embedded here.
  const rnd = () => Math.random().toString(36).slice(2, 12);
  return `cs_${Date.now().toString(36)}_${rnd()}${rnd()}`;
}

// ---------------------------------------------------------------------------
// createCheckoutSession — server-authoritative.
// ---------------------------------------------------------------------------
export function createCheckoutSession(
  req: CheckoutRequest,
): CheckoutSession | CheckoutError {
  // 1. idempotency validation + replay short-circuit.
  if (!isValidIdempotencyKey(req?.idempotencyKey)) {
    return { error: 'Missing or malformed idempotency key', code: 'INVALID_IDEMPOTENCY_KEY' };
  }
  const existing = idempotencyStore.get(req.idempotencyKey);
  if (existing) {
    // Idempotent replay: return the original session, do NOT re-create.
    return existing;
  }

  // 2. currency validation.
  const currency = String(req?.currency ?? '').toLowerCase();
  if (currency !== 'usd') {
    return { error: 'Unsupported currency', code: 'INVALID_CURRENCY' };
  }

  // 3. cart shape validation.
  const lines = Array.isArray(req?.lines) ? req.lines : [];
  if (lines.length === 0) {
    return { error: 'Cart is empty', code: 'EMPTY_CART' };
  }
  if (lines.length > MAX_LINES) {
    return { error: 'Too many line items', code: 'TOO_MANY_LINES' };
  }

  // 4. Server-side re-pricing. The browser amount is never read.
  const resolved: CheckoutLineResolved[] = [];
  let amountTotal = 0;

  for (const line of lines) {
    const entry = CATALOG[String(line?.sku ?? '')];
    if (!entry) {
      return { error: `Unknown SKU: ${String(line?.sku)}`, code: 'UNKNOWN_SKU' };
    }
    if (!entry.active) {
      return { error: `Inactive SKU: ${entry.sku}`, code: 'INACTIVE_SKU' };
    }
    const qty = Number(line?.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
      return { error: `Invalid quantity for ${entry.sku}`, code: 'INVALID_QUANTITY' };
    }
    if (entry.currency !== currency) {
      return { error: 'Currency mismatch on SKU', code: 'INVALID_CURRENCY' };
    }

    const lineAmount = entry.unitAmount * qty; // AUTHORITATIVE price
    amountTotal += lineAmount;
    resolved.push({
      sku: entry.sku,
      title: entry.title,
      quantity: qty,
      unitAmount: entry.unitAmount,
      lineAmount,
    });
  }

  if (amountTotal <= 0 || amountTotal > MAX_ORDER_TOTAL) {
    return { error: 'Order total out of bounds', code: 'ORDER_TOO_LARGE' };
  }

  // 5. Build the session. NOTE: response contains NO secrets — no provider
  // API keys, no webhook signing secret, no internal cost/margin data.
  const session: CheckoutSession = {
    sessionId: newSessionId(),
    status: 'created',
    currency,
    lines: resolved,
    amountTotal,
    createdAt: new Date().toISOString(),
  };

  // Persist under the idempotency key so retries are safe.
  idempotencyStore.set(req.idempotencyKey, session);
  return session;
}

// Test/ops helper: expose read-only catalog view (no secrets).
export function catalogView(): CatalogEntry[] {
  return Object.values(CATALOG);
}
