# Clotho Task 4a — deferred minor-fix backlog

**Status:** Task 4a accepted with these items DEFERRED (The Eye's stopping rule,
2026-07-17): "Finish the round it's on. If it finds something else, start a minor
fix artifact list to revisit outside of feature development."

**Convergence state at acceptance (PR #117, head reviewed at rounds 12–13):**
claude + agy (required) and grok + gemini (advisory) **approve**; the deterministic
gate is **meets**; the committed-closure equality (`test-closure §12`) proves
`git → {registry,git}` and `code → {registry,code,util}` derive exactly.
The **codex** seat remained a lone `revise` after 13 rounds, mining an
asymptotically-shrinking tail of shared-lexer edge cases (11 → 3 → 2 → 4 items).

**Materiality — why these are deferred, not blocking.** Every item below is a
correctness gap of the shared D33 lexer/classifier on **adversarial or unusual
inputs that do not occur in the committed Clotho source** (all real weaver/spine
modules are ordinary ESM: semicolon-terminated, no `function(){} / import()`
division, no Unicode-space-separator hashbangs, no absolute-path symlink
components). The **closure-equality assertion** (`test-closure §12`, run every
weave) is the safety net: if any of these bugs ever produced a wrong closure over
real committed source, the derived closure would no longer equal the committed
inventory and the test would fail closed. They are genuine improvements to the
enforced-profile scanner's total correctness, to be made **outside feature
development**, not Task 4a release blockers.

## Backlog (codex, round 13 — exact breaking inputs)

1. **Declaration parser ASI / statement boundaries.** `parseModuleDecl` does not
   respect semicolonless (ASI) statement boundaries.
   - False fail-closed: `const x = 1; export { x }\nconsole.log("ok");` — the
     completed local export is scanned into the following statement and throws
     `unsupported-module-lexical-profile`.
   - False no-edge: `require("./x.mjs")\n{}` — `isDefinition` suppresses a real
     require call whenever its closing `)` is followed by `{` (an ASI-separated
     block), producing no closure edge.
   - Fix: delimit import/export declarations by the frozen supported grammar
     including ASI boundaries; distinguish a real call-then-ASI-block from a
     method/function definition by token context, not the bare `){` heuristic.

2. **Regex/division in function/class EXPRESSION bodies + contextual keywords.**
   - `const q = function() {} / import("./x.mjs");` — a function *expression* body
     `}` is treated as a statement block, so the real division-adjacent dynamic
     import is masked as regex text.
   - `of` used as a binding inside a `for` head, `for await`, and reserved words
     used after member access remain unsound.
   - Fix: extend the value-token / brace-kind model to function/class expression
     bodies and these contextual-keyword positions.

3. **b3 whitespace — complete Unicode `Space_Separator` set.** `isHorizontalWs`
   omits U+1680, U+2000–U+200A, U+202F, U+205F, U+3000, so a line-leading `-->`
   preceded by e.g. U+2003 is accepted instead of failing closed
   (`unsupported-module-lexical-profile`).
   - Fix: recognize the complete ECMAScript horizontal-whitespace set in the
     line-leading `-->` (b3) check; one failing unit per omitted class.

4. **`physicalContainment` absolute-candidate original-component inspection.** For
   an absolute candidate, components are walked starting at `absRepo` and a later
   `path.resolve` collapses `link/..`, so `<repo>/link/../real/file` (where
   `<repo>/link` is a symlink) can be accepted without lstat-checking `link`; the
   `repoRoot` spelling is likewise normalized before inspection.
   - Fix: inspect original uncollapsed components from the correct anchor for BOTH
     relative and absolute candidates, and the original allowed-root spelling
     before normalization; add absolute-candidate + allowed-root symlink fixtures.

## Process note (best practice, not a module)

The round-by-round council loop grew super-linearly because discovery happened
inside the most expensive loop (signed council + full-rebuild fork) and fixes were
per-case not per-class. Best practice going forward (Tasks 4b/5/6/7):
**class-fix not case-fix** (total rules, e.g. the deny-based regex tokenizer);
**shift discovery left** into a cheap local adversarial/property/fuzz gauntlet run
until dry BEFORE spending a signed council round; and **materiality-gated
convergence** — accept at required-majority approval with no risk-bearing dissent,
deferring residual trivia here. (This is engineering discipline, not a mythological
architectural phase.)
