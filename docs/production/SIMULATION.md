# Championship simulation contract

`src/championship/simulation.ts` is the authoritative, serializable rules module. It has no renderer, DOM, transport, wall clock, global randomness, or asynchronous work. It exports the shared `createMatch`, `stepMatch`, `cpuInput`, `scoreMatch`, and `neutralInput` API, all shared types, course obstacles and durations. Additional exports are `Slot`, `Obstacle`, `FIXED_DT`, `RUN_SPEED`, `RACE_GAP_FOR_FULL_POOL`, `CHARACTERS`, `ATTACKS` and `forfeitMatch`.

The host owns a fixed-step accumulator and calls `stepMatch(match, [left, right], FIXED_DT)`. A step is exactly 1/60 second; another or nonfinite timestep throws. Rendering interpolates independently. Do not send render-frame elapsed time directly to this API. Results are terminal and immutable under further steps; presentation owns its reveal/celebration clock.

## Units, input and phase timing

- Positions, collision distances and movement use metres; speed uses metres/second. All timers use seconds. Race forward is +Z; combat is along X at Z=0, with +Y jumps.
- Countdown is 3 seconds. Race ends when both runners finish or after 95 seconds. Transformation is 4 seconds. Combat ends on knockout or at 60 seconds. Even a passive match terminates within 162 seconds, excluding presentation.
- Movement and guard are held inputs. Jump, strike and special use rising edges: release before another activation. Combat buffers a fresh press for 140 milliseconds through the end of recovery or hitstun. A press during a long recovery expires; holding never auto-repeats.
- Opposing keyboard/touch directions should be combined before submitting `move`; the simulation clamps it to -1..1 and converts nonfinite values to zero.
- In a race, strike/guard have no effect. Special gives the same visible 1.1-second speed boost to every character: 35 energy, 3-second cooldown. Energy regenerates at 10/second. Both competitors have the same 8m/s base speed and 3.5m/s² acceleration on a 500m course, and no collision with each other during racing.
- Race lateral movement is 5.2m/s within ±4.3m. A 7.6m/s takeoff under 20m/s² gravity clears hurdles/barrels with sufficient timing. Arches always require a lane change. Obstacles slow speed to at most 3.5m/s, interrupt boost and impose 0.55 seconds of recovery. Steering retains 45% authority during recovery. One crossing causes at most one hazard hit.
- Authored hazard rows first appear at 45m and end at 449m. Wide gaps provide anticipation and recovery; the last 51m is a sprint. Alternating barricades at 355m/387m extend across each outer lane, preventing a single held edge direction from bypassing every obstacle. The renderer must make the obstruction represented by `arch` unmistakable: its collision occupies the specified width from ground level upward; it is not a passable decorative archway.
- Finishes use sub-tick interpolation. An airborne early finisher continues gravity/landing while waiting, with finish time and course progress locked. Every fighter starts combat with 100 health, 100 guard and 100 energy regardless of race performance.

## Combat that the renderer must represent

Both characters move at 3.6m/s, 1.45m/s while guarding and 2.6m/s in the air. The arena is ±4.4m. Grounded bodies maintain 1.75m separation; the pair center is clamped to ±3.525m to keep both roots inside the arena; sufficiently high airborne movement can cross. Idle/moving fighters face their rival using beginning-of-step positions shared by both decisions. Exact-X ties retain prior facing. Attack direction is committed at startup. An exact-X landing uses prior opposing orientation, or the higher fighter’s orientation when headings agree, to preserve the side choice under slot swaps and spatial reflection. A hit requires the defender to be in front, within the move's horizontal reach and within 0.9m vertically. A move contacts at most once. Apply the same distances to visible limbs/effects; a clip that does not reach the authoritative contact is a rendering defect.

| Move | Startup | Active | Recovery | Reach | Damage | Hitstun | Counterplay |
|---|---:|---:|---:|---:|---:|---:|---|
| Common strike | .18s | .10s | .29s | 1.85m | 11 | .20s | Guard, jump or force a whiff |
| Lion: Ember rush | .32s | .14s | .48s | 2.10m | 18 | .24s | Read startup; guard or evade the committed lunge |
| Wolf: Frost howl | .43s | .16s | .55s | 2.75m | 14 | .27s | Long startup/recovery; close the gap after a miss |
| Unicorn: Prism ward | .40s | .12s | .43s | 1.95m | 13 | .21s | Bait its short range; attack after protection ends |

All specials cost 40 energy and have a 3.2-second cooldown. Lion advances at 7m/s during its active window; it does not teleport. Wolf's longer hit region requires a visible water/ice wave within that reach. Unicorn's forward ward lasts from .08 to .52 seconds of its special and absorbs incoming frontal hits. The special provides frontal protection followed by a short prism pulse: its visible damage pulse spans the 1.95m reach only during the .40–.52s active window. The normal attack remains a hoof strike. The ward cannot reflect damage or generate points.

Held frontal guard reduces a contact to 1 health damage and drains 2.2 times the move's base damage from guard. An intact guard does not regenerate while held; after release and a .6-second contact recovery, it regenerates at 18/second. Depletion causes .38 seconds of guard-break hitstun and latches `guardBroken` until at least 25 meter is rebuilt. Recovery takes about 1.98 seconds without further pressure; incoming hitstun may delay it. During that interval the competitor can move and use ordinary actions after hitstun, but cannot block with a fractional reserve. Holding the guard button automatically resumes guarding once the reserve returns, without requiring a repeated press. An unguarded contact gives .52 seconds of invulnerability; a guard break gives .62. These exceed the corresponding stun, guaranteeing a protected actionable escape window, while ending before the depleted guard can re-arm. No move applies a freezing lock beyond these bounded stun times. Effects must convey brief frost impact without implying an unavailable long freeze mechanic.

