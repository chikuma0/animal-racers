# Championship simulation contract — gameplay revision 2

`src/championship/simulation.ts` is the deterministic, serializable authority. It exports `createMatch`, `stepMatch`, `cpuInput`, `scoreMatch`, `neutralInput`, `forfeitMatch`, shared types and the timing constants below. It has no DOM, renderer, network, wall clock or global randomness. `course.ts` supplies the same road curve to rules and scenery. Host simulation advances exactly `FIXED_DT = 1/60` seconds; other/nonfinite timesteps throw. Results are immutable under later steps.

This revision deliberately replaces the former boost/guard/special combat with race **STEER + LEAP** and fight **MOVE + STRIKE + EVADE**. Earlier guard and special policy audits are historical evidence, not acceptance of these new rules.

## Units, input and phases

Positions and ranges use metres; speed uses metres/second; all timers use seconds. Race Z is course progress, X is lane offset and Y is leap height. The shared course is a visual/steering centreline, not an arc-length conversion of Z. Combat uses X at Z=0 and grounded Y=0.

The unchanged wire input is `{ move, jump, attack, special, guard }`. Movement is held and clamped to −1..1; nonfinite movement becomes zero. Race `jump` is a rising-edge leap; other action buttons have no race effect. In combat `attack || special` is one combined rising-edge STRIKE and `jump || guard` is one combined rising-edge EVADE. Aliases cannot be alternated while held to bypass release. There is no passive blocking or separate special move. Fresh combat intent buffers for140ms; it expires during a long commitment, and holding never repeats it. Evade has priority if both valid intents arrive together.

Countdown lasts3s, race ends when both finish or at95s, transformation lasts4s, fight ends on knockout or at60s. A passive championship is therefore bounded by162s before presentation. Finish time interpolates within its tick. An airborne early finisher lands while its recorded time/progress remains fixed. Combat starts both competitors at100HP, regardless of the race.

## Race: clean lines, visible drafting and a pass

Every species has the same8m/s base speed,6.5m/s² acceleration and5.2m/s lateral steering inside±4.3m. Leap takeoff is7.6m/s under20m/s² gravity. The renderer should map the authored gallop cadence to `speed / RUN_SPEED`.

The centreline is `22*sin(.018*z) + 5*sin(.038*z)`. `courseSlope`, `courseCurvature` and `COURSE_MAX_SECOND_DERIVATIVE = .014348` are shared exports. Outward drift is `clamp(-curvature * speed² *1.25, -.85, .85)` m/s. Steering remains substantially stronger than drift. The rough shoulder begins at `abs(x)>RACE.shoulderStart` (3.6m): target speed is88% of the normal-plus-earned-draft target. The strip must be visibly rough. Returning inside immediately restores the usual target/acceleration; there is no shoulder stun or meter. Leap does not bypass its lane-based cost.

Draft eligibility uses both racers' beginning-of-tick positions and requires a running rival .4–12m ahead. `draftWidthAtGap(gap)` is1.7m through the first3m, tapering to1.25m at12m. This rear-quarter opening is slightly wider than shoulder clearance, so a runner only1m behind can still enter. Eligibility charges `draft` from0 to1 over.9s; outside the trail it decays at.25/s, carrying the advantage into a pass. Target speed gains `1.8*draft` m/s. There is no extra input, hidden opponent penalty or species advantage. `drafting` is current eligibility; `draft` is retained charge. The legacy `boost` remains0. The renderer must use the same gap/width formula for the visible trail, with charge/pass feedback.

Within3m longitudinal distance, racers cannot share less than1.5m lateral clearance. A follower already queued behind a rival stays behind at3m until steering out. Racers already abreast push shoulders sideways, bounded by the road. Body correction precedes hazard/finish adjudication. Hazard crossings interpolate both lateral position and leap height along the corrected movement, avoiding false projected crossings and end-position dodges. A pass event requires both runners to be actively racing and an interpolated reversal of longitudinal order strictly before500m. Its position is the interpolated crossing, so an overshooting trailing finisher cannot pass an already finished rival, and a projected order reversal beyond the finish emits nothing. A genuine pre-line overtake is retained even when both runners finish in that same tick.

