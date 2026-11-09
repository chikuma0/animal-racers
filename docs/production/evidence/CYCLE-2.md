# Cycle 2 — normal-input local multiplayer

2026-09-16, uncommitted working tree based on 0fe548e. MacBook Air M3/24GB, Codex in-app Chromium, two tabs on localhost:3013. Baseline exports before jaw/mane repair. Capture includes canvas only; UI readings below were independently observed with accessibility snapshots. No simulation or network state was injected.

Two tabs selected Fire Lion (host) and Water Wolf (guest). The invitation joined through the existing Supabase project; native WebRTC datachannel opened. Both clients read the same race times:68.34s Lion,68.08s Wolf. Inputs exercised:host movement, burst, strike and fire special; guest jump, burst, frost special and strike. CPU was not used in this match. Both clients reached the fight timeout and independently displayed:

| Character | Race | Duel | Total | Final HP |
|---|---:|---:|---:|---:|
| Fire Lion |24.6|28.8|53.4|86|
| Water Wolf |25.4|21.2|46.6|71|

Both requested rematch. Both screens reset to countdown and entered another race. Guest then returned to selection; host stopped with “This match has no verified championship result.” No trophy was given for that interrupted rematch.

## Files
- `cycle-2-local-multiplayer.mp4`: compressed original canvas recording; entire first lobby/race/fight/award. Derived from local `animal-racers-play-1789549500819.webm` with only H264 transcode and one-pixel even padding. The raw WebM is retained locally and excluded from Git to avoid duplicate28MB storage.
- `animal-racers-race-1789549355886.png`: runtime race frame.
- `cycle-2-combat.png`, `cycle-2-award.png`: extracted runtime frames.
- Two `animal-racers-results-*.png`: host and guest trophy frames.
- Three `animal-racers-performance-*.json`: actual rolling frame/transport readings. Early race recording p95 exceeded60ms on this Mac with two WebGL contexts, capture encoding and UI automation. This is a failed smoothness sample under that load, not a baseline-phone measurement. RTT varied during load (roughly7–233ms snapshots); no stable internet-latency claim.

## Diagnoses and next changes
- Connected lobby warning persisted even after datachannel became healthy; per-packet relay errors were presented as fatal. Clear lobby text when play starts and let missing-packet deadline govern interruption.
- Ground was flat and untextured, canyon mesh sides had reversed winding and no cap. Replace with closed stratified geometry, textured trail, shaped terrain, brush and landmark water towers; re-record affected course views.
- Lion rear mane exposed a ring; Wolf maximum howl opened a visibly disconnected mouth. Asset repair underway; these original captures preserve before evidence.
- Actual characters remain below the cinematic target. Thin upright bodies and arm attachments need sculpt/deformation improvement. Structural tests do not close art acceptance.

The integration check supports same-machine connected lifecycle only. It does not close separate physical internet devices, all matchups/roles, touch feel, sustained iPhone performance, audio listening or owner acceptance.