Contact candidates are gathered for both slots before either hit is applied. Simultaneous hits, including double knockout, remain simultaneous; array ordering cannot grant one slot priority. A whiff still incurs complete recovery. Neither attacking nor defending heals health.

## Combined scoring

Each event allocates exactly 50 points between the competitors. Each competitor receives 0..50 per event and 0..100 in total. Event allocations are rounded to tenths using sign-symmetric rounding; the rival receives the remainder, so every result allocates exactly 100 championship points. The allocation is based on performance gaps, not a fixed win bonus.

For competitor `i`, race effective time is actual finish time. A DNF instead uses:

```
effectiveTime[i] = 95 + (500 - raceProgress[i]) / 8
raceAdvantage[0] = clamp((effectiveTime[1] - effectiveTime[0]) / 16, -1, 1)
racePoints[0] = 25 + 25 * raceAdvantage[0]
fightPoints[0] = 25 + 25 * (finalHealth[0] - finalHealth[1]) / 100
```

Apply the rounding/complement rule above after computing each pool. Sixteen seconds of race advantage captures its full event pool; 100 health of fight advantage captures the other pool. This is an explicit initial tuning choice, not an empirically accepted fun/fairness claim. The HUD should explain: “Race time gap + health remaining; 50 points per event.” Race points do not modify combat stats.

| Example | Race points | Fight points | Overall |
|---|---|---|---|
| Finish 69s/70s; health 0/80 | 26.6/23.4 | 5/45 | 31.6/68.4: decisive fight overturns close race |
| Finish 64s/76s; health 0/10 | 43.8/6.2 | 22.5/27.5 | 66.3/33.7: close fight loss preserves strong race |
| Finish 68s/76s; health 0/50 | 37.5/12.5 | 12.5/37.5 | 50/50: shared honours |
| Same finish; double knockout | 25/25 | 25/25 | 50/50: shared honours |
| Same finish; timeout health 80/60 | 25/25 | 30/20 | 55/45 |
| Both DNF at 400m/200m; same health | 50/0 | 25/25 | 75/25 |

Reducing your finish time, increasing DNF progress or preserving more health cannot lower your own allocation. Finishing earlier cannot be worse than deliberately missing the deadline. Damage is not counted cumulatively: repeated attacks, blocks, elapsed waiting, animations and event counts cannot farm points. Timeout uses final health; double knockout splits the fight pool equally. Exact combined ties share honours without a hidden slot/seed tiebreaker.

`forfeitMatch(match, slot)` ends a live match and allocates both event pools to the connected rival, with an explicit disconnect reason. A disconnected competitor cannot preserve a lead by escaping the fight. Transport owns the timeout/grace policy; the simulation must only receive an authoritative confirmed forfeit. Reconnection after terminal forfeit requires a rematch. To adjudicate both rivals disconnected in the same authoritative observation, set both `connected` values false before stepping: the result is tied with no trophy. Calls after a terminal result do not rewrite it.

## CPU and serializable state

CPU makes decisions every 12 ticks (200 milliseconds) using deterministic seeded choice. It sees race hazards at most 14m ahead, jumps jumpable hazards in its current lane when 1–5m away, steers around arches, and sometimes boosts in clear space. In combat it pursues until 1.80m separation and attempts a normal strike within 1.82m (against the same 1.85m reach as a human), sometimes guards readable threats when its own guard is usable, and occasionally jumps. Its explicit beginner assists are a 1.5-second opening without CPU attacks and at least 1.2 seconds between subsequent CPU attack attempts. If hitstun or defense blocks a ready opportunity, it retries at the next 200ms decision rather than losing an entire interval. This avoids synchronizing every opportunity with an opponent's repeated attack rhythm. Movement and defense remain active during the opening. These are openly specified behavior limits; the CPU uses the exact same input path, move startup/recovery, damage, energy, cooldowns, health, range, gravity and speed as a person. It receives no hidden stat bonus, damage reduction, invulnerability or instant extra move. Difficulty/enjoyment still needs human playtesting.

`cpuInput` mutates only the player's cached AI decision, next decision tick and next eligible attack tick. Call it once per CPU slot before each host simulation step. Complete matches resume exactly from JSON serialization because the seed, AI cache, input edge latches, buffers, phase counters, obstacle history and contact latches are all in `Match`.

Additional state beyond the original shared interface:

- Match: `phaseTick`, `raceTicks`, `fightTicks` are integer counters; public times derive from them. `fightEnd` records pending/knockout/double-knockout/timeout/disconnect. `eventSequence` monotonically identifies events.
- Racer: `vy` is vertical velocity; `connected` is authority's final presence decision; `raceStatus` and `raceProgress` preserve finish/DNF information when combat resets Z. `previous` and `buffer` track input edges/140ms combat intent; `hitObstacles` bounds hazard contacts; `attackConnected` prevents multihits; `guardRecovery` delays meter recovery and `guardBroken` prevents re-arming before a useful reserve returns. `ai` contains cached ordinary inputs, `nextTick` and `nextAttackTick` deadlines.
- `events` keeps only the newest 48 items. Consumers remember their last seen `id` rather than replaying the entire array. Phase events have slot -1; movement/contact events identify 0 or 1. An event's X/Z is the subject's world position at the time it happened.
- Action names map to the asset contract: `race_idle`, `run`, `jump`, `land`, `stumble`, `transform`, `fight_idle`, `fight_move`, `attack`, `special`, `guard`, `hit`, `defeat`, `celebrate`. `actionTime` is elapsed seconds since the action began. Jump and attack can coincide; `y` remains authoritative even while the attack action is active.

## Verification and remaining integration evidence

