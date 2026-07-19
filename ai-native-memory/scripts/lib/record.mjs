// record.mjs — vendored primitives for the ai-native-memory oracles. Zero-dep, stdlib only.
// Deliberately self-contained: the plugin never imports from a host repo's packages.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export const RECORD_KINDS = new Set([
  "mechanism",
  "decision",
  "rejected-alternative",
  "non-claim",
  "invariant",
  "open-question",
  "contract",
  "evidence"
]);

export const RECORD_STATUSES = new Set([
  "NORMATIVE-CURRENT",
  "SUPERSEDED",
  "SPECIFIED-PENDING-IMPLEMENTATION",
  "RATIFICATION-PENDING",
  "MODEL-PROPOSAL",
  "REJECTED-ALTERNATIVE",
  "OPEN-QUESTION",
  "HUMAN-AUTHORIZED-EXCEPTION",
  "ADVISORY"
]);

export const RECORD_LIFECYCLES = new Set([
  "docs-first",
  "build-first-then-ratified"
]);

export const DECISION_PROVENANCE = new Set([
  "human",
  "model-advisory-adopted-by-human"
]);

// Deterministic JSON: object keys sorted at every level, arrays in given order, no whitespace.
export function canonicalize(v) {
  if (Array.isArray(v)) return "[" + v.map(canonicalize).join(",") + "]";
  if (v && typeof v === "object") {
    return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canonicalize(v[k])).join(",") + "}";
  }
  return JSON.stringify(v);
}

export function sha256hex(input) {
  return createHash("sha256").update(input).digest("hex");
}

// Content address of a record: sha256 over its canonical form MINUS its own "id" field.
export function contentAddress(record) {
  const { id, ...rest } = record;
  return "sha256:" + sha256hex(canonicalize(rest));
}

export function hasValidContentAddress(record) {
  return typeof record?.id === "string"
    && /^sha256:[0-9a-f]{64}$/.test(record.id)
    && record.id === contentAddress(record);
}

export function renderRecordList(title, records) {
  const rows = records.map((record) =>
    `- **${record.id}** [${record.status || "unspecified"}] ${record.statement}`
  );
  return `# ${title} (rendered)\n\n${rows.join("\n")}\n`;
}

export function resolveWithin(root, relativePath) {
  if (typeof relativePath !== "string" || !relativePath || path.isAbsolute(relativePath)) {
    throw new Error("path must be nonempty and repository-relative");
  }
  const base = path.resolve(root);
  const resolved = path.resolve(base, relativePath);
  const relative = path.relative(base, resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`path escapes repository root: ${relativePath}`);
  }
  return resolved;
}

