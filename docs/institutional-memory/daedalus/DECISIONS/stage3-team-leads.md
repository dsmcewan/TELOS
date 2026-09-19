---
type: decision
topic/architecture: telos
status: NORMATIVE-CURRENT
note: Item 4 ruling on how tightly Stage 3 maps to parallel dual seats vs team-leads under the DAG. Machine anchor — docs/runs/item-4-stage3-team-leads-ruling-packet.md.
---

# Decision: Stage 3 defaults to team-lead dispatch, with dual pressure reserved for obligation-discharge nodes

**What.** Stage 3 defaults every DAG node to the existing team-lead dispatch path
(`teamForNode` + `runBuild`, already built, tested, and evidenced three times). Literal
Seat-1/Seat-2 dual pressure (`runParallelDaedalus`) is required only on nodes named as
`discharge_node_id` in the Stage-1 obligation matrix — a content-addressed, already-hashed
membership test, never a node-count or plan-size guess. This is adopted as a conditional
target, not a settled, ready-to-ship design: two pieces of engineering are carried forward
as required, currently-uncosted scope of the commitment, not as already-available
machinery — (1) a genuine adapter converting `runParallelDaedalus`'s plan-text/
`descends_from`-provenance output into the `{files:[{path,content}]}` shape `dispatch`
must return for `defaultVerifyNode` to re-hash under Rule 3; and (2) a routing fix to
`mintVerificationNodes` so `discharge_node_id` can name the actual code-authoring node an
obligation is about, instead of only the synthetic, empty (`writes:[]`) check node it
mints today. Neither correction changes which option's shape is structurally preferable;
both must be resolved before Option C can be adopted as-built rather than as-targeted.

**Why.** The boundary is not a node-count or plan-size guess — no evidence on disk
supports any particular number, and picking one would key an enforcement decision on
exactly the kind of mutable label the project's content-address rule forbids.
Obligation-discharge membership, by contrast, is a fact the plan already commits to at
`plan_hash` (`compileAndHashPlan`, `planner.mjs:92`) before Stage 3 ever runs, so a
controller predicate "is `node.id` a discharge node?" is a content-addressed membership
test. This concentrates the expensive dual-pressure path exactly where Stage 0/1's
obligation matrix has already flagged invariant-bearing work, while leaving ordinary,
non-obligation-bearing nodes on the cheap, already-built, already-evidenced team-lead
path — avoiding both Option A's un-costed per-node cost multiplier and Option B's silent
exposure of single-seat-authored, invariant-bearing nodes to Stage-4-grain-only catch. It
also reuses two escalation paths Stage 3 already specifies (floor failure after
agreement; deny from Stage 4 returning as friction) rather than inventing a third state
machine. The ruling flips toward Option A if The Eye later holds that dual-seat friction
must apply literally and uniformly at code grain regardless of cost, and flips toward
Option B if The Eye holds that Stage 4's (not-yet-implemented) code challenge is
sufficient friction on its own or that the adapter-plus-routing-fix scope isn't worth
committing to for a boundary not yet shown calibrated to real risk.

**Authority chain:** docs/runs/item-4-stage3-team-leads-ruling-packet.md (adversarially
reviewed, revised, and passed bounded review 2026-07-22) -> Eye ruling: adopt, 2026-07-22.