There are six hazard moments: a4.4m timber hurdle at82m; two side barrels at156m; a left wagon at235m; a full-width timber/bridge leap at309m; a right wagon at382m; a centre barrel at444m. `arch` is the legacy identifier for a solid wagon that must be steered around; it is not a passable arch. Hurdles need crossing height>.65m and barrels>.8m. Collision includes.32m racer half-width. A hit lasts.32s, lowers speed to at most5.6m/s, halves draft and retains70% steering authority. One obstacle cannot hit a runner twice.

A matched legal-input first-hurdle experiment starts4m before the obstacle at8m/s: one runner leaps and the other misses while both steer the same line. Against the pre-revision source at`cb2ebdc`, time back to base speed improves1.85→.70s and lost distance after3s falls5.368→1.203m. These measurements isolate one mistake; a tactical two-player race can recover through drafting, so more hazard hits do not necessarily imply a slower final time.

## Fight: committed strike, evade, recovery punish

| Species / strike | Windup | Active | Recovery | Damage | Hitstun | Knockback | Move speed |
|---|---:|---:|---:|---:|---:|---:|---:|
| Lion / Sunset Strike | .68s | .14s | .82s |26|.22s|1.10m|3.4m/s|
| Wolf / Creek Slash | .55s | .12s | .82s |18|.18s|.75m|4.2m/s|
| Unicorn / Prism Strike | .60s | .14s | .76s |22|.20s|.90m|3.6m/s|

All strikes reach1.85m. Upright bodies retain1.75m root separation and arena bounds±4.4m; overlap correction clamps pair centre to±3.525m. Evade does not jump over or pass through the rival. Free fighters face the rival from shared beginning-of-step positions; an exact-X tie preserves prior facing. Strike facing locks at startup. The authored anticipation must remain visible for the entire windup, and movement/action cancellation is unavailable during the commitment. A missed strike still pays full recovery. A landed hit can interrupt a rival attack, but contacts already gathered on the same tick trade simultaneously, including a double knockout.

| Species evade | Duration | Protected interval after startup | Movement speed | Cooldown from start |
|---|---:|---:|---:|---:|
| Lion |.40s|.06–.30s|2.8m/s|1.25s|
| Wolf |.38s|.05–.29s|3.6m/s|1.10s|
| Unicorn |.42s|.04–.36s|2.2m/s|1.35s|

With no direction held, evade moves away; held movement chooses its direction. Lion's identity is power/knockback, Wolf's is footwork, and Unicorn's is the longer protective evade shimmer. There is no extra meter or defensive button. An evade that avoids a nearby active strike by protection or by stepping clear grants a.95s `counterWindow`. Starting the same STRIKE within that window captures a.24s windup (`COUNTER_WINDUP`); damage and recovery are unchanged. A distant evade outside the incoming threat grants nothing. Successful avoidance latches that incoming strike as resolved once, so its later active frames cannot re-hit the same evade. An earlier dodge at a wall can expire before a slower windup: the timing and visible boundary still matter.

`strikeTiming(player)` includes the captured normal/counter windup; `strikePhase(player)` returns none/windup/active/recovery. The renderer must retime the authored anticipation to `strikeWindup` and keep the post-contact portion aligned. A counter cue should distinguish the earned faster strike.

A hit gives.65s protection, longer than every.18–.22s hitstun. After stun there is an actionable escape interval. Knockback opens breathing space; when the defender reaches a wall, the attacker recoils by the missing displacement. It is not silently removed at the boundary. Holding EVADE executes once and then leaves the player exposed after its protection ends.

