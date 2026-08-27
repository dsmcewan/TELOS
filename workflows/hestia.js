export const meta = {
  name: 'hestia',
  description: 'The vibe-coder amateur-hour sanity-check cleanup workflow: audit, fix mechanically, verify residue, ship',
  whenToUse: 'Run against one or more GitHub repos before they face outside review — hunts vibe-code tells and amateur-hour cruft, fixes what is mechanical, and leaves no trace of the hunt in anything committed. Args: { repos: ["owner/name", ...], focus?: "extra emphasis", merge?: false }',
  phases: [
    { title: 'Audit', detail: 'one auditor per repo, ranked findings' },
    { title: 'Fix', detail: 'mechanical fixes as plain-labeled PRs' },
    { title: 'Verify', detail: 'per-PR residue scan; a dirty or unscanned PR never ships' },
  ],
}

// Hestia — keeper of the hearth. Sweeps repos the way a senior reviewer reads
// them, fixes what is unambiguous, reports what needs judgment, and leaves no
// trace of the sweep itself in anything committed.

const REPOS = (args && args.repos) || []
if (!REPOS.length) throw new Error('hestia needs args.repos: ["owner/name", ...]')
const FOCUS = (args && args.focus) ? `\nExtra emphasis for this run: ${args.focus}` : ''
const MERGE = !!(args && args.merge)

// The non-negotiables, embedded in every dispatch.
const LAWS = `
## Hestia laws (non-negotiable)
1. NOTHING committed may reference the sweep itself. Branch names, commit
   messages, PR titles, and PR bodies read as ordinary maintenance a normal
   engineer would write ("docs: copyedit credits", "chore: remove superseded
   stub"). Words like vibe, amateur, audit, sweep, slop, batch-generated,
   em-dash, variance, AI-detection are banned from all committed/pushed text.
   A fix that announces itself defeats itself.
2. Never scrub factual AI attribution (Co-Authored-By trailers, generated-with
   footers in history). Never fabricate authorship claims. Never rewrite git
   history.
3. Hash-pinned or signed artifacts (committed evidence, content-addressed
   records, ledger snapshots, fixture packets read by tests) are untouchable.
   If a fix would touch one, report instead.
4. Private/case/sensitive data: name path patterns and counts only. Never
   quote, move, or delete it.
5. Mechanical-vs-judgment split: unambiguous cruft and provable breakage get a
   PR (tests/lint/build green before commit, full suite once before push);
   anything needing an owner's decision is reported, not touched.
6. Verify from a FULL clone: shallow clones lie about git history.
`

const AUDIT_CHECKLIST = `
Scan order:
1. git log --oneline first (full history, unshallow if needed): total commits,
   merges, fix-forward churn, reverts, tool-default messages, giant-drop DNA.
2. Clone and run cold: missing lockfile, deps declared but never imported,
   README quickstart that dies, scripts that cannot run (a lint/test script
   with no config or dependency behind it).
3. Open the tests, do not count them: mocked-everything suites and
   assertion-free green checks are worse than honest absence.
4. Judgment residue: "what" comments restating the line vs "why" comments;
   dated TODOs with a name; visible rejected alternatives with cost attached.
5. Prose register: filler superlatives, bold-lead bullet triads, em-dash
   chains, near-identical boilerplate repeated across sibling repos.
6. Leaks: personal machine paths, usernames, secret-shaped strings (report
   privately, never quote values).
7. Cruft: root litter, duplicate-suffix files (_v2, _FIXED, _final, .bak),
   .DS_Store/logs/editor dirs/__MACOSX, tracked-despite-gitignored paths,
   orphaned assets, dead links (curl them), repo metadata gaps.
8. Dependency health: npm audit / pip equivalent — report, do not bump unless
   an advisory blocks CI.
`

// ---- Phase 1: Audit ---------------------------------------------------------
const FINDINGS_SCHEMA = {
  type: 'object',
  required: ['repo', 'verdict', 'findings'],
  properties: {
    repo: { type: 'string' },
    verdict: { type: 'string', description: 'one line: does it pass a senior sniff test' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['rank', 'path', 'what', 'kind'],
        properties: {
          rank: { type: 'integer' },
          path: { type: 'string' },
          what: { type: 'string' },
          kind: { enum: ['mechanical', 'judgment'] },
          fix: { type: 'string', description: 'for mechanical: exact fix; for judgment: options' },
        },
      },
    },
  },
}

const audits = await parallel(REPOS.map((repo) => () =>
  agent(
    `You have gh CLI authenticated with access to ${repo}. Clone it FRESH and FULL to a /tmp scratch dir and run this hygiene audit. Read-only this phase: no branches, no PRs, no pushes.\n${LAWS}\n${AUDIT_CHECKLIST}${FOCUS}\nReturn ranked findings (worst first), each labeled mechanical (an unambiguous fix exists, name it exactly) or judgment (owner must decide, name the options), plus a one-line verdict.`,
    { label: `audit:${repo}`, phase: 'Audit', schema: FINDINGS_SCHEMA },
  )
))

