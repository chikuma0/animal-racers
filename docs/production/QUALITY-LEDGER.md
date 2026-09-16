# Quality ledger — western championship

Current acceptance: **in production; not a release candidate**. Base 0fe548e. Supporting PRODUCTION-AND-QA.md and selected reference PNGs have not been located; written commission governs until supplied. Every evidence item must name source revision, environment and measurement. Desktop evidence cannot pass the physical-phone gate.

| Gate | Target | Current evidence/status | Gap / next action |
|---|---|---|---|
| Functional | complete select → rival/CPU → race → fight → scoring → cup → rematch | PARTIAL: new complete solo loop observed; recorded two-client local match/rematch passes (Cycle2) | repeat affected controls/physics after repairs; physical touch and all roster loops |
| Character art | three cinematic western animals, same identity in both stances | FAIL against cinematic target:3 racing plus3 dedicated upright GLBs integrated; arm/knee volume improved | inspect actual GLBs against selected target; all characters |
| Animation | full cycles, contacts, transformation, varied species attacks | OPEN:14 racing/source clips plus11 dedicated upright clips per animal; Cycle6 active rematch shows repaired scene cut, wider contact spacing and prism pulse | remaining all-roster motion, expressive acting and physical held-defense review |
| Race/control feel | understandable touch, line choice, anticipation, jump and recovery | UNVERIFIED new implementation | play phone touch, measure obstacle sight/reaction distances |
| Combat | simple skillful controls, visible adjudicated contact, defense and counterplay | PARTIAL: host adjudication and local bidirectional attacks work; full matchup/contact/feel review open | all matchup recordings, physical controls and internet latency tests |
| Scoring | bounded monotone contribution, recoverable split wins, robust edge cases | AUTOMATED PASS:40 simulation cases incl all9 matchups/seeds and adversarial pools; local result matched both clients | inspect actual tie/DNF celebration and all result presentation |
| Multiplayer | two physical devices over internet, both roles and events, consistent replay/results | UNVERIFIED | inspect shared service, bounded timing probe, integrated clients then owner/device session |
| Phone performance | initial 60fps iPhone13Pro sustained, p50/p95/p99, stalls/load/thermal context | UNVERIFIED: paired iPhone13Pro discovered, no measurements | representative asset/runtime and read-only performance report; physical test |
| Audio/UI | coherent world, visual intro, meaningful sounds, mute/unavailable feedback, non-color cues | OPEN: authored UI, procedural foley/music and effects; phone/audio acceptance pending | authored runtime interface and soundscape; inspect phone readability |
| Delivery | playable link + editable sources/licenses/build docs + Japanese draft PR | PARTIAL: Japanese draft PR1, editable source and revision4ed5042 preview with scoped owner test access | complete required quality evidence before release; production remains prior version |
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

## Cycle 4 — guard recovery and CPU opening

Diagnosed fractional-regeneration guard exploit: held defense could repeatedly obtain a full block and guard-break protection from0.3 meter. A broken-guard latch now requires25 meter before rearming, with visible recovery feedback and normal held-input behavior. Four new adversarial/CPU cases bring the suite to85 tests. CPU gets an openly disclosed1.5s opening grace and at least1.2s between attacks; blocked attempts retry on the next200ms decision to avoid cadence resonance. Equal stats and PvP timing remain intact. Human touch/counterplay review is still open. See [QA report](QA-REPORT.md) and SIMULATION.md for reproduction evidence.

Draft PR1 and the first protected Vercel preview now exist. Branch-scoped preview variables provide only the existing Supabase public URL/anonymous key for codex/western-championship. Production settings and shared database schema are unchanged. Next action: publish the repaired commit, verify the preview and scoped test link, and request the agreed phone session while the dedicated upright-mesh experiment continues.

## Cycle 5 — coordinated upright meshes

Published phone-test revision4ed5042 is ready and the owner test request is pending. The scoped branch sharing link was verified with a fresh cookie session; access configuration for the production deployment is unchanged.

After three repair cycles left shoulder sheets and defeat collapse, the asset architecture was reassessed. An isolated Unicorn mesh with explicit upright joint loops and a parented rig passes independent runtime geometry checks:41 samples per clip, finite skinned bounds, planted rear hooves and fixed limb lengths. Matched views show bent knees and connected arm volume. This is evidence for the new topology approach, not cinematic visual acceptance. Extending all three species and integrating six runtime GLBs is in progress. All three original racing assets remain unchanged.