## Scoring and terminal outcomes

Each event allocates50 complementary points; each competitor receives0–50 per event and0–100 overall. Sign-symmetric rounding to tenths followed by the rival's remainder preserves exactly100 championship points and role symmetry.

```
effectiveTime = actual finish time, or 95 + (500 - preservedRaceProgress) / 8 for a DNF
raceAdvantage[0] = clamp((effectiveTime[1] - effectiveTime[0]) / 4, -1, 1)
racePoints[0] = 25 + 25 * raceAdvantage[0]
fightPoints[0] = 25 + 25 * (finalHealth[0] - finalHealth[1]) / 100
```

`RACE_GAP_FOR_FULL_POOL` changes16→4 seconds for the new recoverable race. Seed47 CPU-policy comparisons in both roles measured .011s for CPU/CPU; .140–.361s lost by coasting only the final80m;1.328–1.658s lost by holding the outer edge only the final80m;2.184–3.688s lost by coasting throughout;8.624s lost by holding the edge throughout. Suppressing leaps through309m produced only .054–.087s final gaps and19–20 genuine pass events versus12 for CPU/CPU: drafting recovers early errors and can accelerate both racers. A deliberate-crash audit targeted the first hurdle, bridge, last barrel or every upcoming hazard in both roles over seeds1/47/2026. The every-hazard policy lost both roles (.0095/.1020s); targeted crashes sometimes improved the already-leading slot1 to .0296–.1004s, while slot0 lost all three cases. Race CPU decisions do not use seeded randomness, so the seeds reproduce identical races rather than independent samples. No dominant crash policy appeared in this bounded comparison; it is not a proof against all tactical timing choices. These are bounded policy examples, not human skill distributions. Four seconds allows a clear final-line win to offset one narrow fight loss while photo finishes remain a modest cushion.

| Finish times; finalHP | Race points | Fight points | Total |
|---|---|---|---|
|69.85/70;0/80|25.9/24.1|5/45|30.9/69.1: decisive fight overturns a close race|
|69/70.5;0/26|34.4/15.6|18.5/31.5|52.9/47.1: strong race survives a narrow fight loss|
|68/70;0/50|37.5/12.5|12.5/37.5|50/50: shared honours|
|Same finish; double knockout|25/25|25/25|50/50|
|Same finish; timeout80/60|25/25|30/20|55/45|

Reducing finish time, increasing DNF progress or preserving health cannot lower one's allocation. Deliberately not finishing cannot beat finishing before the deadline. Cumulative damage, attack counts, waiting and visual events add no points. Timeout uses final health; double knockout splits the fight pool; exact overall ties share honours. Race points never change fight stats.

`forfeitMatch(match, slot)` is an authoritative explicit forfeit and awards both pools to the connected rival. Both disconnected in the same authority observation receive no trophy. Terminal results do not change on later calls. Transport must distinguish a confirmed leave from ambiguous connection loss; interrupted/unranked presentation belongs to networking, not competing local claims of a forfeit win.

## CPU and rendering API

The openly limited beginner CPU decides every200ms through the same legal inputs, physics, stats and cooldowns. It sees race hazards within16m, jumps a hazard .16–.43 seconds ahead at current speed, steers around wagons, follows the visible trail and swings2m aside when charge>.8 and the rival is within4.2m. It is not a perfect racing oracle.

Fight attacks have1.8s opening grace and2.0–2.483s between opportunities; blocked readiness remains available at the next decision. A threat must first show.26–.40s of windup before the CPU considers an evade, then a seeded60% roll can accept it. Decision cadence adds delay; no perfect instant read is implied. The CPU approaches at78% stick when preparing a strike or punishing recovery, uses full legal movement to follow an earned counter, and pauses between opportunities instead of immediately erasing knockback. Its first strike may be later than1.8s due to positioning/commitment. Seeded choices, cached input, decision/attack deadlines and all input latches live in `Match`, so JSON replay is exact.