// ---- Phase 2: Fix (mechanical only), pipelined per repo ---------------------
// Structured output: pr_url is the BARE canonical PR URL (or null when nothing
// shipped) — it is the binding key the residue gate matches evidence against.
const FIX_SCHEMA = {
  type: 'object',
  required: ['repo', 'pr_url', 'note'],
  properties: {
    repo: { type: 'string' },
    pr_url: { type: ['string', 'null'], description: 'bare canonical GitHub PR URL, or null when no PR was opened' },
    note: { type: 'string', description: 'one-line test summary, or the no-PR reason' },
  },
}
const fixed = await parallel(audits.filter(Boolean).map((a) => () => {
  const mech = (a.findings || []).filter((f) => f.kind === 'mechanical')
  if (!mech.length) return Promise.resolve({ repo: a.repo, pr_url: null, note: 'nothing mechanical' })
  return agent(
    `You have gh CLI authenticated with access to ${a.repo}. Clone fresh, create ONE branch with a plain maintenance name that describes the change itself (never the process that found it), apply exactly these mechanical fixes and nothing else, run the repo's full test/lint/build gates green before committing, push, and open ONE non-draft PR whose title and body read as ordinary maintenance.\n${LAWS}\nFixes to apply:\n${mech.map((f) => `- ${f.path}: ${f.what} -> ${f.fix}`).join('\n')}\nReturn repo, the bare canonical PR URL as pr_url (null if no PR), and a one-line test summary as note.`,
    { label: `fix:${a.repo}`, phase: 'Fix', schema: FIX_SCHEMA },
  ).then((r) => ({ repo: a.repo, pr_url: (r && typeof r.pr_url === 'string' && r.pr_url) || null, note: (r && r.note) || '' }))
}))

// The shipped set: exactly the PRs this run produced. Evidence below is bound
// to these URLs; pr_url:null entries have nothing to merge and are not gated.
const shipped = fixed.filter((f) => f && typeof f.pr_url === 'string' && f.pr_url.startsWith('http'))

// ---- Phase 3: Verify residue (evidence bound to the shipped PRs) ------------
const RESIDUE_SCHEMA = {
  type: 'object',
  required: ['repos'],
  properties: {
    repos: {
      type: 'array',
      items: {
        type: 'object',
        required: ['repo', 'prs', 'ci_summary'],
        properties: {
          repo: { type: 'string' },
          prs: {
            type: 'array',
            items: {
              type: 'object',
              required: ['pr', 'residue_findings'],
              properties: {
                pr: { type: 'string', description: 'the exact PR URL as given' },
                residue_findings: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['where', 'term'],
                    properties: {
                      where: { type: 'string', description: 'branch|title|body|commit <sha>' },
                      term: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
          ci_summary: { type: 'string' },
        },
      },
    },
  },
}
const verify = shipped.length ? await agent(
  `You have gh CLI authenticated. Scan EXACTLY these PRs (no others): ${JSON.stringify(shipped.map((f) => ({ repo: f.repo, pr: f.pr_url })))}. For each PR, scan branch name + title + body + commit messages for process-residue terms (vibe, amateur, audit, sweep, slop, batch, em-dash, variance, detection, cleanup-of-review). Also report each PR's CI status. Do not modify anything. Return one repos[] entry per repo, one prs[] entry per PR keyed by the EXACT URL given (empty residue_findings = clean).`,
  { label: 'verify:residue', phase: 'Verify', schema: RESIDUE_SCHEMA },
) : { repos: [] }

// ---- Ship gate (fail-closed) ------------------------------------------------
// Merging is the owner's act. Only when args.merge === true, and only for PRs
// whose residue evidence is PRESENT and clean: a PR with findings, a PR the
// verify agent did not report on, or a failed/garbled verify result never
// spawns a ship agent. Required checks are re-polled by the ship agent.
const entriesByPr = new Map()
if (verify && Array.isArray(verify.repos)) {
  for (const r of verify.repos) {
    if (!r || !Array.isArray(r.prs)) continue
    for (const p of r.prs) {
      if (p && typeof p.pr === 'string') entriesByPr.set(p.pr, Array.isArray(p.residue_findings) ? p.residue_findings : null)
    }
  }
}
const gate = shipped.map((f) => {
  const findings = entriesByPr.get(f.pr_url)
  if (findings === undefined || findings === null) return { ...f, clean: false, blocker: 'residue-missing', findings: [] }
  if (findings.length > 0) return { ...f, clean: false, blocker: 'residue-dirty', findings }
  return { ...f, clean: true }
})
const residueGate = {
  clean: gate.filter((g) => g.clean).map((g) => ({ repo: g.repo, pr: g.pr_url })),
  blocked: gate.filter((g) => !g.clean).map((g) => ({ repo: g.repo, pr: g.pr_url, merged: false, blocker: g.blocker, findings: g.findings })),
}

let merged = []
if (MERGE) {
  merged = await parallel(gate.filter((g) => g.clean).map((g) => () =>
    agent(
      `You have gh CLI authenticated. PR: ${g.pr_url} on ${g.repo}. Wait for its required checks (poll, up to 15 min). If every required check passes, merge with a merge commit and report "merged <sha>". If anything fails or conflicts, do NOT merge; report the blocker.`,
      { label: `ship:${g.repo}`, phase: 'Verify' },
    ).then((r) => ({ repo: g.repo, pr: g.pr_url, result: r }))
  ))
}

return {
  audits: audits.filter(Boolean).map((a) => ({ repo: a.repo, verdict: a.verdict, judgment_items: (a.findings || []).filter((f) => f.kind === 'judgment') })),
  fixes: fixed,
  residue: verify,
  residue_gate: residueGate,
  merged,
}
