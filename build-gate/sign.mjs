// sign.mjs — per-model HMAC packet signing (identity floor for trust_mode "signed").
//
// HONEST RESIDUAL: a determined single owner holding every TELOS_SECRET_* can
// still forge all packets. This defeats CARELESS cross-signing and accidental
// rubber-stamping, not a malicious owner — the chosen (honest-but-careless)
// threat model. Identity here is integrity + binding, not non-repudiation.

import { createHmac, timingSafeEqual } from "node:crypto";

function stripSignature(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const { signature, ...rest } = obj;
  return rest;
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((acc, k) => { acc[k] = sortValue(value[k]); return acc; }, {});
  }
  return value;
}

export function canonicalize(packet) {
  return JSON.stringify(sortValue(stripSignature(packet)));
}

export function signPacket(packet, secret) {
  const value = createHmac("sha256", String(secret)).update(canonicalize(packet)).digest("hex");
  return { ...packet, signature: { alg: "HMAC-SHA256", value, signed_fields: "canonical-minus-signature" } };
}

export function verifyPacket(packet, secret) {
  if (!packet || typeof packet !== "object") return { ok: false, reason: "packet not an object" };
  const sig = packet.signature;
  if (!sig || typeof sig !== "object" || typeof sig.value !== "string") return { ok: false, reason: "missing signature" };
  if (sig.alg !== "HMAC-SHA256") return { ok: false, reason: `unsupported alg '${sig.alg}'` };
  if (typeof secret !== "string" || secret.length === 0) return { ok: false, reason: "no secret to verify against" };
  const expected = createHmac("sha256", secret).update(canonicalize(packet)).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(sig.value, "hex");
  if (a.length !== b.length) return { ok: false, reason: "signature length mismatch" };
  return timingSafeEqual(a, b) ? { ok: true, reason: "ok" } : { ok: false, reason: "signature mismatch" };
}

export function secretFor(model) {
  if (typeof model !== "string" || !model) return null;
  return process.env["TELOS_SECRET_" + model.toUpperCase()] || null;
}
