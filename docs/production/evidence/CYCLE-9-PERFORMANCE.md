# Cycle9: first-draw diagnosis, not phone acceptance

The pre-repair instrumented build is `8458545950867da033aaf493d2df15d9a7ef2c6efcede55594771485cc248e8a`, based on5c8eef0. The exact files are in `cycle-9-work-build-manifest.json`. Work timing uses performance.now wall time, fixed histograms, zero samples, and separate visibility keys. It does not measure completed GPU execution or attribute the gap between callbacks to one cause. React work scheduled after callback return is outside the audio/UI interval. Quantiles of stages must not be summed.

## Baseline actual normal-control run

Report `animal-racers-performance-1789566868801.json`, SHA256 `bf894ad4b1e76ef47e279e247f710e940a55c9d030e1df98e10821e3fe7b8ce0`, captured2026-09-16T13:54:28.799Z. Canvas result `animal-racers-results-1789566868885.png`, SHA256 `e7a28d4518345f6fb348745575c1ebb5ffe3408f17b1c1cb9c61255e1150d51c`.

One in-app Chromium152 tab, M3MacBookAir24GB, CSS1082×874, devicePixelRatio0.8999999762 and renderer ratio1, no viewport/zoom override set in this run. Source build and offline audit were finished; Blender rendering paused; no canvas recording. Ordinary unrelated host activity remained: pre-run load averages5.50/4.72/12.37, two background update processes around45–48% CPU. No unrelated process was changed. All gameplay work samples have visible labels. This is a single short desktop sample, not an instrumented GPU trace or thermal soak.

Normal UI: fresh measurement → solo Lion/Wolf intro → championship. Space taps in12+16+16+12 blocks at650ms cadence; K every fourth tap in each block (14 total), with inspection gaps. After the transition,14J taps and4K at650ms cadence. No state injection, held-defense or skilled human-play claim. Lion finished65.47855s, Wolf59.68286s; fight13s with HP0/77; score21.6/78.4 and Wolf cup. Both rematch/return buttons were inside the CSS viewport (right edges877.90/999.03, bottom651.74). CUA screenshot raster had a different scale/clipped right surface; canvas capture and DOM bounds are retained separately, not treated as equivalent.

| Phase | Frame interval p50/p95/p99/max ms | Draw submission p95/max ms | Simulation p95/max ms |
|---|---|---|---|
| Countdown | 10.25/50.5/389.25/870.2 | 32.5/320.9 | 1.75/29.5 |
| Race | 10/11/29.75/99 | 7.75/81.5 | .5/48.6 |
| Transition | 10/11/11/41.1 | 4.5/34.2 | .25/1.6 |
| Fight | 10/11/19.25/61 | 5/56.1 | .5/3.3 |

Countdown callback maximum385.3ms, between-callback maximum579.2ms. They need not occur on the same frame, so adding maxima would be invalid. There were23 race and2 fight intervals over50ms. The first countdown remains a failure despite smooth p95 in active play. Compared with Cycle8, client/recording/load conditions changed; this cannot establish an optimization win.

## Diagnosis and proposed change

Installed Three0.180 source `WebGLRenderer.compile` prepares shader programs; geometry `objects.update` occurs in the rendering traversal, and texture initialization is a separate path. Existing loading compiled materials but never drew representative race/duel/award views. First-use resource/driver work therefore remains plausible; the stage data does not alone prove a single cause.

Next: perform a bounded set of actual scene draws while the loading canvas is hidden, retain preparation costs separately, then compare a fresh single-client full championship under the same recording and render-job conditions. No FPS cap, geometry downgrade or quality compromise is introduced merely from this sample.


## Host contention during verification

The first build gate after preparation changes failed before build: an unchanged arena-boundary fixture took40.508s under severe host contention, exceeding the test runner's20s allowance. The isolated identical fixture then passed in11.81s (run19.40s total); its assertion logic was unchanged. Root's full-suite runner allowance is now60s per test to tolerate this observed environment. This is a runner timeout change, not a relaxed gameplay assertion or frame-time target. The initial failure remains recorded and cannot be used as a passing build.

## Prepared build: actual stress run

Final runtime fingerprint `390b3a2b453ca997ca3effeab84facfe2e6ae2cc6a0a4cb5a29fe93793181900`, manifest `cycle-9-prepared-menu-build-manifest.json`. The intermediate `4f0191f5…` build passed but was not played; the final change restores a real selection frame before revealing the canvas. Full tests/lint/build passed again (gate output SHA256 `dd5d5c5d6ef1b7c27fc0600df9c27ec940ead596c2b8e6ef62d4f58cdd03eba3`).

Fresh Chromium tab, same computer and roster, no recording, no Blender work during play. Pre-run load averages were38.49/40.34/37.51, with browser/system processes active. This differs materially from the baseline. The loading report observed1280×720/DPR1; final gameplay report observed1082×874/DPR0.8999999762 and render ratio1. No viewport/zoom override was requested by the test. The changing browser surface is another comparison limit.

- Loading report: `animal-racers-performance-1789568401233.json`, SHA256 `dfe4a91c6c7adfdd6502d1a9684e2c767e74acafa7373a26a166021a040e8913`.
- Match report: `animal-racers-performance-1789568566398.json`, SHA256 `824b888c0f46319618c5d6118474ce3b6e644eb1062a40fcc1a2885c877dd9ba`.
- Result canvas: `animal-racers-results-1789568567156.png`, SHA256 `ab6adf8830146acd5cc66977011b0483fa377fa65b39e5b33f53eb3e75b7b0c3`.

Preparation completed in586.5ms with nine draws: Lion/Wolf race at0/250/480m, fight, award; Unicorn/Lion race, fight, award; then actual selection view. The recorded per-draw `submissionMs` includes the entire renderer call, not GPU completion. The first race preparation call cost305.1ms; all other preparation calls were70.6ms or less. Shader compilation/asset loading before this section is not included in that586.5ms. Fresh measurement preserved this loading record and reset play histograms.

The full match reached the Wolf award at13.4/86.6, race67.08294/59.68286s, fight11.6s with HP0/100. Inputs were36Space and9K taps in12/16/8 blocks with650ms requested spacing plus tool/inspection delays. The final block crossed the transition; the duel finished before the next inspection, so this run does not certify active fighting or identical input workload to the baseline. No state injection.

| Phase | Frame interval p50/p95/p99/max ms | Draw submission p95/max ms | Simulation p95/max ms |
|---|---|---|---|
| Countdown | 10/20.75/50/480 | 19/82.9 | 1/6.5 |
| Race | 10/30/61/309.6 | 20.5/231 | 1/24.7 |
| Transition | 10/40.25/80.5/350 | 28.25/215 | 1.25/15.5 |
| Fight | 10.25/40/89/270.1 | 26.25/116.7 | 2.25/29.4 |

The formerly expensive first race draw is now explicitly performed during loading, while observed countdown draw-call max decreased320.9→82.9ms. That supports retaining the bounded preparation change, but the two runs differ in host load, viewport history and input cadence. It is not a controlled causal estimate. Countdown still has480ms maximum interval and382ms between-callback maximum; race/fight smoothness fails under this load, with82/22 intervals over50ms. No claim of solved stutter, GPU throughput, physical-phone performance, or release acceptance.

Next concrete performance action: a controlled fixed-viewport comparison when host contention is lower, then the outstanding physical iPhone sustained session using the same timing report. Avoid another speculative geometry/FPS downgrade from this overloaded sample. The shared phone preview remains4ed5042.
