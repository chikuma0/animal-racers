# Cycle 3 — repaired assets and single-client baseline

Internal alpha only. Captured 2026-09-16 on MacBook Air M3, 24 GB, Codex in-app Chromium152, 1280×720 at DPR1. One game tab, no canvas recording and no Blender render running. Browser automation and two frame captures add load. This is not an iPhone measurement or a controlled GPU benchmark.

## Observed run

Normal controls started Rainbow Unicorn versus Fire Lion CPU. Steering, jump and burst taps were exercised in the race. Combat was unattended; this does not establish combat feel or defense quality. Unicorn finished68.34s versus Lion59.68s. Lion won after6.6s of combat with100 HP versus0. Both events contributed11.5–88.5 overall. This short unattended knockout needs human control/feel review.

- `animal-racers-race-1789551514652.png`: repaired closed cliffs, ground texture, softer dust and body shapes in actual play.
- `animal-racers-results-1789551575624.png`: repaired raised cup and Lion pose.
- `animal-racers-performance-1789551575532.json`: complete per-phase report, recordingfalse. Its revision field is empty due to an environment fallback defect; these files describe the pre-compilation-repair working tree. Asset hashes are in ASSETS.md/form-cycle-3.

Race:5,230 samples over69,522ms, p50 10ms, p95 30ms, p99 50ms, max400ms,134 intervals over33.34ms. Combat:464 samples over6,649ms, p95 30.25ms, max130.5ms. Countdown max1,470.3ms and transition max1,420.3ms fail the smooth-transition target. The menu/results were generally cheaper. These statistics do not prove sustained60fps.

## Diagnosis and repair

The renderer previously compiled materials lazily as each stage first appeared. Added asynchronous preparation of every stage and all three skinned models before enabling play; replay is required to determine how much of the measured stall came from shader compilation versus uploads/other work. Also made revision fallback handle empty environment values.

The cup now leaves most of the Lion's face visible, compared with Cycle2's face-covering cup. The base/stem still overlap part of the silhouette. Cinematic character quality, shoulder deformation, environment finish and award appeal remain open; this improvement does not pass the art gate.

Next action: replay first scene transitions after the preparation change, publish a revision-labeled internal test preview, and collect physical touch/performance and separate-network evidence before any release-candidate claim.

## Replay after preparation

`animal-racers-performance-1789551844058.json` reports the same Unicorn/Lion matchup, single client, recording off. Revision fallback now reads `local-working-tree`. Countdown max128.9ms and transition max240.9ms are much lower than the previous1.4s stalls; the long first-use hitch was not reproduced. Race p95 was22ms, max110.2ms; combat p95 was22ms, max69.8ms. **This is still a failed smoothness target.** A local verification build ran during the latter portion, so this is not a controlled performance comparison and cannot establish the size of any sustained improvement. Physical testing remains required.

The next controlled measurement should run with no compiler, recording, Blender or second WebGL tab active. The preview will carry an exact commit revision.
