# Repository-wide dependency policy and native flagship migration

Status: user-directed local implementation; formal review/acceptance, commit,
merge and deployment are not claimed by this record.

Decision identifier: `user-direction-2026-09-17-zero-dependency-native-flagship`.
The user selected a system-wide prohibition covering every real TELOS package,
including the flagship's runtime, development, build and test dependencies. The
user then selected preservation of full 3D/ferrofluid visual and interaction
behavior through native WebGL, and explicitly requested implementation of the
proposed plan. This record captures that scoped direction; it does not manufacture
an Eye acceptance, required-seat review, signature or `authz-N` result.

The existing `CURRENT-AUTHORITY.json` still identifies the completed Clotho v15
lineage. Its `authz-008` is not authorization for this migration. The separate
TELOS-remediation checkout's Phase-A evidence and acceptance are not imported or
reinterpreted here. Historical plans, signatures, receipts and existing unrelated
working-tree changes remain intact.

The rule covers all twelve package roots listed by
`tools/check-zero-dependencies.mjs`, including deferred products. No runtime,
development, optional, peer, bundled, build or test packages, package lockfiles,
CDN-loaded application code, or vendored replacements for the removed libraries
are permitted. Node built-ins and repository-owned relative modules implement
server/build/test logic; browser-standard DOM, WebGL and media APIs implement the
front end. Node, Git, the OS, the browser executable and CI host actions are
declared platform prerequisites, not npm dependencies. Existing first-party data
and licensed static font assets are preserved.

The flagship implementation retains its sixteen commands, six story stations,
evidence and graph measurements, 30 loom threads, three tension knots, graph
spheres and curved tubes, ferrofluid shader, projected labels, selection ripple,
camera motion, themes and reduced-motion behavior. The existing export control
remains an export counter; this migration does not claim a file-export feature.

Acceptance contract fixed before implementation: 1440×900, identical browser and
graphics backend, at most 0.5% of pixels with any RGB channel error over 16, mean
RGB channel error at most 1/255, and motion durations within two nominal frames.
Seven fresh legacy stills, three motion frame sequences, source/build identities,
browser/GPU/DPR/time metadata, native comparisons and GPU-uniform motion probes
are retained in the originating workspace's `implementation/phase2/telos/`.
The frozen legacy stills and provenance are also in
`narcissus/flagship/native/tests/baseline/`. Failed attempts are retained; candidate
images never replaced the legacy baseline. The old source and installed runtime
remain outside canonical TELOS in the implementation evidence directory.

Validation entry points: the dependency oracle and its negative fixtures; the
flagship's Node unit/evidence/build checks; its native browser interaction suite;
source-bound executed-command coverage; exact-backend screenshot comparison; and
GPU-uniform motion probes for camera easing/damping and selection-shell duration.
The lexical dependency scan is a bounded review signal, not a sandbox or proof
against arbitrary trusted-code evasion. A baseline browser/backend mismatch is an
explicit parity blocker, not grounds for approving a new baseline.

This migration does not implement the registered Narcissus role, enroll the
flagship into the Iliad, change other packages' behavior, or grant release
authority. Formal acceptance follows the applicable existing governance path.
