# Cycle8 — rematch recovery and input/presentation freshness

Status: internal alpha; required physical internet, phone and owner experience gates remain open. Shared owner preview is still4ed5042. No deployment or push in this cycle yet.

## Revision and environment

Local build after2316db7, fingerprint `6a37c77d0598af8c13a7a7c1dd13fa35e8b8aae26768b1b7f2f868971eb09d18`; full paths/hashes in `cycle-8-network-build-manifest.json`. Node22 on M3 Mac. Game rules/characters/scenery remain those of Cycle7. Current test suite, lint and production build pass (root G4 output SHA256 `1c123118383e22ec31ec0c0ab54b91429f666682bb0232dd19f9afa371b4bf04`).

## Observed failures and repairs

The frozen actual-code audit reproduced a guest stuck on old results after all rematch-countdown packets were lost. It also measured same-attack clock rewinds and forward racers briefly moving backward under jitter. A one-second input-loss burst replayed a released20ms tap at1033.33ms authority/1041.67ms guest display. Those findings are preserved in `scripts/network/timing-audit-result.json` and its original baseline harness, independently rerun by the parent.

The component now admits the next valid host epoch while the local player is waiting for rematch, even after countdown. Presentation uses a monotonic phase cursor and per-action-instance clock; phase cuts, new attacks and epoch clears still reset correctly. A targeted negative control evaluates original2316db7 and current code with the same snapshots:33.33→7.33ms becomes33.33→33.33ms.

Input history retains at most two presses per button and each original authority-tick reference. The host discards intent older than30 simulation ticks, consumes expired ids, and expires queued/held controls. This is a conservative500ms simulation-clock policy including downstream snapshot delay, not a synchronized wall-clock or guaranteed delivery policy. Namespace v2 prevents old packet-schema clients from joining these rooms. Both players must use the same build.

## Current offline evidence

`node scripts/network/timing-audit.mjs` imports actual modules and actual AST-extracted component callbacks; only clock, sockets, native-peer primitives, React refs/setters and renderer sink are modeled. It makes no external requests. `timing-audit-cycle-8-result.json` binds harness and five actual source hashes and preserves extracted callbacks.

All six current schedules complete both full championships with matching results, including complete loss of rematch countdown. Every profile has zero measured race-backtracking frames, zero same-action clock rewinds, and zero guest canonical mutations. Histories/queues/envelopes and disconnect cleanup remain bounded. The one-second loss-burst tap is intentionally absent from authority; following fresh inputs work and both results converge.18 targeted input/presentation regressions pass, including timing boundary, future/malformed packet rejection, repeated input, phase/epoch reset and original rewind reproduction.

Synthetic guest input-to-presentation p50/p95 remains41.67/58.33ms for1ms direct,75/175ms with injected jitter/loss/reordering, and375/475ms for the slow Broadcast profile. The latter still fails responsive combat expectations. These samples exclude browser event dispatch, real networking, rendering, GPU/display and host stalls; they do not establish physical internet quality. See NETWORK.md for full methodology and baseline findings.

## Actual-browser checkpoint

Two actual production-build clients completed the normal-control Lion-host/Unicorn-guest match over native WebRTC through the existing Supabase pairing service. Both downloaded result objects match exactly: race66.3554/67.0639s, final HP76/6 at60s fight timeout; race26.1/23.9 plus duel42.5/7.5 gives total68.6/31.4. Both user interfaces showed Lion winning. Both requested rematch, reset to countdown and advanced into a new race. Guest then returned to selection; host correctly interrupted without a trophy. No simulation/network state was injected.

The guest recording covers the full successful attempt and rematch start, with gaps between input batches/inspection.28 paired race jump taps and9 paired burst taps were issued with650ms pacing between pairs; the last block crossed into combat. Then10 paired strike taps and4 paired element taps, plus a final paired strike, exercised both combatants. Source/report/capture hashes and observation limits are in `cycle-8-runtime-observations.json`. Recorded canvas excludes DOM controls and HUD; actual UI text was inspected independently.

Same-machine Chromium152 at1082×874, render pixel ratio1, two WebGL contexts, recording on guest only, automation and host background load. Guest reported browser DPR0.9; host1. No browser zoom change was made by root. Both result button bounds fit the CSS viewport. These conditions are not controlled phone benchmarks.

| Role | Race frame p50/p95/p99/max ms | Fight frame p50/p95/p99/max ms | Rolling WebRTC RTT p50/p95/max ms |
|---|---|---|---|
| Host |20.5/90/170.25/369.9|20/60/129/289.5|50.6/249.9/397.2|
| Guest recording |29.5/100/199.5/990.1|20/70/130/300|40.4/217.9/360.8|

RTT distributions hold60 successful samples over a120s window with no recorded timeout at export. They include same-machine scheduling and browser stalls; they are not WAN transport latency. A host countdown stall reached1089.2ms. This run fails a smoothness expectation and does not prove an optimization regression or a baseline phone failure. Physical sustained performance remains unverified. Guest console retained a warning about multiple Supabase auth-client instances after reconnect with persistence disabled; no observed canonical divergence, but it remains a minor cleanup item.

Playable owner preview remains4ed5042; current fixes are local pending the agreed review sequence.

First actual-browser attempt: Lion host/Unicorn guest paired through native WebRTC. During the normal race-input loop, host tab15 became unavailable in the browser session; the tab inventory retained only guest16. Cause is unknown. Guest stopped at51%/35.4s and showed “Your rival disconnected. This match has no verified result,” with no cup/result. Interrupted recording, performance report and canvas frame are preserved separately. This is an interrupted attempt, not a completed-match pass. Menus/early race may overlap the bounded Wolf source-render window before its exact owned process was stopped. A fresh host17 is retrying the match with GPU authoring paused.

Final media: `cycle-8-local-multiplayer.mp4`207.205s,30,868,765bytes and `cycle-8-interrupted-attempt.mp4`93.320s,9,008,843bytes. Both useH264/AAC; successful replay1082×874 at30fps delivery. Full decode passes, interval contact sheet and36-frame duel window inspected. This encoding rate is not a runtime performance claim. Raw WebM hashes are retained in the manifest; raw files stay local/ignored to avoid duplicate delivery.