export function isPortableExecutablePath(value) {
  if (typeof value !== "string"
    || value.length === 0
    || value !== value.trim()
    || value.includes("\\")
    || value.includes("\0")
    || path.posix.isAbsolute(value)
    || path.win32.isAbsolute(value)
    || /^[A-Za-z]:/.test(value)) {
    return false;
  }
  const windowsReserved =
    /^(?:con|prn|aux|nul|clock\$|conin\$|conout\$|com[1-9]|lpt[1-9])(?:\..*)?$/i;
  const segments = value.split("/");
  if (segments.some((segment) =>
    segment === ""
    || segment === "."
    || segment === ".."
    || /[<>:"|?*\u0000-\u001f]/.test(segment)
    || /[. ]$/.test(segment)
    || windowsReserved.test(segment)
  )) {
    return false;
  }
  return path.posix.normalize(value) === value
    && /\.(?:cjs|js|mjs)$/.test(segments.at(-1));
}

const IDENTIFIER_START = /[$_\p{ID_Start}]/u;
const IDENTIFIER_PART = /[$_\u200C\u200D\p{ID_Continue}]/u;
const isIdentifierStart = (character) =>
  typeof character === "string" && character.length > 0
  && IDENTIFIER_START.test(character);
const isIdentifierPart = (character) =>
  typeof character === "string" && character.length > 0
  && IDENTIFIER_PART.test(character);
const REGEX_PREFIX_KEYWORDS = new Set([
  "await",
  "case",
  "delete",
  "do",
  "else",
  "in",
  "instanceof",
  "new",
  "of",
  "return",
  "throw",
  "typeof",
  "void",
  "yield"
]);
const CONTROL_PAREN_KEYWORDS = new Set([
  "catch",
  "for",
  "if",
  "switch",
  "while",
  "with"
]);
const BLOCK_PREFIX_KEYWORDS = new Set([
  "do",
  "else",
  "finally",
  "try"
]);
const PUNCTUATORS = [
  ">>>=",
  "&&=",
  "**=",
  "...",
  "===",
  "!==",
  ">>>",
  "<<=",
  ">>=",
  "??=",
  "||=",
  "=>",
  "&&",
  "++",
  "--",
  "==",
  ">=",
  "<=",
  "!=",
  "??",
  "||",
  "?.",
  "**",
  "<<",
  ">>",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "&=",
  "|=",
  "^="
];

const isKeyword = (token, value) =>
  token?.type === "identifier"
  && token.value === value
  && token.escaped !== true;

function codePoint(source, index) {
  const point = source.codePointAt(index);
  if (point === undefined) return null;
  const value = String.fromCodePoint(point);
  return { value, next: index + value.length };
}

function unicodeEscape(source, index) {
  if (source[index] !== "\\" || source[index + 1] !== "u") return null;
  if (source[index + 2] === "{") {
    const close = source.indexOf("}", index + 3);
    if (close < 0) return null;
    const digits = source.slice(index + 3, close);
    if (!/^[0-9A-Fa-f]{1,6}$/.test(digits)) return null;
    const point = Number.parseInt(digits, 16);
    if (point > 0x10FFFF) return null;
    return { value: String.fromCodePoint(point), next: close + 1 };
  }
  const digits = source.slice(index + 2, index + 6);
  if (!/^[0-9A-Fa-f]{4}$/.test(digits)) return null;
  return {
    value: String.fromCodePoint(Number.parseInt(digits, 16)),
    next: index + 6
  };
}

function literalEscape(source, index) {
  const next = source[index + 1];
  if (next === "\r" && source[index + 2] === "\n") {
    return { value: "", next: index + 3 };
  }
  if (next === "\n" || next === "\r" || next === "\u2028" || next === "\u2029") {
    return { value: "", next: index + 2 };
  }
  const unicode = unicodeEscape(source, index);
  if (unicode) return unicode;
  if (next === "x") {
    const digits = source.slice(index + 2, index + 4);
    if (/^[0-9A-Fa-f]{2}$/.test(digits)) {
      return {
        value: String.fromCodePoint(Number.parseInt(digits, 16)),
        next: index + 4
      };
    }
  }
  const simple = {
    b: "\b",
    f: "\f",
    n: "\n",
    r: "\r",
    t: "\t",
    v: "\v",
    "0": "\0"
  };
  return {
    value: Object.hasOwn(simple, next) ? simple[next] : (next || ""),
    next: Math.min(index + 2, source.length)
  };
}

function regexMayStart(previous) {
  if (!previous) return true;
  if (previous.type === "identifier") {
    return previous.escaped !== true
      && REGEX_PREFIX_KEYWORDS.has(previous.value);
  }
  if (previous.regexAfter === true) return true;
  return previous.type === "punctuator"
    && ![")", "]", "}", ".", "++", "--"].includes(previous.value);
}

function javascriptTokens(source) {
  const tokens = [];
  let index = 0;
  let previous = null;
  const parenContexts = [];
  const braceContexts = [];

  const push = (type, value, start, extra = {}) => {
    const token = { type, value, start, ...extra };
    tokens.push(token);
    previous = token;
    return token;
  };

  const scanQuotedString = () => {
    const start = index;
    const quote = source[index];
    let value = "";
    index++;
    while (index < source.length) {
      const character = source[index];
      if (character === "\\") {
        const escape = literalEscape(source, index);
        value += escape.value;
        index = escape.next;
      } else if (character === quote) {
        index++;
        break;
      } else {
        const point = codePoint(source, index);
        value += point.value;
        index = point.next;
      }
    }
    push("string", value, start);
  };

  const scanRegex = () => {
    const start = index;
    let inCharacterClass = false;
    index++;
    while (index < source.length) {
      const character = source[index];
      if (character === "\\") {
        index += 2;
      } else if (character === "[") {
        inCharacterClass = true;
        index++;
      } else if (character === "]") {
        inCharacterClass = false;
        index++;
      } else if (character === "/" && !inCharacterClass) {
        index++;
        while (/[A-Za-z]/.test(source[index] || "")) index++;
        break;
      } else if (character === "\n" || character === "\r") {
        break;
      } else {
        index++;
      }
    }
    push("regex", "/", start);
  };

  let scanCode;
  const scanTemplate = () => {
    const start = index;
    const token = push("template", "", start, { hasInterpolation: false });
    let value = "";
    index++;
    while (index < source.length) {
      const character = source[index];
      if (character === "\\") {
        const escape = literalEscape(source, index);
        value += escape.value;
        index = escape.next;
      } else if (character === "`") {
        index++;
        token.value = value;
        previous = token;
        return;
      } else if (character === "$" && source[index + 1] === "{") {
        token.hasInterpolation = true;
        index += 2;
        previous = null;
        scanCode(true);
      } else {
        const point = codePoint(source, index);
        value += point.value;
        index = point.next;
      }
    }
    token.value = value;
    previous = token;
  };

  scanCode = (stopAtTemplateBrace = false) => {
    let braceDepth = 0;
    while (index < source.length) {
      const character = source[index];
      if (/\s/.test(character)) {
        index++;
        continue;
      }
      if (character === "/" && source[index + 1] === "/") {
        index += 2;
        while (index < source.length && !/[\r\n]/.test(source[index])) index++;
        continue;
      }
      if (character === "/" && source[index + 1] === "*") {
        index += 2;
        while (index < source.length
          && !(source[index] === "*" && source[index + 1] === "/")) {
          index++;
        }
        index = Math.min(index + 2, source.length);
        continue;
      }
      if (stopAtTemplateBrace && character === "}" && braceDepth === 0) {
        index++;
        return;
      }
      if (character === "'" || character === "\"") {
        scanQuotedString();
        continue;
      }
      if (character === "`") {
        scanTemplate();
        continue;
      }
      const initialPoint = codePoint(source, index);
      if (initialPoint && isIdentifierStart(initialPoint.value)) {
        const start = index;
        let value = initialPoint.value;
        let escaped = false;
        let point;
        index = initialPoint.next;
        while (index < source.length) {
          const escape = unicodeEscape(source, index);
          if (escape && isIdentifierPart(escape.value)) {
            escaped = true;
            value += escape.value;
            index = escape.next;
            continue;
          }
          point = codePoint(source, index);
          if (!point || !isIdentifierPart(point.value)) break;
          value += point.value;
          index = point.next;
        }
        push("identifier", value, start, { escaped });
        continue;
      }
      const escapedStart = unicodeEscape(source, index);
      if (escapedStart && isIdentifierStart(escapedStart.value)) {
        const start = index;
        let value = escapedStart.value;
        index = escapedStart.next;
        while (index < source.length) {
          const escape = unicodeEscape(source, index);
          if (escape && isIdentifierPart(escape.value)) {
            value += escape.value;
            index = escape.next;
            continue;
          }
          const point = codePoint(source, index);
          if (!point || !isIdentifierPart(point.value)) break;
          value += point.value;
          index = point.next;
        }
        push("identifier", value, start, { escaped: true });
        continue;
      }
      if (/[0-9]/.test(character)) {
        const start = index;
        index++;
        while (/[A-Za-z0-9_.]/.test(source[index] || "")) index++;
        push("number", source.slice(start, index), start);
        continue;
      }
      if (character === "/" && regexMayStart(previous)) {
        scanRegex();
        continue;
      }
      const start = index;
      const punctuator = PUNCTUATORS.find((candidate) =>
        source.startsWith(candidate, index)
      ) || character;
      index += punctuator.length;
      let regexAfter = false;
      if (punctuator === "(") {
        parenContexts.push(
          previous?.type === "identifier"
          && previous.escaped !== true
          && CONTROL_PAREN_KEYWORDS.has(previous.value)
        );
      } else if (punctuator === ")") {
        regexAfter = parenContexts.pop() === true;
      } else if (punctuator === "{") {
        braceContexts.push(
          !previous
          || previous.regexAfter === true
          || (previous.type === "punctuator"
            && [";", "{"].includes(previous.value))
          || (previous.type === "identifier"
            && previous.escaped !== true
            && BLOCK_PREFIX_KEYWORDS.has(previous.value))
        );
      } else if (punctuator === "}") {
        regexAfter = braceContexts.pop() === true;
      }
      push("punctuator", punctuator, start, { regexAfter });
      if (stopAtTemplateBrace && punctuator === "{") {
        braceDepth++;
      } else if (stopAtTemplateBrace && punctuator === "}") {
        braceDepth--;
      }
    }
  };

  scanCode();
  return tokens;
}

function afterBalanced(tokens, index, open, close) {
  let depth = 0;
  for (let cursor = index; cursor < tokens.length; cursor++) {
    if (tokens[cursor].value === open) depth++;
    if (tokens[cursor].value === close) {
      depth--;
      if (depth === 0) return cursor + 1;
    }
  }
  return tokens.length;
}

function literalDynamicSpecifier(tokens, openIndex) {
  let cursor = openIndex + 1;
  let wrappers = 0;
  while (tokens[cursor]?.value === "(") {
    wrappers++;
    cursor++;
  }
  const literal = tokens[cursor];
  if (literal?.type !== "string"
    && !(literal?.type === "template" && literal.hasInterpolation === false)) {
    return null;
  }
  cursor++;
  for (let count = 0; count < wrappers; count++) {
    if (tokens[cursor]?.value !== ")") return null;
    cursor++;
  }
  return [")", ","].includes(tokens[cursor]?.value)
    ? literal.value
    : null;
}

function importDeclarationSpecifier(tokens, index) {
  let cursor = index + 1;
  if (tokens[cursor]?.type === "string") return tokens[cursor].value;
  if (tokens[cursor]?.value === ".") return null;
  if (tokens[cursor]?.value === "(") {
    return literalDynamicSpecifier(tokens, cursor);
  }

  if (tokens[cursor]?.type === "identifier") {
    cursor++;
    if (tokens[cursor]?.value === ",") cursor++;
  }
  if (tokens[cursor]?.value === "*") {
    cursor++;
    if (isKeyword(tokens[cursor], "as")) cursor += 2;
  } else if (tokens[cursor]?.value === "{") {
    cursor = afterBalanced(tokens, cursor, "{", "}");
  }
  return isKeyword(tokens[cursor], "from") && tokens[cursor + 1]?.type === "string"
    ? tokens[cursor + 1].value
    : null;
}

function exportDeclarationSpecifier(tokens, index) {
  let cursor = index + 1;
  if (tokens[cursor]?.value === "*") {
    cursor++;
    if (isKeyword(tokens[cursor], "as")) cursor += 2;
  } else if (tokens[cursor]?.value === "{") {
    cursor = afterBalanced(tokens, cursor, "{", "}");
  } else {
    return null;
  }
  return isKeyword(tokens[cursor], "from") && tokens[cursor + 1]?.type === "string"
    ? tokens[cursor + 1].value
    : null;
}

function importAnalysis(source) {
  const tokens = javascriptTokens(source);
  const specifiers = [];
  const unverifiableDynamicImports = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    const previousToken = tokens[index - 1];
    if (token.type !== "identifier"
      || token.escaped === true
      || [".", "?.", "#"].includes(previousToken?.value)) {
      continue;
    }
    if (token.value === "import" && tokens[index + 1]?.value === "(") {
      const specifier = literalDynamicSpecifier(tokens, index + 1);
      if (specifier === null) {
        unverifiableDynamicImports.push(token.start);
      } else {
        specifiers.push(specifier);
      }
      continue;
    }
    const specifier = token.value === "import"
      ? importDeclarationSpecifier(tokens, index)
      : token.value === "export"
        ? exportDeclarationSpecifier(tokens, index)
        : null;
    if (specifier !== null) specifiers.push(specifier);
  }
  return { specifiers, unverifiableDynamicImports };
}

