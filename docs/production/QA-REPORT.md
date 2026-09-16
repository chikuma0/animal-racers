# Internal alpha QA — 2026-09-17

**Not a release candidate.** No owner visual/play approval or physical-phone acceptance has been recorded. This report separates automated evidence, actual local play and outstanding device work.

## Distribution record

- Draft PR: https://github.com/chikuma0/animal-racers/pull/1
- First snapshot: `474fd4b19b6a10d938c87ee4c97f4313ff1cd526`.
- First preview: https://animal-racers-pwaqlj3qt-dera-ai.vercel.app (Vercel sign-in required; superseded by the upcoming guard/CPU repair for testing).
- Phone-test revision: `4ed5042179707330058784675f3a7f1caf2cbfbe`, deployed and inspected at https://animal-racers-4ohkror23-dera-ai.vercel.app. The branch alias has a seven-day scoped sharing link delivered privately to the owner; a fresh anonymous cookie session reached the game through that link. Do not put its access token in the repository.
- Current separate phone-test revision: `f600be234ec7f52527c0a4335c611d236ad39ea3` at https://animal-racers-4png9iy68-dera-ai.vercel.app, deployment `dpl_DNsgJWVs8sn9dtobz6hDsCSoWDv8`. Seven-day scoped private access delivered to the owner. Anonymous HTTP and actual browser/lobby verification passed; all7 runtime assets match the Cycle10 source manifest. [Deployment evidence](evidence/review-f600be2-deployment.json). Older branch alias remains on4ed5042; do not mix revisions between players.
- Production https://animal-racers.vercel.app remains the prior version.
- Build: Node24 on Vercel, Next16.3.5. Local checks: Node22.22.2, MacBook Air M3/24GB. Blender4.5.9 authored editable sources and GLB exports.

## Evidence and limits

| Area | Verified | Remaining |
|---|---|---|
| Rules | 40 simulation cases covering bounded scoring, edge cases, depleted guard, CPU pacing, role symmetry and all9 ordered pairings | Unit fixtures do not establish fun |
| App | Earlier4ed5042:85 tests. Current review f600be2:110 tests across10 test files, lint and production build passed; six GLBs loaded in actual play | Physical/rendered acceptance remains open |
| Solo | Full Lion/Wolf and Unicorn/Lion loops observed through normal controls; race/fight/combined cup and return | All three active touch playthroughs, sustained rematches and balanced difficulty |
| Local network | Cycle8 recorded Lion-host/Unicorn-guest match: matching68.6–31.4; both landed attacks; rematch restarted; departure interrupted active match | Physical internet, both roles, all9 pairings, loss/jitter/fallback profiles |
| Art/motion | Three racing GLBs and three dedicated upright GLBs;14 original/11 upright clips, reproduced source/export identity and actual Cycle6 camera/contact replay | Cinematic quality fails; simplified faces/mane and broader all-roster motion/physical review remain |
| Performance | Raw per-phase intervals and load conditions retained; large first-stage hitches reduced after shader preparation | Frame spikes remain; physical iPhone13Pro sustained60fps is unverified |
| Audio | 15s actual canvas soundtrack extracted to `evidence/cycle-3-audio.wav`;48kHz stereo, nonzero audio, peak−19.6dBFS | Human listening, phone unlock/mute/special-contact cues |
| UI | Desktop and844×390 layout inspected; small landscape panel overlap repaired | Physical safe areas, touch accuracy, interruption/background behavior and visual onboarding |

Cycle2's218.926s video is actual local two-client gameplay, not a concept render. Its old trophy/anatomy defects are not evidence of the repaired asset state. Cycle3 stills and JSON capture subsequent changes. See [Cycle2](evidence/CYCLE-2.md), [Cycle3](evidence/CYCLE-3.md), [asset provenance](ASSETS.md) and [quality ledger](QUALITY-LEDGER.md).

The initial single-client baseline had race p95 30ms/max400ms, countdown max1470.3ms and transition max1420.3ms. After shader preparation, the long hitch did not recur: countdown max128.9ms, transition max240.9ms. The latter replay overlapped a local compiler in its later portion and is not a controlled sustained-performance comparison. Neither run certifies a phone target.

## Physical session pending

Paired device inventory lists iPhone13Pro, iOS26.6.2. **No measurement or gameplay on it has yet been performed.** Owner agreed to make it and a second player/device available once the test build is ready. Follow [DEVICE-TEST.md](DEVICE-TEST.md): first practical controls, then10minutes without recording, then separate-network multiplayer. Record exact build revision, device/OS, battery/charging/low-power state, warmth, network and both clients' results.