The leaf test suite has 40 passing tests covering scoring monotonicity and symmetry, close/decisive split wins, exact ties, double knockout, timeout, DNF preservation, disconnects, race collision/clearance/recovery, an airborne early finisher settling, both outer lanes requiring steering, timing and sanitization, simultaneous contact, guard break, a protected escape window, buffered controls, special counterplay, bounded event memory and deterministic JSON replay. Added adversarial fixtures verify that sustained pressure deals full damage through depleted guard, holding can re-arm after recovery, CPU opening/attack spacing is respected, and active ordinary strikes can beat the beginner rival while still receiving counterattacks. It runs all nine ordered character matchups over three seeds through complete CPU championships; each observed race finishes under 80 seconds without a DNF and every fight produces damage.

Run `npx vitest run src/championship/simulation.test.ts`. This is functional rules evidence. It does not establish contact/animation agreement, enjoyable controls, visible telegraphs, latency tolerance, online two-device delivery, all normal-control matchups, or physical iPhone frame rate. Those belong to the root integration/playtest gates and remain open until observed.

Expert review found and repaired two defects before handoff: resetting Z for the arena originally discarded DNF progress, and ordinary absolute rounding could bias exact half-tenth scores under slot reversal. Persistent `raceProgress` and symmetric signed rounding now have regression fixtures. A later usability pass added the 140ms input buffer and tests for both successful late presses and expired early presses. Independent integration review then found that an airborne early finisher skipped gravity while waiting; the runner now lands without changing recorded results, with a dedicated regression fixture. Visual/game-feel acceptance is not inferred from these functional checks.

The same integration review identified a mismatch between the initial 16m/s world motion and the authored gait. The chosen revision halves course length, forward obstacle distances, speed, acceleration, stumble speed and CPU forward distances while preserving time budgets, lateral agility, jump height and scoring normalization in seconds. `RUN_SPEED` exports the 8m/s nominal animation speed, so renderer cadence should use `player.speed / RUN_SPEED`. The coordinated asset target is a .50-second gallop with a 25% contact phase and 1m backward paw travel during contact, matching 8m/s; actual foot-ground agreement still requires the rendered motion check. The source gait's reversed contact direction was reported to the asset owner for correction. This rescale preserves the intended roughly 60–80-second race rather than shortening the championship.

### CPU pacing and depleted-guard correction after internal alpha 474fd4b

Normal-control play reported an idle Unicorn losing to the Lion CPU in 6.6 seconds. A deterministic reproduction using seed 6827, neutral race input and the same fight controls reproduced the exact result. The first CPU attack began at .417 seconds and contacted at .783 seconds; two specials and six common strikes exhausted 100 health. A common strike occupies .57 seconds, while the former CPU selected attacks every .6 seconds, leaving roughly .03 seconds between a completed strike and the next eligible start. The .29-second attack recovery remains punishable, but the unbroken offense gives a new player little time to find the new controls.

The same investigation found a guard defect: after depletion, one regeneration tick restored .3 meter, enough to buy a full reduced-damage block and another guard-break protection window. Holding guard for the entire fixture therefore caused 49 guard breaks without a single full hit and reached the 60-second timeout with 48 health. The `guardBroken` reserve latch fixes that behavior for both humans and CPU without changing health, damage, stun or invulnerability values.

| Same seed, matchup and ordinary controls | Internal alpha 474fd4b | Revised rules |
|---|---|---|
| Idle throughout combat | KO at 6.60s, player/CPU health 0/100 | KO at 10.20s, 0/100 |
| First CPU attack/contact against idle player | .417s / .783s | 1.617s / 1.800s |
| Hold guard throughout combat | Timeout at 60s, 48/100; no full hits | KO at 28.35s, 0/100; seven full hits |
| Tap strike every .6s, no movement | CPU KO at 7.40s, player health 82 | CPU KO at 6.20s, player health 67; CPU makes four attack attempts |

An initial rigid 1.2-second schedule was rejected after it synchronized every CPU opportunity with the repeated-strike fixture's hitstun, causing the CPU never to attack. The final timer preserves a minimum 1.2-second gap but retries a blocked ready opportunity on the next decision, retaining counterplay in that fixture. These results demonstrate the specific timing and guard repairs. They do not establish that the revised beginner rival is enjoyable, balanced across all human strategies, or approved for release; repeat the normal-control phone playtest with the revised preview.

## Bounded PvP policy audit at 4ed5042

The audit found no unanswerable single-button or species exploit in the exercised policies. Production balance and the 4ed5042 CPU changes were preserved; no new regression test was added because no new rules defect was established.

Coverage was all nine ordered species pairings, both policy-role assignments, and ordinary starting separations of 1.1, 2.2, 3.5 and 6 metres. Each scenario started with 100 health, guard and energy, equal completed-race times and the normal arena bounds, then changed state only through legal inputs and `stepMatch`. Policies observed the same position/action/timer state used for presentation at 100ms or 200ms decision intervals, with shifted initial offsets. A further pass used deterministic 5–12-tick decision jitter (83–200ms) to expose timing resonance. These are scripted policy comparisons, not trained-human reactions or an exhaustive strategy search.

The initial matrix contained 2,160 matches for repeat-strike, guard/counter, special-only spacing/backpedal and jump pressure. A further 1,728 matches added backstep/whiff-punish and mixed guard/strike/special; 1,296 matches checked selected counters with decision jitter. After identifying a weak jump-policy artifact, 864 additional matches evaluated a stronger descending-or-landing strike policy. The largest observed uninterrupted hit/guard-break stun was 23 fixed ticks, approximately .383 seconds. In 216 separately checked mirrored-role pairs, health reversed exactly and match duration was identical.

