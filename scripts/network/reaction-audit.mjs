/** Offline reaction/fairness audit. Fixed injected transit; no browser or service. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = new URL('../../', import.meta.url);
assert.ok(process.argv.slice(2).every(arg => arg === '--event-driven'), 'unknown reaction audit option');
const compareEventDriven = process.argv.includes('--event-driven');
const paths = ['simulation', 'course', 'input-buffer', 'presentation', 'prediction'].map(name => `src/championship/${name}.ts`);
const hash = value => createHash('sha256').update(value).digest('hex');
const sourceHashes = Object.fromEntries(await Promise.all(paths.map(async path => [path, hash(await readFile(new URL(path, root)))])));
const harnessSha256 = hash(await readFile(fileURLToPath(import.meta.url)));
const bundle = await build({ stdin: { contents: paths.map(path => `export * from './${path}';`).join('\n'), resolveDir: fileURLToPath(root) }, bundle: true, write: false, platform: 'node', format: 'cjs' });
const module = { exports: {} }; new Function('module', 'exports', bundle.outputFiles[0].text)(module, module.exports);
const { createMatch, stepMatch, neutralInput, ATTACKS, DODGE, FIGHT_BODY_GAP, InputSender, InputReceiver, INPUT_MAX_AGE_TICKS, PresentationBuffer, GuestPrediction, strikePhase } = module.exports;
const species = ['lion', 'wolf', 'unicorn'];
const frameMs = 1000 / 60, durationMs = 2800, reactionMs = 300;
const rounded = n => n === null ? null : Math.round(n * 100) / 100;

function run(config, defend = true, forceExpiry = false) {
  const { attacker, defender, defenderRole, oneWayMs, sendHz, eventDriven = false } = config;
  const defenderSlot = defenderRole === 'host' ? 0 : 1, attackerSlot = 1 - defenderSlot;
  const characters = defenderSlot === 0 ? [defender, attacker] : [attacker, defender];
  const host = createMatch(characters, 233);
  host.phase = 'fight'; host.tick = 120;
  host.players.forEach((p, slot) => { p.x = (slot === 0 ? -1 : 1) * FIGHT_BODY_GAP / 2; p.action = 'fight_idle'; });
  let canonical = structuredClone(host), now = 0, order = 0, operations = 0, peakQueue = 0, eventId = 0;
  const queue = [], schedule = (at, fn) => { queue.push({ at, fn, order: order++ }); queue.sort((a, b) => a.at - b.at || a.order - b.order); peakQueue = Math.max(peakQueue, queue.length); };
  const senders = [new InputSender(), new InputSender()], receivers = [new InputReceiver(), new InputReceiver()];
  const held = [neutralInput(), neutralInput()];
  const presentation = new PresentationBuffer(), prediction = new GuestPrediction(1);
  presentation.push(canonical, 0); prediction.reset('reaction'); prediction.observe('reaction', canonical, 0);
  const times = { strikeAt: null, cueAt: null, pressedAt: null, inputArrivedAt: null, deliveredToSimulationAt: null, evadeAt: null, hitAt: null, successAt: null, predictedEvadeAt: null };
  let sourceTick = null, receiverAgeTicks = null, consumedAgeTicks = null, authoritativeTickAtPress = null, firstPacket = false, droppedInputs = 0;
  let inputPacketsSent = 0, snapshotPacketsSent = 0, lastSnapshotSentAt = -Infinity;
  function sendGuestInput() {
    const packet = senders[1].packet(canonical.tick); inputPacketsSent++;
    if (forceExpiry && times.pressedAt !== null && now < times.pressedAt + 700) droppedInputs++;
    else schedule(now + oneWayMs, () => accept(1, packet));
  }
  function controls(slot, patch) {
    held[slot] = { ...held[slot], ...patch };
    const tick = slot === 0 ? host.tick : canonical.tick;
    senders[slot].update(held[slot], tick);
    if (slot === 1) prediction.updateInput(held[slot], now);
    if (slot === defenderSlot && patch.jump === true) {
      times.pressedAt = now; sourceTick = tick; authoritativeTickAtPress = host.tick;
    }
    if (slot === 1 && eventDriven) sendGuestInput();
  }
  function cue(view) {
    if (times.cueAt !== null || view.players[attackerSlot].action !== 'attack') return;
    assert.equal(strikePhase(view.players[attackerSlot]), 'windup', 'first observed strike is still its windup');
    times.cueAt = now;
    if (defend) {
      schedule(now + reactionMs, () => controls(defenderSlot, { jump: true }));
      schedule(now + reactionMs + 20, () => controls(defenderSlot, { jump: false }));
    }
  }
  function accept(slot, packet) {
    if (slot === defenderSlot && packet.presses.jump.length && !firstPacket) {
      firstPacket = true; times.inputArrivedAt = now;
      receiverAgeTicks = host.tick - packet.presses.jump[0].tick;
      assert.equal(packet.presses.jump[0].tick, sourceTick, 'retransmission preserves original source tick');
    }
    receivers[slot].accept(packet, host.tick);
  }
  function receiverTick(slot) {
    const input = receivers[slot].tick(host.tick);
    if (slot === defenderSlot && input.jump && times.deliveredToSimulationAt === null) {
      times.deliveredToSimulationAt = now; consumedAgeTicks = host.tick - sourceTick;
    }
    return input;
  }
  function hostFrame(frame) {
    accept(0, senders[0].packet(host.tick));
    stepMatch(host, [receiverTick(0), receiverTick(1)], 1 / 60);
    let combatEvent = false;
    for (const event of host.events) if (event.id > eventId) {
      if (['attack', 'counter', 'evade', 'hit'].includes(event.type)) combatEvent = true;
      if (event.type === 'attack' && event.slot === attackerSlot) times.strikeAt ??= now;
      if (event.type === 'evade' && event.slot === defenderSlot) times.evadeAt ??= now;
      if (event.type === 'hit' && event.slot === defenderSlot) times.hitAt ??= now;
      if (event.type === 'evade-success' && event.slot === defenderSlot) times.successAt ??= now;
      eventId = event.id;
    }
    if (defenderSlot === 0) cue(host);
    const cadenceDue = eventDriven ? now - lastSnapshotSentAt + 1e-7 >= 1000 / sendHz : frame % (60 / sendHz) === 0;
    if (cadenceDue || (eventDriven && combatEvent)) {
      lastSnapshotSentAt = now; snapshotPacketsSent++;
      const snapshot = structuredClone(host);
      schedule(now + oneWayMs, () => {
        canonical = snapshot; presentation.push(snapshot, now); prediction.observe('reaction', snapshot, now);
      });
    }
    if (now + frameMs <= durationMs) schedule(now + frameMs, () => hostFrame(frame + 1));
  }
  function guestFrame(frame) {
    if (frame % (60 / sendHz) === 0) sendGuestInput();
    const baseline = presentation.sample(now, sendHz === 30 ? 50 : 120) ?? canonical;
    prediction.updateInput(held[1], now);
    const view = prediction.sample(baseline, now);
    if (defenderSlot === 1) {
      cue(baseline); // Rival windup must be received authority, never a speculative cue.
      if (times.pressedAt !== null && times.predictedEvadeAt === null && view.players[1].action === 'evade') times.predictedEvadeAt = now;
    }
    // Prediction may alter only the local visual fields; it is never fed to the host.
    const stripped = structuredClone(view);
    for (const field of ['x', 'y', 'action', 'actionTime']) stripped.players[1][field] = baseline.players[1][field];
    assert.deepEqual(stripped, baseline, 'visual feedback cannot change hit/health adjudication');
    if (now + frameMs <= durationMs) schedule(now + frameMs, () => guestFrame(frame + 1));
  }
  schedule(101, () => controls(attackerSlot, { attack: true }));
  schedule(121, () => controls(attackerSlot, { attack: false }));
  schedule(0, () => hostFrame(0)); schedule(frameMs / 2, () => guestFrame(0));
  while (queue.length && queue[0].at <= durationMs) {
    const event = queue.shift(); now = event.at; assert.ok(++operations < 1000, 'bounded schedule'); event.fn();
  }
  assert.notEqual(times.strikeAt, null, 'strike really executes');
  assert.notEqual(times.cueAt, null, 'defender really receives the strike windup');
  const damageTaken = 100 - host.players[defenderSlot].hp;
  if (!defend) { assert.equal(damageTaken, ATTACKS[attacker].damage, 'no-defense positive control must hit'); assert.equal(times.evadeAt, null); }
  else { assert.notEqual(times.pressedAt, null); assert.notEqual(times.inputArrivedAt, null); }
  const packetFreshAtReceiver = receiverAgeTicks === null ? null : receiverAgeTicks <= INPUT_MAX_AGE_TICKS;
  if (defend && !packetFreshAtReceiver) {
    assert.equal(times.deliveredToSimulationAt, null, 'expired source cannot become a later action');
    assert.equal(times.evadeAt, null, 'expired source cannot evade after loss');
  }
  assert.ok(Buffer.byteLength(JSON.stringify(prediction)) < 2000, 'bounded visual state');
  assert.ok(host.events.length <= 48 && presentation.frames.length <= 8, 'bounded authority/presentation history');
  const classification = !defend ? 'no-defense-control' : !packetFreshAtReceiver ? 'expired-before-receiver'
    : times.deliveredToSimulationAt === null ? 'fresh-at-receiver-expired-before-tick'
    : damageTaken > 0 ? 'fresh-input-delivered-but-damage-taken' : 'fresh-input-delivered-damage-avoided';
  return {
    ...config, eventDriven, defend, forceExpiry, classification, windupMs: ATTACKS[attacker].windup * 1000,
    dodgeStartMs: DODGE[defender].invulnerableStart * 1000,
    timesMs: Object.fromEntries(Object.entries(times).map(([key, value]) => [key, rounded(value)])),
    receivedCueAfterStrikeMs: rounded(times.cueAt - times.strikeAt),
    pressAfterStrikeMs: times.pressedAt === null ? null : rounded(times.pressedAt - times.strikeAt),
    inputAfterStrikeMs: times.inputArrivedAt === null ? null : rounded(times.inputArrivedAt - times.strikeAt),
    visualFeedbackAfterPressMs: times.predictedEvadeAt === null ? null : rounded(times.predictedEvadeAt - times.pressedAt),
    sourceTick, authoritativeTickAtPress,
    sourceSnapshotAgeAtPressTicks: sourceTick === null ? null : authoritativeTickAtPress - sourceTick,
    receiverAgeTicks, consumedAgeTicks, packetFreshAtReceiver,
    evadeExecuted: times.evadeAt !== null, damageTaken,
    hitBeforeInputArrival: times.hitAt !== null && times.inputArrivedAt !== null && times.hitAt < times.inputArrivedAt,
    droppedInputs, inputPacketsSent, snapshotPacketsSent, operations, peakQueue,
  };
}

const modes = compareEventDriven ? [false, true] : [false];
const cases = modes.flatMap(eventDriven => [30, 10].flatMap(sendHz => [50, 100, 200].flatMap(oneWayMs => ['host', 'guest'].flatMap(defenderRole => species.flatMap(attacker => species.map(defender => ({ attacker, defender, defenderRole, oneWayMs, sendHz, eventDriven })))))));
const results = cases.map(config => run(config));
const controls = cases.map(config => run(config, false));
const expiredControl = run({ attacker: 'lion', defender: 'wolf', defenderRole: 'guest', oneWayMs: 200, sendHz: 10 }, true, true);
assert.equal(expiredControl.classification, 'expired-before-receiver', 'loss control exercises original-source expiry');
const expiredEventControl = compareEventDriven ? run({ attacker: 'lion', defender: 'wolf', defenderRole: 'guest', oneWayMs: 200, sendHz: 10, eventDriven: true }, true, true) : null;
if (expiredEventControl) assert.equal(expiredEventControl.classification, 'expired-before-receiver', 'urgent input cannot revive expired intent');
assert.ok(results.some(r => r.defenderRole === 'guest' && r.damageTaken > 0 && r.packetFreshAtReceiver), 'fixture exposes fresh-but-too-late guest defense');
assert.ok(results.some(r => r.defenderRole === 'host' && r.damageTaken === 0), 'same reaction can succeed on authority');
const range = values => [Math.min(...values), Math.max(...values)];
const summaries = modes.flatMap(eventDriven => [30, 10].flatMap(sendHz => [50, 100, 200].flatMap(oneWayMs => ['host', 'guest'].map(defenderRole => {
  const rows = results.filter(r => r.eventDriven === eventDriven && r.sendHz === sendHz && r.oneWayMs === oneWayMs && r.defenderRole === defenderRole);
  return { eventDriven, sendHz, oneWayMs, defenderRole, cases: rows.length,
    damageAvoided: rows.filter(r => r.damageTaken === 0).length, damageTaken: rows.filter(r => r.damageTaken > 0).length,
    expiredAtReceiver: rows.filter(r => !r.packetFreshAtReceiver).length,
    freshDeliveredWithDamage: rows.filter(r => r.classification === 'fresh-input-delivered-but-damage-taken').length,
    evadeExecuted: rows.filter(r => r.evadeExecuted).length,
    hitBeforeInputArrival: rows.filter(r => r.hitBeforeInputArrival).length,
    evadeExecutedAfterHit: rows.filter(r => r.evadeExecuted && r.timesMs.hitAt !== null && r.timesMs.evadeAt > r.timesMs.hitAt).length,
    cueAfterStrikeMs: range(rows.map(r => r.receivedCueAfterStrikeMs)),
    inputAfterStrikeMs: range(rows.map(r => r.inputAfterStrikeMs)),
    sourceAgeAtReceiverTicks: range(rows.map(r => r.receiverAgeTicks)),
  };
}))));
const boundarySamples = [];
if (compareEventDriven) {
  // Fixed-grid observations, not a universal maximum playable delay. Scheduling
  // phase, species, jitter, counter strikes and real display lag can move it.
  for (const sendHz of [30, 10]) for (let oneWayMs = 50; oneWayMs <= 200; oneWayMs += 10) {
    const rows = species.flatMap(attacker => species.map(defender => run({ attacker, defender, defenderRole: 'guest', oneWayMs, sendHz, eventDriven: true })));
    boundarySamples.push({ sendHz, oneWayMs, damageAvoided: rows.filter(r => r.damageTaken === 0).length, cases: rows.length });
  }
  assert.ok(results.filter(row => row.eventDriven && row.defenderRole === 'guest' && row.oneWayMs === 100).every(row => row.damageTaken === 0), 'tested 100ms event delivery needs no windup adjustment');
  assert.ok(results.some(row => row.eventDriven && row.damageTaken === 0 && results.some(control => !control.eventDriven && control.attacker === row.attacker && control.defender === row.defender && control.defenderRole === row.defenderRole && control.sendHz === row.sendHz && control.oneWayMs === row.oneWayMs && control.damageTaken > 0)), 'event delivery must rescue at least one identical cadence-only case');
  assert.ok(results.some(row => row.eventDriven && row.oneWayMs === 200 && row.damageTaken > 0), 'remaining high-delay limitation remains visible');
}
for (const [path, expected] of Object.entries(sourceHashes)) assert.equal(hash(await readFile(new URL(path, root))), expected, `source changed during audit: ${path}`);
const report = {
  classification: 'OFFLINE SYNTHETIC REACTION TIMINGS. Injected one-way delays; not internet, phone, browser, display or human measurements.',
  boundary: 'Actual simulation/input buffers/presentation/prediction, ideal 60Hz callbacks and 30/10Hz sends. 300ms reaction starts at first rendered authoritative windup. Host and guest scheduling are modeled, not extracted React callbacks. No loss/jitter in primary cases. Neither role moves before evade; normal strikes only, no counter strikes.',
  conclusion: 'Immediate local pose is feedback only. A fresh input can reach authority after a committed hit; prediction cannot protect health or equalize host/guest reaction budgets.',
  sourceHashes, harnessSha256, durationMs, reactionMs, inputMaxAgeTicks: INPUT_MAX_AGE_TICKS,
  policy: 'Event mode sends guest input on every control change, retains input heartbeat, and sends at most one host snapshot per frame after a new attack/counter/evade/hit, resetting its snapshot cadence. Cadence-only mode is the preserved negative control. The production callback audit verifies actual integration separately.',
  tellMarginBoundary: 'The tested 100ms one-way event cases avoid damage with unchanged production windups. No windup adjustment or counterfactual physics was applied. The delay grid records only fixed scheduling phase, not a universal playable threshold.',
  totalPrimaryCases: results.length, totalNoDefenseControls: controls.length,
  summaries, results, expiredControl, expiredEventControl, controls, boundarySamples,
};
const artifact = compareEventDriven ? './reaction-audit-event-driven-result.json' : './reaction-audit-cadence-control-result.json';
await writeFile(new URL(artifact, import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ summaries, expiredControl, expiredEventControl, boundarySamples }, null, 2));
console.log(compareEventDriven ? 'LOCAL EVENT-DRIVEN REACTION AUDIT VERIFIED' : 'LOCAL REACTION AUDIT VERIFIED');
