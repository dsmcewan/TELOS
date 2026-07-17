# Clotho Phase 1 — Plan amendment 13 (AM-41)

**Status:** normative amendment to the converged plan v13
(`docs/runs/clotho-daedalus-delta12/matured-plan-v13.md`, `sha256:f9368b57…`),
to be integrated by the Daedalus delta-13 workshop into candidate **v14**.

**Origin:** during Task 4a required-seat review the codex seat (lone required
dissenter after claude/agy/grok/gemini approval) surfaced a real ambiguity in the
D33 shared lexical scanner's *correctness domain*: it kept identifying valid but
increasingly esoteric JavaScript lexical forms (HTML/legacy comments, hashbang,
octal string escapes, U+2028/U+2029 line terminators, string-named imports,
CommonJS-only forms) whose handling a hand-written *dependency-free lexical
scanner* does not obviously guarantee. The frozen plan calls for a
"dependency-free lexical scanner that skips comments and recognizes strings" — it
does **not** authorize or require a complete ECMAScript lexical grammar, and the
Phase 1 posture is explicitly advisory / best-effort over a frozen set of
recognizable forms. Escalated to **The Eye**, who ruled that the fix is neither a
full spec-exact lexer nor an override of codex, but a **mechanically enforced
closed source profile**.

---

## AM-41 — the D33 scanner is correct over a closed, enforced source profile; everything outside it fails closed

**The Eye's ruling (FIXED, NON-CHALLENGEABLE):** The shared D33 module-load
classifier / resolver (`clotho/weavers/util.mjs`, used by BOTH the closure
derivation and the advisory outbound scanner, AM-34 test 19) must be **correct
over a closed, mechanically enforced Clotho module-lexical source profile**.
Inputs outside that profile are **rejected deterministically** — they are not
required to be parsed correctly, but they must never be silently misclassified or
accepted. This changes the bar from *"our hand-written scanner probably handles
enough JavaScript"* to *"our scanner is proven correct over an explicit language
subset and refuses everything else"* — total correctness over a closed domain
rather than endless partial correctness over all of ECMAScript.

The amendment MUST integrate into the D33 shared-grammar clause (and the
`test-closure.mjs` / scanner obligations) the following, without dilution:

1. **Supported profile — correctness required.** Within the supported profile the
   scanner MUST classify the exact accepted module-load forms correctly despite
   ordinary variation: normal whitespace and standard comments (`//` line
   comments terminated by LF or CRLF, `/* */` block comments) around and within
   accepted forms; standard string literals; specifier/alias lists including
   keyword-named aliases (`export { h as import } from "./x.mjs"`); literal
   dynamic `import()` **including import options / trailing commas**
   (`import("./x.mjs", { with: { type: "json" } })`); and token context — an
   accepted loader name is a load site ONLY as a real call/declaration, never as
   a member access (`obj.import(...)`, `obj.require(...)`, `import.meta`), a
   private member (`this.#require(...)`), a property key (`{ import: 1 }`), or a
   contextual identifier (`from` used as a binding name). The code-weaver's
   explicit-`.mjs` extraction rule stays in `code.mjs`; the shared **closure**
   resolver traverses every accepted literal relative load per D33 — including
   accepted literal `require()` / `module.require()` targets that are not `.mjs`
   (e.g. `.cjs`) — since D33 governs mechanism provenance, not the code-weaver's
   inferred-dependency grammar.

