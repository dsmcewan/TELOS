// weavers/util.mjs — Clotho's shared weaver substrate (plan v13 (v12 + AM-40) Task 4a). Zero
// dependencies: Node stdlib only.
//
// One lexical scanner (comment/string aware, never executes code), ONE
// module-load form classifier and ONE relative-specifier resolver (D33) shared
// by the closure derivation and — from Task 5 — the advisory outbound scanner;
// the accepted relative module-load closure derived from them; a real-file
// walker; the counted-iterator constructor (D26/D29); the physical-containment
// helper (D21); and the no-shell weaver-facing git wrapper.

import { readFileSync, readdirSync, lstatSync, realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const IDENT_CHAR = /[A-Za-z0-9_$]/;
const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const HEX40 = /^[0-9a-f]{40}$/;

// ---- enforced closed source profile (AM-41) ---------------------------------
// The shared D33 scanner is correct ONLY over a closed, mechanically enforced
// source profile; every construct outside it FAILS CLOSED with this stable
// diagnostic (no edge, no closure result, no coverage claim for that file).
export const PROFILE_DIAGNOSTIC = "unsupported-module-lexical-profile";
export class ProfileError extends Error {
  constructor(detail) { super(`${PROFILE_DIAGNOSTIC}: ${detail}`); this.diagnostic = PROFILE_DIAGNOSTIC; this.detail = detail; }
}

// Escape a run of text for use as a LITERAL inside a RegExp: every
// metacharacter is neutralized, so searched text can never alter the matcher.
export function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// The ONE canonical repository-relative POSIX path predicate, shared by the git
// path-argument allowlist and asserted over walker / closure outputs: a nonempty
// string with no NUL, no backslash, no leading "/", and no "."/".." segment.
// This is what "validated repository-relative POSIX paths" means throughout.
export function isCanonicalRepoRelPosix(p) {
  if (typeof p !== "string" || p.length === 0) return false;
  if (p.includes("\0") || p.includes("\\") || p.startsWith("/")) return false;
  return p.split("/").every((seg) => seg.length > 0 && seg !== "." && seg !== "..");
}

// ---- lexical scanner ---------------------------------------------------------
// Single pass over the source tracking code / line-comment / block-comment /
// single- and double-quoted string / template-literal state. Produces a `masked`
// string (same length as the source) in which every comment character and every
// string/template INTERIOR byte is replaced by a space, while structural
// delimiters (quotes, backticks, braces, parens) are preserved — so a structural
// regex over `masked` can never match inside a comment or string. Also returns
// `strings`: each plain single/double string literal keyed by its opening-quote
// index, carrying its decoded-enough value (specifiers never contain escapes we
// must decode beyond the raw slice). Templates are recorded as non-plain (a
// template specifier is treated as non-literal). Regex literals are not treated
// as strings; they are masked as code (specifiers are never regexes).

// Chars after which a `/` begins a REGEX literal (expression position) rather
// than division. After any value-terminating token (identifier, `)`, `]`, `}`,
// string, template) a `/` is division; after a punctuator that cannot end an
// expression it is a regex. `)`, `]`, `}` are deliberately EXCLUDED here and
// handled as expression-enders — except a `)` that closes a control head (see
// CONTROL_HEADS), which is resolved separately in regexAllowedAfter.
const REGEX_PREFIX = new Set("([{,;=:?!&|^~+-*%<>".split(""));
// Keywords that cannot end an expression, so a following `/` begins a REGEX
// literal even though the preceding significant char is an identifier char —
// e.g. the `/` in `return /re/` or `case /re/`. Regex-vs-division after a WORD is
// the canonical tokenizer DENY rule (not a hand-maintained allow-list): a `/`
// after a word is DIVISION only when the word produces a value — a VALUE keyword
// (`this`/`super`/`true`/`false`/`null`) or a plain non-keyword identifier; after
// any OTHER reserved keyword (which cannot end an expression as a value) a `/`
// begins a REGEX. This is the COMPLETE ES reserved-word set, so `default`,
// `extends`, etc. are covered. `of` stays contextual (regex only inside a control
// head) so a division after an `of`-named binding elsewhere is unaffected.
const VALUE_KEYWORDS = new Set(["this", "super", "true", "false", "null"]);
const RESERVED_KEYWORDS = new Set([
  "await", "break", "case", "catch", "class", "const", "continue", "debugger",
  "default", "delete", "do", "else", "enum", "export", "extends", "finally",
  "for", "function", "if", "import", "in", "instanceof", "new", "return",
  "switch", "throw", "try", "typeof", "var", "void", "while", "with", "yield"
]);
// Keywords whose `(` opens a CONTROL head (`if (x) /re/` — the `)` is followed by
// a regex, not division). An expression-group `)` (any other `(`) is followed by
// division. Tracking which kind of `(` a `)` closes is what makes regex-vs-division
// sound after `)`.
const CONTROL_HEADS = new Set(["if", "while", "for", "switch", "catch", "with"]);
// `/` begins a regex when the previous significant TOKEN cannot end an
// expression: statement start, an expression-introducing punctuator, a
// non-expression-ending keyword, or a `)` that closes a control head. After an
// identifier/literal/`]`/`}`/expression-`)` it is division. The previous
// significant token (`prevSig` char + `prevWord`) is tracked by the lexer across
// whitespace AND comments (both are blanked without updating it), so
// `return /*c*/ /re/` and `if /*c*/ (...) /re/` classify soundly.
function regexAllowedAfter(prevSig, prevWord, lastParenKind, prevSig2, inControlParen, lastBraceKind) {
  if (prevSig === "" || prevSig === "\n") return true;
  // Postfix `++`/`--` is an expression-ender, so a following `/` is DIVISION —
  // e.g. `x++ / import("./m.mjs")` must NOT mask the dynamic import as a regex.
  if ((prevSig === "+" && prevSig2 === "+") || (prevSig === "-" && prevSig2 === "-")) return false;
  if (prevSig === ")") return lastParenKind === "control";
  // A `/` after a block `}` (statement/function/arrow body) is a REGEX; after an
  // object/expression `}` it is DIVISION.
  if (prevSig === "}") return lastBraceKind === "block";
  if (REGEX_PREFIX.has(prevSig)) return true;
  // Previous token was a WORD (prevSig is an identifier char) or a numeric literal
  // (prevSig is a digit, prevWord ""). `of` inside a control head introduces the
  // iterable expression → regex; a value keyword or a plain identifier/number →
  // division; any other reserved keyword → regex.
  if (IDENT_CHAR.test(prevSig)) {
    if (prevWord === "of" && inControlParen) return true;
    if (VALUE_KEYWORDS.has(prevWord)) return false;
    return RESERVED_KEYWORDS.has(prevWord);
  }
  return false;
}

// Decode a single JS string escape beginning at source[i] === '\\'. Returns the
// decoded value and the next index. Correctly interpreting escapes (rather than
// dropping them) is required so a specifier whose runtime value is relative — e.g.
// one written with a `\x2e`/`.` for '.' — is not silently omitted from the
// closure. The NUL value is built at runtime (never a literal NUL byte in source).
const SIMPLE_ESCAPES = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", v: "\v", "0": String.fromCharCode(0), "\\": "\\", "'": "'", '"': '"', "`": "`" };
// The EXACT in-profile string-escape initial chars (frozen AM-41 (a)):
// \\ \" \' \n \r \t \b \f \v \0 \xHH \uHHHH \u{…}. Any other escaped char is
// out-of-profile. (Line-continuation and legacy/octal are flagged separately as b4.)
const STRING_ESCAPE_OK = new Set(["\\", '"', "'", "n", "r", "t", "b", "f", "v", "0", "x", "u"]);
function decodeEscape(source, i) {
  const e = source[i + 1];
  if (e === undefined) return { value: "", next: i + 2 };
  if (e === "\n") return { value: "", next: i + 2 };                 // line continuation
  if (e === "x") {
    const hex = source.slice(i + 2, i + 4);
    if (/^[0-9a-fA-F]{2}$/.test(hex)) return { value: String.fromCharCode(parseInt(hex, 16)), next: i + 4 };
    return { value: "x", next: i + 2 };
  }
  if (e === "u") {
    if (source[i + 2] === "{") {
      const close = source.indexOf("}", i + 3);
      const hx = close === -1 ? "" : source.slice(i + 3, close);
      // Guard the codepoint range: an out-of-range \u{…} is flagged out-of-profile
      // by the caller; here we must never throw a native RangeError.
      if (close !== -1 && /^[0-9a-fA-F]+$/.test(hx) && parseInt(hx, 16) <= 0x10ffff) return { value: String.fromCodePoint(parseInt(hx, 16)), next: close + 1 };
      return { value: "u", next: i + 2 };
    }
    const hex = source.slice(i + 2, i + 6);
    if (/^[0-9a-fA-F]{4}$/.test(hex)) return { value: String.fromCharCode(parseInt(hex, 16)), next: i + 6 };
    return { value: "u", next: i + 2 };
  }
  if (Object.prototype.hasOwnProperty.call(SIMPLE_ESCAPES, e)) return { value: SIMPLE_ESCAPES[e], next: i + 2 };
  return { value: e, next: i + 2 };                                  // any other escaped char is itself
}

// Horizontal (non-line-terminator) whitespace, complete set: TAB, VT, FF, SPACE,
// NBSP, BOM/ZWNBSP. Line terminators (LF/CR/U+2028/U+2029) are handled separately.
function isHorizontalWs(cc) {
  return cc === 0x09 || cc === 0x0b || cc === 0x0c || cc === 0x20 || cc === 0xa0 || cc === 0xfeff;
}

export function lex(source) {
  const n = source.length;
  const keep = new Uint8Array(n); // 1 = code byte to preserve; 0 = blank to space
  const strings = new Map(); // openQuoteIndex -> { end, value, plain:true }
  const templates = new Set(); // opening-backtick index
  // Mode stack. "code" frames are the top level OR a template `${ ... }`
  // substitution (subst:true, `brace` = unmatched "{" opened since the "${").
  // "template" frames blank literal text but yield to "code" inside "${...}".
  const stack = [{ mode: "code", subst: false, brace: 0 }];
  let prevSig = ""; // last significant (non-space) code char, for regex detection
  let prevSig2 = ""; // the significant code char before prevSig (postfix ++/-- detection)
  let prevSigWord = ""; // last significant identifier word (comment/space-robust),
  // for control-head detection and keyword-based regex detection
  // Paren-kind stack: each "(" is "control" (opened by if/while/for/switch/catch/
  // with) or "expr"; on ")" we remember the closed kind so a `/` after a control
  // head is a regex while a `/` after an expression group is division.
  const parenStack = [];
  let lastParenKind = null;
  // Brace-kind stack (parallel to parenStack): each code-mode "{" is a BLOCK
  // (statement/function/arrow/control body) or an OBJECT/expression; on "}" we
  // remember the closed kind so a `/` after a block `}` is a regex while a `/`
  // after an object/expression `}` is division. Kind is decided at "{" open from
  // the previous significant token.
  const braceStack = [];
  let lastBraceKind = null;
  // A `class`/`function` keyword makes the NEXT "{" a BLOCK body (class/function
  // body), regardless of the immediately-preceding token (which is the class/
  // function/super NAME, an identifier that braceKindOf would otherwise read as an
  // object). Set when the keyword is lexed, consumed at the next "{".
  let blockHeadPending = false;
  const braceKindOf = (ps, ps2, pw) => {
    if (ps === "" || ps === ")" || ps === ";" || ps === "{" || ps === "}") return "block";
    if (ps === ">" && ps2 === "=") return "block";                 // arrow `=> {`
    if (pw === "do" || pw === "else" || pw === "try" || pw === "finally") return "block";
    return "expr";                                                 // after = ( , [ : return operator
  };
  // AM-41 enforced source profile: `profileError` is set on the FIRST out-of-
  // profile construct (b1-b6); callers throw ProfileError (fail closed).
  let profileError = null;
  const flagProfile = (d) => { if (!profileError) profileError = d; };
  // b1: a bare CR (U+000D not immediately followed by LF), U+2028, or U+2029
  // anywhere in the source (checked mode-independently, incl. string interiors).
  for (let k = 0; k < n; k++) {
    const cc = source.charCodeAt(k);
    if ((cc === 0x0d && source.charCodeAt(k + 1) !== 0x0a) || cc === 0x2028 || cc === 0x2029) {
      flagProfile("bare CR / U+2028 / U+2029 line terminator"); break;
    }
  }
  let i = 0;
  // AM-41: one optional leading shebang line (`#!` at byte offset 0, first line,
  // LF/CRLF-terminated) is IN-profile and blanked before lexical classification;
  // an unterminated leading shebang is out-of-profile (b6). A `#!` anywhere else
  // is caught as b2 in code mode below.
  if (source[0] === "#" && source[1] === "!") {
    const e = source.indexOf("\n");
    if (e === -1) { flagProfile("unterminated leading shebang"); i = n; }
    else { i = e; } // [0,e) stays blanked (keep=0); the LF at e lexes normally
  }
  while (i < n) {
    const top = stack[stack.length - 1];
    if (top.mode === "template") {
      const c = source[i];
      if (c === "\\") { i += 2; continue; }                 // escaped template char: blanked
      if (c === "`") { keep[i] = 1; i++; stack.pop(); prevSig2 = prevSig; prevSig = "`"; prevSigWord = ""; continue; }  // closing backtick: value token
      if (c === "$" && source[i + 1] === "{") {              // enter substitution code
        keep[i] = 1; keep[i + 1] = 1; i += 2;
        stack.push({ mode: "code", subst: true, brace: 0 });
        prevSig = "{";
        continue;
      }
      i++;                                                   // ordinary template text: blanked
      continue;
    }
    // ---- code mode ----
    const c = source[i], c2 = source[i + 1];
    if (c === "}" && top.subst && top.brace === 0) {         // close the "${...}"
      keep[i] = 1; i++; stack.pop(); prevSig = "}"; continue;
    }
    if (c === "{") { const bk = blockHeadPending ? "block" : braceKindOf(prevSig, prevSig2, prevSigWord); blockHeadPending = false; braceStack.push(bk); if (top.subst) top.brace++; keep[i] = 1; i++; prevSig = "{"; prevSigWord = ""; continue; }
    if (c === "}") { lastBraceKind = braceStack.length ? braceStack.pop() : "block"; if (top.subst && top.brace > 0) top.brace--; keep[i] = 1; i++; prevSig = "}"; prevSigWord = ""; continue; }
    if (c === "#" && c2 === "!") { flagProfile("hashbang (#!) in code position"); i += 2; continue; } // b2 (non-leading)
    if (c === "<" && source[i + 1] === "!" && source[i + 2] === "-" && source[i + 3] === "-") { flagProfile("HTML comment opener <!--"); i += 4; continue; } // b3
    if (c === "-" && c2 === "-" && source[i + 2] === ">") {
      // b3: a line-leading `-->` closes an HTML comment (Annex B). "Line-leading"
      // permits only horizontal whitespace between the previous line terminator (or
      // BOF) and the `-->` — the COMPLETE set (space, tab, VT, FF, NBSP, BOM), not
      // just space/tab — matching the ECMAScript SingleLineHTMLCloseComment rule.
      let s = i - 1;
      while (s >= 0 && isHorizontalWs(source.charCodeAt(s))) s--;
      if (s < 0 || source[s] === "\n" || source[s] === "\r") { flagProfile("line-leading HTML comment -->"); i += 3; continue; }
    }
    if (c === "/" && c2 === "/") { i += 2; while (i < n && source[i] !== "\n") i++; continue; }
    if (c === "/" && c2 === "*") {
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) i++;
      if (i >= n) { flagProfile("unterminated block comment"); continue; } // b6
      i += 2; continue;
    }
    if (c === '"' || c === "'") {
      const open = i;
      keep[open] = 1; // preserve the opening quote position
      i++;
      let value = "";
      while (i < n && source[i] !== c) {
        if (source[i] === "\\") {
          const e = source[i + 1], ec = source.charCodeAt(i + 1);
          // b4: a string line-continuation (backslash before a line terminator),
          // or a legacy/octal escape (`\` + decimal digit, other than `\0` NOT
          // followed by a digit), is out-of-profile.
          if (e === "\n" || e === "\r" || ec === 0x2028 || ec === 0x2029) flagProfile("string line-continuation");
          else if (e >= "0" && e <= "9" && !(e === "0" && !(source[i + 2] >= "0" && source[i + 2] <= "9"))) flagProfile("legacy/octal string escape");
          // Only the frozen escape set is in-profile; any other escaped char
          // (`\a`, `\/`, `` \` `` in a string, …) is out-of-profile (b6-adjacent).
          else if (!STRING_ESCAPE_OK.has(e)) flagProfile("unsupported string escape");
          // A supported-prefix but MALFORMED \x / \u escape is out-of-profile:
          // \xHH requires exactly 2 hex; \uHHHH requires exactly 4 hex; \u{…}
          // requires a nonempty hex codepoint <= U+10FFFF with a closing "}".
          else if (e === "x") {
            if (!/^[0-9a-fA-F]{2}$/.test(source.slice(i + 2, i + 4))) flagProfile("malformed \\x escape");
          } else if (e === "u") {
            if (source[i + 2] === "{") {
              const close = source.indexOf("}", i + 3);
              const hx = close === -1 ? "" : source.slice(i + 3, close);
              if (close === -1 || !/^[0-9a-fA-F]+$/.test(hx) || parseInt(hx, 16) > 0x10ffff) flagProfile("malformed or out-of-range \\u{...} escape");
            } else if (!/^[0-9a-fA-F]{4}$/.test(source.slice(i + 2, i + 6))) {
              flagProfile("malformed \\u escape");
            }
          }
          const d = decodeEscape(source, i); value += d.value; i = d.next; continue;
        }
        if (source[i] === "\n") break; // unterminated line string; stop
        value += source[i];
        i++;
      }
      const closed = i < n && source[i] === c;
      if (closed) { keep[i] = 1; i++; }
      else flagProfile("unterminated string literal"); // b6
      strings.set(open, { end: closed ? i : n, value, plain: true });
      // A string literal is a VALUE token: a following `/` is DIVISION. Clear
      // prevSigWord so a stale keyword (`return "x" / import(...)`) cannot make the
      // `/` a false regex and mask a real dynamic import.
      prevSig2 = prevSig; prevSig = c; prevSigWord = "";
      continue;
    }
    if (c === "`") {
      keep[i] = 1;
      templates.add(i);
      i++;
      stack.push({ mode: "template" });
      // A template literal is a VALUE token (division follows). Same reset.
      prevSig2 = prevSig; prevSig = "`"; prevSigWord = "";
      continue;
    }
    if (c === "(") {
      parenStack.push(CONTROL_HEADS.has(prevSigWord) ? "control" : "expr");
      keep[i] = 1; i++; prevSig = "("; prevSigWord = ""; continue;
    }
    if (c === ")") {
      lastParenKind = parenStack.length ? parenStack.pop() : "expr";
      keep[i] = 1; i++; prevSig = ")"; prevSigWord = ""; continue;
    }
    const inControlParen = parenStack.length > 0 && parenStack[parenStack.length - 1] === "control";
    if (c === "/" && regexAllowedAfter(prevSig, prevSigWord, lastParenKind, prevSig2, inControlParen, lastBraceKind)) {
      // Regex literal: blank the whole literal (interior + delimiters + flags) so
      // a `from "x"` / `import(` inside a regex can never manufacture a load site.
      i++; // consume opening "/"
      let inClass = false;
      let closedRegex = false;
      while (i < n) {
        const ch = source[i];
        if (ch === "\\") { i += 2; continue; }
        // b6: an unterminated regex literal (a line terminator or EOF before the
        // closing "/", or an unterminated character class) is out-of-profile. It
        // must fail closed, NOT bail and then let the following `import(`/`from`
        // text be recognized as a real load.
        if (ch === "\n") { flagProfile("unterminated regex literal"); break; }
        if (ch === "[") { inClass = true; i++; continue; }
        if (ch === "]") { inClass = false; i++; continue; }
        if (ch === "/" && !inClass) { i++; closedRegex = true; break; } // closing "/"
        i++;
      }
      if (!closedRegex && i >= n) flagProfile("unterminated regex literal"); // EOF / unterminated char class
      while (i < n && /[A-Za-z]/.test(source[i])) i++; // consume regex flags (blanked)
      // A regex literal is a VALUE token: a following "/" is division. Clear
      // prevSigWord so a stale keyword cannot make the next "/" a false regex.
      prevSig2 = prevSig; prevSig = "/"; prevSigWord = "";
      continue;
    }
    // Identifier run: consume the whole token so `prevSigWord` holds the last
    // identifier (comment/space-robust), used for control-head and keyword-regex
    // detection. A number (starts with a digit) falls to the catch-all instead.
    if (/[A-Za-z_$]/.test(c)) {
      let q = i; while (q < n && IDENT_CHAR.test(source[q])) q++;
      for (let k = i; k < q; k++) keep[k] = 1;
      prevSig2 = prevSig; prevSig = source[q - 1]; prevSigWord = source.slice(i, q);
      if (prevSigWord === "class" || prevSigWord === "function") blockHeadPending = true;
      i = q; continue;
    }
    keep[i] = 1; // ordinary code byte (punctuator, digit, …)
    if (!/\s/.test(c)) { prevSig2 = prevSig; prevSig = c; prevSigWord = ""; }
    i++;
  }
  // b6: an unterminated template literal (a template frame still open at EOF).
  if (!profileError && stack.length > 1 && stack.some((f) => f.mode === "template")) {
    flagProfile("unterminated template literal");
  }
  let masked = "";
  for (let k = 0; k < n; k++) masked += keep[k] ? source[k] : " ";
  return { masked, strings, templates, profileError };
}

