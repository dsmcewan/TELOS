// verify.js — browser/Node verification of TELOS committed evidence.
//
// `canonical` and `entryBytes` are a line-for-line port of the module-private
// routines in forge/operator.mjs (the ledger's actual signer). Parity is
// enforced end-to-end by test/verify.test.mjs: the real operator signs, this
// module must verify. Any byte-level drift fails that test.

export function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

export function entryBytes(entry) {
  const { sig, ...rest } = entry;
  return new TextEncoder().encode(canonical(rest));
}

export function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export async function sha256Hex(bytes, subtle = globalThis.crypto?.subtle) {
  const buf = await subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyDecision(record, publicJwk, subtle = globalThis.crypto?.subtle) {
  if (!subtle) return { ok: false, reason: "webcrypto-unavailable" };
  const sig = record?.sig;
  if (!sig || typeof sig.value !== "string") return { ok: false, reason: "missing-signature" };
  if (sig.alg !== "Ed25519") return { ok: false, reason: "unsupported-alg" };
  if (sig.signed_fields !== "all-minus-sig") return { ok: false, reason: "unsupported-signed-fields" };
  let key;
  try {
    key = await subtle.importKey("jwk", publicJwk, { name: "Ed25519" }, false, ["verify"]);
  } catch {
    return { ok: false, reason: "ed25519-unsupported" };
  }
  const ok = await subtle.verify("Ed25519", key, base64ToBytes(sig.value), entryBytes(record));
  return ok ? { ok: true, reason: "ok" } : { ok: false, reason: "invalid-signature" };
}

export async function verifyDigest(record, digest, subtle = globalThis.crypto?.subtle) {
  if (!subtle) return { ok: false, reason: "webcrypto-unavailable" };
  if (digest?.alg !== "SHA-256") return { ok: false, reason: "unsupported-alg" };
  const hex = await sha256Hex(new TextEncoder().encode(canonical(record)), subtle);
  return hex === digest.value
    ? { ok: true, reason: "ok" }
    : { ok: false, reason: "digest-mismatch" };
}