export function importSpecifiers(source) {
  return importAnalysis(source).specifiers;
}

export function packageBoundaryProblems(root) {
  const problems = [];
  let packageJson;
  try {
    packageJson = readJson(path.join(root, "package.json"));
  } catch (error) {
    return [error.message];
  }
  const dependencies = packageJson?.dependencies;
  if (!Object.hasOwn(packageJson || {}, "dependencies")
    || !dependencies
    || typeof dependencies !== "object"
    || Array.isArray(dependencies)
    || Object.keys(dependencies).length > 0) {
    const names = dependencies && typeof dependencies === "object" && !Array.isArray(dependencies)
      ? Object.keys(dependencies).sort()
      : [];
    problems.push(
      `package.json runtime dependencies must be an empty object${names.length ? `: ${names.join(", ")}` : ""}`
    );
  }
  for (const field of ["optionalDependencies", "peerDependencies"]) {
    if (!Object.hasOwn(packageJson || {}, field)) continue;
    const declarations = packageJson[field];
    const valid = declarations
      && typeof declarations === "object"
      && !Array.isArray(declarations)
      && Object.keys(declarations).length === 0;
    if (!valid) {
      const names = declarations
        && typeof declarations === "object"
        && !Array.isArray(declarations)
        ? Object.keys(declarations).sort()
        : [];
      problems.push(
        `package.json ${field} must be absent or an empty object${names.length ? `: ${names.join(", ")}` : ""}`
      );
    }
  }
  for (const field of ["bundledDependencies", "bundleDependencies"]) {
    if (!Object.hasOwn(packageJson || {}, field)) continue;
    const declarations = packageJson[field];
    if (!((Array.isArray(declarations) && declarations.length === 0)
      || declarations === false)) {
      const names = Array.isArray(declarations) ? declarations : [];
      problems.push(
        `package.json ${field} must be absent, false, or an empty array${names.length ? `: ${names.join(", ")}` : ""}`
      );
    }
  }

  const scripts = path.join(root, "scripts");
  const walk = (directory) => {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      problems.push(`cannot scan scripts directory ${directory}: ${error.message}`);
      return;
    }
    for (const entry of entries) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        problems.push(`${path.relative(root, file)}: script scan does not follow symlinks`);
      } else if (entry.isDirectory()) {
        walk(file);
      } else if (entry.isFile() && /\.(?:cjs|js|mjs)$/.test(entry.name)) {
        let source;
        try {
          source = readFileSync(file, "utf8");
        } catch (error) {
          problems.push(`cannot read ${path.relative(root, file)}: ${error.message}`);
          continue;
        }
        const analysis = importAnalysis(source);
        for (const specifier of analysis.specifiers) {
          if (!specifier.startsWith("node:") && !specifier.startsWith(".")) {
            problems.push(
              `${path.relative(root, file)}: non-portable import ${specifier}`
            );
          }
        }
        for (const offset of analysis.unverifiableDynamicImports) {
          const prefix = source.slice(0, offset);
          const lines = prefix.split(/\r\n|[\n\r\u2028\u2029]/);
          problems.push(
            `${path.relative(root, file)}: cannot statically verify dynamic import`
            + ` at line ${lines.length}, column ${lines.at(-1).length + 1}`
          );
        }
      }
    }
  };
  walk(scripts);
  return problems;
}

export function readJson(p) {
  let raw;
  try { raw = readFileSync(p, "utf8"); } catch (e) { throw new Error(`cannot read ${p}: ${e.message}`); }
  try { return JSON.parse(raw); } catch (e) { throw new Error(`invalid JSON in ${p}: ${e.message}`); }
}

export function finding(level, check, path, detail) {
  return { level, check, path, detail };
}

// Prints one JSON line per finding + a human summary. Returns the fail-closed exit code.
export function printFindings(findings, label) {
  for (const f of findings) console.log(JSON.stringify(f));
  const fails = findings.filter((f) => f.level === "FAIL").length;
  const warns = findings.filter((f) => f.level === "WARN").length;
  console.log(`${label}: ${fails} FAIL, ${warns} WARN`);
  return fails ? 2 : 0;
}
