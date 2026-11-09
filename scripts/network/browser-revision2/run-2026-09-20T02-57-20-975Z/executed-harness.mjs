/** Normal-control Chrome smoke. Never imports game code or reads private app state. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rm, unlink, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const species = ['lion', 'wolf', 'unicorn'];
const names = { lion: /Fire\s*Lion/i, wolf: /Water\s*Wolf/i, unicorn: /Rainbow\s*Unicorn/i };
const allPairs = species.flatMap(host => species.map(guest => [host, guest]));
const plan = {
  classification: 'SAME-MACHINE ONLINE SERVICE SMOKE. Not separate-network, human, physical-phone, native-touch or fairness acceptance.',
  launch: 'Two isolated installed Chrome profiles; channel:chrome, headless:true; no patched clocks, state injection, routing, game imports or test hooks.',
  coverage: 'Nine ordered host/guest species pairings, and one full agreed rematch of the first pairing.',
  controls: 'Visible selection/lobby/buttons and ordinary keyboard presses. Public DOM phase/progress/health/windup/opening cues only.',
  actions: 'Both roles steer and leap in the race, react 330ms after observed windup, evade, step in and reply, then exchange actual strikes to finish.',
  evidence: 'UI canvas recordings, public report downloads, screenshots, input/cue timeline, served JS/asset hashes, frozen source manifest and visible results.',
  boundary: 'Requires parent-authorized frozen URL/manifest before execution. Browser recording and dual rendering add machine load. Report event ticks are observation ticks, not exact event timestamps.',
};
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const processFile = promisify(execFile);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const json = async (path, value) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); };
const count = (report, slot, type) => report.playTrace.events.filter(e => e.slot === slot && e.type === type).length;

function verifyRound(host, guest, raceReports, expectedPair) {
  for (const [slot, report] of [host, guest].entries()) {
    assert.equal(report.mode, slot === 0 ? 'host' : 'guest');
    assert.equal(report.phase, 'results', 'complete championship required');
    assert.deepEqual(report.match.players.map(p => p.character), expectedPair);
    assert.ok(report.match.result && report.match.result.total.every(Number.isFinite));
    assert.ok(report.match.players.every(p => p.hp >= 0 && p.hp <= 100));
  }
  assert.deepEqual(host.match.result, guest.match.result, 'both roles must agree on all scoring and winner');
  assert.deepEqual(host.match.players, guest.match.players, 'both reports must agree on final race/health state');
  const actions = [0, 1].map(slot => ({ slot,
    leaps: count(raceReports[0], slot, 'jump'),
    strikes: count(host, slot, 'attack') + count(host, slot, 'counter'),
    evades: count(host, slot, 'evade'), successes: count(host, slot, 'evade-success'),
    counters: count(host, slot, 'counter'), damageReceived: 100 - host.match.players[slot].hp,
  }));
  for (const row of actions) {
    assert.ok(row.leaps >= 2, `slot${row.slot}: real race leaps required`);
    assert.ok(row.strikes >= 2 && row.evades >= 1, `slot${row.slot}: actual strike and evade actions required`);
    assert.ok(row.successes >= 1, `slot${row.slot}: actual successful evade required; a visual pose is insufficient`);
    assert.ok(row.damageReceived > 0, `slot${row.slot}: consequential combat, not passive timeout`);
  }
  return { result: host.match.result, players: host.match.players, actions, network: [host.network, guest.network] };
}

function selfTest() {
  const events = [0, 1].flatMap(slot => ['jump', 'jump', 'attack', 'counter', 'evade', 'evade-success'].map(type => ({ slot, type })));
  const fixture = mode => ({ mode, phase: 'results', match: { players: [{ character: 'lion', hp: 30 }, { character: 'wolf', hp: 0 }], result: { race: [25, 25], fight: [32.5, 17.5], total: [57.5, 42.5], winner: 0 } }, playTrace: { events } });
  const host = fixture('host'), guest = fixture('guest');
  verifyRound(host, guest, [host, guest], ['lion', 'wolf']);
  const missing = structuredClone(host); missing.playTrace.events = missing.playTrace.events.filter(e => e.type !== 'evade-success');
  assert.throws(() => verifyRound(missing, guest, [host, guest], ['lion', 'wolf']), /successful evade/);
  const divergent = structuredClone(guest); divergent.match.result.winner = 1;
  assert.throws(() => verifyRound(host, divergent, [host, guest], ['lion', 'wolf']), /agree/);
  const passive = structuredClone(host); passive.match.players.forEach(p => { p.hp = 100; });
  const passiveGuest = structuredClone(passive); passiveGuest.mode = 'guest';
  assert.throws(() => verifyRound(passive, passiveGuest, [host, guest], ['lion', 'wolf']), /consequential/);
  console.log('BROWSER EVIDENCE ORACLE SELF-TEST VERIFIED — synthetic fixtures only; no browser launched');
}

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--describe') { console.log(JSON.stringify(plan, null, 2)); process.exit(0); }
if (args.length === 1 && args[0] === '--self-test') { selfTest(); process.exit(0); }
const options = {};
for (let i = 0; i < args.length; i += 2) {
  assert.ok(['--url', '--manifest', '--revision', '--pairs', '--rematch'].includes(args[i]) && args[i + 1], 'Use --url URL --manifest PATH --revision LABEL [--pairs lion:wolf,...] [--rematch first|none]');
  options[args[i].slice(2)] = args[i + 1];
}
assert.ok(options.url && options.manifest && options.revision, 'Frozen URL, manifest and expected report revision are required. --describe/--self-test launch no browser.');
const origin = new URL(options.url).origin;
assert.ok(['http:', 'https:'].includes(new URL(options.url).protocol));
const manifest = JSON.parse(await readFile(resolve(options.manifest), 'utf8'));
assert.ok(/^[a-f0-9]{64}$/.test(manifest.sourceFingerprint) && manifest.files);
const pairs = options.pairs ? options.pairs.split(',').map(p => p.split(':')) : allPairs;
assert.ok(pairs.length > 0 && pairs.length <= 9 && pairs.every(p => p.length === 2 && p.every(s => species.includes(s))));
assert.equal(new Set(pairs.map(p => p.join(':'))).size, pairs.length, 'no duplicate pairings');
const rematchFirst = options.rematch !== 'none';
assert.ok(!options.rematch || ['first', 'none'].includes(options.rematch));
assert.ok(pairs.length < 9 || rematchFirst, 'a complete nine-pair invocation must include a rematch');
const directory = resolve(root, 'scripts/network/browser-revision2', `run-${new Date().toISOString().replace(/[:.]/g, '-')}`);
await mkdir(dirname(directory), { recursive: true });
await mkdir(directory, { recursive: false });
const sourceCheck = async () => {
  for (const [path, sha] of Object.entries(manifest.files)) assert.equal(digest(await readFile(resolve(root, path))), sha, `frozen source drift: ${path}`);
};
await sourceCheck();
await json(resolve(directory, 'frozen-manifest.json'), manifest);
const buildId = await readFile(resolve(root, '.next/BUILD_ID'), 'utf8');
const started = Date.now(), results = [], served = new Map(), networkErrors = [], contexts = new Set(), pendingRecordings = [], media = [];
let sequence = 0;
const timeline = [], note = (kind, data = {}) => {
  timeline.push({ id: ++sequence, atMs: Date.now() - started, kind, ...data });
  assert.ok(timeline.length < 20_000, 'bounded evidence log');
  if (['phase', 'received-windup', 'visible-opening', 'reply-damage', 'exchange-failed', 'round-verified', 'media-processing-start', 'media-processing-end'].includes(kind)) {
    console.log(`[${Math.round((Date.now() - started) / 1000)}s] ${kind} ${JSON.stringify(data)}`);
  }
};
async function until(test, timeoutMs, label, interval = 80) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const runtimeError = timeline.find(row => row.kind === 'page-error');
    if (runtimeError) throw new Error(`Browser runtime error: ${runtimeError.message}`);
    const value = await test(); if (value) return value; await delay(interval);
  }
  throw new Error(`Timed out: ${label}`);
}
const phase = page => page.locator('main.championship').getAttribute('data-phase');
const visibleText = async locator => await locator.isVisible() ? locator.innerText({ timeout: 500 }).catch(() => '') : '';
const enabled = async locator => await locator.isVisible() && await locator.isEnabled({ timeout: 500 }).catch(() => false);
async function screenshot(page, filename) { await page.screenshot({ path: resolve(directory, filename), timeout: 15_000 }); }
async function panel(page, open) {
  if (await page.locator('.performance-panel').isVisible() !== open) await page.getByRole('button', { name: 'Performance report', exact: true }).click();
}
async function download(page, click, filename) {
  const [item] = await Promise.all([page.waitForEvent('download', { timeout: 20_000 }), click()]);
  const path = resolve(directory, filename + extname(item.suggestedFilename()));
  await item.saveAs(path); assert.equal(await item.failure(), null);
  note('ui-download', { file: path.slice(directory.length + 1) }); return path;
}
async function report(page, prefix) {
  await panel(page, true);
  const path = await download(page, () => page.getByRole('button', { name: 'Download measurements', exact: true }).click(), prefix);
  await panel(page, false);
  const value = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(value.revision, options.revision, 'public report revision must match frozen build label');
  return value;
}
async function startRecording(page) {
  await panel(page, true);
  await page.getByRole('button', { name: 'Start fresh measurement', exact: true }).click();
  await page.getByRole('button', { name: 'Record game canvas', exact: true }).click();
  await panel(page, false);
  await page.locator('.recording-indicator').waitFor({ state: 'visible' });
}
async function stopRecording(page, prefix) {
  if (!await page.locator('.recording-indicator').isVisible()) return null;
  const path = await download(page, () => page.locator('.recording-indicator').click(), prefix);
  pendingRecordings.push(path); return path;
}
async function compressRecordings() {
  assert.equal(contexts.size, 0, 'close both owned browsers before media processing');
  const processOptions = { timeout: 180_000, maxBuffer: 1024 * 1024 };
  const decode = async path => {
    const result = await processFile('ffmpeg', ['-v', 'error', '-nostdin', '-threads', '2', '-i', path, '-map', '0:v:0', '-map', '0:a?', '-f', 'null', '-'], processOptions);
    assert.equal(result.stderr.trim(), '', 'full recording decode must be clean');
  };
  while (pendingRecordings.length) {
    const raw = pendingRecordings.shift();
    assert.ok(raw.startsWith(directory + '/') && /\.(webm|mp4)$/.test(raw));
    note('media-processing-start', { raw: raw.slice(directory.length + 1) });
    await decode(raw);
    const rawProbe = JSON.parse((await processFile('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', raw], processOptions)).stdout);
    const rawSha256 = digest(await readFile(raw)), rawBytes = (await stat(raw)).size;
    const destination = raw.slice(0, -extname(raw).length) + '-review.mp4';
    await processFile('ffmpeg', ['-v', 'error', '-nostdin', '-n', '-threads', '2', '-i', raw, '-map', '0:v:0', '-map', '0:a?', '-vf', 'scale=960:-2', '-r', '30', '-c:v', 'libx264', '-threads', '2', '-preset', 'veryfast', '-crf', '25', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', destination], processOptions);
    await decode(destination);
    const outputProbe = JSON.parse((await processFile('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', destination], processOptions)).stdout);
    assert.ok(Number(outputProbe.format.duration) > 1, 'recording must contain playable motion');
    const rawDuration = Number(rawProbe.format.duration);
    if (Number.isFinite(rawDuration)) assert.ok(Math.abs(Number(outputProbe.format.duration) - rawDuration) < 0.5, 'compression retains the full recording duration');
    assert.ok(outputProbe.streams.some(s => s.codec_type === 'video' && s.codec_name === 'h264' && s.width === 960));
    if (rawProbe.streams.some(s => s.codec_type === 'audio')) assert.ok(outputProbe.streams.some(s => s.codec_type === 'audio' && s.codec_name === 'aac'));
    const entry = { rawFile: raw.slice(directory.length + 1), rawSha256, rawBytes, rawDecode: 'complete, no errors', rawProbe,
      file: destination.slice(directory.length + 1), sha256: digest(await readFile(destination)), bytes: (await stat(destination)).size, outputDecode: 'complete, no errors', outputProbe,
      encoding: 'H264 CRF25,960px wide,30fps,AAC96k; processed with owned browsers closed; functional smoke, no controlled performance claim' };
    media.push(entry); await json(destination + '.json', entry);
    await unlink(raw); // Only this run's verified duplicate, after both full decodes.
    note('media-processing-end', { file: entry.file, rawBytes, bytes: entry.bytes });
  }
}
async function tap(page, role, name) {
  note('button', { role, name }); await page.getByRole('button', { name, exact: true }).click({ timeout: 3000 });
}
async function hold(page, role, key, milliseconds) {
  note('key-down', { role, key, durationMs: milliseconds });
  await page.keyboard.down(key);
  try { await delay(milliseconds); } finally { await page.keyboard.up(key); note('key-up', { role, key }); }
}
async function release(page) { for (const key of ['ArrowLeft', 'ArrowRight', 'Space', 'j']) await page.keyboard.up(key).catch(() => {}); }
async function inward(pages, ms = 550) {
  await Promise.all([hold(pages[0], 'host', 'ArrowRight', ms), hold(pages[1], 'guest', 'ArrowLeft', ms)]);
}
async function race(page, role) {
  await until(async () => ['race', 'transition', 'fight'].includes(await phase(page)), 25_000, `${role} race start`);
  const acted = new Set(), end = Date.now() + 150_000;
  let previousPhase = '';
  while (Date.now() < end) {
    assert.ok(!timeline.some(row => row.kind === 'page-error'), 'browser runtime error during race');
    const current = await phase(page);
    if (current !== previousPhase) { note('phase', { role, phase: current }); previousPhase = current; }
    if (['transition', 'fight', 'results'].includes(current)) return;
    assert.equal(current, 'race', `${role}: race must not disconnect or leave`);
    const progress = parseInt(await visibleText(page.locator('.race-distance > span')), 10);
    for (const at of [16, 61]) if (progress >= at && !acted.has(`jump${at}`)) {
      acted.add(`jump${at}`); await tap(page, role, 'Leap');
    }
    const steering = [[10, 'ArrowRight'], [20, 'ArrowRight'], [35, 'ArrowLeft'], [45, 'ArrowLeft'], [60, 'ArrowRight'], [72, 'ArrowRight'], [85, 'ArrowLeft']];
    for (const [at, key] of steering) if (progress >= at && !acted.has(`steer${at}`)) {
      acted.add(`steer${at}`); await hold(page, role, key, role === 'guest' ? 260 : 180);
    }
    await delay(150);
  }
  throw new Error(`${role}: race exceeded wall-time bound`);
}
async function health(page) {
  if (await phase(page) !== 'fight') return null;
  const text = await page.locator('.health-block small').allTextContents();
  return text.map(s => Number(/^\s*(\d+) HP/.exec(s)?.[1]));
}
async function exchange(pages, defender, prefix, attempt) {
  const attacker = 1 - defender, role = defender === 0 ? 'host' : 'guest';
  if (!await Promise.all(pages.map(phase)).then(p => p.every(v => v === 'fight'))) return false;
  await inward(pages);
  await delay(150);
  const before = await health(pages[0]);
  await tap(pages[attacker], attacker === 0 ? 'host' : 'guest', 'Strike');
  try {
    await until(async () => await visibleText(pages[defender].locator('.duel-cue')) === 'WATCH THE WIND-UP', 1800, `${role} received windup`, 30);
    const observed = Date.now(); note('received-windup', { role, attempt });
    await delay(330);
    await tap(pages[defender], role, 'Evade');
    const evadedAt = Date.now();
    note('reaction', { role, afterObservedCueMs: Date.now() - observed });
    await until(async () => (await visibleText(pages[defender].locator('.match-hint'))).includes('YOUR OPENING'), 1500, `${role} authoritative evade opening`, 30);
    note('visible-opening', { role, attempt });
    // Ordinary approach/reply inside the visible opening. No position reads.
    // Let the visible evade complete before moving; screenshot work must not
    // insert an artificial delay into the limited reply window.
    await delay(Math.max(0, evadedAt + 500 - Date.now()));
    await hold(pages[defender], role, defender === 0 ? 'ArrowRight' : 'ArrowLeft', 360);
    await tap(pages[defender], role, 'Strike');
    await until(async () => { const hp = await health(pages[0]); return !hp || hp[attacker] < before[attacker]; }, 2200, `${role} reply causes authoritative damage`, 50);
    note('reply-damage', { role, before, after: await health(pages[0]) });
    await screenshot(pages[defender], `${prefix}-${role}-reply-${attempt}.png`);
    await delay(1300); return true;
  } catch (error) {
    if (error instanceof ReferenceError || error instanceof SyntaxError) throw error;
    note('exchange-failed', { role, attempt, error: error.message, before, after: await health(pages[0]) });
    await screenshot(pages[defender], `${prefix}-${role}-exchange-failed-${attempt}.png`);
    await delay(1800); return false;
  } finally { await Promise.all(pages.map(release)); }
}
async function duel(pages, prefix) {
  await Promise.all(pages.map(page => until(async () => await phase(page) === 'fight', 15_000, 'fight start')));
  for (const defender of [1, 0]) {
    for (let attempt = 1; attempt <= 3; attempt++) if (await exchange(pages, defender, prefix, attempt)) break;
  }
  const end = Date.now() + 100_000;
  for (let turn = 0; turn < 28 && Date.now() < end; turn++) {
    if (await phase(pages[0]) === 'results') break;
    assert.equal(await phase(pages[0]), 'fight', 'must remain connected during duel');
    await inward(pages, 600);
    const attacker = turn % 2, before = await health(pages[0]);
    await tap(pages[attacker], attacker === 0 ? 'host' : 'guest', 'Strike');
    await until(async () => { const hp = await health(pages[0]); return !hp || hp[1 - attacker] < before[1 - attacker]; }, 2300, 'committed strike damage', 80).catch(error => note('strike-did-not-hit', { turn, error: error.message }));
    await delay(1050);
  }
  await Promise.all(pages.map(page => until(async () => await phase(page) === 'results', 70_000, 'complete results')));
}

async function launch(role, pairName) {
  const profile = resolve(directory, `profile-${pairName}-${role}`);
  const context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true, viewport: { width: 1100, height: 740 }, deviceScaleFactor: 1, acceptDownloads: true });
  contexts.add(context);
  const page = context.pages()[0] ?? await context.newPage();
  const pending = new Set();
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.origin !== origin || !response.ok() || !(url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/assets/'))) return;
    const work = (async () => {
      const pathname = decodeURIComponent(url.pathname);
      const local = pathname.startsWith('/_next/static/') ? resolve(root, '.next/static', pathname.slice('/_next/static/'.length)) : resolve(root, 'public', pathname.slice(1));
      const [remote, bytes] = await Promise.all([response.body(), readFile(local)]);
      const actual = digest(remote); assert.equal(actual, digest(bytes), `served build mismatch: ${url.pathname}`);
      served.set(url.pathname, { sha256: actual, bytes: remote.length }); assert.ok(served.size < 300);
    })().catch(error => networkErrors.push({ role, message: error.message }));
    pending.add(work); work.finally(() => pending.delete(work));
  });
  page.on('pageerror', error => note('page-error', { role, message: error.message.slice(0, 500) }));
  try {
    await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await until(() => enabled(page.getByRole('button', { name: 'Invite a friend', exact: true })), 45_000, 'champions prepared');
    await report(page, `${pairName}-${role}-initial-report`);
    return { context, page, profile, pending };
  } catch (error) {
    await context.close(); contexts.delete(context); await rm(profile, { recursive: true, force: true }); throw error;
  }
}

let consecutiveFailures = 0, fatalFailure = null;
try {
  for (const [index, pair] of pairs.entries()) {
    const prefix = `${String(index + 1).padStart(2, '0')}-${pair.join('-')}`, clients = [];
    note('pair-start', { pair }); console.log(`Starting ${prefix}`);
    try {
      clients.push(await launch('host', prefix)); clients.push(await launch('guest', prefix));
      const pages = clients.map(c => c.page);
      await Promise.all(pages.map((page, slot) => page.locator('.roster-card').filter({ hasText: names[pair[slot]] }).click()));
      await pages[0].getByRole('button', { name: 'Invite a friend', exact: true }).click();
      await pages[0].locator('.invite-code').waitFor({ state: 'visible', timeout: 30_000 });
      const code = (await pages[0].locator('.invite-code').innerText()).trim().split(/\s/)[0];
      assert.ok(/^[A-Z0-9]{10}$/.test(code), 'visible invitation code');
      await pages[1].getByRole('textbox', { name: 'Invitation code' }).fill(code);
      await pages[1].getByRole('button', { name: 'Join friend', exact: true }).click();
      await Promise.all(pages.map(page => until(() => enabled(page.getByRole('button', { name: 'READY TO RIDE' })), 35_000, 'paired lobby')));
      const rounds = [];
      for (let round = 1; round <= (index === 0 && rematchFirst ? 2 : 1); round++) {
        const roundPrefix = `${prefix}-round${round}`;
        await Promise.all(pages.map(startRecording));
        if (round === 1) await Promise.all(pages.map(page => page.getByRole('button', { name: 'READY TO RIDE' }).click()));
        else await Promise.all(pages.map(page => page.getByRole('button', { name: 'RIDE AGAIN' }).click()));
        await Promise.all(pages.map((page, slot) => race(page, slot === 0 ? 'host' : 'guest')));
        const raceReports = await Promise.all(pages.map((page, slot) => report(page, `${roundPrefix}-${slot ? 'guest' : 'host'}-race-report`)));
        await Promise.all(pages.map((page, slot) => screenshot(page, `${roundPrefix}-${slot ? 'guest' : 'host'}-transition.png`)));
        await duel(pages, roundPrefix);
        await Promise.all(pages.map((page, slot) => screenshot(page, `${roundPrefix}-${slot ? 'guest' : 'host'}-results.png`)));
        const finalReports = await Promise.all(pages.map((page, slot) => report(page, `${roundPrefix}-${slot ? 'guest' : 'host'}-final-report`)));
        await Promise.all(pages.map((page, slot) => stopRecording(page, `${roundPrefix}-${slot ? 'guest' : 'host'}-recording`)));
        const verified = verifyRound(...finalReports, raceReports, pair);
        rounds.push(verified); note('round-verified', { pair, round, result: verified.result });
        await json(resolve(directory, `${roundPrefix}-verified.json`), verified);
      }
      results.push({ pair, passed: true, rounds }); consecutiveFailures = 0;
      await Promise.all(pages.map(page => page.getByRole('button', { name: 'Back to the trail', exact: true }).click()));
      console.log(`Verified ${prefix}: ${rounds.length} complete match(es)`);
    } catch (error) {
      results.push({ pair, passed: false, error: error.message }); consecutiveFailures++;
      note('pair-failed', { pair, error: error.message }); console.log(`Failed ${prefix}: ${error.message}`);
      await Promise.all(clients.map(async ({ page }, slot) => {
        const label = `${prefix}-${slot ? 'guest' : 'host'}-failure`;
        await release(page); await screenshot(page, `${label}.png`).catch(() => {});
        await report(page, `${label}-report`).catch(() => {}); await stopRecording(page, `${label}-recording`).catch(() => {});
      }));
      if (error instanceof ReferenceError || error instanceof SyntaxError || timeline.some(row => row.kind === 'page-error')) throw error;
    } finally {
      for (const client of clients) { await Promise.allSettled([...client.pending]); await client.context.close(); contexts.delete(client.context); await rm(client.profile, { recursive: true, force: true }); }
      await compressRecordings();
      await sourceCheck();
      assert.equal(await readFile(resolve(root, '.next/BUILD_ID'), 'utf8'), buildId, 'production build changed during browser matrix');
      if (consecutiveFailures >= 2) break; // Stop a systemic failure; preserve attempts for repair.
    }
  }
} catch (error) {
  fatalFailure = error.message; note('fatal-run-error', { error: error.message }); throw error;
} finally {
  for (const context of contexts) await context.close().catch(() => {});
  const summary = { ...plan, startedAt: new Date(started).toISOString(), completedAt: new Date().toISOString(), url: options.url, sourceFingerprint: manifest.sourceFingerprint, buildId: buildId.trim(), expectedReportRevision: options.revision,
    requestedPairs: pairs, rematchFirst, results, served: Object.fromEntries(served), servedValidationErrors: networkErrors, media, timeline, fatalFailure,
    matrixPassed: !fatalFailure && !timeline.some(row => row.kind === 'page-error') && results.length === 9 && results.every(r => r.passed) && results[0].rounds.length === 2 && networkErrors.length === 0,
  };
  await json(resolve(directory, 'browser-matrix-result.json'), summary);
  console.log(`Evidence saved: ${directory}`);
}
assert.equal(networkErrors.length, 0, 'all observed served assets/bundles must match the frozen build');
assert.ok(!timeline.some(row => row.kind === 'page-error'), 'browser runtime errors require review before acceptance');
assert.equal(results.length, pairs.length, 'all requested pairs completed');
assert.ok(results.every(r => r.passed), 'every requested normal-control pair must pass');
console.log(pairs.length === 9 ? 'NORMAL-CONTROL CHROME MATRIX VERIFIED — same-machine smoke only' : 'NORMAL-CONTROL CHROME SUBSET VERIFIED — full matrix remains open');
