# Physical-device and internet acceptance session

Status: internal alpha f600be234ec7f52527c0a4335c611d236ad39ea3 is published as a separate protected preview at https://animal-racers-4png9iy68-dera-ai.vercel.app. The seven-day private access link was delivered directly to the owner; do not store its token here. Both players must open that full private link before exchanging an invitation code. The older branch link originally served4ed5042 and can advance on task-branch pushes; do not use it for this fixed-revision protocol. The first physical-device response is pending. A local two-tab match is recorded; separate-device internet play is not verified. This protocol does not imply the visual target is accepted.

## Setup

Baseline:iPhone13Pro or newer, Safari, landscape, normal display brightness. Note model, iOS version, battery level, charging state, low-power mode and whether the phone feels warm. Start without screen recording. The second player uses a different device and, for the internet gate, a different network (for example one Wi-Fi and one cellular connection). Use the exact same review URL/revision.

## First pass — practical access and control

1. Load the build, choose an animal and start solo. Confirm character assets load and audio unlocks after the first interaction; test mute. Read the short intro.
2. Steer both directions, deliberately clear a hurdle with jump, recover from one collision, and use burst on a clear section. Note delayed, missed or confusing touch actions.
3. In the saloon, approach/retreat, strike, guard, jump and use the element. Note whether contact, hit reactions and health changes agree and whether the controls obscure action.
4. Confirm race and duel contributions, a recognizable cup, rematch and return. Report the most frustrating or visually distracting moment, with phase and character.

## Measurement pass

Use **⋯ → Start fresh measurement** before playing. Play at least10 minutes with repeated full matches and all three characters; keep the same load conditions. Avoid canvas/screen recording in this pass. At the end choose **Download measurements** and retain the JSON. It includes per-phase sample counts, total measured time, p50/p95/p99, longest frame and threshold counts, plus browser and build revision. Annotate device/environment details separately. Compare early and late sessions for thermal degradation. The initial target is sustained60fps; failures require repair or an explicitly agreed compromise.

## Internet pass

PlayerA creates an invitation. PlayerB opens the link/code and selects a different animal. Both ready up. Both should remain visibly live during the race and fight; perform attacks from both roles. Compare exact result rows, winner and scores. Both select rematch. Repeat with the host role reversed. Include all9 ordered character pairings over the full QA matrix, rather than claiming roster-wide coverage from one pairing.

Then test a deliberate mid-race departure and mid-fight departure. The remaining player must see an interruption and no invented win. After a completed result, departure must preserve the completed score and disable unavailable rematch. Test reload/stale code, third-player rejection and app backgrounding. Log network type and transport/RTT distribution from the report. Record one representative complete match separately from performance testing.

## Owner acceptance

Review actual phone gameplay and captures against the cinematic-western target. Character anatomy, animation contact, speed/readability, combat counterplay, audio, cup presentation and enjoyment require human judgment. Open major defects remain failures even if code/build tests pass. The quality ledger tracks each result; no release-complete claim before these gates close.

## Additional timing evidence in local Cycle9 builds

The download also separates simulation, network send, presentation, renderer, audio/UI and complete callback wall times. Renderer details split scene update from draw submission. Zero-duration samples are retained, and visible/hidden samples have separate keys. These durations include scheduling pauses and synchronous driver work; they are not CPU utilization or completed GPU execution times. The gap between callbacks includes refresh pacing, browser work and other unmeasured work. Do not add stage percentiles or infer a GPU bottleneck from a single maximum.

The loading preparation section records the elapsed time and bounded representative draws before play is enabled. Starting a fresh measurement clears gameplay histograms but preserves the loading record. All raw frame intervals remain available: moving first-use work into loading does not make long loading acceptable or certify sustained play. Record loading duration separately in the physical-device session. The new f600be2 immutable review preview includes these additions; the old4ed5042 branch link does not.

## Touch regression pass for Cycle10 or later

Hold both steering buttons, then lift only one finger: the remaining direction must stay active. Hold Guard with one finger while tapping Strike with another; the guard must resume after attack recovery. Hold Jump across the race-to-fight boundary and release it after the button changes; the previous press must not remain latched. Cancel a press by backgrounding Safari, return, and verify that movement/defense is neutral until a new press. Repeat after rematch. These are physical event-delivery checks; callback fixtures and desktop clicks do not replace them. Use the new f600be2 review build; the4ed5042 shared build predates this repair.