// ---- module-load form classifier (D33) --------------------------------------
// Recognizes exactly the accepted forms and reports, per load site, its form,
// its literal specifier (or null when non-literal), and whether it is literal.
//   static import  :  import ... from "x"      form "import"
//   side-effect    :  import "x"               form "import-side-effect"
//   export-from    :  export { ... } from "x"  form "export-from"
//   export-star    :  export * from "x"        form "export-star"
//   dynamic import :  import("x")              form "dynamic-import"
//   require        :  require("x")             form "require"
//   module.require :  module.require("x")      form "module-require"
// A dynamic import / require / module.require whose argument is not a plain
// string literal is reported with literal:false and specifier:null (no edge).

// Parse ONE statement-position import/export declaration starting at `kwStart`
// (the keyword's index) to its true end, brace-matching the specifier list so a
// keyword used as a specifier/alias NAME inside `{ ... }` (`export { h as import }
// from "x"`) or as an object property (`{ import: 1 }`) never truncates or
// fabricates a declaration. Returns null when the keyword is not a real
// load-bearing declaration (property/member name, a local export declaration with
// no `from`, or a dynamic `import(`/`import.meta`). Otherwise returns
// { kwWord, kwStart, form, specifier, clauseStart, fromKwStart, fromEnd }.
function parseModuleDecl(masked, strings, kwStart, kwWord) {
  const n = masked.length;
  let p = kwStart + kwWord.length;
  while (p < n && /\s/.test(masked[p])) p++;
  if (kwWord === "import") {
    if (masked[p] === "(" || masked[p] === ".") return null;   // dynamic import() / import.meta
    if (masked[p] === '"' || masked[p] === "'") {
      const s = strings.get(p);                                 // side-effect: import "x"
      return s ? { kwWord, kwStart, form: "import-side-effect", specifier: s.value, clauseStart: p, fromKwStart: -1, fromEnd: s.end } : null;
    }
    // A bare `import` at statement position terminated with `;` or EOF (not a
    // dynamic `import(`, `import.meta`, side-effect `import "x"`, or a real clause)
    // is a TRUNCATED accepted module-load form — b6, fail closed.
    if (p >= n || masked[p] === ";") throw new ProfileError("truncated static import (bare import)");
    // A real static import clause starts with `{`, `*`, or a default-binding
    // identifier; anything else means `import` is a property NAME.
    if (!(masked[p] === "{" || masked[p] === "*" || /[A-Za-z_$]/.test(masked[p]))) return null;
  } else if (!(masked[p] === "{" || masked[p] === "*" || /[A-Za-z_$]/.test(masked[p]))) {
    return null;                                                // `export` as a property name
  }
  const clauseStart = p;
  let isStar = false, first = true, sawFrom = false;
  while (p < n) {
    const c = masked[p];
    // b5: a string literal reached DIRECTLY in the clause is a specifier/alias
    // NAME (`export * as "ns" from …`, `export "x"` …), not a from-specifier — a
    // governing `from "…"` is consumed by the `from` branch's early return below,
    // so it never reaches here. Fail closed. (Names inside `{ … }` are covered by
    // the brace-match check.)
    if ((c === '"' || c === "'") && strings.has(p)) throw new ProfileError("string-literal specifier/alias name in import/export clause");
    if (c === "{") {                                            // skip the whole specifier list
      const braceOpen = p;
      let d = 1; p++;
      while (p < n && d > 0) { if (masked[p] === "{") d++; else if (masked[p] === "}") d--; p++; }
      // b5: a string-literal specifier/alias NAME inside the specifier list
      // (`export { x as "public" }`, `import { "a" as b } from "x"`) is
      // out-of-profile — whether or not a from-clause follows. This reuses the
      // real-declaration detection above, so a property key (`{ import: {…} }`)
      // never reaches here.
      for (const openIdx of strings.keys()) {
        if (openIdx > braceOpen && openIdx < p) throw new ProfileError("string-literal specifier/alias name in import/export clause");
      }
      first = false; continue;
    }
    if (c === "*") { isStar = true; first = false; p++; continue; }
    if (c === ";") break;                                       // statement end, no from-clause
    if (/[A-Za-z_$]/.test(c)) {
      let q = p; while (q < n && /[A-Za-z0-9_$]/.test(masked[q])) q++;
      const word = masked.slice(p, q);
      if (word === "from") {
        // `from` is the governing from-clause keyword ONLY when a string specifier
        // follows it. `from` used as a binding/namespace NAME (`import from from
        // "x"`, `import * as from from "x"`) is not followed by a string — keep
        // scanning so the REAL from-keyword (the one before the specifier) governs.
        sawFrom = true;
        let r = q; while (r < n && /\s/.test(masked[r])) r++;
        const s = strings.get(r);
        if (s) {
          const form = kwWord === "import" ? "import" : (isStar ? "export-star" : "export-from");
          return { kwWord, kwStart, form, specifier: s.value, clauseStart, fromKwStart: p, fromEnd: s.end };
        }
        first = false; p = q; continue;
      }
      // An export whose FIRST clause token is a declaration keyword is a local
      // export (`export const/function/class/default/...`) — never a module load.
      if (kwWord === "export" && first && ["const", "let", "var", "function", "class", "default", "async"].includes(word)) return null;
      first = false; p = q; continue;
    }
    p++;
  }
  // Reached the declaration end without a governing `from "…"` specifier.
  // b6 (truncated accepted forms, out-of-profile — fail closed):
  //  - a `from` keyword appeared but no string specifier followed
  //    (`import { x } from`, `export * from` truncated);
  //  - a real static import CLAUSE with no from-clause at all (`import { x }`,
  //    `import d`, `import * as ns`) — every static import requires `from "…"`;
  //  - `export *` / `export * as ns` with no from-clause — export-star requires it.
  // An `export { … }` list with NO from is a VALID LOCAL export (no module-load
  // edge): return null.
  if (sawFrom) throw new ProfileError("truncated import/export from-clause (no specifier)");
  if (kwWord === "import") throw new ProfileError("truncated static import (no from-clause)");
  if (isStar) throw new ProfileError("truncated export * (no from-clause)");
  return null;                                                  // local export list (no from-clause)
}

