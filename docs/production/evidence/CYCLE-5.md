# Cycle 5 — upright integration review

This is an internal alpha review, not acceptance. The published phone-test revision remains4ed5042. Local changes are identified by [the source/runtime fingerprint](cycle-5-build-manifest.json).

The local candidate loads three unchanged quadruped racing GLBs and three new dedicated upright GLBs. It adds a generated timber albedo with world-sized boards, confirmed-contact accents, corrected Wolf reach cues, action-instance-safe guest animation timing, and both saloon/outdoor shader preparation during loading.

The first menu inspection loaded all six exports successfully. [The initial Lion frame](animal-racers-select-1789554483282.png) exposed a platform placement error: paws at localY≈.03 were hidden by the .26-high pedestal. The subsequent renderer offset is.27; the corrected [fresh capture](animal-racers-select-1789555376304.png) confirms visible paws. Source inspection confirmed the paw geometry exists, so no model workaround was made.

Host conditions: MacBook Air M3/24GB, Node22.22.2, in-app browser. Blender rendering was suspended for the upcoming local pass. Multiple unrelated desktop applications remained active under substantial CPU load; encrypted swap use was approximately4.45GB. No unrelated application was closed. The first check passed88 tests/lint but exceeded a120s total timeout during build TypeScript. A second run hit Vitest's5s wall-clock limit in the broad scoring-invariant case; no scored assertion failed. A targeted run with more time passed all35 simulation cases. The integrated check subsequently passed88 tests, lint and the production build, run serially with20s per-test and600s total allowances; assertions and game rules are unchanged. Gate output SHA-256:1c2c65da15862f9343e56e4096938da21568f72b9bbdb884736ad81aeaf67142.

These conditions cannot establish a clean sustained-performance baseline or the physical iPhone target. Two recorded normal-control loops and a rematch completed. The first fight was mostly unattended between browser-control calls; it cannot establish active counterplay. Owner phone feedback, physical internet play and cinematic acceptance remain open.


## Actual local rematch

[Full active rematch recording](cycle-5-active-rematch.mp4), [result frame](animal-racers-results-1789555651437.png), [measurements](animal-racers-performance-1789555650442.json). Inputs used ordinary keyboard APIs: race jump/burst pairs and eight strike/ward pairs during combat, with visible UI inspected between actions. No simulation state, phase or health was injected. This is agent-operated input coverage, not a human fun judgment.

Unicorn finished in64.365s, Lion59.683s. The16.4s fight ended at0/3HP. Race points17.7/32.3 plus fight24.2/25.8 gave41.9/58.1. The prior loop gave13.8/86.2 with an effectively idle Unicorn fight; both result sets are retained, not treated as equivalent play policies. Rematch returned normally to countdown/racing.

The dedicated upright mesh replaced the racer at the saloon scene cut and the cup stage used the upright form. The final image shows visible Lion paws, arm volume rather than the old shoulder sheets, a bent-knee Unicorn defeat and a recognizable handled cup with the Lion's face visible. Simplified facial/coat/mane art still falls below the cinematic target. Sampled transition, combat, defeat and cup motion was inspected at0.5s intervals from67–96.5s. This catches gross deformation and staging defects; it does not certify every active contact frame or all matchups.

Recording was ON for both runs. The active rematch race had p50/p95/p99=21/70/110ms, max569.1ms; fight19.5/50/70ms, max101ms; transition max80.9ms. First-loop transition max199.4ms. The old1.4s transition stall did not recur in these samples, but no clean causal or performance pass follows because recording, host contention, window size and prior thermal load differ. Canvas output changed from1280×720 to1082×874 during the first session; the second video is1082×874 throughout. No iPhone or internet acceptance is established.

## Recording integrity and follow-up defects

The recording is105.028s,1082×874, H.264/AAC48kHz stereo. The original browser stream contains1262 frames with variable timestamps. The delivery derivative uses30fps with duplicated source frames for reliable playback; this is not a30fps gameplay measurement. All1262 original decoded frames have the same1082×874 dimensions. The final derivative decodes fully with no FFmpeg error output.

- Source/runtime fingerprint: `d739e7ab4116412290dcd930d899883217fd3b4a20602a0760250bf259e25887`.
- Movie SHA-256: `dadd16650f6448329e2c8b083a97d98095c00676e61a345155d156ef7509f62e`.
- Movie bytes: 11948352.

Observed remaining major presentation defects: at the race-to-saloon boundary (~72s), the camera eases from the remote track position into the arena, showing a blank frame and a tiny distant room. The intended scene cut must place the camera immediately, retaining smoothing only within one world. In the close fight (~76.5–92.5s), muzzles overlap because the current0.85m body separation is smaller than the opposing face extents. Contact pose/spacing requires measured mesh bounds before tuning the collision envelope. Fighters occupy too little of the central saloon view; an aspect-aware framing pass must retain safe space for HUD, airborne characters and touch controls.

The cup lifts with connected arms and the defeat keeps knees bent, but the simplified face, hard mane clumps and plain coat still fail the cinematic target. New topology solves a specific deformation defect; it is not visual acceptance. Next cycle: repair the scene cut and framing, resolve measured contact spacing, then replay the same matchup through normal controls. The published owner test remains4ed5042.
