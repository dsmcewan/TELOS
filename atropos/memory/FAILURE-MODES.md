# Atropos — failure modes
Fail-closed (throw): CURRENT-AUTHORITY unreadable/unparseable/not-object; `superseded` not an array;
active_plan.path missing or escaping root.
Verdict `inconsistent` (not a throw): unexpected/missing key; wrong scalar type; `must_not_govern_new_work!==true`;
malformed sha256/authz; duplicate `plan_version`; self/dangling/cyclic `superseded_by`; active_plan.version itself
superseded; active_plan sha mismatch (terminal authority); node-backed entry (UNREPRESENTABLE); unknown entry.
Residual NON-CLAIMs: read-only oracle is a static check not a sandbox; node-backed retirement deferred; trust is
relative to the supplied CURRENT-AUTHORITY.