// Yield every REAL statement-position import/export declaration, in source order,
// each parsed to its true end. A keyword occurrence inside an already-parsed
// declaration's span (an `as`-alias like `export { h as import }`) is skipped, so
// it can never start a spurious declaration.
function* moduleDecls(masked, strings) {
  const kwRe = /(?<![A-Za-z0-9_$.])(import|export)(?![A-Za-z0-9_$])/g;
  let consumedUntil = 0;
  for (let m; (m = kwRe.exec(masked)); ) {
    if (m.index < consumedUntil) continue;
    const decl = parseModuleDecl(masked, strings, m.index, m[1]);
    if (decl) { yield decl; consumedUntil = decl.fromEnd; }
  }
}

// Last significant (non-space) char in `masked` before `idx` — comments/strings
// are blanked to spaces in masked, so this skips across whitespace AND comments,
// making `obj . require(...)` / `obj ./*c*/require(...)` / `this.#require(...)`
// resolve their preceding member/private token.
function prevSigChar(masked, idx) {
  let j = idx - 1;
  // Skip ALL lexical whitespace (space, tab, CR, LF, FF, VT), not just U+0020 —
  // comments and strings are already blanked to U+0020 in `masked`, but real code
  // whitespace (a tab or newline between `.` and the loader name) is preserved as
  // itself, so `obj.\nimport(...)` / `obj.\trequire(...)` must skip it to reach `.`.
  while (j >= 0 && /\s/.test(masked[j])) j--;
  return j >= 0 ? masked[j] : "";
}

