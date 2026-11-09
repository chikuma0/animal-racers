/** Deterministic OFFLINE protocol audit. No service, browser, credentials or source mutations. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import ts from 'typescript';

const rootUrl = new URL('../../', import.meta.url);
const root = fileURLToPath(rootUrl);
assert.ok(process.argv.slice(2).every(arg => arg === '--expect-rematch-recovery'), 'unknown audit option');
const sourcePaths = ['src/components/Championship.tsx', ...['network', 'input-buffer', 'presentation', 'prediction', 'simulation', 'course', 'measurements', 'work-measurements', 'controls'].map(name => `src/championship/${name}.ts`)];
const sources = Object.fromEntries(await Promise.all(sourcePaths.map(async path => [path, await readFile(new URL(path, rootUrl), 'utf8')])));
const sha = value => createHash('sha256').update(value).digest('hex');
const component = sources[sourcePaths[0]];
const tree = ts.createSourceFile('Championship.tsx', component, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function find(test) {
  const matches = [];
  const visit = node => { if (test(node)) matches.push(node); ts.forEachChild(node, visit); };
  visit(tree); assert.equal(matches.length, 1, 'Source extraction must identify exactly one node'); return matches[0];
}
const variable = name => find(node => ts.isVariableDeclaration(node) && node.name.getText(tree) === name);
const callbacks = {
  begin: variable('begin').initializer.arguments[0],
  animate: variable('animate').initializer,
  receive: find(node => ts.isBinaryExpression(node) && node.left.getText(tree) === 'net.onMessage').right,
  rematch: variable('rematch').initializer,
  publishControls: variable('publishControls').initializer.arguments[0],
};
const callbackEvidence = Object.fromEntries(Object.entries(callbacks).map(([name, node]) => [name, { line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1, sha256: sha(node.getText(tree)), source: node.getText(tree) }]));
function compile(node) {
  const code = node.getText(tree);
  return ts.transpileModule(`(${code})`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText.trim().replace(/;$/, '');
}
const compiledCallbacks = Object.fromEntries(Object.entries(callbacks).map(([name, node]) => [name, compile(node)]));
const frameDeclaration = variable('frame').parent.parent.getText(tree);
const validators = ['validCharacter', 'validInput'].map(name => `const ${name} = ${compile(variable(name).initializer)};`).join('\n') +
  ts.transpileModule(find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'isSnapshot').getText(tree), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

const bundle = await build({ stdin: { contents: sourcePaths.slice(1).map(path => `export * from './${path}';`).join('\n'), resolveDir: root }, bundle: true, write: false, platform: 'node', format: 'cjs', external: ['@supabase/supabase-js'] });
const bundleCode = bundle.outputFiles[0].text;
const moduleRequire = createRequire(new URL('../../package.json', import.meta.url));
const flush = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };
const rounded = n => Math.round(n * 100) / 100;
function distribution(values) {
  const a = values.filter(Number.isFinite).sort((x, y) => x - y);
  const p = q => a.length ? rounded(a[Math.ceil(q * a.length) - 1]) : null;
  return { count: a.length, p50: p(.5), p95: p(.95), max: p(1) };
}
class Clock {
  now = 0; nextId = 0; queue = []; active = new Map(); operations = 0; peakQueue = 0; delivery = null;
  timer = (fn, ms = 0, repeat = 0) => {
    const task = { id: ++this.nextId, fn, at: this.now + ms, repeat }; this.active.set(task.id, task); this.insert(task); return task.id;
  };
  insert(task) { this.queue.push(task); this.queue.sort((a, b) => a.at - b.at || a.id - b.id); this.peakQueue = Math.max(this.peakQueue, this.queue.length); }
  clear = id => { this.active.delete(id); this.queue = this.queue.filter(task => task.id !== id); };
  async until(test, deadline) {
    while (!test() && this.queue.length && this.queue[0].at <= deadline) {
      const task = this.queue.shift(); if (!this.active.has(task.id)) continue;
      assert.ok(++this.operations < 150_000, 'bounded event count');
      this.now = task.at;
      if (task.repeat) { task.at += task.repeat; this.insert(task); } else this.active.delete(task.id);
      task.fn(); await flush();
    }
    assert.ok(this.now <= deadline + .01, 'bounded virtual duration');
  }
}
function apiFor(clock) {
  const module = { exports: {} };
  new Function('module', 'exports', 'require', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', bundleCode)(
    module, module.exports, moduleRequire, (fn, ms) => clock.timer(fn, ms), clock.clear, (fn, ms) => clock.timer(fn, ms, ms), clock.clear,
  );
  return module.exports;
}
class Wire {
  channels = []; peers = []; packetCount = 0; peakBytes = 0; dropped = 0; reordered = 0; highest = new Map(); sentTypes = {}; droppedTypes = {};
  constructor(clock, profile, options) { Object.assign(this, { clock, profile, options }); }
  sync() { for (const channel of [...this.channels]) channel.presence?.(); }
  send(envelope, deliver) {
    const packet = typeof envelope === 'string' ? JSON.parse(envelope) : structuredClone(envelope);
    const sentAt = this.clock.now, number = ++this.packetCount;
    this.peakBytes = Math.max(this.peakBytes, Buffer.byteLength(JSON.stringify(packet)));
    this.sentTypes[packet.type] = (this.sentTypes[packet.type] ?? 0) + 1;
    const rematchBlackout = this.options.blackoutCountdown && packet.type === 'snapshot' && packet.data.epoch === 'epoch-2' && packet.data.match.phase === 'countdown';
    const periodicLoss = this.profile.lossEvery && number % this.profile.lossEvery === 0 && ['snapshot', 'input'].includes(packet.type);
    if (this.profile.inputBlackoutMs && packet.type === 'input' && packet.data.packet.edges.attack > 0) this.inputBlackoutAt ??= sentAt;
    const inputBlackout = packet.type === 'input' && this.inputBlackoutAt !== undefined && sentAt < this.inputBlackoutAt + this.profile.inputBlackoutMs;
    if (rematchBlackout || periodicLoss || inputBlackout) { this.dropped++; this.droppedTypes[packet.type] = (this.droppedTypes[packet.type] ?? 0) + 1; return; }
    const delay = this.profile.delays[number % this.profile.delays.length] + (this.profile.stepJitter && sentAt >= 5_000 && sentAt < 6_000 ? 130 : 0);
    this.clock.timer(() => {
      if (packet.seq < (this.highest.get(packet.sender) ?? 0)) this.reordered++;
      this.highest.set(packet.sender, Math.max(this.highest.get(packet.sender) ?? 0, packet.seq));
      this.clock.delivery = { sentAt, type: packet.type, epoch: packet.data?.epoch };
      deliver(packet); this.clock.delivery = null;
    }, delay);
  }
  client = async () => ({
    channel: (topic, id) => {
      const channel = {
        topic, id, metadata: null, broadcast: null, presence: null,
        onBroadcast(fn) { this.broadcast = fn; }, onPresence(fn) { this.presence = fn; },
        presenceState: () => Object.fromEntries(this.channels.filter(c => c.topic === topic && c.metadata).map(c => [c.id, [c.metadata]])),
        subscribe: fn => queueMicrotask(() => fn('SUBSCRIBED')),
        track: async data => { channel.metadata = data; this.sync(); return 'ok'; },
        isJoined: () => true,
        send: async data => { this.send(data, packet => { for (const other of this.channels) if (other !== channel && other.topic === topic) other.broadcast?.(packet); }); return 'ok'; },
      };
      this.channels.push(channel); return channel;
    },
    removeChannel: async channel => { this.channels = this.channels.filter(c => c !== channel); this.sync(); }, disconnect() {},
  });
  createPeer = () => {
    const peer = {
      id: this.peers.length, connectionState: 'new', iceGatheringState: 'complete', localDescription: null, channel: null,
      createDataChannel: () => (peer.channel = this.dataChannel()),
      createOffer: async () => ({ type: 'offer', sdp: String(peer.id) }),
      createAnswer: async () => ({ type: 'answer', sdp: String(peer.id) }),
      setLocalDescription: async description => { peer.localDescription = description; },
      setRemoteDescription: async description => {
        if (description.type !== 'answer') return;
        const guest = this.peers[Number(description.sdp)]; guest.channel = this.dataChannel();
        guest.channel.peer = peer.channel; peer.channel.peer = guest.channel;
        guest.ondatachannel?.({ channel: guest.channel });
        peer.connectionState = guest.connectionState = 'connected';
        queueMicrotask(() => { guest.channel.readyState = peer.channel.readyState = 'open'; guest.channel.onopen?.(); peer.channel.onopen?.(); });
      },
      close() { this.connectionState = 'closed'; },
    };
    this.peers.push(peer); return peer;
  };
  dataChannel() {
    const wire = this;
    return { label: 'championship', readyState: 'connecting', bufferedAmount: 0, peer: null,
      send(data) { wire.send(data, packet => this.peer?.onmessage?.({ data: JSON.stringify(packet) })); },
      close() { this.readyState = 'closed'; },
    };
  }
}
const ref = current => ({ current });
function makeEndpoint(api, clock, wire, role, options) {
  const s = { ...api, CHARACTER_IDS: ['lion', 'wolf', 'unicorn'], mode: role, asHost: role === 'host', selected: 'lion', rival: 'wolf', alive: true,
    performance: { now: () => clock.now }, document: { hidden: false }, crypto: { randomUUID: () => `epoch-${++s.epochCount}` }, epochCount: 0,
    requestAnimationFrame: () => 0, captured: null, unpredicted: null, sourceSentAt: null, ignoredNewEpoch: 0, acceptedSnapshots: 0, lastSnapshotAt: null,
    ui: {}, statuses: [], peakPendingEdges: 0, receivedPresses: [], receivedPressIds: new Set(),
  };
  for (const [name, value] of Object.entries({ match: null, input: api.neutralInput(), remoteInput: api.neutralInput(), modeRef: role, screenRef: 'lobby', selectedRef: role === 'host' ? 'lion' : 'wolf', readyRef: true,
    peerRef: { character: role === 'host' ? 'wolf' : 'lion', ready: true }, epoch: '', lastSnapshot: clock.now, lastInput: clock.now, localSeq: 0, remoteSeq: -1, latestTick: -1, connected: true,
    rematchPending: false, peerRematch: false, presentation: new api.PresentationBuffer(), prediction: new api.GuestPrediction(1), inputSender: new api.InputSender(), localReceiver: new api.InputReceiver(), remoteReceiver: new api.InputReceiver(),
    controls: new api.InputControls(), workMeasurements: new api.WorkMeasurements(), playTrace: { lastId: 0, events: [] }, audio: { reset() {}, update() {} }, renderer: { render: state => { s.captured = state; }, report: () => null },
  })) s[name] = ref(value);
  for (const name of ['setRematchWaiting', 'setInterrupted', 'setStatus', 'setReady', 'setPeer', 'setRival', 'setView', 'setReport']) s[name] = value => { s.ui[name] = value; };
  s.setPage = page => { s.screenRef.current = page; };
  const sample = s.presentation.current.sample.bind(s.presentation.current);
  s.presentation.current.sample = (...args) => { s.unpredicted = sample(...args); return s.unpredicted; };
  const net = new api.ChampionshipNetwork({ createClient: wire.client, now: () => clock.now, enableWebRTC: wire.profile.direct, createPeerConnection: wire.createPeer });
  s.network = ref(net); s.net = net;
  s.begin = new Function('scope', `with(scope){return ${compiledCallbacks.begin};}`)(s);
  s.animate = new Function('scope', `with(scope){${frameDeclaration}\nreturn ${compiledCallbacks.animate};}`)(s);
  const animate = s.animate;
  s.animate = (...args) => {
    const before = wire.sentTypes.snapshot ?? 0;
    animate(...args);
    assert.ok((wire.sentTypes.snapshot ?? 0) - before <= 1, 'urgent events send at most one snapshot per frame');
  };
  s.rematch = new Function('scope', `with(scope){return ${compiledCallbacks.rematch};}`)(s);
  s.publishControls = new Function('scope', `with(scope){return ${compiledCallbacks.publishControls};}`)(s);
  const receive = new Function('scope', `with(scope){${validators}\nreturn ${compiledCallbacks.receive};}`)(s);
  net.onMessage = message => {
    const previous = s.lastSnapshot.current, priorInputSeq = s.remoteSeq.current;
    receive(message);
    if (role === 'host' && message.type === 'input' && s.remoteSeq.current > priorInputSeq) {
      for (const [key, presses] of Object.entries(message.data.packet.presses)) for (const press of presses) {
        const identity = `${message.data.epoch}:${key}:${press.id}`;
        if (s.receivedPressIds.has(identity)) continue;
        s.receivedPressIds.add(identity);
        s.receivedPresses.push({ epoch: message.data.epoch, key, id: press.id, at: clock.now, authorityTick: s.match.current.tick, sourceTick: press.tick, ageTicks: s.match.current.tick - press.tick });
        if (s.receivedPresses.length > 64) s.receivedPresses.shift();
        if (s.receivedPressIds.size > 64) s.receivedPressIds.delete(s.receivedPressIds.values().next().value);
      }
    }
    s.peakPendingEdges = Math.max(s.peakPendingEdges, ...Object.values(s.remoteReceiver.current.pending).map(queue => queue.length));
    if (message.type === 'snapshot') {
      if (s.lastSnapshot.current !== previous) { s.sourceSentAt = clock.delivery?.sentAt ?? clock.now; s.acceptedSnapshots++; }
      else if (message.data.epoch !== s.epoch.current) s.ignoredNewEpoch++;
    }
  };
  net.onStatus = status => s.statuses.push({ at: rounded(clock.now), status });
  net.onPresence = ids => { s.connected.current = ids.length === 2; };
  s.setInput = patch => {
    for (const [key, value] of Object.entries(patch)) {
      const pointer = 20 + ['move', 'jump', 'attack', 'special', 'guard'].indexOf(key);
      if (value === false || value === 0) s.controls.current.pointerUp(pointer);
      else s.controls.current.pointerDown(pointer, key, value);
    }
    s.publishControls();
    const sequence = s.localSeq.current;
    s.publishControls();
    assert.equal(s.localSeq.current, sequence, 'unchanged control publication must not flood immediate packets');
  };
  return s;
}
const profiles = [
  { id: 'near-zero-direct', direct: true, delays: [1] },
  { id: 'direct-jitter-loss-reorder', direct: true, delays: [2, 70, 4, 120, 3, 8], lossEvery: 13 },
  { id: 'direct-delay-step', direct: true, delays: [1], stepJitter: true },
  { id: 'slow-broadcast-injected', direct: false, delays: [82, 88, 120, 250, 90, 150], lossEvery: 17 },
  { id: 'guest-input-loss-burst', direct: true, delays: [1], inputBlackoutMs: 1_000 },
];

async function scenario(profile, options = {}) {
  const clock = new Clock(), api = apiFor(clock), wire = new Wire(clock, profile, options);
  const host = makeEndpoint(api, clock, wire, 'host', options), guest = makeEndpoint(api, clock, wire, 'guest', options);
  const endpoints = [host, guest];
  await Promise.all(endpoints.map((s, i) => s.net.connect('ABCDEFGH23', i === 0))); await flush();
  await clock.until(() => endpoints.every(s => s.net.peerId && (!profile.direct || s.net.transport === 'webrtc')), 4_000);
  assert.ok(endpoints.every(s => s.net.peerId && (!profile.direct || s.net.transport === 'webrtc')), 'modeled path setup');
  const start = clock.now;
  const metrics = { hostTickLagMs: [], snapshotAgeMs: [], actionClockLagMs: [], resultConvergences: [], resultReceivedTimes: {}, stimuli: [], peakPresentationFrames: 0, peakPendingEdges: 0, peakRoundTripSamples: 0, peakRateWindow: 0, phaseMismatches: 0, backtracks: 0, maxBackwardZM: 0, actionRewinds: 0, maxActionRewindMs: 0, actionRewindExamples: [], canonicalMutations: 0, predictionGameplayMutations: 0, predictionActionClockCorrections: 0, maxPredictionActionClockCorrectionMs: 0, maxPredictionXOffset: 0, maxPredictionYOffset: 0, peakPredictorStateBytes: 0 };
  const specifications = [
    { fightAt: 1, slot: 1, key: 'attack', action: 'attack' }, { fightAt: 3, slot: 1, key: 'special', action: 'attack' }, { fightAt: 5, slot: 1, key: 'jump', action: 'evade' },
    { fightAt: 7, slot: 0, key: 'attack', action: 'attack' }, { fightAt: 9, slot: 1, key: 'attack', action: 'attack' }, { fightAt: 11, slot: 1, key: 'jump', action: 'evade' },
  ];
  let previousView = null, previousEvent = 0, rematchAt = null, secondBeginAt = null, finalAt = null, approached = false;
  const rematchInputResets = [];
  const collect = (s, slot) => {
    const m = host.match.current, rendered = s.captured, v = slot === 1 ? s.unpredicted : rendered;
    if (s.epoch.current === 'epoch-2' && !rematchInputResets.includes(slot)) {
      assert.deepEqual(s.controls.current.value(), api.neutralInput(), 'new epoch releases physical owners');
      assert.deepEqual(s.input.current, api.neutralInput(), 'new epoch clears the published held input');
      assert.deepEqual(s.inputSender.current.packet(s.match.current.tick).held, api.neutralInput(), 'new epoch clears transmitted held input');
      assert.equal(s.prediction.current.pose, null, 'new epoch clears speculative pose');
      assert.equal(s.prediction.current.motion, null, 'new epoch clears speculative movement');
      rematchInputResets.push(slot);
    }
    metrics.peakPresentationFrames = Math.max(metrics.peakPresentationFrames, s.presentation.current.frames.length);
    const connection = s.net.connection;
    if (connection) {
      metrics.peakRoundTripSamples = Math.max(metrics.peakRoundTripSamples, connection.roundTrips.length);
      metrics.peakRateWindow = Math.max(metrics.peakRateWindow, connection.sendTimes.length, connection.receiveTimes.length);
    }
    metrics.peakPendingEdges = Math.max(metrics.peakPendingEdges, s.peakPendingEdges);
    for (const receiver of [s.localReceiver.current, s.remoteReceiver.current]) metrics.peakPendingEdges = Math.max(metrics.peakPendingEdges, ...Object.values(receiver.pending).map(queue => queue.length));
    if (slot === 0 && m) {
      if (host.epoch.current === 'epoch-2' && secondBeginAt === null) secondBeginAt = clock.now;
      for (const event of m.events.filter(event => event.id > previousEvent)) {
        const stimulus = metrics.stimuli.find(item => item.epoch === host.epoch.current && item.slot === event.slot && (item.action === event.type || (item.action === 'attack' && event.type === 'counter')) && item.authorityAt === null && clock.now - item.pressedAt <= api.INPUT_MAX_AGE_TICKS * 1000 / 60);
        if (stimulus) { stimulus.authorityAt = clock.now; stimulus.eventId = event.id; }
      }
      previousEvent = m.eventSequence;
    }
    if (slot === 1 && v && m && guest.epoch.current === host.epoch.current) {
      metrics.hostTickLagMs.push((m.tick - v.tick) * 1000 / 60);
      if (guest.sourceSentAt !== null) metrics.snapshotAgeMs.push(clock.now - guest.sourceSentAt);
      if (v.phase !== m.phase) metrics.phaseMismatches++;
      assert.equal(v.phase, guest.match.current.phase, 'presentation retains canonical phase');
      assert.deepEqual(v.result, guest.match.current.result, 'presentation retains canonical score');
      assert.deepEqual(v.players.map(p => p.hp), guest.match.current.players.map(p => p.hp), 'presentation retains canonical health');
      const stripped = { ...rendered, players: [...rendered.players] };
      stripped.players[1] = { ...rendered.players[1] };
      for (const key of ['x', 'y', 'action', 'actionTime']) stripped.players[1][key] = v.players[1][key];
      if (JSON.stringify(stripped) !== JSON.stringify(v)) metrics.predictionGameplayMutations++;
      metrics.maxPredictionXOffset = Math.max(metrics.maxPredictionXOffset, Math.abs(rendered.players[1].x - guest.match.current.players[1].x));
      metrics.maxPredictionYOffset = Math.max(metrics.maxPredictionYOffset, Math.abs(rendered.players[1].y - guest.match.current.players[1].y));
      metrics.peakPredictorStateBytes = Math.max(metrics.peakPredictorStateBytes, JSON.stringify(s.prediction.current).length);
      if (previousView?.epoch === guest.epoch.current && previousView.rendered.phase === rendered.phase && previousView.rendered.players[1].action === rendered.players[1].action && ['attack', 'evade', 'jump'].includes(rendered.players[1].action)) {
        const correction = previousView.rendered.players[1].actionTime - rendered.players[1].actionTime;
        if (correction > 1e-7) { metrics.predictionActionClockCorrections++; metrics.maxPredictionActionClockCorrectionMs = Math.max(metrics.maxPredictionActionClockCorrectionMs, correction * 1000); }
      }
      if (previousView?.epoch === guest.epoch.current && previousView.state.phase === 'race' && v.phase === 'race') {
        const backwards = previousView.state.players[1].z - v.players[1].z;
        if (backwards > 1e-7) { metrics.backtracks++; metrics.maxBackwardZM = Math.max(metrics.maxBackwardZM, backwards); }
      }
      for (const playerSlot of [0, 1]) {
        const a = m.players[playerSlot], b = v.players[playerSlot];
        const received = guest.match.current.players[playerSlot];
        if (['attack', 'evade', 'jump', 'hit'].includes(a.action) && a.action === b.action && Math.abs((m.tick - guest.match.current.tick) / 60 - (a.actionTime - received.actionTime)) < 1 / 120) metrics.actionClockLagMs.push(Math.max(0, a.actionTime - b.actionTime) * 1000);
        const prior = previousView?.state.players[playerSlot];
        if (prior && previousView.epoch === guest.epoch.current && prior.action === b.action && ['attack', 'special'].includes(b.action)) {
          const live = guest.match.current.players[playerSlot], priorLive = previousView.canonical.players[playerSlot];
          const sameStart = priorLive.action === live.action && Math.abs((guest.match.current.tick - previousView.canonical.tick) / 60 - (live.actionTime - priorLive.actionTime)) < 1 / 120;
          if (sameStart && prior.actionTime > b.actionTime + 1e-7) {
            metrics.actionRewinds++;
            metrics.maxActionRewindMs = Math.max(metrics.maxActionRewindMs, (prior.actionTime - b.actionTime) * 1000);
            if (metrics.actionRewindExamples.length < 3) metrics.actionRewindExamples.push({ at: rounded(clock.now), playerSlot, action: b.action, previousRenderedMs: rounded(prior.actionTime * 1000), nextRenderedMs: rounded(b.actionTime * 1000), previousCanonicalMs: rounded(priorLive.actionTime * 1000), nextCanonicalMs: rounded(live.actionTime * 1000), previousCanonicalTick: previousView.canonical.tick, nextCanonicalTick: guest.match.current.tick });
          }
        }
      }
      // Both objects are replaced (not advanced) by guest receive/sample; retain
      // their immutable references instead of cloning the full match every frame.
      previousView = { epoch: guest.epoch.current, state: v, rendered, canonical: guest.match.current };
    }
    if (v) for (const stimulus of metrics.stimuli) {
      if (s.epoch.current !== stimulus.epoch || stimulus.eventId === null || !v.events.some(event => event.id === stimulus.eventId)) continue;
      const which = slot === 0 ? 'hostVisibleAt' : 'guestVisibleAt';
      if (stimulus[which] === null && v.players[stimulus.slot].action === stimulus.action) stimulus[which] = clock.now;
    }
    if (slot === 1 && rendered) for (const stimulus of metrics.stimuli) {
      if (stimulus.slot === 1 && s.epoch.current === stimulus.epoch && stimulus.guestFeedbackAt === null && clock.now >= stimulus.pressedAt && clock.now - stimulus.pressedAt <= api.PREDICTION_LIMITS.horizonMs && rendered.players[1].action === stimulus.action) stimulus.guestFeedbackAt = clock.now;
    }
    if (s.match.current?.phase === 'results') {
      const key = `${s.epoch.current}-${slot}`;
      metrics.resultReceivedTimes[key] ??= clock.now;
    }
    if (endpoints.every(s => s.match.current?.phase === 'results') && host.epoch.current === guest.epoch.current) {
      const epoch = host.epoch.current;
      if (!metrics.resultConvergences.some(row => row.epoch === epoch)) {
        assert.deepEqual(host.match.current.result, guest.match.current.result, 'canonical result agreement');
        metrics.resultConvergences.push({ epoch, at: clock.now, result: host.match.current.result, finalHealth: host.match.current.players.map(player => player.hp), guestDelayMs: clock.now - metrics.resultReceivedTimes[`${epoch}-0`] });
      }
      if (!rematchAt) {
        // A press may still be held when a result becomes a new championship.
        for (const endpoint of endpoints) {
          endpoint.controls.current.pointerDown(17, 'guard', true);
          endpoint.controls.current.keyDown('j');
          endpoint.setInput(endpoint.controls.current.value());
        }
        rematchAt = clock.now; host.rematch(); guest.rematch(); previousEvent = 0;
      }
      else if (epoch === 'epoch-2') finalAt ??= clock.now;
    }
  };
  const frame = slot => {
    const s = endpoints[slot], m = host.match.current;
    if (slot === 0 && m?.phase === 'fight' && host.epoch.current === 'epoch-1') {
      if (!approached && m.fightTime >= .05) {
        approached = true; host.setInput({ move: 1 });
        clock.timer(() => host.setInput({ move: 0 }), 500);
      }
      for (const specification of specifications) if (m.fightTime >= specification.fightAt && !specification.fired) {
        specification.fired = true;
        const stimulus = { ...specification, epoch: host.epoch.current, pressedAt: clock.now, authorityAt: null, eventId: null, hostVisibleAt: null, guestVisibleAt: null, guestFeedbackAt: null };
        metrics.stimuli.push(stimulus); endpoints[specification.slot].setInput({ [specification.key]: true });
        stimulus.pressId = endpoints[specification.slot].inputSender.current.packet().edges[specification.key];
        clock.timer(() => endpoints[specification.slot].setInput({ [specification.key]: false }), 20);
      }
    }
    const canonicalBefore = slot === 1 ? JSON.stringify(s.match.current) : null;
    s.animate(clock.now);
    if (slot === 1 && JSON.stringify(s.match.current) !== canonicalBefore) metrics.canonicalMutations++;
    collect(s, slot);
    clock.timer(() => frame(slot), 1000 / 60);
  };
  clock.timer(() => frame(0), 0); clock.timer(() => frame(1), 1000 / 120);
  await clock.until(() => finalAt !== null, start + 340_000);
  const sameResult = endpoints.every(s => s.match.current?.phase === 'results') && host.epoch.current === guest.epoch.current && JSON.stringify(host.match.current.result) === JSON.stringify(guest.match.current.result);
  const response = metrics.stimuli.map(({ fired, ...stimulus }) => ({ ...stimulus, firstReceived: host.receivedPresses.find(press => press.epoch === stimulus.epoch && press.key === stimulus.key && press.id === stimulus.pressId) ?? null, inputToAuthorityMs: stimulus.authorityAt === null ? null : rounded(stimulus.authorityAt - stimulus.pressedAt), inputToHostVisibleMs: stimulus.hostVisibleAt === null ? null : rounded(stimulus.hostVisibleAt - stimulus.pressedAt), inputToGuestVisibleMs: stimulus.guestVisibleAt === null ? null : rounded(stimulus.guestVisibleAt - stimulus.pressedAt), inputToGuestFeedbackMs: stimulus.guestFeedbackAt === null ? null : rounded(stimulus.guestFeedbackAt - stimulus.pressedAt) }));
  const result = {
    profile: profile.id, injected: profile, counterfactual: false, blackoutAllRematchCountdownSnapshots: Boolean(options.blackoutCountdown),
    virtualDurationMs: rounded(clock.now - start), eventOperations: clock.operations,
    packetCounts: { total: wire.packetCount, dropped: wire.dropped, deliveredOutOfOrder: wire.reordered, droppedTypes: wire.droppedTypes, sentTypes: wire.sentTypes },
    cadenceHz: endpoints.map(s => s.net.sendHz), response,
    responseMs: { guestToAuthority: distribution(response.filter(r => r.slot === 1).map(r => r.inputToAuthorityMs)), guestToGuestVisible: distribution(response.filter(r => r.slot === 1).map(r => r.inputToGuestVisibleMs)), guestToLocalFeedback: distribution(response.filter(r => r.slot === 1).map(r => r.inputToGuestFeedbackMs)), hostToHostVisible: distribution(response.filter(r => r.slot === 0).map(r => r.inputToHostVisibleMs)) },
    freshness: { hostTickLagMs: distribution(metrics.hostTickLagMs), snapshotAgeMs: distribution(metrics.snapshotAgeMs), actionClockLagMs: distribution(metrics.actionClockLagMs), phaseMismatchFrames: metrics.phaseMismatches, raceBacktrackFrames: metrics.backtracks, maxBackwardZM: rounded(metrics.maxBackwardZM), actionRewindFrames: metrics.actionRewinds, maxActionRewindMs: rounded(metrics.maxActionRewindMs), actionRewindExamples: metrics.actionRewindExamples },
    bounds: { peakPresentationFrames: metrics.peakPresentationFrames, peakPendingEdgesPerButton: metrics.peakPendingEdges, peakRoundTripSamples: metrics.peakRoundTripSamples, peakRateWindow: metrics.peakRateWindow, peakScheduledEvents: clock.peakQueue, peakEnvelopeBytes: wire.peakBytes, canonicalMutations: metrics.canonicalMutations },
    prediction: { gameplayMutations: metrics.predictionGameplayMutations, localActionClockCorrections: metrics.predictionActionClockCorrections, maxLocalActionClockCorrectionMs: rounded(metrics.maxPredictionActionClockCorrectionMs), maxXOffsetM: rounded(metrics.maxPredictionXOffset), maxYOffsetM: rounded(metrics.maxPredictionYOffset), peakStateBytes: metrics.peakPredictorStateBytes },
    convergence: { results: metrics.resultConvergences, sameFinalResult: sameResult, rematchInputResets, rematchAt, secondBeginAt, hostEpoch: host.epoch.current, guestEpoch: guest.epoch.current, hostPhase: host.match.current?.phase, guestPhase: guest.match.current?.phase, hostInterrupted: Boolean(host.ui.setInterrupted), guestInterrupted: Boolean(guest.ui.setInterrupted), guestIgnoredNewEpochSnapshots: guest.ignoredNewEpoch },
  };
  assert.ok(metrics.peakPresentationFrames <= 8 && metrics.peakPendingEdges <= 2 && wire.peakBytes <= api.NETWORK_LIMITS.maxBytes && metrics.canonicalMutations === 0, 'production memory/envelope/authority bounds');
  assert.ok(metrics.peakRoundTripSamples <= api.NETWORK_LIMITS.roundTripSamples && metrics.peakRateWindow <= api.NETWORK_LIMITS.directMessagesPerSecond, 'transport history bounds');
  assert.ok(metrics.resultConvergences.length >= 1, 'initial canonical result arrives');
  assert.ok(metrics.resultConvergences[0].finalHealth.some(hp => hp < 100), 'actual input produced consequential combat damage');
  assert.ok(sameResult && host.epoch.current === 'epoch-2', 'both complete rematch');
  assert.equal(rematchInputResets.length, 2, 'both roles release old championship inputs');
  assert.equal(response.length, 6);
  for (const row of response) {
    if (row.slot === 1) assert.ok(row.firstReceived, 'every scripted guest counter eventually arrives');
    const expired = row.slot === 1 && row.firstReceived.ageTicks > api.INPUT_MAX_AGE_TICKS;
    row.intentOutcome = expired ? 'expired-before-receiver' : 'executed';
    if (expired) assert.equal(row.authorityAt, null, 'expired press must never replay, even when locally previewed');
    else assert.ok(row.authorityAt !== null, `fresh scripted intent must execute: ${profile.id} ${JSON.stringify(row)}`);
  }
  if (profile.inputBlackoutMs) assert.equal(response[0].intentOutcome, 'expired-before-receiver', 'controlled loss proves stale-input rejection');
  assert.equal(metrics.actionRewinds, 0, 'same action must not rewind');
  assert.equal(metrics.backtracks, 0, 'forward race must not play backward');
  assert.equal(metrics.predictionGameplayMutations, 0, 'local visual prediction must not alter gameplay');
  assert.ok(metrics.peakPredictorStateBytes < 2000 && metrics.maxPredictionXOffset <= api.PREDICTION_LIMITS.maxLateralOffset + 1e-7, 'bounded local prediction state and position');
  await Promise.all(endpoints.map(s => s.net.disconnect()));
  assert.ok(wire.channels.length === 0 && endpoints.every(s => s.net.connection === null) && wire.peers.every(peer => peer.connectionState === 'closed'), 'transport cleanup');
  return result;
}

const started = performance.now();
// A saturation control checks a transient queue before tick() drains it.
const burstApi = apiFor(new Clock()), sender = new burstApi.InputSender(), receiver = new burstApi.InputReceiver();
for (let i = 0; i < 1_000; i++) {
  sender.update({ ...burstApi.neutralInput(), attack: true }); sender.update(burstApi.neutralInput());
}
receiver.accept(sender.packet());
const pendingMaximum = Math.max(...Object.values(receiver.pending).map(queue => queue.length));
assert.equal(pendingMaximum, 2, 'edge queue saturation bound');
const emitted = Array.from({ length: 6 }, () => receiver.tick()).filter(input => input.attack).length;
assert.equal(emitted, 2, 'bounded queued edges drain without held-repeat');
receiver.accept(sender.packet()); assert.ok(!receiver.tick().attack, 'duplicate cumulative counters do not replay');
const edgeBurst = { attemptedEdges: 1_000, pendingMaximum, emitted, duplicateReplay: false };
const results = [];
for (const profile of profiles) {
  results.push(await scenario(structuredClone(profile)));
  console.log(`Audited ${profile.id}`);
}
results.push(await scenario(structuredClone(profiles[0]), { blackoutCountdown: true }));
const report = {
  auditedCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  expectedBehavior: 'Revision2 event-driven input/combat snapshots through actual callbacks: gameplay/rematch convergence, canonical presentation monotonicity, stale-input expiry, bounded cosmetic feedback; visual prediction corrections measured separately. No counterfactual callbacks.',
  harnessSha256: sha(await readFile(fileURLToPath(import.meta.url))),
  classification: 'OFFLINE SYNTHETIC SCHEDULES. Injected delay/jitter/loss are not internet measurements. Fixed 60Hz app callbacks; model-to-render timings exclude browser input dispatch, rendering, GPU, display and CPU stalls.',
  sources: Object.fromEntries(Object.entries(sources).map(([path, source]) => [path, sha(source)])), extractedCallbacks: callbackEvidence,
  extractedSupportingSource: { frameDeclaration, validators },
  boundaries: ['Actual exported network, input-buffer, presentation, prediction, controls, course and simulation code.', 'Actual AST-extracted app begin, animate, message-handler, control publisher and rematch callbacks; only sockets, WebRTC primitive, clock, React refs/setters and renderer sink are modeled.', 'Canonical presentation metrics are captured before prediction; immediate local feedback is separately measured without requiring a host event. Cosmetic clock corrections do not imply canonical replay.', 'Current audit uses only actual callbacks; historical baseline/counterfactual findings are in separate immutable reports. Canonical files remain unchanged during each audit.', 'Near-zero values are synthetic. Slow fallback values are inspired by the historical small smoke sample, not a reconstruction or forecast.'],
  edgeBurst, results,
  wallRuntimeMs: rounded(performance.now() - started),
};
for (const [path, original] of Object.entries(sources)) assert.equal(sha(await readFile(new URL(path, rootUrl), 'utf8')), sha(original), `canonical source changed during audit: ${path}`);
const artifactName = './timing-audit-event-driven-result.json';
await writeFile(new URL(artifactName, import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(results.map(result => ({ profile: result.profile, blackout: result.blackoutAllRematchCountdownSnapshots, counterfactual: result.counterfactual, response: result.responseMs, freshness: result.freshness, convergence: result.convergence.sameFinalResult, bounds: result.bounds })), null, 2));
console.log('LOCAL TIMING AUDIT VERIFIED');
