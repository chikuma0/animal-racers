# Gameplay revision 2 — review candidate, 2026-09-20

**Playable candidate for owner/device review; not an accepted release candidate.** The approved redesign and rebuilt roster are deployed together at [the immutable preview](https://animal-racers-eg9gw1za9-dera-ai.vercel.app). Open the full private access link supplied directly to the owner before joining a friend. Production remains unchanged.

- Exact application fingerprint: `de401d12cd83b9736d534c3a46b3288f98fcf8ef5e28d95de7760775a1e35960`; visible report revision `revision2-de401d12cd83`. [Build manifest](evidence/revision2-release/build-manifest.json), [regression receipt](evidence/revision2-release/regression.json), [deployed asset/access verification](evidence/revision2-release/deployment.json). Source rules/UI/network bytes match the fully tested `dab6cd037a2a` build; six GLBs and roster provenance changed. The preview's eight asset files match exact local hashes; all three menu choices and invitation creation/exit were checked in a fresh browser session.
- Gameplay now centers on visible drafting, pulling alongside to pass, purposeful lane hazards, short collision recovery, committed strikes, successful evasion and faster counter replies. Equal bounded race/fight pools allow a strong duel to overturn a race loss. [Play instructions](PLAY-THIS-BUILD.md) and [game brief](GAMEPLAY-DESIGN.md).
- Regression:126 tests across11 files, lint and the explicitly labeled production build passed after integration.35 semantic simulation tests and216 pressure fixtures cover the core rules; no permanent stun trap was observed in those fixtures. This does not establish optimal balance or enjoyment.
- Full functional coverage before the asset-only repair: all9 ordered solo pairings and all9 ordered two-client pairings plus a full rematch. Both online roles performed leaps, successful evades, actual counters and consequential damage, and agreed on final state/results. Parent independently checked the saved reports and recording hashes. [Solo matrix](evidence/revision2-solo/2026-09-20T03-02-36-830Z/README.md), [online aggregate](../../scripts/network/browser-revision2/aggregate-2026-09-20T03-34-30-929Z.json). These remain pinned to their original asset hashes.
- Integrated replay: Lion/Wolf, Wolf/Unicorn and Unicorn/Lion each completed via ordinary visible controls on the delivered fingerprint, with4 leaps, a real pass and4/6/5 successful evade-and-counter replies respectively. [Reports/screenshots](evidence/revision2-solo/2026-09-20T04-10-46-092Z/solo-matrix.json). Lion/Wolf has a completely decoded portable movie; the other two exports were empty and are explicitly excluded from recording evidence. The affected two-client replay covers Lion/Wolf plus a full rematch, Wolf/Unicorn and Unicorn/Lion:4 accepted complete movies, both roles4 leaps/1 successful evade/1 counter, consequential damage and exact agreement on final results. Parent re-derived and rehashed every result/movie in [the repaired-art aggregate](../../scripts/network/browser-revision2/aggregate-2026-09-20T04-27-02-316Z.json). An earlier Wolf/Unicorn control-click timeout is retained as a failed attempt; the isolated rerun passed. This3-pair affected subset complements the unchanged-rules9-pair matrix; it is not a new9-pair matrix.
- Art and motion: all six rebuilt meshes and editable Blender sources are integrated, with continuous tail roots and lifted evade steps. Parent reviewed18 exact-renderer poses and9 complete normal/counter/evade cycles, plus side/root views and full affected Blender cycles.27 complete baseline/candidate movies and429 paired frames remain available. Fresh independent reproduction matches all six GLBs byte-for-byte and editable source semantics; all3 canonical integration gates passed parent re-execution. [Runtime review](evidence/revision2-tail-runtime/2026-09-20T03-50-31-404Z/README.md), [asset provenance/reproduction](ASSETS.md). This is technical/motion improvement; cinematic quality and owner approval remain separate.
- Known networking limit: bounded guest presentation prediction preserves host authority, but the host still has a timing advantage. Synthetic reaction tests passed all9 pairings at100ms one-way latency and failed all9 at200ms. Broadcast fallback is not accepted for responsive combat. Shared-computer browser matches are not separate-network internet acceptance.
- Known capture limitation: two repeat solo recording exports were zero bytes. Fresh passive MediaRecorder diagnostics produced9 nonempty short recordings, including3 across character/rival changes and race starts and3 with sound muted, without reproducing an error. Cause remains unconfirmed; no app change was made. Failed movies are never counted as evidence. [Diagnostic](evidence/revision2-release/recording-diagnostic/README.md).
- Compatibility-only asset limitation: unused quadruped defeat clips retain tail-only floor crossing (worst Unicorn−0.508m). Actual fight/results dispatch uses upright assets. Every displayed clip and all body vertices retain the original floor checks; tail continuity and finite bounds remain checked for the unused clips. [Exact boundary](../../assets/source/western/revision2/tail-integration/REVIEW.md).
- Environment: MacBook Air M3/24GB, Node22.22.2, installed Chrome, Next16.3.5, Blender4.5.9; hosted build uses the configured Vercel environment. Concurrent automation and recording add load. None of these frame reports certifies physical iPhone performance.
- **Still required:** physical iPhone13Pro touch/readability and sustained60fps measurements; two real players on separate devices/networks; owner judgment of the actual art, control feel and enjoyment. Two device-image mount attempts returned CoreDeviceError10003 because the paired phone was locked; tools and Developer Mode are available. The concrete preview and unlock/test request were sent to the owner. [Phone diagnosis](evidence/revision2-integrated/phone-access.json), [physical/internet protocol](DEVICE-TEST.md).

Next action: run the physical/internet session when the owner unlocks the phone and provides the second player, then address observed feel/art/performance findings. No full-game completion claim before these gates pass.

---

# Historical alpha QA — 2026-09-17

**Not a release candidate.** No owner visual/play approval or physical-phone acceptance has been recorded. This report separates automated evidence, actual local play and outstanding device work.

## Distribution record

- Draft PR: https://github.com/chikuma0/animal-racers/pull/1
- First snapshot: `474fd4b19b6a10d938c87ee4c97f4313ff1cd526`.
- First preview: https://animal-racers-pwaqlj3qt-dera-ai.vercel.app (Vercel sign-in required; superseded by the upcoming guard/CPU repair for testing).
- Phone-test revision: `4ed5042179707330058784675f3a7f1caf2cbfbe`, deployed and inspected at https://animal-racers-4ohkror23-dera-ai.vercel.app. The branch alias has a seven-day scoped sharing link delivered privately to the owner; a fresh anonymous cookie session reached the game through that link. Do not put its access token in the repository.
- Current separate phone-test revision: `f600be234ec7f52527c0a4335c611d236ad39ea3` at https://animal-racers-4png9iy68-dera-ai.vercel.app, deployment `dpl_DNsgJWVs8sn9dtobz6hDsCSoWDv8`. Seven-day scoped private access delivered to the owner. Anonymous HTTP and actual browser/lobby verification passed; all7 runtime assets match the Cycle10 source manifest. [Deployment evidence](evidence/review-f600be2-deployment.json). The older branch alias was held on4ed5042 during this deployment, but can advance after subsequent task-branch pushes; use the immutable URL and do not mix revisions between players.
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

## Source delivery checkpoint

2026-09-17: changes through efde8f3 were pushed to the isolated codex/western-championship branch, and draft PR1 was updated in Japanese. An initial HTTP408 push left the remote on4ed5042; a verified HTTP/1.1 retry succeeded without force or shared-branch changes. The fixed f600be2 phone-test deployment is independent of later branch previews. Actual phone/internet results and the requested animal-source download are still pending.
