# Cycle10: physical press ownership

The pre-change source is commit62ae5e3. This cycle repairs input state tracking; it does not change simulation rules, scoring, character assets, hit windows, network authority or input-expiry policy. The shared owner preview remains4ed5042 and predates these changes.

## Reproduced failures

The oracle extracts the actual component callbacks with the TypeScript parser and runs them with fake DOM events plus the real input sender. The retained baseline and repaired observations, full callback text and source hashes are in [cycle-10-input-ownership.json](cycle-10-input-ownership.json).

| Sequence | Before | Repaired callback |
|---|---|---|
| Press Jump; phase rebinds the button to Strike; release the original pointer | Jump remains true | Original Jump owner releases |
| Hold left and right; release left only | Movement becomes neutral although right remains held | Both held is neutral; releasing left restores right |
| Hold Guard with two pointers; release one | Guard becomes false | Remaining Guard owner stays held |
| Hold touch Guard; press and release keyboard J | Keyboard update clears touch Guard | Guard remains held |
| Lose pointer capture after Jump button becomes Strike | Jump remains true | Original Jump owner releases |

The old handlers already had a lost-capture callback. Its defect was releasing the currently bound action instead of the action owned by that pointer. The repair tracks up to16 simultaneous pointers and a bounded recognized-key set, combines their held actions, and releases by pointer id. Global release/cancel/lost-capture listeners cover a control removed during a phase change. Blur/visibility changes clear owners. Keyboard case is normalized and editable/select/IME input is excluded from gameplay keydown handling.

Beginning or leaving a championship clears input owners. Guest acceptance of a new match epoch also clears the published input and resets its sender/receivers. The actual network callback audit now deliberately holds pointer Guard and keyboard Strike at the result boundary and asserts neutral owners, published state and transmitted held input for both roles after rematch.

## Verification boundaries and execution

Five ownership fixtures and the actual old/new callback oracle passed. The complete suite passed110 tests, but that integrated run then stopped at a lint error; it is not a passing build. The network audit completed five schedules before its120-second process limit during heavy host contention. A600-second rerun uses identical schedule and gameplay assertions, with no change to latency or frame-time acceptance targets. The extended audit passed all six schedules, with both roles clearing old input and identical authoritative results. A final source-bound run follows the export timestamp repair. The lint finding pointed to Date.now in the download callback; capturing one Date for the report timestamp and filename removes the inconsistency and passes the lint probe without disabling any rule. Final integrated build and normal-browser evidence will be recorded below.

These synthetic callbacks do not dispatch physical Safari events. Simultaneous fingers, touch cancellation/backgrounding, phase-boundary release, physical safe areas and sustained iPhone performance still require the physical session in [DEVICE-TEST.md](../DEVICE-TEST.md).

The final source fingerprint is `bdbf3736f1bd4aa452750665aa500885c864546b4402df74fb06ef3595fbd94a`, with exact file hashes in [cycle-10-build-manifest.json](cycle-10-build-manifest.json). The prior Cycle9 network audit is preserved at `scripts/network/timing-audit-cycle-9-result.json`; the current audit artifact will bind this cycle.

## Final integrated verification

Final tests/lint/production build passed:110 tests, root G4 output SHA256 `6f9906031e5efcfc66ca35c37a834f3df770cd3f5e216def9494c239beb3ade3`. The final actual-callback audit passed all six schedules in277.545 seconds of host wall time, including both input resets and complete loss of rematch countdown. Every canonical result is unchanged from the archived Cycle9 audit. This long process duration reflects the local audit under contention; it is not a simulated network delay. Source fingerprint files were independently rehashed after the build and play session with no drift.

## Normal-input browser replay

One fresh Chromium152 tab on the M3 Mac,1280×720/DPR1 and render ratio1, served the production build at localhost3013. No Blender rendering ran during play. The offline audit finished before the first measured match. Last sampled host load before browser work was35.35/30.03/35.23 and varied during the session. Both attempts used canvas recording; this is not a controlled performance comparison or physical-device measurement. Video excludes DOM controls/HUD, which were inspected through the live UI. All input used normal keys/buttons; no application state was injected.

The first Wolf/Lion match completed race67.00562/59.68286 seconds, then fight0/100HP in10.35 seconds, total13.6/86.4. Jump/Burst buttons,20Space taps,5K taps and one Left key were issued. The duel ended during the inspection gap before the next Element click could find its node. That failed attempt is retained and receives no active-combat credit.

The rematch completed race65.34765/59.68286 seconds and fight0/88HP in11.4 seconds, total19.1/80.9. Inputs included34Space and10K taps during the scripted race blocks. The next visible-button loop successfully clicked Element, Strike and Guard; it issued one further Space after combat controls disappeared and stopped at the visible result. Twelve rival HP were lost. This proves a narrow active-input regression, not sustained held-defense, human reaction quality, skill, or enjoyment. The result showed both event pools and the Lion cup; Back to the trail returned to the selected Water Wolf. No browser console warning/error was reported.

| Attempt | Race interval p50/p95/p99/max ms | Fight interval p50/p95/p99/max ms | Race/fight intervals >50ms |
|---|---|---|---|
| First |10.5/40/70.5/270.1|10.25/39/80/240.3|90/15|
| Active rematch |11/40/61/149.1|11/51/110/230.1|78/34|

Desktop recording-on smoothness still fails. No causal performance comparison with earlier cycles follows from different inputs, load, viewport and recording conditions.

`cycle-10-runtime-observations.json` binds original reports, result canvases, source fingerprint, input sequence and all media hashes. `cycle-10-first-attempt.mp4` is141.184 seconds; `cycle-10-active-rematch.mp4` is110.467 seconds. Both H264/AAC deliverables fully decode with ffmpeg -xerror, exit0. Their30fps encoding is a delivery format, not a gameplay FPS claim. Both complete interval sheets and the64-sample quarter-second transition/duel sheet were reviewed; recordings retain the intervening motion. Raw WebM files remain local/ignored with their hashes retained.

Next control action: perform the documented simultaneous-finger, phase-rebound release, focus/cancel and rematch checks on the phone using a newly identified build. The old shared4ed5042 preview cannot certify this repair. Required all-matchup/role/mode coverage, cinematic visuals, physical internet play, sustained iPhone performance and owner acceptance remain open.
