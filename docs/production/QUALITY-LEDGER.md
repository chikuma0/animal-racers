# Quality ledger — western championship

Current acceptance: **in production; not a release candidate**. Base 0fe548e. Supporting PRODUCTION-AND-QA.md and selected reference PNGs have not been located; written commission governs until supplied. Every evidence item must name source revision, environment and measurement. Desktop evidence cannot pass the physical-phone gate.

| Gate | Target | Current evidence/status | Gap / next action |
|---|---|---|---|
| Functional | complete select → rival/CPU → race → fight → scoring → cup → rematch | PARTIAL: new complete solo loop observed; recorded two-client local match/rematch passes (Cycle2) | repeat affected controls/physics after repairs; physical touch and all roster loops |
| Character art | three cinematic western animals, same identity in both stances | FAIL against cinematic target:3 skinned GLBs integrated; anatomy/shape repair continues | inspect actual GLBs against selected target; all characters |
| Animation | full cycles, contacts, transformation, varied species attacks | OPEN:14 clips per animal; actual full-match recording; jaw/mane repair and raised-cup deformation under review | render/play clips, capture motion and fix foot/ground or joint artifacts |
| Race/control feel | understandable touch, line choice, anticipation, jump and recovery | UNVERIFIED new implementation | play phone touch, measure obstacle sight/reaction distances |
| Combat | simple skillful controls, visible adjudicated contact, defense and counterplay | PARTIAL: host adjudication and local bidirectional attacks work; full matchup/contact/feel review open | all matchup recordings, physical controls and internet latency tests |
| Scoring | bounded monotone contribution, recoverable split wins, robust edge cases | AUTOMATED PASS:31 simulation cases incl all9 matchups/seeds and adversarial pools; local result matched both clients | inspect actual tie/DNF celebration and all result presentation |
| Multiplayer | two physical devices over internet, both roles and events, consistent replay/results | UNVERIFIED | inspect shared service, bounded timing probe, integrated clients then owner/device session |
| Phone performance | initial 60fps iPhone13Pro sustained, p50/p95/p99, stalls/load/thermal context | UNVERIFIED: paired iPhone13Pro discovered, no measurements | representative asset/runtime and read-only performance report; physical test |
| Audio/UI | coherent world, visual intro, meaningful sounds, mute/unavailable feedback, non-color cues | OPEN: authored UI, procedural foley/music and effects; phone/audio acceptance pending | authored runtime interface and soundscape; inspect phone readability |
| Delivery | playable link + editable sources/licenses/build docs + Japanese draft PR | UNVERIFIED: Vercel/GitHub access works | build/verify/push isolated branch; preview, no merge/production replacement without readiness |
| Enjoyment/acceptance | owner judges actual play/visuals, no critical or major defects | UNVERIFIED | prepare actual review build and targeted script after internal QA |

## Cycle 0 — inventory
Observed current GitHub main and local checkout match 0fe548e. Original checkout has untracked public/assets/guides; preserved. Isolated worktree created. MacBook Air M3/24GB, Xcode26.6, paired iPhone13Pro; no 3D engine installed. Web 3D + GLB initial experiment chosen for practical internet distribution; decision remains subject to representative measurements. Existing Supabase schema/settings will not be altered. Source shows damage supplied by a client and accepted based on ids/phase only; replace adjudication with host-owned simulation. Existing project has 45 npm audit findings; triage runtime relevance before preview.

Next concrete action: integrate simulation, GLB character and host-authoritative transport into a measured complete browser match, then inspect actual rendered play before any claim of visual acceptance.

## Cycle 1 — representative implementation and diagnosed repairs
Revision: isolated working tree, not yet committed; no release claim. Node22 on Mac M3.