export function classifyModuleLoads(source) {
  const { masked, strings, profileError } = lex(source);
  if (profileError) throw new ProfileError(profileError);
  // (b5 — a string-literal specifier/alias name inside an import/export `{ … }`
  // specifier list — is enforced inside parseModuleDecl's brace-match, so it
  // covers both from and no-from declarations and can never misfire on a property
  // key.)
  const sites = [];

  const literalAt = (parenIdx) => {
    // parenIdx points at "("; find next non-whitespace (tabs/newlines included, not
    // just U+0020); if a plain string opens there and the call closes ")" OR is
    // followed by "," (an import options object and/or a trailing comma —
    // `import("./x.mjs", { with:{...} })`, `import("./x.mjs",)`), the FIRST arg is a
    // literal specifier; return its value, else null.
    let j = parenIdx + 1;
    while (j < masked.length && /\s/.test(masked[j])) j++;
    const s = strings.get(j);
    if (!s || !s.plain) return null;
    let k = s.end;
    while (k < masked.length && /\s/.test(masked[k])) k++;
    if (masked[k] === ")") return s.value;
    if (masked[k] !== ",") return null;
    // A trailing comma / options object follows a VALID literal specifier. The
    // remaining args, up to the call's matching ")", must be BRACE/BRACKET
    // balanced. An unbalanced/truncated options structure (`import("./x.mjs", { )`,
    // `import("./x.mjs", { a: [ )`) is a truncated accepted form — b6, FAIL CLOSED
    // with the stable diagnostic, NOT a degrade to literal:false / no edge.
    const close = matchingParenLA(parenIdx);
    if (close === -1) throw new ProfileError("truncated dynamic-import options (unclosed call)");
    let depth = 0;
    for (let t = k; t < close; t++) {
      const ch = masked[t];
      if (ch === "{" || ch === "[") depth++;
      else if (ch === "}" || ch === "]") { depth--; if (depth < 0) throw new ProfileError("unbalanced dynamic-import options"); }
    }
    if (depth !== 0) throw new ProfileError("truncated/unbalanced dynamic-import options");
    return s.value;
  };
  // Matching ")" for a "(" at openIdx (parens in strings/comments are blanked).
  const matchingParenLA = (openIdx) => {
    let depth = 0;
    for (let t = openIdx; t < masked.length; t++) {
      if (masked[t] === "(") depth++;
      else if (masked[t] === ")") { depth--; if (depth === 0) return t; }
    }
    return -1;
  };
  // ---- statement forms: import ... / export ... --------------------------------
  // Each REAL declaration is delimited by parseModuleDecl (brace-matched), so a
  // keyword used as a specifier/alias name inside `{ ... }` or as a property key
  // never truncates a declaration or fabricates a load site.
  for (const d of moduleDecls(masked, strings)) {
    sites.push({ form: d.form, specifier: d.specifier, literal: true });
  }

  // ---- call forms: dynamic import() / require() / module.require() -------------
  // An accepted loader name is a load site ONLY as a real call — never a member
  // access or private member. The `(?<![A-Za-z0-9_$])` lookbehind excludes an
  // adjacent identifier char; `prevSigChar` additionally rejects a preceding "."
  // or "#" reached across whitespace/comments (`obj . import(...)`,
  // `obj ./*c*/require(...)`, `this.#require(...)`), which the lookbehind alone
  // (immediate-char only) would miss.
  const isMember = (idx) => { const p = prevSigChar(masked, idx); return p === "." || p === "#"; };
  // b6: an accepted call form whose `(` never closes (`import("./x.mjs",`,
  // `require("./x.mjs"`) is a truncated accepted form — fail closed. Returns the
  // matching `)` index, or -1 when the paren is unbalanced to EOF (strings and
  // comments are already blanked in `masked`, so their parens never count).
  const matchingParen = (openIdx) => {
    let depth = 0;
    for (let k = openIdx; k < masked.length; k++) {
      if (masked[k] === "(") depth++;
      else if (masked[k] === ")") { depth--; if (depth === 0) return k; }
    }
    return -1;
  };
  const requireClose = (paren, form) => { if (matchingParen(paren) === -1) throw new ProfileError(`truncated ${form} form (unclosed call)`); };
  // The identifier word ending just before `idx` (whitespace/comment robust).
  const wordBefore = (idx) => { let j = idx - 1; while (j >= 0 && /\s/.test(masked[j])) j--; let q = j; while (q >= 0 && IDENT_CHAR.test(masked[q])) q--; return masked.slice(q + 1, j + 1); };
  const nextSigFrom = (idx) => { let j = idx; while (j < masked.length && /\s/.test(masked[j])) j++; return masked[j] || ""; };
  // A loader word is a load site ONLY in CALL-EXPRESSION position — NOT the NAME
  // of a function/method definition: `function require(x){}`, an object shorthand
  // method `{ require(x){} }`, a class method / getter `require(){}` all have the
  // shape `name(params){ body }`, so the matching `)` is followed by `{`; a
  // definition name may also be preceded by the `function` keyword. A real call
  // `require("x")` / `import("x")` is never followed by `{`.
  const isDefinition = (nameIdx, paren) => {
    if (wordBefore(nameIdx) === "function") return true;
    const close = matchingParen(paren);
    return close !== -1 && nextSigFrom(close + 1) === "{";
  };
  const dynRe = /(?<![A-Za-z0-9_$])import\s*\(/g;
  for (let m; (m = dynRe.exec(masked)); ) {
    if (isMember(m.index)) continue; // obj.import(...) / obj . import(...) is not a load
    const paren = m.index + m[0].length - 1;
    if (isDefinition(m.index, paren)) continue; // a method/function named `import` is not a load
    requireClose(paren, "dynamic-import");
    const value = literalAt(paren);
    sites.push({ form: "dynamic-import", specifier: value, literal: value !== null });
  }
  const claimedParens = new Set();
  const modReqRe = /(?<![A-Za-z0-9_$])module\s*\.\s*require\s*\(/g;
  for (let m; (m = modReqRe.exec(masked)); ) {
    if (isMember(m.index)) continue; // a.module.require(...) is a member call, not a load
    const paren = m.index + m[0].length - 1;
    if (isDefinition(m.index, paren)) continue;
    claimedParens.add(paren);
    requireClose(paren, "module-require");
    const value = literalAt(paren);
    sites.push({ form: "module-require", specifier: value, literal: value !== null });
  }
  const reqRe = /(?<![A-Za-z0-9_$])require\s*\(/g;
  for (let m; (m = reqRe.exec(masked)); ) {
    const paren = m.index + m[0].length - 1;
    if (claimedParens.has(paren)) continue; // already a module.require site
    if (isMember(m.index)) continue; // obj.require(...) / obj . require(...) / this.#require(...) is not a load
    if (isDefinition(m.index, paren)) continue; // `function require(x){}` / `{ require(x){} }` is not a load
    requireClose(paren, "require");
    const value = literalAt(paren);
    sites.push({ form: "require", specifier: value, literal: value !== null });
  }

  return sites;
}

// ---- relative-specifier resolver + physical containment (D33/D21) ------------
// A resolver used by both the closure derivation and the outbound scanner. Only
// literal specifiers beginning with "./" or "../" are relative module edges;
// everything else (node:, bare) resolves to { ok:false, kind:"non-relative" }.
// A relative specifier is resolved under the importing file's directory, then
// every existing path component from the repo root down is lstat-checked: a
// symlink component is fatal; the resolved target must be an existing regular
// file beneath the repo root; a target under merkle-dag/ is permitted ONLY if it
// is in allowExternal, otherwise "forbidden"; anything else is "escape".

function toPosix(p) { return p.split(path.sep).join("/"); }

// Shared fail-closed chain-walk discipline (D21/D33). Three helpers implement the
// SAME rule — lstat every existing component of a path, reject any symlink
// component, and only then trust a realpath — for three shapes: an absolute path
// including its repo-root ancestors (`componentsSymlinkFree`), a target beneath
// the repo real root (`containmentReal`), and a candidate write path with its
// deepest-existing-ancestor resolution (`physicalContainment`). They are kept as
// focused variants rather than one over-parameterized walker to avoid drift-by-
// generalization, but they never diverge in policy: a symlink component is always
// fatal, and realpath is only consulted after the lstat pass proves the chain
// symlink-free. TOCTOU posture: lstat and the later realpath are not atomic, so a
// rename between them is theoretically observable; Phase 1 treats that as out of
// scope (the walk still fails closed on any symlink it actually observes, and the
// weave is a single-shot read of a quiescent tree). A missing INTERMEDIATE
// component is reported as `missing` (there is nothing deeper to follow), never
// silently treated as containment.

// A repository-relative POSIX path that is PROVEN canonical (fail-closed): a
// filesystem name containing a backslash or other noncanonical byte cannot pass
// as a walker/closure output. Used wherever a validated repo-relative path is
// emitted.
function canonicalRel(repoRootReal, abs) {
  const rel = toPosix(path.relative(repoRootReal, abs));
  if (!isCanonicalRepoRelPosix(rel)) throw new Error(`noncanonical repository-relative path: ${JSON.stringify(rel)}`);
  return rel;
}

// Walk EVERY existing component of an absolute path from the filesystem root down,
// lstat-ing each; a symlink component is fatal. This covers a path's ANCESTORS
// (not just components below the repo root), so a symlinked ancestor of the repo
// root — or an intermediate component of a multi-segment configured root — is
// rejected rather than silently followed. Returns { ok, missing } (missing=true
// when a component does not yet exist; the caller checks target existence).
function componentsSymlinkFree(absPath) {
  const parsed = path.parse(absPath);
  let cur = parsed.root;
  const rest = absPath.slice(parsed.root.length).split(path.sep).filter(Boolean);
  for (const seg of rest) {
    cur = path.join(cur, seg);
    let st;
    // Only genuine absence (ENOENT) is "missing"; any other lstat error
    // (EACCES, ELOOP, …) must FAIL CLOSED rather than be read as absence.
    try { st = lstatSync(cur); } catch (e) { if (e && e.code === "ENOENT") return { ok: true, missing: true }; throw e; }
    if (st.isSymbolicLink()) return { ok: false };
  }
  return { ok: true, missing: false };
}

// Resolve a repository root to its real path only AFTER proving no component of
// its absolute path (including ancestors) is a symlink — realpathSync alone would
// silently FOLLOW a symlinked ancestor instead of rejecting it. Throws otherwise.
function checkedRepoRootReal(repoRoot) {
  const abs = path.resolve(repoRoot);
  const c = componentsSymlinkFree(abs);
  if (!c.ok) throw new Error(`repository root path has a symlinked component: ${abs}`);
  if (c.missing) throw new Error(`repository root does not exist: ${abs}`);
  return realpathSync(abs);
}

// Walk each existing component from repoRootReal down to `absTarget`; reject any
// symlink component; return the deepest existing ancestor's real path (or null
// if a component is a symlink / a missing component appears mid-chain after an
// existing one — the caller separately checks existence of the final target).
function containmentReal(repoRootReal, absTarget) {
  const rel = path.relative(repoRootReal, absTarget);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) return { ok: false, reason: "escape" };
  const segs = rel.split(path.sep);
  let cur = repoRootReal;
  for (const seg of segs) {
    cur = path.join(cur, seg);
    let st;
    // ENOENT is a missing component; any other lstat error fails closed.
    try { st = lstatSync(cur); } catch (e) { if (e && e.code === "ENOENT") return { ok: true, deepestExisting: null, missing: true }; throw e; }
    if (st.isSymbolicLink()) return { ok: false, reason: "symlink" };
  }
  return { ok: true, missing: false };
}

// The ONE relative-specifier resolver (D33), consumed by BOTH the closure
// derivation and the code weaver. It performs only the SHARED mechanics — an
// EXPLICIT `.mjs` extension (no appending, no other extension), resolution under
// the importing file's directory, physical containment within the repo root, and
// a real regular-file, non-symlink target — and returns the resolved
// repository-relative POSIX path. The MEMBERSHIP policy (which resolved files a
// consumer permits: clotho-only + allowExternal for the closure; the seeded file
// set for the code weaver) belongs to the caller, not to this resolver.
// AM-41 (c): walk the ORIGINAL, uncollapsed candidate components in source order
// from the importing file's directory, lstat-ing each concrete component AS IT IS
// ENTERED — BEFORE any `..` collapse could erase it — and reject a symlink
// component. So `./link/../x.mjs` where `link` is a symlink is rejected even
// though the collapsed path `./x.mjs` is clean. Only genuine absence (ENOENT) is
// "missing"; any other lstat error fails closed.
function originalChainSymlinkFree(fromDirAbs, specifier) {
  let cur = fromDirAbs;
  for (const seg of specifier.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") { cur = path.dirname(cur); continue; }
    cur = path.join(cur, seg);
    let st;
    // A component that does not yet exist is NOT trusted-and-returned: a later
    // `..` can return to an existing chain, so keep walking so a symlink after a
    // missing component (`./missing/../link/../x.mjs`) is still lstat-checked.
    // Only genuine absence (ENOENT) is skipped; any other lstat error fails closed.
    try { st = lstatSync(cur); } catch (e) { if (e && e.code === "ENOENT") continue; throw e; }
    if (st.isSymbolicLink()) return { ok: false };
  }
  return { ok: true };
}

export function resolveRelativeSpecifier(fromFileAbs, specifier, { repoRoot, extensions = [".mjs"] } = {}) {
  if (typeof specifier !== "string" || !(specifier.startsWith("./") || specifier.startsWith("../"))) {
    return { ok: false, kind: "non-relative" };
  }
  // A backslash in a module specifier is non-canonical and platform-unsafe:
  // splitting on "/" then handing an embedded-backslash segment to path.join would
  // let Windows normalize `link\..` and erase the `link` symlink component before
  // it is lstat-checked. Reject it deterministically BEFORE any filesystem
  // resolution (fatal for the closure, no-edge for the code weaver).
  if (specifier.includes("\\")) return { ok: false, kind: "backslash-in-specifier", resolved: specifier };
  // Extension rule (the ONE resolver, configured per consumer):
  //   - code weaver (default `[".mjs"]`): only an explicit `.mjs` target — its
  //     application-dependency extraction grammar is `.mjs`-only.
  //   - D33 CLOSURE (`extensions: "any"`): EVERY accepted literal relative edge
  //     whose target has an EXPLICIT extension participates (`.cjs` is only an
  //     example; `.js`/`.json`/… also traverse) — mechanism provenance covers
  //     whatever the code actually reaches. An extensionless specifier is still
  //     ambiguous (out).
  const hasAcceptedExt = extensions === "any"
    ? path.posix.extname(specifier) !== ""
    : extensions.some((x) => specifier.endsWith(x));
  if (!hasAcceptedExt) return { ok: false, kind: "ambiguous-extension", resolved: specifier };
  const repoRootReal = checkedRepoRootReal(repoRoot);
  // Reject a symlink in the ORIGINAL uncollapsed chain before path.resolve below
  // normalizes any `..` away (AM-41 (c)).
  if (!originalChainSymlinkFree(path.dirname(fromFileAbs), specifier).ok) {
    return { ok: false, kind: "symlink", resolved: specifier };
  }
  const abs = path.resolve(path.dirname(fromFileAbs), specifier);
  const contain = containmentReal(repoRootReal, abs);
  if (!contain.ok) return { ok: false, kind: contain.reason, resolved: toPosix(path.relative(repoRootReal, abs)) };
  let st;
  // ENOENT => the specifier does not resolve to a real file (unresolved); any
  // other lstat error must fail closed rather than masquerade as "unresolved".
  try { st = lstatSync(abs); } catch (e) { if (e && e.code === "ENOENT") return { ok: false, kind: "unresolved", resolved: toPosix(path.relative(repoRootReal, abs)) }; throw e; }
  if (st.isSymbolicLink()) return { ok: false, kind: "symlink", resolved: toPosix(path.relative(repoRootReal, abs)) };
  if (!st.isFile()) return { ok: false, kind: "non-regular", resolved: toPosix(path.relative(repoRootReal, abs)) };
  // A successful resolution must yield a CANONICAL repository-relative POSIX path;
  // canonicalRel throws (fatal) on a noncanonical name (backslash, absolute,
  // "."/".." or empty segment, NUL), so such a name can never enter a closure.
  return { ok: true, repoRelative: canonicalRel(repoRootReal, abs), abs };
}

// ---- accepted relative module-load closure (D33) -----------------------------
// The entry module plus every file reachable through an accepted LITERAL RELATIVE
// module-load edge, recursively. Fatal (throws) on: an ambiguous-extension /
// symlink / non-regular / escaping / forbidden target, a literal relative
// specifier that does not resolve to an existing file, or an entry that is
// itself missing/symlinked/non-regular/outside the admissible set. Non-literal
// dynamic import/require/module.require and non-relative specifiers create NO
// edge. Returns sorted repo-relative paths. `allowExternal` is the set of
// permitted non-clotho targets (permitted merkle-dag primitives).

export function deriveAcceptedClosure(entryFileAbs, { repoRoot, allowExternal = new Set() } = {}) {
  const repoRootReal = checkedRepoRootReal(repoRoot);
  // The entry undergoes the SAME containment / regular-file / symlink checks as a
  // resolved target — an entry is not exempt from the closure discipline.
  const entryContain = containmentReal(repoRootReal, entryFileAbs);
  if (!entryContain.ok) throw new Error(`closure: entry is ${entryContain.reason}`);
  let est;
  try { est = lstatSync(entryFileAbs); } catch (e) { if (e && e.code === "ENOENT") throw new Error("closure: entry does not exist"); throw e; }
  if (est.isSymbolicLink()) throw new Error("closure: entry is a symlink");
  if (!est.isFile()) throw new Error("closure: entry is non-regular");
  // Safe now (verified a real regular file, not a symlink): canonicalize for
  // traversal so all path arithmetic shares the repo real-path base.
  const entryReal = realpathSync(entryFileAbs);
  const entryRel = canonicalRel(repoRootReal, entryReal); // entry path must be canonical too (fatal otherwise)

  // Membership policy (the closure's, not the resolver's): a resolved target is
  // admitted only if it is under clotho/ or an explicitly permitted external
  // primitive; a merkle-dag target outside allowExternal is forbidden; anything
  // else escapes. Admission failure is fatal.
  // A non-clotho target is admissible ONLY as an approved merkle-dag/ primitive
  // that is ALSO in allowExternal. A merkle-dag target NOT in allowExternal is
  // forbidden; ANY other non-clotho target is an escape — regardless of what the
  // caller-supplied allowExternal set contains (a non-merkle-dag entry in
  // allowExternal can never widen the closure beyond the one frozen external
  // namespace).
  const admit = (rel) => {
    if (rel === "clotho" || rel.startsWith("clotho/")) return;
    if (rel.startsWith("merkle-dag/")) {
      if (allowExternal.has(rel)) return;
      throw new Error(`closure: ${rel} is forbidden`);
    }
    throw new Error(`closure: ${rel} is escape`);
  };
  admit(entryRel);

  const seen = new Set([entryRel]);
  const absOf = new Map([[entryRel, entryReal]]);
  const work = [entryRel];
  while (work.length) {
    const rel = work.shift();
    const abs = absOf.get(rel);
    const source = readFileSync(abs, "utf8");
    for (const site of classifyModuleLoads(source)) {
      // Only literal specifiers participate; a non-literal dynamic/require site
      // creates no edge (but is still a recognized site).
      if (!site.literal || site.specifier === null) continue;
      if (!(site.specifier.startsWith("./") || site.specifier.startsWith("../"))) continue;
      const r = resolveRelativeSpecifier(abs, site.specifier, { repoRoot: repoRootReal, extensions: "any" });
      if (!r.ok) {
        throw new Error(`closure: ${rel} -> ${JSON.stringify(site.specifier)} is ${r.kind}${r.resolved ? " (" + r.resolved + ")" : ""}`);
      }
      admit(r.repoRelative);
      if (!seen.has(r.repoRelative)) {
        seen.add(r.repoRelative);
        absOf.set(r.repoRelative, r.abs);
        work.push(r.repoRelative);
      }
    }
  }
  return [...seen].sort();
}

// ---- Phase 1 export scanner --------------------------------------------------
// Recognizes exactly `export function`, `export async function`, `export const`,
// and `export class` followed by an identifier. Unsupported re-exports, computed
// exports, default exports, and dynamic symbol flow warn and emit no symbol.

// True when the declaration region (up to its first top-level `;`) has a `,` at
// bracket depth 0 — a second declarator, e.g. `export const x = 1, y = 2;`.
function hasTopLevelComma(region) {
  let depth = 0;
  for (let k = 0; k < region.length; k++) {
    const ch = region[k];
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    else if (ch === ";" && depth === 0) return false;
    else if (ch === "," && depth === 0) return true;
  }
  return false;
}

export function scanExports(source) {
  const { masked, profileError } = lex(source); if (profileError) throw new ProfileError(profileError);
  // Every occurrence is reported (NOT de-duplicated): a repeated export name is a
  // duplicate descriptor, which seedSourceDescriptors treats as fatal.
  const exportsFound = [];
  const warnings = [];

  // Dispatch EACH `export` keyword: it either yields a Phase 1 symbol (one of the
  // four declaration forms) or emits a warning for its specific unsupported
  // category. Every export keyword is accounted for, so no unsupported form —
  // including computed exports and dynamic (let/var/reassigned) symbol flow — can
  // slip through without a warning. Bounds a keyword's region at the next keyword.
  const kwRe = /(?<![A-Za-z0-9_$.])export(?![A-Za-z0-9_$])/g;
  const kws = [];
  for (let m; (m = kwRe.exec(masked)); ) kws.push(m.index);
  const phase1 = /^export\s+(?:async\s+function|function|const\s+[A-Za-z_$][A-Za-z0-9_$]*\s*=?|class)\s*/;
  const declRe = /^export\s+(?:async\s+function|function|const|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/;
  for (let a = 0; a < kws.length; a++) {
    const start = kws[a];
    const bound = a + 1 < kws.length ? kws[a + 1] : masked.length;
    const region = masked.slice(start, bound);
    // A MEMBER / PRIVATE / METHOD occurrence of `export` is NOT an export
    // declaration — emit NEITHER a symbol NOR a warning: `obj.export` /
    // `obj . export` (preceding significant char `.`), `class C { #export = 1 }`
    // (preceding `#`), and a method named `export` (`{ export() {} }` — followed
    // by `(`).
    const pc = prevSigChar(masked, start);
    if (pc === "." || pc === "#") continue;
    { let e = start + 6; while (e < masked.length && /\s/.test(masked[e])) e++; if (masked[e] === "(") continue; }
    // `export` as a PROPERTY NAME (`{ export: 1 }`, shorthand `{ export }`) is not
    // an export declaration — emit no symbol AND no warning. A real export
    // continues with `{`, `*`, or a declaration keyword, never `:`/`,`/`}`.
    if (/^export\s*[:,}]/.test(region)) continue;
    const decl = declRe.exec(region);
    // A Phase 1 declaration form binds a single identifier — but NOT a
    // destructuring/computed pattern (`export const { a } = ...` / `export const [a]`).
    if (decl && !/^export\s+const\s*[[{]/.test(region) && phase1.test(region)) {
      exportsFound.push(decl[1]);
      // A multi-declarator `export const x = 1, y = 2;` seeds only the FIRST
      // identifier; the remaining declarators would be silently dropped. Warn so
      // the dropped symbol flow is accounted for, not unclassified.
      if (/^export\s+(?:const|let|var)\b/.test(region) && hasTopLevelComma(region)) {
        warnings.push("multi-declarator export declaration seeds only the first identifier");
      }
      continue;
    }
    if (/^export\s+default(?![A-Za-z0-9_$])/.test(region)) { warnings.push("export default is not a Phase 1 export"); continue; }
    if (/^export\s*\*/.test(region)) { warnings.push("export * re-export is not a Phase 1 export"); continue; }
    if (/^export\s*\{/.test(region)) { warnings.push("export { ... } list/re-export is not a Phase 1 export"); continue; }
    if (/^export\s+(?:const|let|var)\s*[[{]/.test(region)) { warnings.push("destructuring/computed export is not a Phase 1 export"); continue; }
    if (/^export\s+(?:let|var)(?![A-Za-z0-9_$])/.test(region)) { warnings.push("mutable (let/var) export is dynamic symbol flow, not a Phase 1 export"); continue; }
    warnings.push("unsupported/computed export form is not a Phase 1 export");
  }

  exportsFound.sort();
  return { exports: exportsFound, warnings };
}

// ---- static-import parser (code weaver) --------------------------------------
// Parses static import declarations only. Returns, per declaration: its POSIX
// specifier, its [start,end) span in the source, and its bindings. Bindings:
//   { form:"named",       imported, local }   import { a as b } / import { a }
//   { form:"default",     local }             import d from "x"
//   { form:"namespace",   local }             import * as ns from "x"
//   { form:"side-effect" }                    import "x"
// Only used to derive knowledge-graph dependency edges (unchanged by D33).

export function scanImports(source) {
  const { masked, strings, profileError } = lex(source); if (profileError) throw new ProfileError(profileError);
  const imports = [];
  // Extend a declaration's end THROUGH a trailing import-attributes clause
  // (`assert { type: "json" }` / `with { ... }`) so identifiers inside the clause
  // fall INSIDE the import-declaration span and are never mistaken for a use of an
  // imported local (which must occur OUTSIDE the declaration).
  const spanEndAfter = (from) => {
    let j = from;
    while (j < masked.length && /\s/.test(masked[j])) j++;
    const m = /^(assert|with)(?![A-Za-z0-9_$])/.exec(masked.slice(j));
    if (!m) return from;
    j += m[0].length;
    while (j < masked.length && /\s/.test(masked[j])) j++;
    if (masked[j] !== "{") return from;
    let depth = 0;
    for (; j < masked.length; j++) {
      if (masked[j] === "{") depth++;
      else if (masked[j] === "}") { depth--; if (depth === 0) return j + 1; }
    }
    return from;
  };
  // Only REAL static import declarations (parseModuleDecl brace-matches, so a
  // property key `{ import: 1 }` or a keyword-named specifier never starts a
  // spurious declaration nor swallows a later real `from` clause).
  for (const d of moduleDecls(masked, strings)) {
    if (d.kwWord !== "import") continue;
    if (d.form === "import-side-effect") {
      imports.push({ specifier: d.specifier, span: [d.kwStart, spanEndAfter(d.fromEnd)], bindings: [{ form: "side-effect" }] });
      continue;
    }
    const clause = masked.slice(d.clauseStart, d.fromKwStart); // clause between the keyword and `from`
    const bindings = parseImportClause(clause);
    imports.push({ specifier: d.specifier, span: [d.kwStart, spanEndAfter(d.fromEnd)], bindings });
  }
  return imports;
}

function parseImportClause(clause) {
  const bindings = [];
  // namespace: * as ns
  const nsRe = /\*\s*as\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
  for (let m; (m = nsRe.exec(clause)); ) bindings.push({ form: "namespace", local: m[1] });
  // named group { ... }
  const braceStart = clause.indexOf("{");
  const braceEnd = clause.indexOf("}");
  let namedRegion = "";
  if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
    namedRegion = clause.slice(braceStart + 1, braceEnd);
    for (const part of namedRegion.split(",")) {
      const t = part.trim();
      if (!t) continue;
      const asMatch = t.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)$/);
      if (asMatch) bindings.push({ form: "named", imported: asMatch[1], local: asMatch[2] });
      else if (IDENT.test(t)) bindings.push({ form: "named", imported: t, local: t });
    }
  }
  // default: a leading identifier before any '{' or '*'
  const head = (braceStart === -1 ? clause : clause.slice(0, braceStart)).replace(/\*\s*as\s+[A-Za-z_$][A-Za-z0-9_$]*/g, "");
  // The clause passed here is delimited by parseModuleDecl to EXCLUDE the governing
  // `from` keyword, so a leading identifier here is a real default binding — even
  // when it is the contextual word `from` (`import from from "./dep.mjs"` binds a
  // default named `from`). Do NOT special-case `from` away.
  const defMatch = head.match(/^\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*,?\s*$/);
  if (defMatch) bindings.push({ form: "default", local: defMatch[1] });
  return bindings;
}

// True if `name` occurs as an identifier token in `masked` OUTSIDE every span in
// `excludeSpans` (metacharacter-safe: guarded by non-identifier boundaries).
export function identifierUsedOutside(source, name, excludeSpans) {
  const { masked, profileError } = lex(source); if (profileError) throw new ProfileError(profileError);
  const re = new RegExp(`(?<![A-Za-z0-9_$])${escapeRegExp(name)}(?![A-Za-z0-9_$])`, "g");
  for (let m; (m = re.exec(masked)); ) {
    const idx = m.index;
    if (!excludeSpans.some(([a, b]) => idx >= a && idx < b)) return true;
  }
  return false;
}

// ---- real-file walker --------------------------------------------------------
// Walks only real regular files beneath each configured root. Rejects root
// escape and symlinked input (does not follow). Returns validated
// repository-relative POSIX paths, sorted, deduplicated.

export function walkFiles(repoRoot, roots) {
  const repoRootReal = checkedRepoRootReal(repoRoot);
  const out = new Set();
  for (const root of roots) {
    const absRoot = path.resolve(repoRootReal, root);
    const rel = path.relative(repoRootReal, absRoot);
    if (rel !== "" && (rel.startsWith("..") || path.isAbsolute(rel))) {
      throw new Error(`walkFiles: root escapes repository: ${JSON.stringify(root)}`);
    }
    // Check EVERY component of the (possibly multi-segment) configured root's
    // absolute path — a symlinked INTERMEDIATE or LEAF component (e.g. a symlinked
    // `connectors/` in `connectors/ai-peer-mcp`, or a symlinked root itself) is
    // rejected, not followed. componentsSymlinkFree also covers the "." root
    // (== repo root) without the escape false-positive of a below-root walker.
    const chain = componentsSymlinkFree(absRoot);
    if (!chain.ok) throw new Error(`walkFiles: symlinked component in root: ${JSON.stringify(root)}`);
    if (chain.missing) continue;          // absent root: nothing to walk
    const rootStat = lstatSync(absRoot);  // symlink leaf already rejected above
    if (rootStat.isFile()) { out.add(canonicalRel(repoRootReal, absRoot)); continue; }
    walkDir(absRoot, repoRootReal, out);
  }
  return [...out].sort();
}

function walkDir(dir, repoRootReal, out) {
  const entries = readdirSync(dir).sort();
  for (const name of entries) {
    const full = path.join(dir, name);
    let st;
    // A vanished entry (ENOENT race) is skipped; any other lstat error fails
    // closed (throws) so an inaccessible entry never silently omits a real input.
    try { st = lstatSync(full); } catch (e) { if (e && e.code === "ENOENT") continue; throw e; }
    // Symlinked input is REJECTED (fail-closed), not silently skipped: a symlink
    // beneath a configured root could otherwise omit a real input from the walk.
    if (st.isSymbolicLink()) throw new Error(`walkFiles: symlinked entry is not permitted: ${toPosix(path.relative(repoRootReal, full))}`);
    if (st.isDirectory()) walkDir(full, repoRootReal, out);
    else if (st.isFile()) out.add(canonicalRel(repoRootReal, full));
  }
}

// ---- source-descriptor seeding -----------------------------------------------
// Seeds ctx.symbols and ctx.files from the real files below the closed package
// roots: every walked file gets a repository-file descriptor {path, blob_sha};
// every Phase 1 export of each .mjs file gets a code-symbol descriptor
// {path, symbol, blob_sha}. The blob_sha comes from `git hash-object
// --no-filters -- <path>` (injected runner, like registry.deriveRepositoryRef),
// so a symbol and its file carry the SAME blob_sha by construction (one hash per
// walked file per weave). files sorted by path; symbols sorted by (path, symbol);
// a duplicate symbol descriptor is fatal.

export function seedSourceDescriptors(repoRoot, packageRoots, git) {
  if (typeof git !== "function") throw new TypeError("seedSourceDescriptors: git runner must be a function");
  const walked = walkFiles(repoRoot, packageRoots);
  const files = [];
  const symbols = [];
  const warnings = [];
  const seenSymbol = new Set();
  for (const rel of walked) {
    // ONE hash per walked file: this exact `rel` is both hash-objected and (for
    // .mjs) read for export scanning, and the single `blob_sha` is stamped onto
    // the file descriptor AND every symbol descriptor for the same path — so
    // "symbol and file descriptors for the same path carry the same blob_sha" is
    // true BY CONSTRUCTION (one variable, one file), not by later reconciliation.
    const raw = git(["hash-object", "--no-filters", "--", rel]);
    const blob_sha = typeof raw === "string" ? raw.replace(/\r?\n$/, "") : "";
    if (!HEX40.test(blob_sha)) throw new Error(`seedSourceDescriptors: bad blob_sha for ${rel}: ${JSON.stringify(blob_sha)}`);
    files.push({ path: rel, blob_sha });
    if (rel.endsWith(".mjs")) {
      const source = readFileSync(path.join(repoRoot, ...rel.split("/")), "utf8");
      const scan = scanExports(source);
      for (const w of scan.warnings) warnings.push({ path: rel, message: w });
      for (const symbol of scan.exports) {
        const key = `${rel} ${symbol}`;
        if (seenSymbol.has(key)) throw new Error(`seedSourceDescriptors: duplicate symbol descriptor ${rel}#${symbol}`);
        seenSymbol.add(key);
        symbols.push({ path: rel, symbol, blob_sha });
      }
    }
  }
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  symbols.sort((a, b) => {
    if (a.path !== b.path) return a.path < b.path ? -1 : 1;
    return a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0;
  });
  return { files, symbols, warnings };
}

// ---- counted-iterator constructor (D26/D29) ----------------------------------
// Given an inventory id and its ordered source list, returns an iterable that
// yields each source and increments a PRIVATE count only when the consumer
// COMPLETES consumption of that source — i.e. resumes for the next item, or the
// iterator reaches natural completion — without a fatal error. This is exactly
// the frozen definition: "processing to edge-extraction eligibility WITHOUT fatal
// error"; a source that raises before completion is not counted. The accounting
// accessor is returned separately; the weaver receives only `source`.
//
// Full consumption counts every item exactly once: iterating to NATURAL
// COMPLETION (a `for...of` runs the loop body for each item and then makes the
// final next() call that returns done) records observed_count = N and
// exhausted = true. This is not a bespoke "contract" — it is the direct
// consequence of the frozen "without fatal error" definition plus D29's
// requirement that an `executed` weaver EXHAUST every handed iterable. A consumer
// that abandons iteration early (break/throw before exhaustion) is PARTIAL
// consumption: its unconsumed tail is not counted and exhausted stays false,
// which is precisely what D29 forbids for an executed weaver — the Task 5 driver's
// post-return accounting check is what turns an unexhausted source into a fatal
// accounting failure. Pinned by units in test-util.mjs (full for...of counts N and
// exhausts; a fatal mid-item is not counted).

export function makeCountedSource(inventoryId, list) {
  const items = Array.from(list);
  let observed = 0;
  let exhausted = false;
  function* gen() {
    for (let idx = 0; idx < items.length; idx++) {
      yield items[idx];
      // Reached only when the consumer resumes for the next item: the previous
      // item was consumed to completion without a fatal error.
      observed++;
    }
    exhausted = true; // normal completion
  }
  const source = { [Symbol.iterator]: gen };
  const accounting = () => ({
    inventory_id: inventoryId,
    expected_cardinality: items.length,
    observed_count: observed,
    exhausted
  });
  return { source, accounting };
}

// ---- physical-containment helper (D21) ---------------------------------------
// True iff every existing component of the candidate's ancestor chain (from the
// repo root down) is a non-symlink and the resulting physical path remains
// beneath the repository's real path. Never follows a symlink to decide.

export function physicalContainment(repoRoot, candidate) {
  // Do NOT realpath the allowed root first — that would silently FOLLOW a
  // symlinked root or a symlinked ANCESTOR of it. Prove every component of the
  // allowed-root's absolute path (ancestors included) is symlink-free, then lstat
  // the root in place and require it to be a real directory.
  const absRepo = path.resolve(repoRoot);
  const anc = componentsSymlinkFree(absRepo);
  if (!anc.ok || anc.missing) return false;
  let rootSt;
  try { rootSt = lstatSync(absRepo); } catch { return false; }
  if (rootSt.isSymbolicLink() || !rootSt.isDirectory()) return false;
  // AM-41 (c): inspect the ORIGINAL, uncollapsed candidate components in source
  // order BEFORE any `path.resolve` collapse could erase a `..`-elided component —
  // so `link/../x` where `link` is a symlink is rejected. A component that does
  // not yet exist is skipped (a later `..` may return to an existing chain); any
  // non-ENOENT lstat error fails closed.
  const origSegs = String(candidate).split(/[\\/]/).filter(Boolean);
  let walk = absRepo;
  for (const seg of origSegs) {
    if (seg === ".") continue;
    if (seg === "..") { walk = path.dirname(walk); continue; }
    walk = path.join(walk, seg);
    let ws;
    try { ws = lstatSync(walk); } catch (e) { if (e && e.code === "ENOENT") continue; return false; }
    if (ws.isSymbolicLink()) return false;
  }
  const absCand = path.resolve(absRepo, candidate);
  const rel = path.relative(absRepo, absCand);
  if (rel !== "" && (rel.startsWith("..") || path.isAbsolute(rel))) return false;
  // Walk every existing component of the COLLAPSED path from the root down; reject
  // any symlink; track the deepest existing ancestor for the realpath check.
  const segs = rel === "" ? [] : rel.split(path.sep);
  let cur = absRepo;
  let deepest = absRepo;
  for (const seg of segs) {
    cur = path.join(cur, seg);
    let st;
    // ENOENT => this component (and the rest of the tail) does not exist yet, so
    // the deepest EXISTING ancestor found so far is authoritative. Any other error
    // (EACCES, …) must fail closed — an uninspectable component cannot establish
    // containment from an earlier ancestor.
    try { st = lstatSync(cur); } catch (e) { if (e && e.code === "ENOENT") break; return false; }
    if (st.isSymbolicLink()) return false;
    deepest = cur;
  }
  // Resolve the deepest existing ancestor's real path (safe: no symlink components
  // above it) and require it to remain beneath the repository's real path.
  let repoReal, deepestReal;
  try { repoReal = realpathSync(absRepo); deepestReal = realpathSync(deepest); } catch { return false; }
  const relReal = path.relative(repoReal, deepestReal);
  return relReal === "" || (!relReal.startsWith("..") && !path.isAbsolute(relReal));
}

// ---- weaver-facing git wrapper -----------------------------------------------
// Permits ONLY the exact subcommands and argument shapes the weavers need, with
// no shell. Any other shape is fatal.

export function validateGitArgs(args) {
  if (!Array.isArray(args) || args.length === 0 || !args.every((a) => typeof a === "string")) {
    throw new Error("git: args must be a nonempty string array");
  }
  const [sub] = args;
  const eq = (arr) => args.length === arr.length && arr.every((v, k) => v === args[k]);
  if (sub === "rev-parse") {
    if (eq(["rev-parse", "HEAD"]) || eq(["rev-parse", "--is-shallow-repository"])) return;
    throw new Error(`git: disallowed rev-parse shape ${JSON.stringify(args)}`);
  }
  if (sub === "rev-list") {
    if (eq(["rev-list", "--max-parents=0", "HEAD"])) return;
    throw new Error(`git: disallowed rev-list shape ${JSON.stringify(args)}`);
  }
  if (sub === "hash-object") {
    if (args.length === 4 && args[1] === "--no-filters" && args[2] === "--" && isPathArg(args[3])) return;
    throw new Error(`git: disallowed hash-object shape ${JSON.stringify(args)}`);
  }
  if (sub === "log") {
    // EXACTLY the two frozen shapes, in their required order — missing, extra,
    // duplicated, or reordered flags are all rejected:
    //   log -S<symbol> --format=%H --reverse -- <path>
    if (args.length === 6 && args[1].startsWith("-S") && args[1].length > 2 &&
        args[2] === "--format=%H" && args[3] === "--reverse" && args[4] === "--" && isPathArg(args[5])) return;
    //   log --format=%H --reverse -- <path>
    if (args.length === 5 && args[1] === "--format=%H" && args[2] === "--reverse" &&
        args[3] === "--" && isPathArg(args[4])) return;
    throw new Error(`git: disallowed log shape ${JSON.stringify(args)}`);
  }
  throw new Error(`git: disallowed subcommand ${JSON.stringify(sub)}`);
}

// A git `<path>` argument must be a canonical repository-relative POSIX path
// (no absolute path, no ".."/"." segment, no backslash, no NUL) and must not be
// option-shaped — so a caller can never smuggle an absolute path, a traversal,
// or a flag through the path slot.
function isPathArg(p) {
  return isCanonicalRepoRelPosix(p) && !p.startsWith("-");
}

// Repository-redirecting Git environment variables. Even with cwd=repoRoot and
// the caller options dropped, an INHERITED GIT_DIR/GIT_WORK_TREE/... in
// process.env would make git inspect a DIFFERENT repository. We pass a controlled
// env with these neutralized so cwd alone determines the repository.
const GIT_REDIRECT_ENV = [
  "GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_INDEX_FILE", "GIT_NAMESPACE",
  "GIT_CEILING_DIRECTORIES", "GIT_DISCOVERY_ACROSS_FILESYSTEM", "GIT_PREFIX"
];

// The FIXED spawn settings — a CLOSED set. Caller-supplied options are DROPPED
// entirely (not merged): forwarding an uncontrolled bag would let a caller
// redirect which repository is inspected (`env` with GIT_DIR/GIT_WORK_TREE,
// `argv0`, a `cwd` override) without violating the arg-shape allowlist. The
// `options` parameter is accepted for call-site compatibility but never consulted.
// `env` is a copy of process.env with every repository-redirecting GIT_* var
// removed, so `cwd: repoRoot` alone determines which repository git inspects.
export function gitSpawnOptions(repoRoot, _options = {}) {
  const env = { ...process.env };
  for (const k of GIT_REDIRECT_ENV) delete env[k];
  return {
    cwd: repoRoot, shell: false, encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024, env
  };
}

export function makeGitRunner(repoRoot) {
  return function git(args, options = {}) {
    validateGitArgs(args);
    return execFileSync("git", args, gitSpawnOptions(repoRoot, options));
  };
}

export function isFullSha(s) { return typeof s === "string" && HEX40.test(s); }