| Policy versus opponent | Fixed-decision wins / ties / losses | Jittered-decision wins / ties / losses |
|---|---:|---:|
| Repeat-strike versus guard/counter | 0 / 72 / 144 | 18 / 0 / 198 |
| Repeat-strike versus backstep/whiff-punish | 54 / 0 / 162 | 27 / 0 / 189 |
| Guard/counter versus mixed guard/strike/special | 162 / 36 / 18 | 96 / 18 / 102 |

Each table cell summarizes 216 pairings with the first named policy as the subject. The large change in the third row is evidence of policy timing sensitivity: the fixed-cadence win rate is not reliable evidence that guard/counter dominates every opponent. Repeat-strike has credible defensive and spacing counters in every species pairing because those ordinary defensive/attack rules are shared. Special-only retreat also lost to ordinary approach-and-strike, so no species' special was unanswerable in this bounded set.

The original jump policy sometimes missed its narrow airborne attack opportunity at a 200ms decision interval and never attempted a strike. Treating those losses as jump-balance evidence would have been misleading. The stronger policy keeps a pending strike through descent or landing. Across 216 cases per opponent it made at least one strike in every scenario: it won/lost 36/180 against repeat-strike, 18/198 against guard/counter, 216/0 against special-only spacing, and won/tied/lost 180/3/33 against backstep/whiff-punish. Jump pressure therefore has counters and can win, while these data still do not certify its intended feel.

Representative reproductions (slot 0 health / slot 1 health):

| Characters and policies | Start gap; decisions; offset | Final health; time |
|---|---|---|
| Unicorn repeat / Wolf guard-counter | 3.5m; 100ms; rival +3 ticks | 0 / 82; 9.850s |
| Unicorn repeat / Wolf guard-counter | 3.5m; jitter; rival +4 ticks | 0 / 60; 9.683s |
| Lion guard-counter / Wolf mixed | 6m; 100ms; slot 0 +3 ticks | 0 / 1; 18.800s |
| Lion repeat / Unicorn strengthened jump | 2.2m; 200ms; rival +7 ticks | 45 / 0; 10.800s |
| Lion strengthened jump / Lion repeat | 1.1m; jitter; rival +4 ticks | 1 / 0; 11.233s |

The source SHA-256 for these measurements was `08460daff15c5752cb6ab8b02337f3d56f92e9e3ae92f56e7a7200e10be8a80a`. No claim about fun, visual contact, touch execution, internet latency or global optimal play follows from these results. The next useful check is normal-control human play against varied reactions, not a balance change inferred from one scripted win rate.

### Reproduce the decisive audit cases

Run the following Node program from the repository root. It reads the historical `4ed5042` simulation from local Git and transpiles it in memory, does not write production files, and uses only ordinary controls after initial scenario setup. Policy names map to `repeat`, `guardCounter`, `spacing`, `jump` (the strengthened version), `whiff`, and `balanced`. Period 6 means 100ms, 12 means 200ms, and 0 selects the bounded jitter schedule. The `swap` flag moves the initial decision offset from slot 1 to slot 0; callers explicitly swap policy/species arrays for a true mirrored-role check.