Local renderer work adds short contact accents only for authoritative hit/block/guard-break/ward events, removes camera response from special windup, and aligns the Wolf howl rings with the active reach. These changes need the next complete normal-control capture. Build and motion acceptance are reopened until the integrated change is verified. The shared phone-test preview stays on4ed5042 meanwhile.

Source inspection also exposed a guest presentation defect: delayed snapshot clocks could be assigned to a newly received attack or a later repetition of that attack. The presentation buffer now interpolates only snapshots from the same action instance; three new fixtures cover the failure and preserve normal smoothing. Seven presentation tests pass. Canonical health, hit decisions and results are unchanged. An original weathered timber albedo replaces uniform procedural wall/floor grain; world-sized UVs prevent room-wide planks. The source, exact prompt and lossless runtime derivative are in visuals/environment/PROVENANCE.md. Both changes still require the integrated capture.

The first integrated upright menu screenshot exposed apparent flat-ended ankles. Independent source and skinned-bound inspection showed complete paws at localY≈.03; the actor root was incorrectly left at ground0 inside the .26-high award platform. Menu actors now use the same .27 platform offset as winners. Recheck actual feet after the next build rather than changing the mesh to compensate for stage occlusion.

Cycle5 integration passed88 tests, lint and production build. Two normal-control CPU loops completed; the active Unicorn/Lion rematch ended41.9/58.1 with fight HP0/3. Its105.028s recording, exact source/runtime fingerprint and interval measurements are in [CYCLE-5.md](evidence/CYCLE-5.md). Paw placement is corrected in the actual menu capture. Contact accents and timber material are present in actual gameplay. Source clips and runtime still retain simplified mascot styling. Desktop recording under host contention failed a smoothness baseline and establishes no phone performance.

Next concrete action: fix the observed camera fly-through at the race/saloon boundary, improve combat framing, and measure opposing face extents before repairing body/contact spacing. Reopen affected play and build gates after these changes. Shared phone-test revision4ed5042 remains stable while the owner response is pending.

## Cycle6 — contact geometry and ceremony composition

Dedicated upright v2b assets move the head/neck attachment .30m back and reduce normal-strike lean. The first attachment revision was rejected for a detached mane/cheek-level collar; repaired source, full cycles and exact canonical reconstruction pass. Runtime pose matrices cover all9 pairings at minimum and maximum strike distance. A small early Unicorn contact gap tightened normal range to1.85m. Bodies now remain1.75m apart; CPU pursuit/trigger follow the geometry. A separately reproduced slot-order facing/landing bug is repaired.40 simulation tests and the current1,728-policy-match audit pass, without claiming optimal balance or fun.

[Cycle6](evidence/CYCLE-6.md) retains the96.090s normal-input active rematch at844×390: race65.5510/59.6829s, fight0/15HP after13.8s, totals37.0/63.0. Quarter-second samples cover the complete transition/duel and45 native frames resolve the short prism pulse. The scene cut and gross close-fighter overlap improve; the roster still fails cinematic styling. Recording-on desktop race/fight p95=11/11ms under this session's conditions does not replace sustained physical-phone measurement; maxima159.9/60ms still matter.

Live DOM inspection exposed the results card hiding the cup/winner even though canvas captures looked unobscured. The renderer now receives the actual card bounds and composes the ceremony in remaining space. A projection regression checks landscape, portrait and shared winner silhouettes; the production build passes. Live results inspection passed at844×390,390×844 and1082×874: the complete cup/winner fits beside or above the score card after resizing. Physical safe-area behavior and owner presentation acceptance remain open.

Next concrete action: verify the results layout, preserve the cycle, then evaluate the isolated Lion face/mane art redesign against the actual concept. Physical controls, sustained phone performance, internet multiplayer and owner visual/play acceptance remain required. Published owner preview stays4ed5042; local work is not silently promoted.

## Cycle7 environment

[Actual paired captures and full replay](evidence/CYCLE-7-ENVIRONMENT.md) show improved storefront depth and road clearance. Same menu view adds1496triangles and reduces draws26→24 through material sharing. Code/build and geometry checks pass; no phone-performance or overall cinematic acceptance follows. An isolated Lion mane study remains rejected; root is assessing alternative mesh sources while networking timing review proceeds. Sharedpreview4ed5042 remains frozen.
