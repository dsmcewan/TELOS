// app.js — DOM glue for the tamper demo. All verification logic lives in
// verify.js; this file only renders artifacts, collects edits, and reports
// the named result of each real check.

import { verifyDecision, verifyDigest } from "./verify.js";

const state = { committed: null, working: null };
const $ = (id) => document.getElementById(id);

function deepClone(v) { return JSON.parse(JSON.stringify(v)); }

function renderStatus(kind, title, detail) {
  const panel = $("status-panel");
  panel.className = `status-${kind}`;
  panel.innerHTML = "";
  const h = document.createElement("strong");
  h.textContent = title;
  const p = document.createElement("span");
  p.textContent = detail;
  panel.append(h, p);
}

// Render one JSON object as a definition list of click-to-edit leaf fields.
// `path` addresses the field inside the working copy for edit-writeback.
function renderObject(container, obj, path) {
  const dl = document.createElement("dl");
  for (const [key, value] of Object.entries(obj)) {
    const dt = document.createElement("dt");
    dt.textContent = key;
    const dd = document.createElement("dd");
    if (value && typeof value === "object") {
      renderObject(dd, value, [...path, key]);
    } else {
      dd.textContent = JSON.stringify(value);
      dd.tabIndex = 0;
      dd.className = "editable";
      dd.title = "Click to tamper with this field";
      dd.addEventListener("click", () => beginEdit(dd, [...path, key]));
    }
    dl.append(dt, dd);
  }
  container.append(dl);
}

function beginEdit(dd, path) {
  const input = document.createElement("input");
  input.value = dd.textContent;
  dd.replaceChildren(input);
  input.focus();
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });
  input.addEventListener("blur", () => {
    let parsed;
    try { parsed = JSON.parse(input.value); } catch { parsed = input.value; }
    let target = state.working;
    for (const k of path.slice(0, -1)) target = target[k];
    target[path.at(-1)] = parsed;
    dd.textContent = JSON.stringify(parsed);
    dd.classList.add("tampered");
    renderStatus("halted", "HALTED", "Evidence edited — verification pending. Click Verify.");
  });
}

function renderEvidence() {
  const panel = $("evidence-panel");
  panel.innerHTML = "";
  const ledgerBox = document.createElement("div");
  ledgerBox.className = "evidence-box";
  ledgerBox.innerHTML = "<h3>Ed25519 decision ledger entry</h3>";
  renderObject(ledgerBox, state.working.ledger[0], ["ledger", 0]);
  const recordBox = document.createElement("div");
  recordBox.className = "evidence-box";
  recordBox.innerHTML = "<h3>Content-addressed needs-human record</h3>";
  renderObject(recordBox, state.working.bound.record, ["bound", "record"]);
  panel.append(ledgerBox, recordBox);
}

async function runVerification() {
  const { ledger, publicJwk, bound } = state.working;
  const sig = await verifyDecision(ledger[0], publicJwk);
  if (!sig.ok) {
    if (sig.reason === "webcrypto-unavailable" || sig.reason === "ed25519-unsupported") {
      renderStatus("error", "CANNOT VERIFY HERE",
        `This browser lacks ${sig.reason === "ed25519-unsupported" ? "Ed25519 WebCrypto" : "WebCrypto"}. ` +
        "Run the proof locally: node docs/runs/fail-closed-demo/run.mjs");
    } else {
      renderStatus("blocked", "BLOCKED", `Ed25519 check failed: ${sig.reason}`);
    }
    return;
  }
  const dig = await verifyDigest(bound.record, bound.digest);
  if (!dig.ok) {
    renderStatus("blocked", "BLOCKED", `content-address check failed: ${dig.reason}`);
    return;
  }
  renderStatus("verified", "VERIFIED",
    "Ed25519 signature valid against the committed public key; SHA-256 content address matches.");
}

async function loadArtifacts() {
  const get = async (name) => {
    const res = await fetch(`artifacts/${name}`);
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    return res.json();
  };
  return {
    ledger: await get("ledger.json"),
    publicJwk: await get("public-key.jwk.json"),
    bound: await get("record.json")
  };
}

async function main() {
  try {
    state.committed = await loadArtifacts();
  } catch (err) {
    renderStatus("error", "EVIDENCE UNAVAILABLE",
      `Could not load committed artifacts (${err.message}). The demo fails closed rather than showing fake data.`);
    return;
  }
  state.working = deepClone(state.committed);
  renderEvidence();
  $("btn-verify").addEventListener("click", runVerification);
  $("btn-reset").addEventListener("click", () => {
    state.working = deepClone(state.committed);
    renderEvidence();
    renderStatus("halted", "RESET", "Committed evidence restored. Click Verify.");
  });
  await runVerification();
}

main();
