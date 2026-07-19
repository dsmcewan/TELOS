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
import { symlinkOrSkip } from "./lib/symlink.mjs";

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
// shared record, rendering, path-safety, and grammar-aware import-analysis primitives
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
  'import source moduleValue from "external-source";',
  'import.source("external-source-call");',
  'import defer * as deferredModule from "external-defer";',
  'import.defer("external-defer-call");',
  'if (ready) /import("regex-only")/.test(value);',
  'if (ready) {} /import("regex-after-block")/.test(value);',
  'function declared() {} /import("regex-function-only")/.test(value);',
  'class Declared {} /import("regex-class-only")/.test(value);',
  'labeled: {}; /import("regex-labeled-only")/.test(value);',
  'while (ready) { break\n/import("regex-break-only")/.test(value); }',
  'while (ready) { continue\n/import("regex-continue-only")/.test(value); }',
  'const objectMethods = { import(value = "object-method-default") { return value; } };',
  'class MethodNames { import(value = "class-method-default") { return value; } }',
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
    "external-source",
    "external-source-call",
    "external-defer",
    "external-defer-call",
    "external-template"
  ],
  "grammar-aware import analysis must recognize every import phase without reading methods, regex, or template text"
);
const hashbangSource = [
  "#!/usr/bin/env node",
  '; /import("regex-hashbang-only")/.test(value);',
  'import "external-after-hashbang";'
].join("\n");
assert.deepEqual(
  importSpecifiers(hashbangSource),
  ["external-after-hashbang"],
  "a leading hashbang and the following regex are not import records"
);
const packageRoot = mkdtempSync(path.join(tmpdir(), "anm-boundary-"));
const outsideRoot = mkdtempSync(path.join(tmpdir(), "anm-boundary-outside-"));
try {
  mkdirSync(path.join(packageRoot, "scripts", "nested"), { recursive: true });
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
    [
      'import "node:path";',
      'import "./relative.mjs";',
      'import "../inside-root.mjs?../../../../traversal-looking";'
    ].join("\n")
  );
  writeFileSync(path.join(packageRoot, "inside-root.mjs"), "export {};\n");
  writeFileSync(
    path.join(packageRoot, "scripts", "nested", "legitimate-parent.mjs"),
    'import "../portable.mjs";\n'
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
    path.join(packageRoot, "scripts", "hashbang-cases.mjs"),
    `${hashbangSource}\n`
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
  writeFileSync(
    path.join(packageRoot, "scripts", "parser-error.mjs"),
    'import "unterminated\n'
  );
  writeFileSync(
    path.join(packageRoot, "scripts", "lexical-escape.mjs"),
    'import "../../outside-lexical.mjs";\n'
  );
  writeFileSync(
    path.join(packageRoot, "scripts", "percent-normalized-escape.mjs"),
    'import "./%2e%2e/%2e%2e/outside-percent.mjs";\n'
  );
  writeFileSync(
    path.join(packageRoot, "scripts", "mixed-percent-dot-escape.mjs"),
    'import "./.%2e/%2e./outside-mixed.mjs";\n'
  );
  writeFileSync(
    path.join(packageRoot, "scripts", "invalid-dot-prefix.mjs"),
    'import ".external";\n'
  );
  writeFileSync(
    path.join(packageRoot, "scripts", "invalid-three-dot-prefix.mjs"),
    'import ".../external";\n'
  );
  writeFileSync(
    path.join(packageRoot, "scripts", "url-conversion-error.mjs"),
    'import "./encoded%2Fslash.mjs";\n'
  );
  writeFileSync(
    path.join(outsideRoot, "external-file.mjs"),
    "export {};\n"
  );
  mkdirSync(path.join(outsideRoot, "external-directory"));
  writeFileSync(
    path.join(outsideRoot, "external-directory", "existing.mjs"),
    "export {};\n"
  );
  const fileLinkCreated = symlinkOrSkip(
    path.join(outsideRoot, "external-file.mjs"),
    path.join(packageRoot, "linked-file.mjs"),
    { type: "file", label: "package-boundary external file target" }
  );
  const directoryLinkCreated = symlinkOrSkip(
    path.join(outsideRoot, "external-directory"),
    path.join(packageRoot, "linked-directory"),
    { type: "dir", label: "package-boundary external directory target" }
  );
  if (process.platform === "win32") {
    assert.equal(
      directoryLinkCreated,
      true,
      "native Windows directory-junction containment coverage must run"
    );
  }
  if (fileLinkCreated) {
    writeFileSync(
      path.join(packageRoot, "scripts", "file-link-escape.mjs"),
      'import "../linked-file.mjs";\n'
    );
  }
  if (directoryLinkCreated) {
    writeFileSync(
      path.join(packageRoot, "scripts", "directory-link-escape.mjs"),
      'import "../linked-directory/missing/external.mjs";\n'
    );
  }
  const executableProblems = packageBoundaryProblems(packageRoot);
  const hasBoundaryFinding = (file, detail) =>
    executableProblems.some((problem) =>
      problem.startsWith(`${path.join("scripts", file)}:`)
      && problem.includes(detail)
    );
  assert.deepEqual(
    {
      lexicalEscapeRejected: hasBoundaryFinding(
        "lexical-escape.mjs",
        "relative import escapes plugin root"
      ),
      percentNormalizedEscapeRejected: hasBoundaryFinding(
        "percent-normalized-escape.mjs",
        "relative import escapes plugin root"
      ),
      mixedPercentDotEscapeRejected: hasBoundaryFinding(
        "mixed-percent-dot-escape.mjs",
        "relative import escapes plugin root"
      ),
      invalidDotPrefixRejected: hasBoundaryFinding(
        "invalid-dot-prefix.mjs",
        "non-portable import .external"
      ),
      invalidThreeDotPrefixRejected: hasBoundaryFinding(
        "invalid-three-dot-prefix.mjs",
        "non-portable import .../external"
      ),
      urlConversionErrorRejected: hasBoundaryFinding(
        "url-conversion-error.mjs",
        "cannot resolve relative import ./encoded%2Fslash.mjs"
      ),
      containedParentImportAccepted: !executableProblems.some((problem) =>
        problem.startsWith(
          `${path.join("scripts", "nested", "legitimate-parent.mjs")}:`
        )
      ),
      traversalLookingQueryAccepted: !executableProblems.some((problem) =>
        problem.startsWith(`${path.join("scripts", "portable.mjs")}:`)
      )
    },
    {
      lexicalEscapeRejected: true,
      percentNormalizedEscapeRejected: true,
      mixedPercentDotEscapeRejected: true,
      invalidDotPrefixRejected: true,
      invalidThreeDotPrefixRejected: true,
      urlConversionErrorRejected: true,
      containedParentImportAccepted: true,
      traversalLookingQueryAccepted: true
    },
    "relative imports must be exact, URL-resolved, lexically contained, and conversion-safe"
  );
  if (fileLinkCreated) {
    assert.equal(
      hasBoundaryFinding(
        "file-link-escape.mjs",
        "relative import escapes plugin root through filesystem link"
      ),
      true,
      "an in-root file symlink to an external target must be rejected"
    );
  }
  if (directoryLinkCreated) {
    assert.equal(
      hasBoundaryFinding(
        "directory-link-escape.mjs",
        "relative import escapes plugin root through filesystem link"
      ),
      true,
      "an in-root directory symlink or junction to an external target must be rejected"
    );
  }
  for (const specifier of [
    "external-js",
    "external-cjs",
    "external-dynamic",
    "external-reexport",
    "external-unicode",
    "external-escaped-binding",
    "external-source",
    "external-source-call",
    "external-defer",
    "external-defer-call",
    "external-template",
    "external-after-hashbang"
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
    5,
    "every real import without a lexer-resolved specifier must fail closed, including parenthesized literals"
  );
  assert.ok(
    executableProblems.some((problem) =>
      problem.includes("parser-error.mjs: cannot parse JavaScript module")
    ),
    "lexer parse errors are deterministic package-boundary problems"
  );
  assert.equal(
    executableProblems.some((problem) =>
      /regex-(?:only|after-block|function-only|class-only|labeled-only|break-only|continue-only|hashbang-only)|template-value-only/.test(problem)
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
  rmSync(outsideRoot, { recursive: true, force: true });
}
// findings
const f = finding("FAIL", "three-representation", "x/memory", "missing INVARIANTS.json");
assert.deepEqual(Object.keys(f).sort(), ["check", "detail", "level", "path"]);
assert.equal(printFindings([f], "audit"), 2);
assert.equal(printFindings([], "audit"), 0);
console.log("test-lib: all assertions passed");