All9 physical ordered pairings (Lion/Lion, Lion/Wolf, Lion/Unicorn, Wolf/Lion, Wolf/Wolf, Wolf/Unicorn, Unicorn/Lion, Unicorn/Wolf, Unicorn/Unicorn) and host reversal remain unverified. Do not substitute local tabs or seeded CPU fixtures.

## Required next repairs

1. Run physical touch/cancellation and sustained performance on a precisely identified review build, then separate-device internet play with both roles. The new immutable f600be2 preview includes the verified control/network/geometry fixes; owner phone feedback is pending.
2. Resolve cinematic character art and complete animation/contact coverage. The Mast cut-head study is rejected for runtime promotion after actual motion review; the completed native full-body assessment also rejects production adoption because of human anatomy and excessive smooth-body cost. A bounded animal-specific source/access review is next. Primitive source/runtime styling remains a major open defect.
3. Record all9 ordered matchups, both roles and both modes; obtain owner visual and enjoyment acceptance. Desktop results-card/cup composition has already passed at844×390,390×844 and1082×874; physical safe areas remain open.

Current root gates:2 met,11 open,0 abandoned. The abandoned visual gate in the earlier isolated hero-mane approach is retained as a failed approach; it does not abandon the required art outcome. Automated success cannot close presentation, phone or internet gates.

## Guard and opening-pace repair

An observed idle Unicorn/Lion fight ended in6.6s, and an adversarial fixture found repeated full blocks on fractional regenerated guard. Broken guard now stays unavailable until25 meter is restored (about1.98s without pressure), then automatically accepts a still-held input. The UI explains recovery and encourages movement. Holding guard under continued pressure now takes full hits. The CPU waits1.5s before attacks, then leaves at least1.2s between attempts; a blocked opportunity retries on the next200ms decision. Identical stats and human-versus-human timing remain unchanged. The seeded idle KO becomes10.2s, while ordinary repeated strikes can win with67HP and CPU retaliation. These are tuning evidence, not enjoyment acceptance.

Original diagrams now illustrate race movement/jump, guard/counterplay and equal event contributions. The short soundtrack recording proves capture includes game audio without microphone access; human audio review remains open.

## Local Cycle5 evidence

[Cycle5](evidence/CYCLE-5.md) records two actual CPU loops, source/runtime fingerprint, active rematch video, both result images and both raw per-phase measurements. The active Unicorn/Lion result is41.9–58.1, fight0–3HP. Frame-time p95 was70ms racing and50ms fighting under recording and substantial host contention; no sustained performance pass is claimed. Source rendering and automated geometry verification do not substitute for the physical touch, separate-device internet or owner visual gates.

## Local Cycle6 evidence

[Cycle6](evidence/CYCLE-6.md) links separate camera-only and integrated build manifests. The integrated active rematch (`a6a6d10b…`) ended37.0–63.0 with fight0–15HP. Forty rule tests, the current counter/boundary audit and independently reconstructed canonical assets pass. The later award-composition build is separately fingerprinted because it changes the renderer/UI; live results inspection passed at844×390,390×844 and1082×874 with the complete cup/winner clear of the score card. This is responsive desktop evidence, not physical safe-area or phone-performance acceptance. Shared preview4ed5042 and required phone/internet/owner gates remain unchanged.

## Local Cycles7–10 checkpoint

[Cycle7](evidence/CYCLE-7-ENVIRONMENT.md) adds authored storefront depth; [Cycle8](evidence/CYCLE-8-NETWORK.md) repairs rematch countdown loss, action-clock rewind and stale input. [Cycle9](evidence/CYCLE-9-PERFORMANCE.md) instruments per-stage wall time and moves representative first draws into loading. Host load differs across the samples, so no controlled speedup or physical60fps conclusion follows.

[Cycle10](evidence/CYCLE-10-CONTROLS.md), commit f600be2, tracks each pointer's original action and combines held keyboard/touch inputs. Original failure callbacks, current source hashes, all six network schedules,110-test build verification and two complete Wolf/Lion recordings are retained. The active rematch ends19.1/80.9 with0/88HP; only a brief Element/Strike/Guard sequence is verified. Recording-on desktop race/fight p95 is40/51ms, still failing a smoothness target. Final runtime fingerprint: bdbf3736f1bd4aa452750665aa500885c864546b4402df74fb06ef3595fbd94a. These changes are now available in the separate immutable f600be2 review preview. The original shared branch preview remains unchanged.
