## 2026-06-30 Final Review Fixes - Composable Workstream Catalog

### RED

- Added regression coverage in `ai-forge/scripts/test-workstream-catalog.mjs` for:
  - `computeScorecard()` returning `passed: false` on below-threshold scores while `assertThresholds()` still throws.
  - `redactOutput()` preserving clean object output as an object and redacting blocked terms inside object responses.
  - platform-independent rejection of POSIX absolute, Windows drive absolute, and UNC-style paths.
- Failing command:

```text
cd ai-forge
node scripts/test-workstream-catalog.mjs
```

- Failing output:

```text
Error: score for quality is below threshold
    at assertThresholds (...)
    at Module.computeScorecard (...)
```

### GREEN

- Updated `ai-forge/workstreams/catalog.mjs` so:
  - `requireRelativeFile()` rejects `/x`, `C:/x`, `C:\x`, `\\server\share`, and `//server/share` independent of host OS.
  - generated `computeScorecard()` validates score shape/types/range without enforcing threshold pass, and returns `passed` booleans.
  - generated `assertThresholds()` reuses `computeScorecard()` and throws only for below-threshold metrics.
  - generated `redactOutput()` returns strings for string input and parsed objects for object input, preserving clean object structure apart from redactions.
  - guardrail and scorecard selftests exercise the corrected contracts directly.

- Passing commands:

```text
cd ai-forge
node scripts/test-workstream-catalog.mjs
npm test
```

- Passing output highlights:

```text
test-workstream-catalog: ok
test-serving.mjs OK
test-serving-forge.mjs OK
```

## 2026-06-30 Final Review Fixes - Output Guardrail Object Key Preservation

### RED

- Added regression coverage in `ai-forge/scripts/test-workstream-catalog.mjs` for a rendered/imported output guardrail with blocked terms overlapping object keys.
- Repro command:

```text
cd ai-forge
node scripts/test-workstream-catalog.mjs
```

- Failing output:

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
+ actual - expected

  {
+   '[REDACTED]': '[REDACTED]',
    nested: {
+     '[REDACTED]': '[REDACTED]'
-     token: '[REDACTED]'
    },
-   password: '[REDACTED]'
  }
```

### GREEN

- Updated generated `redactOutput()` in `ai-forge/workstreams/catalog.mjs` to:
  - keep string input behavior as direct string redaction,
  - clone non-string input through JSON serialization for serializability parity,
  - recursively redact only string leaf values in objects/arrays,
  - preserve object keys and container structure.
- Extended generated output-guard selftest to assert object-key preservation.

- Passing commands:

```text
cd ai-forge
node scripts/test-workstream-catalog.mjs
npm test
```

- Passing output highlights:

```text
test-workstream-catalog: ok
test-serving.mjs OK
test-serving-forge.mjs OK
```

## 2026-06-30 Final Review Fixes - Remaining Important Findings

### RED

- Added regression coverage in `ai-forge/scripts/test-workstream-catalog.mjs` for:
  - rendered/imported output guardrails preserving object keys and container structure when blocked terms are redacted and a property value is `undefined`,
  - explicit rejection of all-zero scorecard thresholds,
  - host-independent rejection of rooted backslash paths like `\\tmp\\x.mjs` by importing `catalog.mjs` under POSIX path semantics.
- Failing command:

```text
cd ai-forge
node scripts/test-workstream-catalog.mjs
```

- Failing output:

```text
AssertionError [ERR_ASSERTION]: Missing expected exception.
    at main (.../ai-forge/scripts/test-workstream-catalog.mjs:251:10)
