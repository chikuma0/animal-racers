/** Offline, deterministic model-to-render measurements. No browser or service. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = new URL('../../', import.meta.url);
const paths = ['prediction', 'presentation', 'input-buffer', 'simulation', 'course'].map(name => `src/championship/${name}.ts`);
const hash = value => createHash('sha256').update(value).digest('hex');
const sources = Object.fromEntries(await Promise.all(paths.map(async path => [path, hash(await readFile(new URL(path, root)))])));
const bundle = await build({ stdin: { contents: paths.map(path => `export * from './${path}';`).join('\n'), resolveDir: fileURLToPath(root) }, bundle: true, write: false, platform: 'node', format: 'cjs' });
const module = { exports: {} }; new Function('module', 'exports', bundle.outputFiles[0].text)(module, module.exports);
const { GuestPrediction, PresentationBuffer, InputSender, InputReceiver, createMatch, neutralInput, stepMatch, PREDICTION_LIMITS } = module.exports;
const ms = n => n === null ? null : Math.round(n * 100) / 100;
const duration = 2800;
const profiles = [
  { name: 'near-zero-direct-injected', hz: 30, delays: [1], presentationDelay: 50 },
  { name: 'direct-jitter-loss-reorder-injected', hz: 30, delays: [2, 70, 4, 120, 3, 8], presentationDelay: 50, lossEvery: 13 },
  { name: 'slow-broadcast-injected', hz: 10, delays: [82, 88, 120, 250, 90, 150], presentationDelay: 120, lossEvery: 17 },
  { name: 'input-loss-until-900ms-injected', hz: 30, delays: [1], presentationDelay: 50, dropInputUntil: 900 },
  { name: 'snapshot-loss-and-disconnect-injected', hz: 30, delays: [1], presentationDelay: 50, blackout: [100, 1800], disconnectAt: 800 },
];

function run(profile, phase, predictionEnabled = true) {
  let now = 0, id = 0, operations = 0, peakQueue = 0, packet = 0, drops = 0, reordered = 0, inputSeq = 0, snapshotSeq = 0, lastInput = 0, lastSnapshot = 0, disconnected = false;
  const queue = [], schedule = (at, fn) => { queue.push({ at, fn, id: id++ }); queue.sort((a, b) => a.at - b.at || a.id - b.id); peakQueue = Math.max(peakQueue, queue.length); };
  const host = createMatch(['lion', 'wolf'], 712);
  host.phase = phase; host.tick = 120;
  for (const [slot, p] of host.players.entries()) { p.x = slot === 0 ? -.875 : .875; p.action = phase === 'race' ? 'run' : 'fight_idle'; p.speed = phase === 'race' ? 8 : 0; }
  let canonical = structuredClone(host), held = neutralInput();
  const sender = new InputSender(), receiver = new InputReceiver(), presentation = new PresentationBuffer(), predictor = new GuestPrediction();
  predictor.reset('audit'); predictor.observe('audit', canonical, 0); presentation.push(canonical, 0);
  const inputs = phase === 'fight' ? [
    { key: 'attack', action: 'attack', at: 101 }, { key: 'jump', action: 'evade', at: 1901 },
  ] : [{ key: 'jump', action: 'jump', at: 401 }];
  const responses = inputs.map(row => ({ ...row, authorityAt: null, baselineAt: null, predictedAt: null }));
  let maxXOffset = 0, maxYOffset = 0, maxCorrectionStep = 0, previousX = null, unchangedFailures = 0, stalePreviewFrames = 0, correctionAt = null;
  function verifyCanonical(before, view) {
    const stripped = structuredClone(view);
    for (const key of ['x', 'y', 'action', 'actionTime']) stripped.players[1][key] = before.players[1][key];
    if (JSON.stringify(stripped) !== JSON.stringify(before)) unchangedFailures++;
  }
  function deliver(type, data, fn) {
    const n = ++packet, clone = structuredClone(data);
    const blackout = type === 'snapshot' && profile.blackout && now >= profile.blackout[0] && now < profile.blackout[1];
    if (blackout || (type === 'input' && now < (profile.dropInputUntil ?? 0)) || (profile.lossEvery && n % profile.lossEvery === 0)) { drops++; return; }
    schedule(now + profile.delays[n % profile.delays.length], () => fn(clone));
  }
  function controls(patch) {
    held = { ...held, ...patch };
    sender.update(held, canonical.tick);
    predictor.updateInput(held, now);
  }
  for (const row of inputs) {
    schedule(row.at, () => controls({ [row.key]: true }));
    schedule(row.at + 20, () => controls({ [row.key]: false }));
  }
  if (phase === 'race') { schedule(101, () => controls({ move: 1 })); schedule(301, () => controls({ move: 0 })); }
  if (profile.disconnectAt) schedule(profile.disconnectAt, () => { disconnected = true; predictor.disconnect(); });
  const hostFrame = frame => {
    stepMatch(host, [neutralInput(), receiver.tick(host.tick)], 1 / 60);
    for (const row of responses) if (row.authorityAt === null && now >= row.at && host.players[1].action === row.action) row.authorityAt = now;
    if (frame % (60 / profile.hz) === 0) deliver('snapshot', { seq: ++snapshotSeq, match: host }, data => {
      if (data.seq <= lastSnapshot) { reordered++; return; }
      lastSnapshot = data.seq;
      if (disconnected) { assert.equal(predictor.observe('audit', data.match, now), false); return; }
      canonical = data.match; presentation.push(canonical, now); predictor.observe('audit', canonical, now);
    });
    if (now + 1000 / 60 <= duration) schedule(now + 1000 / 60, () => hostFrame(frame + 1));
  };
  const guestFrame = frame => {
    predictor.updateInput(held, now); // The real root integration may call every frame.
    if (!disconnected && frame % (60 / profile.hz) === 0) deliver('input', { seq: ++inputSeq, packet: sender.packet(canonical.tick) }, data => {
      if (data.seq <= lastInput) { reordered++; return; }
      lastInput = data.seq; receiver.accept(data.packet, host.tick);
    });
    const baseline = presentation.sample(now, profile.presentationDelay) ?? canonical;
    const before = JSON.stringify(canonical);
    const view = predictionEnabled ? predictor.sample(baseline, now) : baseline;
    assert.equal(JSON.stringify(canonical), before, 'canonical source is immutable');
    verifyCanonical(baseline, view);
    for (const row of responses) if (now >= row.at) {
      if (row.baselineAt === null && baseline.players[1].action === row.action) row.baselineAt = now;
      if (row.predictedAt === null && view.players[1].action === row.action) row.predictedAt = now;
      if (now > row.at + PREDICTION_LIMITS.horizonMs && view.players[1].action === row.action && baseline.players[1].action !== row.action) stalePreviewFrames++;
    }
    maxXOffset = Math.max(maxXOffset, Math.abs(view.players[1].x - canonical.players[1].x));
    maxYOffset = Math.max(maxYOffset, Math.abs(view.players[1].y - canonical.players[1].y));
    if (previousX !== null) maxCorrectionStep = Math.max(maxCorrectionStep, Math.abs(view.players[1].x - previousX));
    previousX = view.players[1].x;
    if (profile.name === 'input-loss-until-900ms-injected' && phase === 'race' && now >= 751 && correctionAt === null && view.players[1].y === canonical.players[1].y && view.players[1].action === baseline.players[1].action) correctionAt = now;
    if (now + 1000 / 60 <= duration) schedule(now + 1000 / 60, () => guestFrame(frame + 1));
  };
  schedule(0, () => hostFrame(0)); schedule(1000 / 120, () => guestFrame(0));
  while (queue.length && queue[0].at <= duration) {
    const event = queue.shift(); now = event.at;
    assert.ok(++operations < 1500, 'bounded schedule'); event.fn();
  }
  assert.equal(unchangedFailures, 0, 'only four local visual fields may differ');
  assert.equal(stalePreviewFrames, 0, 'no old unconfirmed pose replay');
  assert.ok(maxXOffset <= PREDICTION_LIMITS.maxLateralOffset + 1e-8, 'bounded lateral error');
  const result = {
    profile: profile.name, phase, predictionEnabled, injected: profile, durationMs: duration,
    responses: responses.map(row => ({ action: row.action, pressedAtMs: row.at, authorityDelayMs: row.authorityAt === null ? null : ms(row.authorityAt - row.at), baselineVisibleDelayMs: row.baselineAt === null ? null : ms(row.baselineAt - row.at), predictedVisibleDelayMs: row.predictedAt === null ? null : ms(row.predictedAt - row.at) })),
    maxXOffsetM: ms(maxXOffset), maxYOffsetM: ms(maxYOffset), maxFramePositionStepM: ms(maxCorrectionStep), correctionObservedAtMs: correctionAt === null ? null : ms(correctionAt),
    operations, peakQueue, packets: packet, drops, reordered, stalePreviewFrames, unchangedFailures,
    predictorStateBytes: Buffer.byteLength(JSON.stringify(predictor)), finalCanonicalHealth: canonical.players.map(p => p.hp), disconnected,
  };
  assert.ok(result.predictorStateBytes < 2000, 'constant-size predictor state');
  if (predictionEnabled) {
    for (const row of result.responses) {
      if (profile.disconnectAt && row.pressedAtMs > profile.disconnectAt) { assert.equal(row.predictedVisibleDelayMs, null, 'disconnect cannot predict'); continue; }
      if (profile.blackout && row.pressedAtMs >= profile.blackout[0] + PREDICTION_LIMITS.horizonMs && row.pressedAtMs < profile.blackout[1]) { assert.equal(row.predictedVisibleDelayMs, null, 'stale snapshots cannot authorize a new visual pose'); continue; }
      assert.ok(row.predictedVisibleDelayMs !== null && row.predictedVisibleDelayMs <= 1000 / 60, `local pose feedback within one modeled frame: ${profile.name} ${phase} ${JSON.stringify(row)}`);
    }
    if (profile.dropInputUntil && phase === 'fight') assert.equal(result.responses[0].authorityDelayMs, null, 'expired input is not executed');
    if (profile.dropInputUntil && phase === 'race') { assert.equal(result.responses[0].authorityDelayMs, null); assert.ok(correctionAt <= 401 + 250 + 100 + 1000 / 60); }
  }
  predictor.disconnect();
  assert.equal(predictor.sample(canonical, duration + 1), canonical, 'disconnect clears all visual work');
  return result;
}

const results = profiles.flatMap(profile => ['race', 'fight'].map(phase => run(profile, phase)));
// Positive control: the same delayed schedule without prediction must fail the
// responsiveness oracle. This demonstrates that the gate detects the old delay.
const control = run(profiles[2], 'fight', false);
assert.ok(control.responses[0].predictedVisibleDelayMs > 1000 / 60, 'unpredicted positive control exhibits network delay');
const report = {
  classification: 'OFFLINE SYNTHETIC MODEL-TO-RENDER TIMINGS; not internet, touch, GPU, display or browser measurements.',
  sourceHashes: sources, limits: PREDICTION_LIMITS,
  boundary: 'Actual simulation/input buffers/presentation/prediction; modeled sequence filtering, 60Hz callbacks and packet schedules. No service, rollback, hit prediction or production integration claim.',
  results, unpredictedControl: control,
};
for (const [path, expected] of Object.entries(sources)) assert.equal(hash(await readFile(new URL(path, root))), expected, `source changed during audit: ${path}`);
await writeFile(new URL('./prediction-audit-result.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(results.map(r => ({ profile: r.profile, phase: r.phase, responses: r.responses, maxXOffsetM: r.maxXOffsetM, maxYOffsetM: r.maxYOffsetM, correctionObservedAtMs: r.correctionObservedAtMs })), null, 2));
console.log('LOCAL PREDICTION AUDIT VERIFIED');