```js
const fs=require('node:fs'),ts=require('typescript'),crypto=require('node:crypto');
const source=require('node:child_process').execFileSync('git',['show','4ed5042:src/championship/simulation.ts'],{encoding:'utf8'});
const mod={exports:{}};new Function('module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(mod,mod.exports);const s=mod.exports;
const clamp=(v)=>Math.max(-1,Math.min(1,v));
const attackFor=p=>p.action==='attack'?s.ATTACKS.attack:p.action==='special'?s.ATTACKS[p.character]:null;
function policy(kind,slot,period,offset=0){
 let next=offset,input=s.neutralInput(),pulseAfter=offset,decision=0,jumpPending=false;
 return m=>{
  if(m.fightTicks<next)return {...input};
  decision++;const delay=period||(5+(decision*7+offset+slot*3)%8);next=m.fightTicks+delay; input=s.neutralInput();
  const p=m.players[slot],o=m.players[1-slot],distance=Math.abs(o.x-p.x),toward=Math.sign(o.x-p.x);
  const busy=attackFor(p)||p.stun>0,move=attackFor(o);
  const threat=move&&o.actionTime<move.windup+move.active&&distance<move.reach+.25;
  const canPulse=m.fightTicks>=pulseAfter&&!busy;
  function strike(){if(canPulse&&distance<=1.45){input.attack=true;pulseAfter=m.fightTicks+delay*2;}}
  if(kind==='whiff'){
    input.move=distance>1.65?toward:distance<1.48?-toward:0;
    if(threat)input.move=-toward;
    const recovery=move&&o.actionTime>=move.windup+move.active;
    if(canPulse&&Math.abs(p.x)>3.7&&p.y===0){input.jump=true;input.move=toward;pulseAfter=m.fightTicks+delay*2;}
    else if(p.y>0){input.move=toward;if(canPulse&&p.vy<0&&Math.abs(p.y-o.y)<.9)strike();}
    else if(recovery&&canPulse){
      if(distance<=1.45)strike();
      else if(p.energy>=40&&p.cooldown===0&&distance<=s.ATTACKS[p.character].reach+(p.character==='lion'?.6:0)){input.special=true;pulseAfter=m.fightTicks+delay*2;}
    }
  }else if(kind==='balanced'){
    input.move=distance>1.2?toward:0;
    if(threat&&!p.guardBroken&&p.y===0){input.guard=true;input.move=0;}
    else if(canPulse&&p.energy>=40&&p.cooldown===0&&distance>1.5&&distance<=s.ATTACKS[p.character].reach+(p.character==='lion'?.6:0)){input.special=true;pulseAfter=m.fightTicks+delay*2;}
    else strike();
  }else if(kind==='repeat'){
    input.move=distance>1.08?toward:0;strike();
  }else if(kind==='guardCounter'){
    input.move=distance>1.1?toward:0;
    if(threat&&!p.guardBroken&&p.y===0){input.guard=true;input.move=0;}
    else if(p.guardBroken&&threat){input.move=-toward;}
    else strike();
  }else if(kind==='spacing'){
    const desired=p.character==='wolf'?2.3:p.character==='lion'?1.95:1.4;
    input.move=distance<desired-.15?-toward:distance>desired+.15?toward:0;
    if(canPulse&&p.energy>=40&&p.cooldown===0&&distance<=s.ATTACKS[p.character].reach+(p.character==='lion'?.6:0)){
      input.special=true;pulseAfter=m.fightTicks+delay*2;
    }
  }else if(kind==='jump'){
    input.move=distance>.92?toward:0;
    const contactY=Math.max(0,p.y+p.vy*.18-9*.18*.18);
    if(canPulse&&jumpPending&&(p.y===0||(p.vy<0&&Math.abs(contactY-o.y)<.9))){strike();if(input.attack)jumpPending=false;}
    else if(canPulse&&!jumpPending&&p.y===0){input.jump=true;jumpPending=true;pulseAfter=m.fightTicks+delay*2;}
  }
  return {...input};
 };
}
function run(chars,kinds,spacing,period=6,offset=3,swap=false,trace=false){
 const m=s.createMatch(chars,1);m.phase='fight';
 m.players.forEach((p,i)=>{p.x=(i?1:-1)*spacing/2;p.z=0;p.action='fight_idle';p.raceStatus='finished';p.finishTime=70;p.raceProgress=s.COURSE_LENGTH;});
 const controls=[policy(kinds[0],0,period,swap?offset:0),policy(kinds[1],1,period,swap?0:offset)];
 const stunned=[0,0],maxStun=[0,0],counts=[{attack:0,special:0,hit:0,block:0,break:0},{attack:0,special:0,hit:0,block:0,break:0}];
 let last=0;const events=[];
 while(m.phase==='fight'){
   const inputs=controls.map(p=>p(m));
   if(inputs.some(p=>!Number.isFinite(p.move)||Math.abs(p.move)>1))throw new Error('Illegal input');
   s.stepMatch(m,inputs,s.FIXED_DT);
   m.players.forEach((p,i)=>{stunned[i]=p.stun>0?stunned[i]+1:0;maxStun[i]=Math.max(maxStun[i],stunned[i]);});
   for(const e of m.events.filter(e=>e.id>last)){
    if(e.slot>=0){if(['attack','special','hit','block'].includes(e.type))counts[e.slot][e.type]++;if(e.type==='guard-break')counts[e.slot].break++;}
    if(trace&&['hit','block','guard-break','special'].includes(e.type))events.push({t:+m.fightTime.toFixed(3),type:e.type,slot:e.slot,hp:m.players.map(p=>p.hp),x:m.players.map(p=>+p.x.toFixed(2)),y:m.players.map(p=>+p.y.toFixed(2))});
    last=e.id;
   }
 }
 return {chars,kinds,spacing,period,offset,swap,hp:m.players.map(p=>p.hp),winner:m.players[0].hp===m.players[1].hp?null:m.players[0].hp>m.players[1].hp?0:1,time:+m.fightTime.toFixed(3),end:m.fightEnd,maxStun:maxStun.map(n=>n/60),counts,...trace?{events}:{}};
}
const fixtures = [
  [['unicorn','wolf'], ['repeat','guardCounter'], 3.5, 6, 3, false],
  [['unicorn','wolf'], ['repeat','guardCounter'], 3.5, 0, 4, false],
  [['lion','wolf'], ['guardCounter','balanced'], 6, 6, 3, true],
  [['lion','unicorn'], ['repeat','jump'], 2.2, 12, 7, false],
  [['lion','lion'], ['jump','repeat'], 1.1, 0, 4, false],
];
console.log('source-sha256', crypto.createHash('sha256').update(source).digest('hex'));
for (const fixture of fixtures) console.log(JSON.stringify(run(...fixture)));
```


## Historical Cycle6 contact investigation and role-symmetry repair

This investigation began at `f5cd5e6`. At the end of this investigation contact geometry was **unadopted**: the simulation still had 0.85m separation and its original move reaches/CPU spacing. The later integration below supersedes that state. The separate confirmed role-symmetry defect below was repaired with authorization. Final repaired source SHA-256: `3b016d1978db2a2e7dd6a61002ae7078d8f4413aaa5035b62a6c679329d54306`.

A legal Lion jump-pressure versus Lion mixed-policy fixture exposed sequential-facing bias. Starting 2.2m apart with 100ms decisions and the mixed policy offset by three ticks, slot 0's jumper lost with the rival at 55HP after 10.15s. Reversing both roles and spatial directions instead left the rival at 45HP after 9.75s: a 2.5-point fight-pool discrepancy. On frame31, a Lion lunge crossed the airborne jumper while the jumper started a strike; the second slot saw an already-moved rival and committed the opposite facing. Taking both X coordinates before processing either fighter restores mirrored results: 55HP and 10.15s in both roles. Existing strikes retain their original committed facing, and idle auto-facing resumes after recovery, so airborne cross-up counterplay remains available.

The related exact-X landing rule also assigned slot0 the left side. A descending fighter beginning at y=.7 and shared X crossed into the body exclusion band on the next gravity step, producing a .85m position error under reflection/slot swap. Its tie fallback now uses prior opposing orientation, or the higher fighter's orientation when both headings agree. Three regression tests cover the legal jump/lunge input trace, preserved facing at exact-X attack startup, and landing reflection/slot swaps with opposing and matching headings. Each regression failed against its defective predecessor. All38 simulation tests and file-level ESLint pass. This does not claim that arbitrarily injected fully identical overlapping body states have a unique physical ordering.