```

### GREEN

- Updated `ai-forge/workstreams/catalog.mjs` so:
  - generated `redactOutput()` recursively clones arrays and plain objects without a JSON stringify/parse round trip,
  - only string leaf values are redacted while object keys, `undefined` properties, and array structure are preserved,
  - circular references fail clearly with a dedicated error,
  - `requireRelativeFile()` rejects Windows-rooted and normalized POSIX-rooted absolute paths independent of host OS.
- Passing commands:

```text
cd ai-forge
node scripts/test-workstream-catalog.mjs
npm test
```

- Passing output highlights:

```text
test-workstream-catalog: ok
test-serving.mjs OK
test-serving-forge.mjs OK
```

## 2026-06-30 Final Review Fixes - Output Guardrail Instance Redaction

### RED

- Added regression coverage in `ai-forge/scripts/test-workstream-catalog.mjs` for a rendered/imported output guardrail receiving a class instance with blocked string properties.
- The new contract verifies:
  - `redactOutput()` clones the instance instead of mutating or returning it unchanged,
  - the returned value preserves the original prototype/`instanceof` shape,
  - blocked string leaf values on the instance and nested plain-object properties are redacted.
- Failing command:

```text
cd ai-forge
node scripts/test-workstream-catalog.mjs
```

- Failing output:

```text
AssertionError [ERR_ASSERTION]: class instances are cloned during redaction
    at main (.../ai-forge/scripts/test-workstream-catalog.mjs:409:10)
```

### GREEN

- Updated generated `redactOutput()` in `ai-forge/workstreams/catalog.mjs` to:
  - keep direct string input behavior unchanged,
  - continue recursively redacting arrays and plain objects,
  - clone ordinary `[object Object]` instances via property descriptors while preserving their prototype,
  - recurse into nested string leaf values on those instances,
  - keep circular-reference rejection explicit.
- Extended the generated output-guard selftest to cover class-instance redaction and prototype preservation.

- Passing commands:

```text
cd ai-forge
node scripts/test-workstream-catalog.mjs
npm test
```

- Passing output highlights:

```text
test-workstream-catalog: ok
test-serving.mjs OK
test-serving-forge.mjs OK
```

## 2026-06-30 Final Review Fixes - Guardrail Selftests Support Arbitrary Blocked Terms

### RED

- Added regression coverage in `ai-forge/scripts/test-workstream-catalog.mjs` that renders and runs generated selftests for:
  - `guardrailWorkstream({ mode: "input", blockedTerms: ["hello"] })`
  - `guardrailWorkstream({ mode: "output", blockedTerms: ["a"] })`
- Added an imported contract assertion for the `["a"]` output guardrail to prove object redaction remains correct even when the replacement marker contains the blocked term.
- Failing command:

```text
cd ai-forge
node scripts/test-workstream-catalog.mjs
```

- Failing output:

```text
Error: Command failed: node generated/input-guard-short-term-selftest.mjs --selftest
Error: input contains blocked term: hello
```

### GREEN

- Updated `ai-forge/workstreams/catalog.mjs` so generated guardrail selftests:
  - synthesize clean fixture strings that avoid the configured denylist instead of relying on hard-coded sample text,
  - exercise blocked cases with exact expected outputs rather than substring checks that can be invalidated by the redaction marker,
  - preserve existing support for arbitrary non-empty blocked terms, including short/common values like `"hello"` and `"a"`.
- Passing commands:

```text
cd ai-forge
node scripts/test-workstream-catalog.mjs
npm test
```

- Passing output highlights:

```text
test-workstream-catalog: ok
test-serving.mjs OK
test-serving-forge.mjs OK
```

## 2026-06-30 Final Review Fixes - Catalog Expansion Final Review Findings

### RED

- Added regression coverage in `ai-forge/scripts/test-workstream-catalog.mjs` for:
  - rendering and running a generated output guardrail selftest with `blockedTerms: ["ß"]`,
  - importing a rendered output guardrail and verifying `redactOutput()` preserves and redacts `Map` and `Set`,
  - rendering and importing a scorecard built from `JSON.parse('{"__proto__":0.5}')` thresholds.
- Failing command:

```text
cd ai-forge
node scripts/test-workstream-catalog.mjs
```

- Failing output:

```text
Error: Command failed: node generated/output-guard-unicode-case-selftest.mjs --selftest
Error: expected secret to be redacted
```

### GREEN

- Updated `ai-forge/workstreams/catalog.mjs` so generated catalog modules now:
  - use the exact blocked term in output-guard selftests instead of `toUpperCase()` fixtures that break on Unicode casing like `"ß"`,
  - redact values recursively inside `Map` and `Set` while preserving container type,
  - fail closed with a clear error for unsupported non-ordinary container types instead of returning them unchanged,
  - emit scorecard thresholds and selftest fixtures via `JSON.parse(<json string>)`, preserving keys like `"__proto__"` safely in generated code.
- Passing commands:

```text
cd ai-forge
node scripts/test-workstream-catalog.mjs
npm test
```

- Passing output highlights:

```text
test-workstream-catalog: ok
test-serving.mjs OK
test-serving-forge.mjs OK
```

## 2026-06-30 Final Review Fixes - Catalog Expansion Final Review Follow-ups

### RED

- Added regression coverage in `ai-forge/scripts/test-workstream-catalog.mjs` for:
  - rendering/importing a scorecard built from `JSON.parse('{"__proto__":0.5}')` and verifying both `computeScorecard({})` and `assertThresholds({})` reject with `missing score: __proto__`,
  - rendering/importing an output guardrail with `blockedTerms: ["ß"]` and verifying `redactOutput("ẞ")` redacts the uppercase Unicode form,
  - rendering/importing an output guardrail and passing an object with an enumerable getter that returns a blocked string, verifying `redactOutput()` fails closed with an accessor-property error.
- Failing command:

```text
cd ai-forge
node scripts/test-workstream-catalog.mjs
```

- Failing output:

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

'ẞ' !== '[REDACTED]'
```