2. **The EXACT frozen closed profile.** The profile is fixed here — not left to
   the implementation to choose. A source file is IN-PROFILE iff it consists
   entirely of:
   - **Encoding/terminators:** UTF-8 text whose only line terminators are LF
     (U+000A) or CRLF (U+000D U+000A).
   - **Comments:** `//` line comments (ending at LF/CRLF or EOF) and `/* … */`
     block comments.
   - **Strings:** single- or double-quoted string literals using only these
     escapes — `\\ \" \' \n \r \t \b \f \v \0` (where `\0` is NOT followed by a
     decimal digit), `\xHH`, `\uHHHH`, `\u{…}` — and template literals
     (backtick) whose `${…}` substitutions are scanned as code; a module-load
     **specifier** must be a plain single/double-quoted string literal.
   - **Accepted module-load forms (the D33 set):** static `import … from`,
     side-effect `import`, `export … from`, `export * [as ns] from`, literal
     dynamic `import()` (including an options object and/or trailing comma),
     literal `require()`, literal `module.require()` — with specifier/alias names
     as ordinary identifiers (including keyword-named aliases such as `import`).
   - **Regex vs division** decided by previous-significant-token.

   Everything else is OUT-OF-PROFILE and MUST be **detected and rejected with the
   stable diagnostic `unsupported-module-lexical-profile`** (no inferred edge, no
   successful closure result, no coverage claim for that file). The out-of-profile
   set is EXACT and enumerable — the scanner MUST fail closed on each of:
   1. a bare CR (U+000D not immediately followed by LF), U+2028, or U+2029
      anywhere in the source;
   2. a hashbang line (`#!`) anywhere;
   3. an HTML/legacy comment opener `<!--`, or a line-leading `-->`;
   4. a string line-continuation (a backslash immediately preceding a line
      terminator) or a legacy/octal escape (`\` followed by a decimal digit,
      other than `\0` not followed by a digit);
   5. a string-literal specifier or alias **name** in an import/export clause
      (e.g. `import { "a" as b } from …`, `export { "a" } from …`);
   6. an unterminated string or comment, or an unterminated/…-truncated accepted
      module-load form.

   The exclusion is **tested and enforced, not presumed** — the scanner may not
   assume such inputs "cannot occur"; it mechanically detects and refuses each.

3. **Two proved properties (tests).** The suite MUST prove BOTH:
   - **Supported profile:** accepted forms are classified correctly despite normal
     whitespace, comments, strings, aliases, options, and token context (the
     realistic variations in §1).
   - **Outside profile:** each unsupported construct fails closed with the stable
     `unsupported-module-lexical-profile` diagnostic — never silently
     misclassified, never accepted, never yielding a closure edge or a coverage
     claim.

4. **Faithful coverage claim.** With the profile enforced, the D33
   `implementation_refs` / closure results **exactly cover the supported,
   statically-declared dependency model over the closed profile** — not every
   module route ECMAScript could express. This is consistent with v13's existing
   requirement that comments and string lookalikes create no closure edge; it does
   not require universal parsing of every JavaScript lexical curiosity.

**Required Task 4a corrections (supported-profile correctness).** The following
are ordinary variations of accepted syntax and belong to the scanner's actual
responsibility; they MUST be fixed: whitespace/comments around member access;
`obj.import(...)` / `obj.require(...)` / private-member lookalikes not treated as
loads; literal dynamic imports with options or trailing commas; contextual `from`
used as an identifier; the shared-closure-vs-code-weaver `.mjs` split (closure
traverses accepted literal require/module.require incl. `.cjs`); and the general
regex-vs-division decision by previous-significant-token across all expression-start
contexts — plus any other case occurring INSIDE the declared accepted module-load
forms.

**Original-component containment (bound requirement + fixture).** The SHARED D33
resolver (`resolveRelativeSpecifier` / `deriveAcceptedClosure`), not only the
driver's `physicalContainment` helper, MUST `lstat` every existing component of
the ORIGINAL, uncollapsed candidate path — in its original component order —
BEFORE any `path.resolve`/normalization that could collapse a `..` and erase a
component from inspection, and MUST reject any symlink component (fail closed). A
resolver fixture MUST exercise a candidate containing a symlink/junction component
followed by a later `..` that would normalize the symlink component away, and
require rejection.

**No other scope changes.** AM-41 is narrow: it defines the scanner's correctness
domain and its fail-closed behavior outside it. Every other frozen decision
(AM-40 PACKAGE_ROOTS; D17/AM-17; D24/D26/D31; D32; D33 accepted-form set; the
AM-35..AM-39 advisory / non-sandbox posture; zero-dependency; spine read-only) is
reaffirmed unchanged.

---

## Hard guards for the delta-13 workshop (FIXED)

The workshop MUST NOT:
- weaken the closed-profile contract into an unenforced assumption ("cannot
  occur") — out-of-profile constructs must fail closed with the stable diagnostic,
  mechanically and testably;
- require a complete ECMAScript lexer/parser, OR permit a supported-profile input
  to be misclassified;
- reintroduce any descoped claim (loader isolation proven, containment beyond D21,
  sandbox, capability boundary) — the AM-35..AM-39 advisory / non-sandbox posture
  stands;
- alter any OTHER frozen decision (AM-40; D17/AM-17; D24/D26/D31; D32; the D33
  accepted-form set; zero-dep; spine read-only);
- modify any prior authorization or Daedalus evidence (deltas 1–12 and v12/v13 are
  read-only history);
- describe provider provenance as an HMAC signature;
- start or resume implementation, convene the re-authorization, or open Argo.

Convergence requires the two seats (claude, codex) to integrate AM-41 into the
plan body, delete this amendment appendix once integrated, and bind the exact
converged artifact — producing candidate **v14**.
