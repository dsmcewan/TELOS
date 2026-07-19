#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  canonicalize,
  sha256hex,
  contentAddress,
  hasValidContentAddress,
  importSpecifiers,
  packageBoundaryProblems,
  renderRecordList,
  resolveWithin,
  RECORD_KINDS,
  RECORD_STATUSES,
  finding,
  printFindings
} from "../scripts/lib/record.mjs";

// canonicalize: key order does not matter; array order does
assert.equal(canonicalize({ b: 2, a: 1 }), canonicalize({ a: 1, b: 2 }));
assert.notEqual(canonicalize({ a: [1, 2] }), canonicalize({ a: [2, 1] }));
assert.equal(canonicalize({ a: 1, b: 2 }), '{"a":1,"b":2}');
// sha256hex deterministic
assert.equal(sha256hex("x"), sha256hex("x"));
assert.match(sha256hex("x"), /^[0-9a-f]{64}$/);
// contentAddress: minus-id rule — id in the record does not change the address
const rec = { kind: "invariant", statement: "s", id: "sha256:junk" };
const { id, ...rest } = rec;
assert.equal(contentAddress(rec), "sha256:" + sha256hex(canonicalize(rest)));
// shared record, rendering, path-safety, and literal-import primitives
const addressed = { kind: "invariant", statement: "s" };
addressed.id = contentAddress(addressed);
assert.equal(hasValidContentAddress(addressed), true);
assert.equal(hasValidContentAddress({ ...addressed, statement: "changed" }), false);
assert.equal(RECORD_KINDS.has("contract"), true);
assert.equal(RECORD_KINDS.has("invented-kind"), false);
assert.equal(RECORD_STATUSES.has("NORMATIVE-CURRENT"), true);
assert.equal(RECORD_STATUSES.has("INVENTED-STATUS"), false);
assert.equal(
  renderRecordList("Example invariants", [addressed]),
  `# Example invariants (rendered)\n\n- **${addressed.id}** [unspecified] s\n`
);
const platformRoot = path.join(path.parse(path.resolve(".")).root, "repo");
assert.equal(
  resolveWithin(platformRoot, path.join("component", "memory")),
  path.resolve(platformRoot, "component", "memory")
);
assert.throws(() => resolveWithin(platformRoot, "../outside"), /escapes repository root/);
assert.throws(
  () => resolveWithin(platformRoot, path.join(path.parse(platformRoot).root, "outside")),
  /repository-relative/
);
assert.deepEqual(
  importSpecifiers('import x from "node:x"; import "./side.mjs"; await import("../dynamic.mjs");'),
  ["node:x", "./side.mjs", "../dynamic.mjs"]
);
assert.deepEqual(
  importSpecifiers(`
    // import "comment-only";
    const ordinary = "import('string-only')";
    const template = \`export * from "template-only"\`;
    import /* binding trivia */ value
      /* before from */ from /* before specifier */ "external-static";
    import /* side-effect trivia */ "external-side-effect";
    export { value } /* re-export trivia */ from /* before specifier */ "external-reexport";
    export * /* star trivia */ from /* before specifier */ "external-star";
    await import(/* first-argument trivia */ "external-dynamic", { with: { type: "json" } });
    await import(runtimeSelected);
    await import("node:" + runtimeSelected);
    await import("./" + runtimeSelected);
  `),
  [
    "external-static",
    "external-side-effect",
    "external-reexport",
    "external-star",
    "external-dynamic"
  ]
);
const reviewerSource = [
  'import café from "external-unicode";',
  'import \\u0062inding from "external-escaped-binding";',
  'if (ready) /import("regex-only")/.test(value);',
  'if (ready) {} /import("regex-after-block")/.test(value);',
  'await import(("external-parenthesized"));',
  'await import(`external-template`);',
  'const ordinaryTemplate = `import("template-value-only")`; ',
  "void import.meta.url;"
].join("\n");
assert.deepEqual(
  importSpecifiers(reviewerSource),
  [
    "external-unicode",
    "external-escaped-binding",
    "external-parenthesized",
    "external-template"
  ],
  "the import scanner must handle valid identifiers and literal dynamic forms without reading regex/template text"
);
const packageRoot = mkdtempSync(path.join(tmpdir(), "anm-boundary-"));
try {
  mkdirSync(path.join(packageRoot, "scripts"));
  writeFileSync(
    path.join(packageRoot, "package.json"),
    JSON.stringify({
      dependencies: {},
      optionalDependencies: {},
      peerDependencies: {},
      bundledDependencies: [],
      bundleDependencies: [],
      devDependencies: { allowed: "1.0.0" }
    })
  );
  writeFileSync(
    path.join(packageRoot, "scripts", "portable.mjs"),
    'import "node:path"; import "./relative.mjs";\n'
  );
  assert.deepEqual(packageBoundaryProblems(packageRoot), []);

  writeFileSync(
    path.join(packageRoot, "package.json"),
    JSON.stringify({ dependencies: { surprise: "1.0.0" } })
  );
  assert.ok(
    packageBoundaryProblems(packageRoot).some((problem) =>
      problem.includes("runtime dependencies")
    )
  );

  writeFileSync(
    path.join(packageRoot, "package.json"),
    JSON.stringify({ dependencies: {} })
  );
  writeFileSync(
    path.join(packageRoot, "scripts", "non-portable.js"),
    'import "external-js";\n'
  );
  writeFileSync(
    path.join(packageRoot, "scripts", "non-portable.cjs"),
    'void import("external-cjs");\n'
  );
  writeFileSync(
    path.join(packageRoot, "scripts", "non-portable.mjs"),
    'await import(/* runtime */ "external-dynamic", {});\n'
  );
  writeFileSync(
    path.join(packageRoot, "scripts", "non-portable-reexport.mjs"),
    'export * from "external-reexport";\n'
  );
  writeFileSync(
    path.join(packageRoot, "scripts", "reviewer-cases.mjs"),
    `${reviewerSource}\n`
  );
  writeFileSync(
    path.join(packageRoot, "scripts", "unverifiable.mjs"),
    [
      "await import(`external-${runtimeSelected}`);",
      'await import("external-" + runtimeSelected);',
      "await import(runtimeSelected);",
      "await import((runtimeSelected));"
    ].join("\n")
  );
  const executableProblems = packageBoundaryProblems(packageRoot);
  for (const specifier of [
    "external-js",
    "external-cjs",
    "external-dynamic",
    "external-reexport",
    "external-unicode",
    "external-escaped-binding",
    "external-parenthesized",
    "external-template"
  ]) {
    assert.ok(
      executableProblems.some((problem) =>
        problem.includes(`non-portable import ${specifier}`)
      ),
      `${specifier} must be rejected across the complete executable-source boundary`
    );
  }
  assert.equal(
    executableProblems.filter((problem) =>
      problem.includes("cannot statically verify dynamic import")
    ).length,
    4,
    "every real dynamic import that cannot reduce to one literal string must fail closed"
  );
  assert.equal(
    executableProblems.some((problem) =>
      /regex-only|template-value-only/.test(problem)
    ),
    false,
    "regex and ordinary-template contents are not executable imports"
  );

  for (const field of [
    "optionalDependencies",
    "peerDependencies",
    "bundledDependencies",
    "bundleDependencies"
  ]) {
    const value = field.endsWith("Dependencies") && field.startsWith("bundle")
      ? ["surprise"]
      : { surprise: "1.0.0" };
    writeFileSync(
      path.join(packageRoot, "package.json"),
      JSON.stringify({ dependencies: {}, [field]: value })
    );
    assert.ok(
      packageBoundaryProblems(packageRoot).some((problem) => problem.includes(field)),
      `${field} must not declare runtime packages`
    );
  }

  writeFileSync(
    path.join(packageRoot, "scripts", "import-like-text.js"),
    `
      // import "comment-package";
      /* export * from "block-comment-package"; */
      const first = "import('ordinary-string-package')";
      const second = 'export { x } from "ordinary-string-reexport"';
    `
  );
  const textProblems = packageBoundaryProblems(packageRoot);
  assert.equal(
    textProblems.some((problem) =>
      /comment-package|block-comment-package|ordinary-string-package|ordinary-string-reexport/.test(problem)
    ),
    false,
    "import-like text in comments and ordinary strings is not an import"
  );
} finally {
  rmSync(packageRoot, { recursive: true, force: true });
}
// findings
const f = finding("FAIL", "three-representation", "x/memory", "missing INVARIANTS.json");
assert.deepEqual(Object.keys(f).sort(), ["check", "detail", "level", "path"]);
assert.equal(printFindings([f], "audit"), 2);
assert.equal(printFindings([], "audit"), 0);
console.log("test-lib: all assertions passed");