### GREEN

- Updated `ai-forge/workstreams/catalog.mjs` so generated modules now:
  - use `Object.hasOwn(scores, key)` for required score-key validation, closing the inherited `__proto__` hole,
  - redact blocked output terms with a Unicode-aware alternation regex that explicitly covers the `ß`/`ẞ` case without re-redacting inside the replacement marker,
  - throw `unsupported accessor property on output: <key>` when cloning an object with an own getter/setter instead of copying the accessor through unchanged.
- Passing commands:

```text
cd ai-forge
node scripts/test-workstream-catalog.mjs
npm test
```

- Passing output highlights:

```text
test-workstream-catalog: ok
test-serving.mjs OK
test-serving-forge.mjs OK
```

## 2026-06-30 Final Review Fixes - Output Guardrail Regex Braces and Array Accessors

### RED

- Added regression coverage in `ai-forge/scripts/test-workstream-catalog.mjs` for:
  - rendering and running generated output-guard selftests with `blockedTerms: ["{"]`, `["}"]`, and `["a{b}"]`,
  - importing a rendered output guardrail and verifying an array with an own accessor element throws a clear accessor/unsupported-property error before the getter is invoked.
- Failing command:

```text
cd ai-forge
node scripts/test-workstream-catalog.mjs
```

- Failing output:

```text
Error: Command failed: node generated/output-guard-brace-open-selftest.mjs --selftest
SyntaxError: Invalid regular expression: /{/giu: Lone quantifier brackets
```

### GREEN

- Updated `ai-forge/workstreams/catalog.mjs` so generated output guardrails now:
  - escape blocked terms with the standard full regex metacharacter class, including `{` and `}`,
  - clone arrays by inspecting own property descriptors instead of using `Array.prototype.map`,
  - reject accessor descriptors on array indices and other own properties before reading them,
  - preserve array holes, `undefined`, length, and non-index own properties consistently with object redaction behavior.
- Passing commands:

```text
cd ai-forge
node scripts/test-workstream-catalog.mjs
npm test
```

- Passing output highlights:

```text
test-workstream-catalog: ok
test-serving.mjs OK
test-serving-forge.mjs OK
```

## 2026-06-30 Final Review Fixes - Output Guardrail Inherited Prototype Accessors

### RED

- Added regression coverage in `ai-forge/scripts/test-workstream-catalog.mjs` for a rendered/imported output guardrail receiving a class instance whose prototype defines an inherited getter returning a blocked string.
- The new contract verifies `redactOutput()` fails closed with a clear inherited/prototype/accessor error instead of returning a cloned instance whose getter still exposes the secret.
- Failing command:

```text
cd ai-forge
node scripts/test-workstream-catalog.mjs
```

- Failing output:

```text
AssertionError [ERR_ASSERTION]: Missing expected exception.
    at main (.../ai-forge/scripts/test-workstream-catalog.mjs:616:10)
```