- Functional evidence:31 new simulation tests (all9 ordered matchups across3 seeds),19 transport unit cases,5 cumulative-input cases plus9 legacy tests targeted for integration run. Unit counts must be reread from current run before delivery.
- Actual assets:three GLBs with22-bone skins and14 named clips; reproducible Blender4.5.9 source/export scripts, original painted/normal materials and concept provenance. Geometry gates pass, but art gate remains FAIL against cinematic reference. Current simplified mascot silhouette/fur/facial acting need improvement. Source renders do not substitute for gameplay acceptance.
- Observed motion defect: planted feet moved forwards at1.75m/s while the actor travelled16m/s. Repair: author .5s gallop with1m backwards stance sweep over.125s, reduce course and speed proportionally to500m/8m/s; independent skeleton evaluation measures backwards8.0000004m/s. Root speedScale uses RUN_SPEED. Reopen actual gait recordings and slope/landing checks.
- Observed race defect: all obstacles could be bypassed by holding an outer edge. Repair: alternating lane barriers extend to track edge; held-left/held-right fixtures now require contacts. Renderer now depicts solid barriers instead of an empty arch with invisible collision. Reopen readable course-camera captures.
- Observed multiplayer risks:preview env lacked public Supabase settings; production public config obtained locally without changing resources. Actual bounded relay probe delivered24/24 messages with RTTp50 216.57ms/p95 463.24ms and intermittent pairing. This fails responsive combat expectations. Repair under evaluation:native WebRTC direct datachannel with existing Supabase for signaling; Broadcast fallback labelled. Direct channels opened but bounded response measurement still UNVERIFIED. Two local clients cannot close the physical internet gate.
- Observed integration defects:110ms sampling could lose guest taps; fixed cumulative edge packets with duplicate/loss fixtures. Guest formerly predicted hits/results; removed guest canonical simulation. Rematch could reject fresh tick0 against previous epoch; reset epoch counters and repeat requests/snapshots. Unknown disconnect now shows interruption/no verified result instead of both devices claiming opposing forfeits. Needs two-client replay evidence.
- Animation integration fixes:one-shot animation time follows simulation actionTime; transform/defeat clamp and repeated strikes rewind correctly. Both tied winners receive distinct positions. Trophy has traditional bowl/handles/stem/engraved base and staged contribution reveal; actual grip/cup desirability pending visual review.
- Device inventory:paired iPhone13Pro, iOS26.6.2, developer mode enabled. No physical measurements yet. In-app simulated viewport is not hardware certification.
- Dependency repair:upgraded obsolete Next runtime to16.3.5; production npm audit currently0 advisories. Development tool audit still has outstanding findings; no claim all dependencies clean.

Next action:finish production build/lint, capture actual complete normal-control solo match, test both native direct clients including rematch, inspect gameplay/motion against concepts, fix highest observed gap. Only then provide owner/device test build; keep RC gates open.

## Cycle 2 — actual two-client local match
Both clients played through race, saloon fight, timeout, combined scoring and cup. Host Lion53.4 vs guest Wolf46.6 appeared identically; both landed attacks. Both requested rematch and restarted; guest departure correctly interrupted the second race without a trophy. Durable full canvas recording and environment/performance facts are in [CYCLE-2.md](evidence/CYCLE-2.md). This establishes local integration only, not physical internet acceptance. Captured race p95 exceeded60ms under two WebGL clients plus recording/automation, so smoothness remains OPEN.

Next concrete action: re-record the repaired terrain/cliffs and jaw/mane/torso poses, measure a single client without capture load, then deploy an explicitly provisional test build for physical iPhone and separate-network testing. Maintain all failed art/phone/internet gates until actual evidence passes.

## Cycle 3 — repaired runtime and first-use stalls

One normal-input Unicorn/Lion solo match completed with recording off and a single browser client. Repaired terrain and cup captures plus per-phase distributions are in [CYCLE-3.md](evidence/CYCLE-3.md). The cup exposes more of the Lion's face; art remains below target. Race p95 30ms and first countdown/transition stalls around1.4s remain failures. Added shader preparation during loading and reopened affected transition measurement. Latest automated suite:81 tests across7 files pass; build/lint and three GLB structure checks pass. No physical/internet/owner gate is closed by these results.

Next concrete action: verify the shader-preparation change in the same local matchup, then publish a commit-labeled internal alpha and Japanese draft PR so the owner can run the physical test protocol. The preview is for evidence gathering, not production promotion or release acceptance.