### Temporary geometry recommendation

Recommend a rendered experiment with **1.75m** separation, normal reach1.90m, Lion2.10m, Unicorn1.95m, Wolf2.75m, CPU pursuit threshold1.80m and normal-attack trigger1.85m. Collision half-spacing must be .875m and its center clamp must be ±3.525m, retaining individual arena bounds ±4.4m. Keeping the old center clamp pushes a corner fighter to4.43m on the first forward step; the audit's bounds oracle correctly rejects that negative control. Keeping the old CPU attack trigger1.45m would make normal attacks impossible at the proposed body spacing. The unused-on-ground close retreat threshold .95m can remain unchanged; it still applies to close airborne cross-ups. All move timing, damage, energy, guard, score and beginner CPU pacing remain unchanged in these copies.

The isolated asset candidate's actual skinned GLB measurements in `assets/source/western/contact-v2/contact-comparison.json` put the normal-contact head maxima at Lion.647m, Wolf.769m and Unicorn.811m. The largest two-head envelope leaves about .078m at1.70 separation or .128m at1.75; this motivates the extra .05m. It does **not** establish a mesh intersection or a strike contact. Idle head maxima are .562/.670/.730m, guard .597/.710/.763m, and measured special poses .688/.653/.743m. Region bounds include vertices with at least50% influence from the named bones; normal contact was swept at120Hz over .18–.28s. Unicorn's paw is lower than the other strikes, at Y1.207–1.458m, so adding forward head/paw extrema overstates what can be concluded about actual contact. Its special paw reaches only .849m: adopting the proposed1.95m range needs the root's proposed visible short prism pulse during the active window, rather than a claim that this hoof pose reaches the opponent. At this historical checkpoint the canonical move description was unchanged pending integration.

### Bounded comparison

Each geometry ran1,728 legal-input policy matches across all9 ordered species pairings, both policy roles, starting gaps1.8/2.2/3.5/6m and three decision schedules (100ms,+3ticks;200ms,+7ticks;83–200ms deterministic jitter,+4ticks). Approach/strike thresholds were adjusted relative to each copy's normal reach, so widening the bodies did not disable the audit's own attacks. The same policies from the earlier audit were used; no state was changed after scenario setup. Each geometry also ran288 exact mirrored-role pairs,108 center/left-wall/right-wall policy scenarios, and27 fight-only CPU scenarios (idle player, repeat-strike player and CPU/CPU across9 matchups).

| First policy / opponent | Original geometry, wins/ties/losses | 1.70m candidate | 1.75m candidate |
|---|---:|---:|---:|
| Repeat / guard-counter |9/0/207|9/0/207|0/0/216|
| Repeat / whiff-punish |45/0/171|105/6/105|99/0/117|
| Repeat / spaced special |216/0/0|216/0/0|216/0/0|
| Jump / repeat |36/0/180|54/0/162|90/18/108|
| Jump / guard-counter |18/0/198|27/0/189|27/0/189|
| Jump / spaced special |216/0/0|216/0/0|216/0/0|
| Guard-counter / mixed |99/9/108|90/0/126|144/0/72|
| Jump / mixed |9/0/207|18/0/198|18/0/198|

Both candidates retain concrete answers to repeated strike, jump pressure, spaced specials and guard-counter; these aggregate scripted outcomes are not player balance rankings. After the facing repair, all288 mirrored pairs per geometry had reversed health and identical duration. Every checked near-ground separation and arena bound held within1e-9m; maximum continuous stun remained23ticks (.383s). Idle versus CPU ended at10.35–11.40s with original geometry and10.35–11.85s with either candidate. All these fight-only fixtures kept the1.5s opening grace and at least1.2s between CPU attack starts. Active repeat strikes beat Lion/Wolf CPU while receiving retaliation, and lost narrowly to Unicorn in this particular cadence; this is evidence of ordinary counterplay, not universal ease. A separate27 full CPU championships per geometry (9 pairings×seeds1/47/2026) all finished, no DNF, with damage: maximum race59.683s and fights11.4–16.2s in all copies.

The data support the stated candidate for a visual experiment. They do not certify human fun, touch usability, exact mesh contact, all possible strategies, or special-effect agreement. Source/attachment and normal-control rendered review remain required before adopting the contact geometry.

## Adopted Cycle6 contact geometry

Root accepted the v2b attachment/pose review and 1.75m body spacing after viewing all nine ordered runtime pairings. A subsequent boundary-pose review found a small gap at the beginning of Unicorn's common strike at1.90m, so the final common reach is **1.85m** and the CPU's strike trigger is **1.82m**. Pursuit remains1.80m, and Lion/Wolf/Unicorn special reaches are2.10/2.75/1.95m. The center clamp is±3.525m with .875m half-spacing. This supersedes the temporary1.90m recommendation above. Startup, active and recovery durations, damage, guard, energy, movement, beginner CPU pacing and scoring are unchanged. Unicorn's shared character description now specifies frontal protection followed by a short prism pulse; its normal attack remains a hoof strike.

Final adopted source SHA-256: `63239026494e2e3bf2b53e6988df294f75f3afa25458978537c4bd431f6d925b`. The final current-source audit runs1,728 policy matches across all9 ordered matchups, both roles and all four starting gaps,288 mirrored pairs,108 center/wall scenarios,27 fight-only CPU scenarios and27 complete CPU championships. All bounds and symmetry checks pass; every CPU championship finishes without DNF and produces combat damage. Race maximum is59.683s; full-CPU fights span11.4–16.2s. Idle fight-only CPU KOs remain10.35–11.85s; the existing full-flow Unicorn/Lion seed6827 fixture remains10.20s. All preserve the1.5s opening grace and1.2s minimum CPU attack interval.