### GREEN

- Updated `ai-forge/workstreams/catalog.mjs` so generated output guardrails now:
  - walk the prototype chain for accepted ordinary object instances before cloning,
  - reject inherited getter/setter descriptors with `unsupported inherited accessor property on output prototype: <key>`,
  - stop the walk at `Object.prototype`, so normal plain objects are not rejected because of built-ins,
  - preserve successful class-instance redaction for prototypes without accessors.
- Extended the generated output-guard selftest to cover inherited prototype accessor rejection directly.

- Passing commands:

```text
cd ai-forge
node scripts/test-workstream-catalog.mjs
npm test
```

- Passing output highlights:

```text
test-workstream-catalog: ok
test-serving.mjs OK
test-serving-forge.mjs OK
```

## 2026-06-30 Final Review Fixes - Composable Workstream Catalog Serving Contract Blockers

### RED

- Added regression coverage in `ai-forge/scripts/test-workstream-catalog.mjs` for:
  - rendered/imported output guardrails redacting `Map` string keys and object keys recursively,
  - default catalog input guardrails preserving the throw-or-passthrough contract,
  - rendered/imported serving `guard-in.mjs` returning `{ allow: true }`, `{ allow: false, reason: "denylisted" }`, and `{ allow: false, reason: "oversized" }`,
  - rendered/imported serving `audit.mjs` appending one top-level JSONL record to `dir/audit.log` without an `event` wrapper.
- Failing command:

```text
cd ai-forge
node scripts/test-workstream-catalog.mjs
```

- Failing output summary:

```text
AssertionError [ERR_ASSERTION]: string map keys are redacted recursively
actual: [ [ 'secret', 'visible' ] ]
expected: [ [ '[REDACTED]', 'visible' ] ]
```

### GREEN

- Updated `ai-forge/workstreams/catalog.mjs` so generated workstreams now:
  - redact `Map` keys and values recursively while preserving `Map` instances,
  - support explicit `inputContract: "allow-object"` while keeping the default catalog input contract as throw on blocked/oversized input and passthrough on clean input,
  - support explicit `auditContract: "directory-log"` while keeping the default catalog audit contract as `appendAudit(file, event)` with top-level `{ timestamp, event }`,
  - exercise both the selected input and audit contracts through generated `--selftest` code.
- Updated `ai-forge/patterns/serving.mjs` to opt into the explicit serving contracts:
  - `inputGuardWorkstream` uses `inputContract: "allow-object"`,
  - `auditWs` uses `auditContract: "directory-log"`.
- Passing commands:

```text
cd ai-forge
node scripts/test-workstream-catalog.mjs
npm test
```

- Passing output summary:

```text
test-workstream-catalog: ok
test-serving.mjs OK
test-serving-forge.mjs OK
npm test exit 0
```

- Code commit: `aafb11c` (`fix ai-forge serving contracts`)
- Files changed:
  - `ai-forge/workstreams/catalog.mjs`
  - `ai-forge/patterns/serving.mjs`
  - `ai-forge/scripts/test-workstream-catalog.mjs`

## 2026-06-30 Follow-up Serving Body Scope Fix

### RED

- Added rendered serving guardrail regressions proving the `allow-object` serving contract still scopes denylist and size checks to `req.body`, matching the pre-catalog serving module.
- Failing command:

```text
cd ai-forge
node scripts/test-workstream-catalog.mjs
```

- Failing output summary:

```text
AssertionError [ERR_ASSERTION]: serving input guard only inspects the request body for denylisted terms
actual: { allow: false, reason: "denylisted" }
expected: { allow: true }
```

### GREEN

- Added explicit `inputScope: "body"` support to `guardrailWorkstream({ mode: "input" })`.
- Updated the serving pattern to opt into `inputScope: "body"` alongside `inputContract: "allow-object"`.
- Passing commands:

```text
cd ai-forge
node scripts/test-workstream-catalog.mjs
npm test
```

- Passing output summary:

```text
test-workstream-catalog: ok
test-serving.mjs OK
test-serving-forge.mjs OK
npm test exit 0
```
