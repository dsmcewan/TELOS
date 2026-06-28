// research.mjs — the "research breakout" stage of the SaaS forge.
//
// Given a project's telos + the required market workstreams, it derives the
// capability domains a SaaS build needs (UI / DB / infra / auth / evals) and,
// for each, gathers up-to-date architecture guidance through an INJECTED
// `docsFor` adapter. In the live deployment `docsFor` is backed by Context7
// (resolve-library-id -> query-docs); offline it falls back to a curated KB so
// the forge is runnable + testable with no network/keys (the TELOS idiom:
// callers are injected, deterministic in tests, live in deployment).

// Market workstream -> capability domain. Workstreams with no concrete library
// (business-positioning, product-architecture) shape prose, not a stack pick.
const WORKSTREAM_DOMAINS = {
  "frontend-brand-experience": "ui",
  "backend-schema": "db",
  "security-trust": "auth",
  "scale-operations": "infra",
  "accuracy-evals": "evals"
};

// The core SaaS triad always researched, so ARCHITECTURE.md describes a real
// multi-tier system even for a small slice.
const CORE_DOMAINS = ["ui", "db", "infra"];

// Curated offline stand-in for Context7 `query-docs` results. Each entry is the
// shape a Context7-backed adapter returns: { library, libraryId, summary,
// snippets[] }. Kept deliberately terse — the point is the wiring, not a doc dump.
const OFFLINE_KB = {
  ui: {
    library: "Vite",
    libraryId: "/vitejs/vite",
    summary: "Vite + React for a static-first SPA: instant dev server, Rollup production build to a hashed static bundle that ships to a CDN.",
    snippets: [
      "npm create vite@latest app -- --template react",
      "vite build  # emits dist/ static assets for CDN upload"
    ]
  },
  db: {
    library: "Supabase",
    libraryId: "/supabase/supabase",
    summary: "Supabase (managed Postgres) for relational data, row-level security, and auth; accessed from the SPA via the supabase-js client with RLS policies enforcing tenant isolation.",
    snippets: [
      "create policy tenant_isolation on findings using (tenant_id = auth.uid());",
      "const supabase = createClient(URL, ANON_KEY)"
    ]
  },
  infra: {
    library: "AWS CDK",
    libraryId: "/aws/aws-cdk",
    summary: "AWS CDK to provision S3 (static origin) + CloudFront (TLS, caching, SPA routing) as code, so the frontend deploy is reproducible and versioned.",
    snippets: [
      "new s3.Bucket(this, 'Site', { websiteIndexDocument: 'index.html' })",
      "new cloudfront.Distribution(this, 'CDN', { defaultBehavior: { origin } })"
    ]
  },
  auth: {
    library: "Supabase Auth",
    libraryId: "/supabase/supabase",
    summary: "Supabase Auth (GoTrue) for email/OAuth sessions; JWTs carry the tenant claim that RLS policies read. No secrets in the client bundle.",
    snippets: ["await supabase.auth.signInWithOtp({ email })"]
  },
  evals: {
    library: "Vitest",
    libraryId: "/vitest-dev/vitest",
    summary: "Vitest to run the deterministic discriminator against a fixed labeled set and emit a scorecard artifact, so accuracy is measured, not asserted.",
    snippets: ["expect(score.precision).toBeGreaterThan(0.9)"]
  }
};

// Default (offline) docs adapter. Live wiring lives in makeContext7DocsFor below.
export async function offlineDocsFor(domain, _query) {
  const entry = OFFLINE_KB[domain];
  if (!entry) return { library: domain, libraryId: null, summary: `(no curated guidance for ${domain})`, snippets: [], source: "offline-fallback" };
  return { ...entry, source: "offline-fallback" };
}

// Live Context7 adapter factory. `resolve` and `queryDocs` are the two Context7
// operations (resolve-library-id, query-docs) wired by the operator — kept as an
// injected boundary so this module never hard-depends on a transport or a key.
//
//   const docsFor = makeContext7DocsFor({
//     resolve:    (name, q) => context7.resolveLibraryId({ libraryName: name, query: q }),
//     queryDocs:  (id, q)   => context7.queryDocs({ libraryId: id, query: q }),
//   });
export function makeContext7DocsFor({ resolve, queryDocs, libraryHints = {} }) {
  return async (domain, query) => {
    const hint = libraryHints[domain] || OFFLINE_KB[domain]?.library || domain;
    const libraryId = await resolve(hint, query);            // -> "/org/project"
    const docs = await queryDocs(libraryId, query);          // -> up-to-date snippets/prose
    return {
      library: hint,
      libraryId,
      summary: typeof docs === "string" ? docs.slice(0, 600) : (docs?.summary ?? ""),
      snippets: Array.isArray(docs?.snippets) ? docs.snippets : [],
      source: "context7"
    };
  };
}

function domainsFor(workstreams) {
  const set = new Set(CORE_DOMAINS);
  for (const ws of Array.isArray(workstreams) ? workstreams : []) {
    const d = WORKSTREAM_DOMAINS[ws];
    if (d) set.add(d);
  }
  return [...set];
}

// Run the research breakout: resolve every needed domain to a concrete library +
// guidance, returning a structured architecture the generator + checks consume.
export async function researchArchitecture({ telos, workstreams = [], docsFor = offlineDocsFor }) {
  const domains = domainsFor(workstreams);
  const stack = [];
  for (const domain of domains) {
    const doc = await docsFor(domain, `${domain} architecture for a market-ready SaaS: ${telos || "project"}`);
    stack.push({ domain, ...doc });
  }
  return { telos: telos || null, workstreams, stack };
}

// Render the architecture as a markdown doc — this is what the `architecture`
// build task writes to disk and what the gate's required-doc / check verifies.
export function renderArchitectureMarkdown(arch) {
  const lines = [];
  lines.push("# Architecture — generated by TELOS SaaS forge");
  lines.push("");
  if (arch.telos) { lines.push(`**Telos:** ${arch.telos}`); lines.push(""); }
  lines.push("Capability stack (researched, then built + gated):");
  lines.push("");
  lines.push("| Domain | Library | Source | Guidance |");
  lines.push("| --- | --- | --- | --- |");
  for (const s of arch.stack) {
    lines.push(`| ${s.domain} | ${s.library} | ${s.source}${s.libraryId ? ` (${s.libraryId})` : ""} | ${s.summary} |`);
  }
  lines.push("");
  lines.push("## Notes per capability");
  for (const s of arch.stack) {
    lines.push("");
    lines.push(`### ${s.domain} — ${s.library}`);
    lines.push(s.summary);
    for (const sn of s.snippets || []) lines.push("", "```", sn, "```");
  }
  lines.push("");
  return lines.join("\n");
}

// Convenience: the library display names, used to assert the architecture doc
// actually references the chosen stack (the deterministic build-task test).
export function stackLibraries(arch) {
  return arch.stack.map((s) => s.library);
}