| First policy / opponent | Final1.85m reach wins / ties / losses |
|---|---:|
| Repeat / guard-counter |0 / 0 / 216|
| Repeat / whiff-punish |108 / 0 / 108|
| Repeat / spaced special |216 / 0 / 0|
| Jump / repeat |72 / 18 / 126|
| Jump / guard-counter |27 / 0 / 189|
| Jump / spaced special |216 / 0 / 0|
| Guard-counter / mixed |138 / 0 / 78|
| Jump / mixed |24 / 0 / 192|

Maximum continuous stun remains23ticks. The conservative range therefore retains the exercised counters without altering combat timings. The audit's jump approach threshold stays inside its own strike threshold to avoid an artificial gap that could make a scripted jumper stop moving before it can strike. These results still do not establish human enjoyment or universal optimal play.

All40 tests pass, including the preserved role-symmetry regressions and two new tests that check just-inside/just-outside attack/special reach for every matchup and role, plus sustained arena-edge pressure. Existing close-combat setup uses legal1.75m spacing. The broken-guard regression now uses ordinary forward input to close the small block pushback before its second strike; its damage/recovery assertions are unchanged. Both the historical4ed5042 program and this current-source reproducer remain runnable; historical results are not silently attributed to the new rules.

### Current reproducer and historical geometry comparison

Run this CommonJS program from the repository root (for example save it to a temporary `.cjs` file). It reuses the preceding policy functions, reads the current canonical source and defaults to the adopted geometry without source patches. Named comparison profiles change source copies in memory using move-specific numeric patterns, so they do not depend on obsolete literal reach values. `build`, `setup`, `check` and `audit` are exported for targeted follow-up fixtures. The program includes the 1,728-match matrix, mirror checks, wall scenarios, fight-only CPU fixtures and 27 full CPU championships. It rejects missing counters, mirrored outcome differences, broken bounds and incomplete championships. Geometry copies are not written to the repository.