New `Racer` presentation state: `draft`, `drafting`, `dodgeCooldown`, `dodgeDirection`, `counterWindow`, `strikeWindup`, `strikeCounter`, `strikeId`. Existing `energy`, `guard`, `cooldown`, `boost`, `guardRecovery`, `guardBroken` remain wire-compatible legacy values without revision2 abilities. There is no UI meter to spend. `raceStatus`/`raceProgress` survive the arena reset; `previous`/`buffer` preserve edges and short intent; `attackConnected` prevents repeated contact. Times derive from integer counters.

Actions are `race_idle`, `run`, `jump`, `land`, `stumble`, `transform`, `fight_idle`, `fight_move`, `attack`, `evade`, `hit`, `defeat`, `celebrate`. `actionTime` is elapsed seconds from action start. Important events include `draft-start`, `draft-ready`, `pass`, `attack`, `counter`, `evade`, `evade-success`, `hit`, `obstacle`, `finish`, `jump`, `land`, `disconnect` and phase names. The event queue contains only the newest48 events; consumers remember the last seen monotonically increasing id. Phase event slot is−1; otherwise it is0/1. A visual guest prediction must not write HP, resources, events, rival state, phase or results back into authority.

## Verification and remaining acceptance

Four passes covered implementation, domain review, defect investigation and polish. Domain review repaired projected race hazard crossings before body correction, interpolation at lateral crossings, and a shallow-gap trail that could not be entered after a single stumble. Root's actual-control play found Wolf's earlier.38s windup failed every delayed evade; minimum normal windup is now.55s, independent of faster HUD refresh. Stronger course drift and a visible shoulder cost make line keeping consequential. The original scoring gap was recalibrated from measured new policy gaps.

The finish-feedback correction adds both-role regressions for a stopped finisher, an order reversal only beyond500m, ordinary overtakes and genuine pre-finish overtakes in a shared finishing tick. Reinstating the former pass check in memory produces four false passes in the four negative scenarios; the corrected source produces zero. Physics, finish times, scoring and combat audit results are unchanged. Current source SHA-256 is`ed96a791128e7dc74e0ca39de20034a247b6baccfff167fea9c2bfac7e083537`.

The current tests assert scoring monotonicity/complement/symmetry, actual split-win examples, ties/DKO/timeout/DNF/forfeit, immutable results, fixed units, grounded finishers, obstacle crossing and recovery, draft/queue/pass in both roles, edge-vs-clean lines, captured windup, simultaneous hits, bounded contact, held-action exposure, legal aliases/buffers, role-reflected outcomes and JSON replay. The evade→approach→punish matrix covers all9 ordered species pairings, both roles,1.75/1.83m gaps and .40/.45/.50s decisions. Each one-exchange fixture avoids damage and lands its counter in recovery. The sustained-pressure matrix covers all9 pairings/both roles,1.75/1.83/2.8m starts, open space/either wall and .40/.45s responses against a rival that attacks as soon as legally available. This is a state-driven opponent, not a fixed-period attack accidentally synchronized with a defensive script. Some repeated-pressure fixtures take damage; the policy has a counter, not invulnerability. All27 CPU championships (three seeds across9 matchups) finish their races without DNF and produce combat damage. Current reproduction reports a maximum59.567s race and10.900–24.467s fights. All216 sustained-pressure scenarios defeat the repeat-strike opponent; minimum surviving defenderHP is10 and maximum fight time18.583s. This surviving low-health case reinforces that the scripted counter is not a universal safe action.

Run `npx vitest run src/championship/simulation.test.ts` and `npx eslint src/championship/simulation.ts src/championship/simulation.test.ts src/championship/course.ts` from the repository root. Reproduce the measured policy evidence with the CommonJS program below, also from the root. It transpiles current source in memory and only uses legal inputs after scenario setup. No old source-text patch anchors are needed.

