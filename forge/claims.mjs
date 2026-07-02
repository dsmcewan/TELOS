// claims.mjs — epistemic claim typing: claims graded by what can settle them.
//
// The deepest lesson of the live runs: convergence speed tracks claim
// verifiability, and every stall was a GRADE MISMATCH — adversaries demanding
// executable proof of a hypothesis, or live evidence from a document. Typing
// makes the fix structural: each claim carries the strongest truth-grade its
// artifact can actually access, and challengers are bound to judge it at that
// grade — no stronger (unwinnable), no weaker (rubber stamp).
//
//   executable   settled by RUNNING something (a test, a script) — dispute only
//                with a failing execution
//   inspectable  settled by LOOKING at the artifact (deterministic checks,
//                literal content) — dispute only with a concrete text defect
//   cited        settled by a SOURCE present in evidence — a missing/wrong
//                citation is a valid blocker; demanding sources beyond the
//                evidence is not
//   hypothesis   not settleable yet (pre-market, forward-looking) — judge
//                LABELING, assumptions, internal coherence, and the validation
//                plan; never the truth of the claim itself

export const GRADES = ["executable", "inspectable", "cited", "hypothesis"];

const GRADE_RULES = {
  executable:
    "EXECUTABLE claims are settled by running their test. Valid blocker: a failing execution or a test that " +
    "does not cover the claim. Invalid: stylistic doubts about code a passing test already vouches for.",
  inspectable:
    "INSPECTABLE claims are settled by the artifact's literal content and its deterministic checks. Valid " +
    "blocker: a concrete text defect (contradiction, missing required content, broken example) cited by " +
    "location. Invalid: preferences about how the content could be nicer.",
  cited:
    "CITED claims are settled by sources present in the evidence. Valid blocker: a claim whose citation is " +
    "missing, wrong, or contradicted by the cited source. Invalid: demanding sources beyond the evidence " +
    "provided to this bout.",
  hypothesis:
    "HYPOTHESIS claims cannot be settled yet — judge only (a) explicit labeling as hypothesis, (b) stated " +
    "assumptions, (c) internal coherence, (d) a falsifiable validation plan. Valid blocker: an unlabeled " +
    "forward-looking claim presented as fact, a hidden assumption, or an untestable formulation. Invalid: " +
    "disputing the hypothesis's truth or demanding market/operational proof that does not exist yet."
};

/**
 * Render the claim ledger + per-grade adjudication rules for a bout's contract.
 * `claims` = [{statement, grade}]. Returns "" when there are none (bouts
 * without declared claims keep their existing behavior byte-for-byte).
 */
export function renderClaimRules(claims) {
  if (!Array.isArray(claims) || claims.length === 0) return "";
  const byGrade = new Map();
  for (const c of claims) {
    if (!c || typeof c.statement !== "string" || !GRADES.includes(c.grade)) continue;
    if (!byGrade.has(c.grade)) byGrade.set(c.grade, []);
    byGrade.get(c.grade).push(c.statement);
  }
  if (byGrade.size === 0) return "";
  const sections = [];
  for (const grade of GRADES) {
    const list = byGrade.get(grade);
    if (!list) continue;
    sections.push(
      `[${grade.toUpperCase()}] ${GRADE_RULES[grade]}\nClaims at this grade:\n` +
      list.map((s) => `  - ${s.slice(0, 300)}`).join("\n")
    );
  }
  return "\n=== CLAIM LEDGER (each claim is judged AT ITS GRADE — demanding a stronger grade than the " +
    "artifact can access is an invalid blocker; accepting a weaker one is a rubber stamp) ===\n" +
    sections.join("\n\n") + "\n";
}
