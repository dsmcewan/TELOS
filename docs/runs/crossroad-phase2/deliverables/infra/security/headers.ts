/**
 * infra/security/headers.ts
 *
 * Hosting-level security headers for Crossroad Threads.
 *
 * WHY THIS FILE EXISTS (evidence):
 *   audit/SECURITY.md §"Current Posture" item 4 states: "Security headers are
 *   not configured in the supplied Next config: `source/next.config.ts` has no
 *   `headers()` export/function." Because `source/next.config.ts` contains
 *   `output: "export"` (a static export), Next cannot attach response headers at
 *   runtime — there is no Node server in the request path. Therefore these headers
 *   MUST be attached by the hosting/edge layer (CloudFront response-headers
 *   policy, ALB, or nginx) as noted in audit/SECURITY.md items 4 and 5.
 *
 * This module is a standalone, framework-agnostic source of truth. It exports
 * plain data + a serializer so it can be consumed by a CloudFront function,
 * an nginx add_header generator, or a Next `headers()` shim if Phase 2 moves
 * to a server-rendered path. It performs NO file writes and NO network calls.
 *
 * Rollout for CSP is two-phase (report-only, then enforce), per the SECURITY.md
 * "CSP" section which records that no repository-supplied CSP exists yet.
 */

export type SecurityHeader = { name: string; value: string };

/**
 * CSP REPORT ENDPOINT NOTE
 * ------------------------
 * Set CSP_REPORT_URI to a collector you control (e.g. an API Gateway route or a
 * third-party report sink). During the report-only phase the browser POSTs
 * violation reports here without blocking; this lets you tune the policy against
 * real traffic before enforcing. Keep this endpoint OFF the enforced allowlist
 * paths and rate-limit it. When you flip to enforce mode, keep report-uri active
 * so you continue to receive violations after enforcement begins.
 */
export const CSP_REPORT_URI = "/csp-report";

/**
 * Directive set. `self` is the own-domain origin (audit HYPOTHESIS H1:
 * own-domain storefront). No wildcard script/style sources; inline is disallowed
 * by omitting 'unsafe-inline'. Tighten img/connect once the POD vendor (H3) and
 * payment provider (H1) origins are confirmed via SECURITY.md validation plans.
 */
const CSP_DIRECTIVES: Record<string, string[]> = {
  "default-src": ["'self'"],
  "script-src": ["'self'"],
  "style-src": ["'self'"],
  "img-src": ["'self'", "data:"],
  "font-src": ["'self'"],
  "connect-src": ["'self'"],
  "frame-ancestors": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "object-src": ["'none'"],
  "upgrade-insecure-requests": [],
};

function serializeCsp(directives: Record<string, string[]>): string {
  const parts = Object.entries(directives).map(([key, values]) =>
    values.length ? `${key} ${values.join(" ")}` : key
  );
  parts.push(`report-uri ${CSP_REPORT_URI}`);
  return parts.join("; ");
}

const CSP_VALUE = serializeCsp(CSP_DIRECTIVES);

/**
 * PHASE 1 — report-only. Emits Content-Security-Policy-Report-Only so violations
 * are collected without breaking the storefront.
 */
export const cspReportOnlyHeaders: SecurityHeader[] = [
  { name: "Content-Security-Policy-Report-Only", value: CSP_VALUE },
];

/**
 * PHASE 2 — enforce. Emits Content-Security-Policy (blocking). Flip to this set
 * only after report-only traffic shows zero legitimate violations.
 */
export const cspEnforceHeaders: SecurityHeader[] = [
  { name: "Content-Security-Policy", value: CSP_VALUE },
];

/**
 * Always-on hardening headers. Strict-Transport-Security addresses SECURITY.md
 * item 5 ("HTTPS redirect, HSTS ... must be provided by the own-domain host").
 * Only enable HSTS once TLS is live on the apex + all subdomains, since
 * includeSubDomains + preload is hard to reverse.
 */
export const baselineSecurityHeaders: SecurityHeader[] = [
  {
    name: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { name: "X-Content-Type-Options", value: "nosniff" },
  { name: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    name: "Permissions-Policy",
    value: "geolocation=(), microphone=(), camera=(), payment=(self), interest-cohort=()",
  },
];

/** Report-only rollout bundle (use first). */
export const securityHeadersReportOnly: SecurityHeader[] = [
  ...baselineSecurityHeaders,
  ...cspReportOnlyHeaders,
];

/** Enforced bundle (use after tuning). */
export const securityHeadersEnforced: SecurityHeader[] = [
  ...baselineSecurityHeaders,
  ...cspEnforceHeaders,
];

/**
 * Convenience serializer for hosting layers that consume name/value maps
 * (e.g. CloudFront custom headers). Pure function, no side effects.
 */
export function toHeaderMap(headers: SecurityHeader[]): Record<string, string> {
  return headers.reduce<Record<string, string>>((acc, h) => {
    acc[h.name] = h.value;
    return acc;
  }, {});
}

export default {
  CSP_REPORT_URI,
  securityHeadersReportOnly,
  securityHeadersEnforced,
  baselineSecurityHeaders,
  toHeaderMap,
};