These checks do not establish human enjoyment, visible contact/telegraph quality, universal strategy balance, touch execution, internet latency tolerance, physical-device frame rate or full product acceptance. Root owns the current normal-control/browser/device checks. Exact-X identical constructed fighters with the same heading have no historical side information and are not a general symmetry claim; reachable grounded states preserve their existing order.

## Historical evidence retained separately from the new rules

The previous complete contract and executable audit sources remain retrievable with `git show cb2ebdc:docs/production/SIMULATION.md`. The4ed5042 guard-era investigation covered2,160 initial policy matches,1,728 mixed-policy matches,1,296 jittered counters and864 improved jump-policy matches;216 mirrored pairs matched and longest continuous stun was23ticks. The later Cycle6 geometry audit used1,728 policy matches,288 mirrored pairs,108 wall scenarios,27 fight-only CPU fixtures and27 full championships. Adopted geometry source hash was`63239026494e2e3bf2b53e6988df294f75f3afa25458978537c4bd431f6d925b`; its CPU race maximum was59.683s and fights11.4–16.2s. Those move sets, timings, guard and CPU policies are superseded here. The original guard fractional-reserve defect and subsequent reserve latch are likewise historical because revision2 removes guarding. DNF progress, sign-symmetric scoring, finisher gravity, simultaneous contact and beginning-of-step facing fixes remain relevant and covered. Use the pinned historical source for those old reproductions rather than applying old literal replacements to current rules.

## Current policy reproducer