```js
const fs=require('node:fs'), ts=require(process.cwd()+'/node_modules/typescript'),crypto=require('node:crypto');
const canonical=fs.readFileSync('src/championship/simulation.ts','utf8');
const doc=fs.readFileSync('docs/production/SIMULATION.md','utf8');
const original=[...doc.matchAll(/^```js\n([\s\S]*?)^```$/gm)][0][1].split('const fixtures = [')[0];
function build(name='current'){
 const profiles={originalGeometry:{min:.85,normal:1.5,lion:1.75,unicorn:1.65,pursuit:1.25,trigger:1.45},spacing1_70:{min:1.7,normal:1.9,lion:2.1,unicorn:1.95,pursuit:1.8,trigger:1.85},previous1_90:{min:1.75,normal:1.9,lion:2.1,unicorn:1.95,pursuit:1.8,trigger:1.85}};
 if(name!=='current'&&!profiles[name])throw new Error('Unknown geometry '+name);
 const profile=profiles[name],min=profile?.min??1.75;let source=canonical;
 const replace=(pattern,replacement)=>{if(!pattern.test(source))throw new Error('Missing pattern '+pattern);source=source.replace(pattern,replacement);};
 if(profile){
  for(const [move,reach]of Object.entries({attack:profile.normal,lion:profile.lion,unicorn:profile.unicorn}))replace(new RegExp('(^  '+move+': \\{[^\\n]*?reach: )[\\d.]+','m'),(_,prefix)=>prefix+reach);
  replace(/initialOrder < [\d.]+/,'initialOrder < '+min);
  replace(/const center = clamp\(\(match.players\[0\].x \+ match.players\[1\].x\) \/ 2, -[\d.]+, [\d.]+\);/,`const center = clamp((match.players[0].x + match.players[1].x) / 2, ${-(4.4-min/2)}, ${4.4-min/2});`);
  replace(/center - [\d.]+ \* initialOrder; match.players\[1\].x = center \+ [\d.]+ \* initialOrder/,`center - ${min/2} * initialOrder; match.players[1].x = center + ${min/2} * initialOrder`);
  replace(/input.move = distance > [\d.]+ \? toward/,'input.move = distance > '+profile.pursuit+' ? toward');
  replace(/input.attack = !input.special && distance <= [\d.]+;/,'input.attack = !input.special && distance <= '+profile.trigger+';');
 }
 let harness=original.slice(original.indexOf('const clamp='));
 harness=harness.replaceAll('distance<=1.45','distance<=s.ATTACKS.attack.reach-.05')
 .replaceAll('distance>1.65','distance>s.ATTACKS.attack.reach+.15').replaceAll('distance<1.48','distance<s.ATTACKS.attack.reach-.02')
 .replaceAll('distance>1.2','distance>s.ATTACKS.attack.reach-.3').replaceAll('distance>1.5','distance>s.ATTACKS.attack.reach')
 .replaceAll('distance>1.08','distance>s.ATTACKS.attack.reach-.42').replaceAll('distance>1.1','distance>s.ATTACKS.attack.reach-.4')
 .replaceAll("p.character==='lion'?1.95:1.4","p.character==='lion'?s.ATTACKS.lion.reach+.2:s.ATTACKS.unicorn.reach-.25")
 .replaceAll('distance>.92','distance>Math.min(min+.07,s.ATTACKS.attack.reach-.06)');
 const mod={exports:{}};new Function('module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(mod,mod.exports);
 const s=mod.exports;
 const {policy,run}=new Function('s','min',harness+';return {policy,run};')(s,min);
 return {s,policy,run,source,min,name};
}
function setup(s,chars,gap,center=0){const m=s.createMatch(chars,6827);m.phase='fight';m.players.forEach((p,i)=>{p.x=center+(i?1:-1)*gap/2;p.z=0;p.action='fight_idle';p.raceStatus='finished';p.finishTime=70;p.raceProgress=s.COURSE_LENGTH;});return m;}
function check(m,min,out){
 for(const p of m.players)if(!Number.isFinite(p.x)||Math.abs(p.x)>4.4+1e-9||!Number.isFinite(p.hp)||p.hp<0||p.hp>100)throw new Error('Bounds '+JSON.stringify(m.players));
 if(Math.abs(m.players[0].y-m.players[1].y)<.7&&Math.abs(m.players[0].x-m.players[1].x)<min-1e-9)throw new Error('Separation '+JSON.stringify(m.players));
 out.minGap=Math.min(out.minGap,...Math.abs(m.players[0].y-m.players[1].y)<.7?[Math.abs(m.players[0].x-m.players[1].x)]:[]);
}
const species=['lion','wolf','unicorn'], pairs=[['repeat','guardCounter'],['repeat','whiff'],['repeat','spacing'],['jump','repeat'],['jump','guardCounter'],['jump','spacing'],['guardCounter','balanced'],['jump','balanced']];
function audit(v){
 const result={name:v.name,sourceHash:crypto.createHash('sha256').update(v.source).digest('hex'),matches:0,counts:{},minGap:Infinity,maxStun:0,mirrorPairs:0,mirrorMismatches:[],cpu:{idle:[],repeat:[],full:[]},edgeCases:0};
 const {s,run,policy,min}=v;
 for(const a of species)for(const b of species)for(const gap of [1.8,2.2,3.5,6])for(const timing of [[6,3],[12,7],[0,4]])for(const kinds of pairs)for(const swap of [false,true]){
  const r=run([a,b],swap?[...kinds].reverse():kinds,gap,...timing,swap); const subject=swap?1:0;
  const key=kinds.join('/'),count=result.counts[key]??=[0,0,0];count[r.winner===null?1:r.winner===subject?0:2]++;result.matches++;
  result.maxStun=Math.max(result.maxStun,...r.maxStun);
 }
 for(const a of species)for(const b of species)for(const gap of [1.8,2.2,3.5,6])for(const kinds of pairs){
  const p=run([a,b],kinds,gap,6,3,false),q=run([b,a],[...kinds].reverse(),gap,6,3,true);
  if(p.hp[0]!==q.hp[1]||p.hp[1]!==q.hp[0]||p.time!==q.time)result.mirrorMismatches.push({p,q});result.mirrorPairs++;
 }
 for(const a of species)for(const b of species)for(const side of [-1,0,1])for(const kind of ['repeat','guardCounter','jump','spacing']){
  const m=setup(s,[a,b],min,side*(4.4-min/2));const controls=[policy(kind,0,6,0),policy('balanced',1,6,3)];
  while(m.phase==='fight'){s.stepMatch(m,controls.map(f=>f(m)),s.FIXED_DT);check(m,min,result);}result.edgeCases++;
 }
 for(const a of species)for(const b of species)for(const mode of ['idle','repeat','full']){
  const m=setup(s,[a,b],3.5),human=policy('repeat',0,6,0);let last=0,attacks=[0,0],first=null,minAttackGap=Infinity,lastAttack=[null,null];
  while(m.phase==='fight'){
   const inputs=[mode==='full'?s.cpuInput(m,0):mode==='repeat'?human(m):s.neutralInput(),s.cpuInput(m,1)];s.stepMatch(m,inputs,s.FIXED_DT);check(m,min,result);
   for(const e of m.events.filter(e=>e.id>last)){if((e.type==='attack'||e.type==='special')&&e.slot>=0){attacks[e.slot]++;if(e.slot===1&&first===null)first=m.fightTime;if(lastAttack[e.slot]!==null&& (mode==='full'||e.slot===1))minAttackGap=Math.min(minAttackGap,m.fightTime-lastAttack[e.slot]);lastAttack[e.slot]=m.fightTime;}last=e.id;}
  }
  if(first<1.5-1e-9||minAttackGap<1.2-1e-9)throw new Error('CPU pacing changed');
  result.cpu[mode].push({a,b,hp:m.players.map(p=>p.hp),time:+m.fightTime.toFixed(3),attacks,first:+first.toFixed(3),minAttackGap:+minAttackGap.toFixed(3)});
 }
 if(result.mirrorMismatches.length)throw new Error('Mirrored role outcome differs');
 for(const [pair,index]of [['repeat/guardCounter',2],['repeat/spacing',0],['jump/guardCounter',2],['guardCounter/balanced',2]])if(result.counts[pair][index]===0)throw new Error('Missing exercised counter '+pair);
 result.championships={count:0,maxRace:0,minFight:60,maxFight:0};
 for(const a of species)for(const b of species)for(const seed of [1,47,2026]){
  const m=s.createMatch([a,b],seed);for(let tick=0;tick<10000&&m.phase!=='results';tick++){s.stepMatch(m,[s.cpuInput(m,0),s.cpuInput(m,1)],s.FIXED_DT);if(m.phase==='fight')check(m,min,result);}
  if(m.phase!=='results'||m.players.some(p=>p.raceStatus!=='finished')||m.players.every(p=>p.hp===100))throw new Error('Incomplete CPU championship');
  const c=result.championships;c.count++;c.maxRace=Math.max(c.maxRace,m.raceTime);c.minFight=Math.min(c.minFight,m.fightTime);c.maxFight=Math.max(c.maxFight,m.fightTime);
 }
 return result;
}
if(require.main===module){for(const name of ['current','previous1_90','originalGeometry'])console.log(JSON.stringify(audit(build(name))));}
module.exports={build,setup,check,audit};
```
