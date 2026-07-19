// sign.mjs — per-model HMAC packet signing (identity floor for trust_mode "signed").
//
// HONEST RESIDUAL: a determined single owner holding every TELOS_SECRET_* can
// still forge all packets. This defeats CARELESS cross-signing and accidental
// rubber-stamping, not a malicious owner — the chosen (honest-but-careless)
// threat model. Identity here is integrity + binding, not non-repudiation.

import { createHmac, timingSafeEqual, createHash } from "node:crypto";

function stripSignature(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const { signature, ...rest } = obj;
  return rest;
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const sorted = Object.create(null);
    for (const k of Object.keys(value).sort()) sorted[k] = sortValue(value[k]);
    return sorted;
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

// A market-readiness packet is authored by the trusted harness from an on-disk-
// verified breakout record, so it has no live server response id. In signed mode it
// is re-attributed to the workstream's SIGNER (which must have a TELOS_SECRET_*),
// carries a reproducible content-addressed attestation over the record, and is
// HMAC-signed. The reviewing `lens` is preserved as `reviewed_by_lens`. Without a
// secret the packet is returned attested-but-unsigned so the gate blocks it.
export function signMarketPacket(packet, record, signer) {
  const digest = createHash("sha256").update(canonicalize(record ?? null)).digest("hex");
  const stamped = {
    ...packet,
    model: signer,
    reviewed_by_lens: packet.model,
    provenance: { model: signer, source: "forge/market-attestation", response_id: `market-${digest}` }
  };
  const secret = secretFor(signer);
  return secret ? signPacket(stamped, secret) : stamped;
}