```js
const fs = require('node:fs'), ts = require('typescript'), assert = require('node:assert/strict');
const crypto = require('node:crypto');
function load(path) {
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText)(mod, mod.exports, () => load('src/championship/course.ts'));
  return mod.exports;
}
const s = load('src/championship/simulation.ts'), species = ['lion', 'wolf', 'unicorn'];
const idle = () => [s.neutralInput(), s.neutralInput()];
function duel(chars, gap = 1.8) {
  const m = s.createMatch(chars, 47); m.phase = 'fight';
  m.players.forEach((p, i) => Object.assign(p, { x: (i ? 1 : -1) * gap / 2, action: 'fight_idle', raceStatus: 'finished', finishTime: 70, raceProgress: 500 }));
  return m;
}
function pressure(chars, slot, reaction, gap, wall) {
  const m = duel(chars, gap), other = 1 - slot;
  if (wall) { m.players[other].x = slot === 0 ? 4.4 : -4.4; m.players[slot].x = m.players[other].x + (slot === 0 ? -gap : gap); }
  let seen = 0;
  for (let f = 0; f < 1800 && m.phase === 'fight'; f++) {
    const input = idle(), a = m.players[slot], d = m.players[other], gap = Math.abs(a.x - d.x), toward = Math.sign(d.x - a.x);
    const free = p => p.stun === 0 && p.action !== 'attack' && p.action !== 'evade';
    if (free(a)) { input[slot].move = gap > 1.81 ? toward : 0; input[slot].attack = gap <= 1.83; }
    if (free(d)) {
      if (a.strikeId !== seen && s.strikePhase(a) === 'windup' && a.actionTime >= reaction && d.dodgeCooldown === 0) { input[other].jump = true; seen = a.strikeId; }
      else if (d.counterWindow > 0) { input[other].move = gap > 1.81 ? -toward : 0; input[other].attack = gap <= 1.83; }
    }
    s.stepMatch(m, input, s.FIXED_DT);
    assert(m.players.every(p => Math.abs(p.x) <= 4.4)); assert(Math.abs(a.x - d.x) >= 1.75 - 1e-8);
  }
  assert.equal(m.players[slot].hp, 0); assert(m.players[other].hp > 0);
  return { hp: m.players[other].hp, time: m.fightTime };
}
function racePair(policy, slot, seed = 47) {
  const m = s.createMatch(['lion', 'wolf'], seed); let passes = 0, last = 0;
  for (let f = 0; f < 6000 && ['countdown', 'race'].includes(m.phase); f++) {
    const input = [s.cpuInput(m, 0), s.cpuInput(m, 1)], p = m.players[slot];
    if (policy === 'missEarly' && p.z < 310) input[slot].jump = false;
    const next = s.OBSTACLES.find(o => o.z > p.z && o.z - p.z < 16);
    if (next && (policy === 'crashAll' || policy === 'crashFirst' && next.id === 0 || policy === 'crashBridge' && next.id === 4 || policy === 'crashLast' && next.id === 6)) {
      input[slot].jump = false; input[slot].move = Math.max(-1, Math.min(1, (next.x - p.x) * 2));
    }
    if (policy === 'coast' || policy === 'coastLast80' && p.z > 420) input[slot] = s.neutralInput();
    if (policy === 'edge' || policy === 'edgeLast80' && p.z > 420) { input[slot] = s.neutralInput(); input[slot].move = slot === 0 ? -1 : 1; }
    s.stepMatch(m, input, s.FIXED_DT);
    for (const e of m.events.filter(e => e.id > last)) { if (e.type === 'pass') passes++; last = e.id; }
  }
  assert(m.players.every(p => p.finishTime !== null));
  return { policy, slot, seed, times: m.players.map(p => p.finishTime), gap: m.players[slot].finishTime - m.players[1 - slot].finishTime, passes, hits: m.players.map(p => p.hitObstacles.length) };
}
const pressureResults = [], cpu = [];
for (const a of species) for (const b of species) {
  for (const slot of [0, 1]) for (const reaction of [.40, .45]) for (const gap of [1.75, 1.83, 2.8]) for (const wall of [false, true]) pressureResults.push(pressure([a, b], slot, reaction, gap, wall));
  for (const seed of [1, 47, 2026]) {
    const m = s.createMatch([a, b], seed);
    for (let f = 0; f < 10000 && m.phase !== 'results'; f++) s.stepMatch(m, [s.cpuInput(m, 0), s.cpuInput(m, 1)], s.FIXED_DT);
    assert.equal(m.phase, 'results'); assert(m.players.every(p => p.raceStatus === 'finished')); assert(m.players.some(p => p.hp < 100));
    cpu.push({ race: m.raceTime, fight: m.fightTime });
  }
}
const races = [];
for (const policy of ['cpu', 'missEarly', 'coastLast80', 'edgeLast80', 'coast', 'edge']) for (const slot of [0, 1]) races.push(racePair(policy, slot));
const crashes = [];
for (const policy of ['crashFirst', 'crashBridge', 'crashLast', 'crashAll']) for (const slot of [0, 1]) for (const seed of [1, 47, 2026]) {
  const r = racePair(policy, slot, seed); if (policy === 'crashAll') assert(r.gap > 0); crashes.push(r);
}
console.log(JSON.stringify({ sourceSha256: crypto.createHash('sha256').update(fs.readFileSync('src/championship/simulation.ts')).digest('hex'),
  courseSha256: crypto.createHash('sha256').update(fs.readFileSync('src/championship/course.ts')).digest('hex'),
  pressure: { scenarios: pressureResults.length, minimumSurvivorHP: Math.min(...pressureResults.map(r => r.hp)), maximumFightSeconds: Math.max(...pressureResults.map(r => r.time)) },
  cpu: { championships: cpu.length, maximumRace: Math.max(...cpu.map(r => r.race)), fightRange: [Math.min(...cpu.map(r => r.fight)), Math.max(...cpu.map(r => r.fight))] }, races, deliberateCrashes: { scenarios: crashes.length, wins: crashes.filter(r => r.gap < 0).length, representativeSeed47: crashes.filter(r => r.seed === 47) } }, null, 2));
console.log('REVISION2_RULES_AUDIT_PASS');
```
