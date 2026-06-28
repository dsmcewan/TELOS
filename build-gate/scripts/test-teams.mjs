#!/usr/bin/env node
// test-teams.mjs — the agentic-teams roster: dossier-sized planTeams, deterministic
// node->team routing, and the authorized_signers collection that pins teams to the ledger.
import assert from "node:assert/strict";
import { TEAMS, planTeams, teamForNode, authorizedSignersFor } from "../teams.mjs";

// --- TEAMS shape: every team is well-formed and its signer is usable as a key_id ---
{
  assert.ok(Array.isArray(TEAMS) && TEAMS.length >= 5, "TEAMS is a non-trivial roster");
  const ids = new Set();
  for (const t of TEAMS) {
    assert.ok(typeof t.id === "string" && t.id.length > 0, "team has an id");
    assert.ok(!ids.has(t.id), `team id '${t.id}' is unique`);
    ids.add(t.id);
    assert.ok(Array.isArray(t.seats) && t.seats.length > 0, `team '${t.id}' has seats`);
    assert.ok(t.seats.every((s) => typeof s.model === "string" && typeof s.role === "string"), `team '${t.id}' seats are {model,role}`);
    assert.ok(["plan", "build", "verify"].includes(t.lifecycle), `team '${t.id}' has a valid lifecycle`);
    assert.ok(typeof (t.signer || t.id) === "string", `team '${t.id}' has a signer key_id`);
  }
}

// --- planTeams: non-market job convenes only the always-on meta backbone ---
{
  const roster = planTeams({ build_id: "x" });
  const got = roster.map((t) => t.id).sort();
  assert.deepEqual(got, ["architecture", "breakout", "planning"], "non-market job = planning + architecture + breakout");
}

// --- planTeams: market-bound job adds one team per required workstream, deduped ---
{
  const roster = planTeams({
    build_id: "x",
    market_bound: true,
    required_market_workstreams: ["backend-schema", "frontend-brand-experience", "product-architecture"]
  });
  const got = roster.map((t) => t.id).sort();
  // architecture owns product-architecture AND is always-on => must appear exactly once.
  assert.deepEqual(got, ["architecture", "backend", "breakout", "frontend", "planning"], "market job adds workstream teams, architecture not doubled");
  assert.equal(got.filter((id) => id === "architecture").length, 1, "architecture deduped");
}

// --- planTeams: unknown workstream is ignored (no phantom team) ---
{
  const roster = planTeams({ build_id: "x", market_bound: true, required_market_workstreams: ["does-not-exist"] });
  const got = roster.map((t) => t.id).sort();
  assert.deepEqual(got, ["architecture", "breakout", "planning"], "unknown workstream contributes no team");
}

// --- teamForNode: explicit workstream routes deterministically ---
{
  const roster = planTeams({ build_id: "x", market_bound: true, required_market_workstreams: ["backend-schema", "frontend-brand-experience"] });
  assert.equal(teamForNode({ id: "n1", workstream: "backend-schema" }, roster).id, "backend", "backend-schema node -> backend team");
  assert.equal(teamForNode({ id: "n2", workstream: "frontend-brand-experience" }, roster).id, "frontend", "frontend node -> frontend team");
  // same node routes the same way every time (pure)
  assert.equal(teamForNode({ id: "n1", workstream: "backend-schema" }, roster).id, "backend", "routing is deterministic");
}

// --- teamForNode: no/unknown workstream falls back to the first build team ---
{
  const roster = planTeams({ build_id: "x" }); // planning, architecture(build), breakout
  assert.equal(teamForNode({ id: "n3" }, roster).id, "architecture", "missing workstream -> first build team");
  assert.equal(teamForNode({ id: "n4", workstream: "backend-schema" }, roster).id, "architecture", "absent team -> first build-team fallback");
}

// --- authorizedSignersFor: only signers present in the keyring are pinned (fail-closed) ---
{
  const roster = planTeams({ build_id: "x" }); // signers: planning, architecture, breakout
  const fullKeyring = { planning: { kty: "OKP" }, architecture: { kty: "OKP" }, breakout: { kty: "OKP" }, unused: { kty: "OKP" } };
  const signers = authorizedSignersFor(roster, fullKeyring);
  assert.deepEqual(Object.keys(signers).sort(), ["architecture", "breakout", "planning"], "collects each roster team's signer; ignores unused keys");

  const partial = authorizedSignersFor(roster, { architecture: { kty: "OKP" } });
  assert.deepEqual(Object.keys(partial), ["architecture"], "a team whose key is absent cannot settle (excluded)");

  assert.deepEqual(authorizedSignersFor(roster, null), {}, "no keyring => no signers (fail-closed)");
}

console.log("test-teams.mjs OK");
