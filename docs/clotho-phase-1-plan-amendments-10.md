# Clotho Phase 1 — Plan Amendments, Round 10 (normative delta to plan v10)

Input to the tenth Daedalus delta workshop. Source: **the codex required
seat's third dissent** in TELOS authorization `authz-003`
(`docs/runs/clotho-authorization-3/`, preserved at commit `d138a69`) against
released plan v10 (`sha256:a23da81a…`, reviewed head `14b5918`, merge anchor
`bc85873b`) — one hard stop, accepted by The Eye as a genuine blocking
contradiction, not an implementation detail. **AM-34 is the sole accepted
repair.** A surgical single-amendment delta — no unrelated architecture
changes. The requirement is fixed; the implementation mechanism remains
challengeable when it proves equal or stronger invariants explicitly.

## AM-34 — Mechanism provenance uses the complete accepted module-load closure

### Defect

D14 and the governing specification define provenance through the transitive
**static relative-import** closure. D27 and Task 5 permit or recognize
additional literal relative module-loading forms (side-effect imports,
re-exports, literal dynamic `import()`, accepted literal `require()` /
`module.require()`). A reachable module loaded through one of those forms can
therefore execute without appearing in `implementation_refs` or
`orchestrator_refs` — a structurally valid manifest whose mechanism
references omit bytes capable of affecting execution.

### Normative closure

The **accepted relative module-load closure** of an entry point is:

1. the entry-point file itself; and
2. every file recursively reachable through an accepted literal relative
   module-loading edge of exactly these forms:
   - static `import` declarations with `from`;
   - side-effect `import` declarations;
   - static `export … from`;
   - static `export * from`, including recognized namespace re-export
     variants;
   - literal dynamic `import()`;
   - accepted literal `require()`;
   - accepted literal `module.require()`.

The traversal is recursive, cycle-safe, deterministic, and sorted by
normalized repository-relative path.

### Required invariants

1. `implementation_refs` for each weaver equal the exact accepted relative
   module-load closure of that weaver's entry module.
2. `orchestrator_refs` equal the exact accepted relative module-load closure
   of the frozen orchestrator entry points.
3. The outbound advisory scanner and the provenance-closure derivation use
   the **same** parser, literal classifier, resolver, physical-containment
   checks, extension rules, and accepted-form definition.
4. There is no separately maintained closure-only list of module-loading
   forms.
5. There is no separately maintained closure-only resolver.
6. Every accepted edge's resolved target is included before traversal
   continues recursively.
7. A missing, unresolved, ambiguous, non-regular, symlinked, escaping, or
   otherwise forbidden target fails closed.
8. Every resolved target must exist when its inventory is committed,
   preserving D17.
9. Committed implementation and orchestrator inventories must exactly equal
   their derived closures. Missing and extra files both fail.
10. Conditional or apparently unreachable literal dynamic imports and
    require-style loads are included conservatively; the closure describes
    **bytes capable of executing**, not observed branch coverage.
11. Shared files may legitimately appear in more than one weaver closure or
    in both implementation and orchestrator closures.
12. Nonliteral dynamic imports and require-style loads remain forbidden
    under D27; AM-34 does not broaden the executable surface.
13. D30/D32 loader prohibitions remain unchanged.
14. The code-weaver's knowledge-graph extraction semantics are unchanged;
    AM-34 governs mechanism provenance, not inferred application
    dependencies.
15. No published manifest may identify an executed mechanism while omitting
    a file reachable through an accepted relative module-loading form.

### D14 replacement (wording equivalent to)

> Coverage provenance binds the whole executable mechanism mechanically.
> `implementation_refs` for each weaver equal the exact transitive accepted
> relative module-load closure of that weaver's entry module.
> `orchestrator_refs` equal the corresponding closure of the frozen
> orchestrator entry points. The accepted edge forms are exactly the literal
> relative forms permitted by D27: static imports, side-effect imports,
> static re-exports, literal dynamic imports, and accepted literal
> `require()`/`module.require()` calls. Closure derivation and outbound
> enforcement share one parser and resolver. Committed inventories are
> proven exactly equal to the derived closures; any omitted, extra,
> unresolved, or forbidden target is fatal.

### D27 replacement

D27 must enumerate the same closed form set rather than saying only "literal
relative imports," and must state explicitly that every accepted relative
module-loading edge participates in D14's provenance closure.

### Suggested new decision

**D33 — Mechanism provenance closes over every accepted literal relative
module-loading edge.** D14 and D27 then reference D33 rather than carrying
divergent shorthand.

### Required tests (at minimum)

1. named static-import-reached helper cannot be omitted;
2. side-effect-import-reached helper cannot be omitted;
3. `export { … } from`-reached helper cannot be omitted;
4. `export * from`-reached helper cannot be omitted;
5. literal dynamic-import-reached helper cannot be omitted;
6. literal `require()`-reached helper cannot be omitted;
7. literal `module.require()`-reached helper cannot be omitted;
8. a recursive chain mixing re-export, dynamic import, and require reaches
   the fixed point;
9. cycles terminate deterministically and include every member once;
10. per-weaver inventory equality uses the complete closure;
11. orchestrator inventory equality uses the complete closure;
12. omission of one target from each newly covered form fails;
13. an extra unreachable inventory file fails;
14. missing and unresolved targets fail;
15. symlink, physical escape, and forbidden merkle-dag target fail;
16. nonliteral dynamic import, require, and module.require remain rejected;
17. comments and string lookalikes create no edge;
18. all accepted literal syntaxes supported by the outbound scanner receive
    identical closure treatment;
19. the outbound scanner and closure derivation demonstrably share the form
    classifier and resolver;
20. a reachable permitted merkle-dag helper is included and recursively
    traversed;
21. manifest `implementation_refs` contain the exact content addresses of
    all reachable helper bytes;
22. manifest `orchestrator_refs` contain the exact content addresses of all
    reachable orchestrator bytes;
23. flagship reproduction proves committed inventory equality against the
    complete accepted module-load closure;
24. a tampered inventory omitting a dynamic-, re-export-, or
    require-reached helper cannot close or publish.

### Acceptance

> No published Clotho manifest may represent a weaver or orchestrator
> mechanism as content-bound unless its references include every module
> recursively reachable through every literal relative module-loading form
> that the outbound scanner permits. The enforcement scanner and provenance
> closure must operate over one shared closed edge grammar and one shared
> resolver.

## Reaffirmed (no change intended)

Everything else in plan v10 as released: D29 complete-consumption
accounting, D31 contract-files inventory, D30/D32 loader prohibitions and
the exact frozen safe-export mapping, publication commit point, physical
containment, abort/descriptor lifecycle, locator invariant, blast-radius
semantics, assertion-status quarantine, and all previously settled
contracts.
