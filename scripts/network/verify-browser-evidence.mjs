/** Read-only re-verification of saved UI evidence. No browser or service access. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const evidenceRoot = resolve(root, 'scripts/network/browser-revision2');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const load = async path => JSON.parse(await readFile(path, 'utf8'));
const count = (report, slot, type) => report.playTrace.events.filter(event => event.slot === slot && event.type === type).length;
const argumentsList = process.argv.slice(2);
const selectedPairs = argumentsList[0] === '--pairs' ? argumentsList.splice(0, 2)[1].split(',') : null;
const species = ['lion', 'wolf', 'unicorn'];
const allPairs = species.flatMap(host => species.map(guest => `${host}:${guest}`));
const expectedPairs = selectedPairs ?? allPairs;
assert.ok(expectedPairs.length >= 1 && expectedPairs.length <= 9 && new Set(expectedPairs).size === expectedPairs.length && expectedPairs.every(pair => allPairs.includes(pair)), 'explicit valid ordered pair coverage');
const directories = argumentsList.map(path => resolve(path));
assert.ok(directories.length > 0 && directories.length <= 12, 'Supply one or more completed run directories; default requires all nine pairings; --pairs explicitly requests a bounded affected subset.');
const runs = [], rounds = [], failures = [], media = [], reactions = [];
const paired = new Set();
let fingerprint = null, revision = null, buildId = null, referenceFiles = null;

for (const directory of directories) {
  assert.ok(relative(evidenceRoot, directory).startsWith('run-') && !relative(evidenceRoot, directory).includes('..'));
  const summaryBytes = await readFile(resolve(directory, 'browser-matrix-result.json'));
  const summary = JSON.parse(summaryBytes);
  const manifest = await load(resolve(directory, 'frozen-manifest.json'));
  const identity = await load(resolve(directory, 'harness-identity.json'));
  assert.equal(sha(await readFile(resolve(directory, 'executed-harness.mjs'))), identity.harnessSha256);
  assert.equal(sha(await readFile(resolve(directory, 'executed-media-helper.mjs'))), identity.mediaHelperSha256);
  fingerprint ??= summary.sourceFingerprint; revision ??= summary.expectedReportRevision; buildId ??= summary.buildId;
  referenceFiles ??= manifest.files;
  assert.equal(summary.sourceFingerprint, fingerprint, 'one frozen fingerprint');
  assert.equal(manifest.sourceFingerprint, fingerprint);
  assert.deepEqual(manifest.files, referenceFiles);
  assert.equal(summary.expectedReportRevision, revision);
  assert.equal(summary.buildId, buildId);
  assert.equal(summary.fatalFailure, null);
  assert.deepEqual(summary.servedValidationErrors, []);
  assert.ok(!summary.timeline.some(row => row.kind === 'page-error'));
  assert.ok(Object.keys(summary.served).length > 0, 'observed served-file validation');
  for (const [path, entry] of Object.entries(summary.served)) {
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
    if (path.startsWith('/assets/')) assert.equal(entry.sha256, manifest.files[`public${path}`], `served frozen asset ${path}`);
  }
  runs.push({ directory: basename(directory), summarySha256: sha(summaryBytes), viewport: summary.viewport ?? [1100, 740], recordingRoles: summary.recordingRoles ?? 'both', harness: identity.harnessSha256 });
  reactions.push(...summary.timeline.filter(row => row.kind === 'reaction').map(row => ({ directory: basename(directory), role: row.role, observedCueToCompletedClickMs: row.afterObservedCueMs })));
  failures.push(...summary.results.filter(result => !result.passed).map(result => ({ directory: basename(directory), ...result })));
  for (const [index, pair] of summary.requestedPairs.entries()) {
    const result = summary.results.find(result => result.pair.join(':') === pair.join(':'));
    if (!result?.passed) continue; // Failed attempts stay explicit; no success inferred.
    assert.ok(!paired.has(pair.join(':')), 'exactly one accepted run per ordered pairing');
    paired.add(pair.join(':'));
    const prefix = `${String(index + 1).padStart(2, '0')}-${pair.join('-')}`;
    assert.ok(result.rounds.length === 1 || result.rounds.length === 2);
    for (let round = 1; round <= result.rounds.length; round++) {
      const name = `${prefix}-round${round}`;
      const reports = await Promise.all(['host', 'guest'].map(role => load(resolve(directory, `${name}-${role}-final-report.json`))));
      const race = await load(resolve(directory, `${name}-host-race-report.json`));
      const actions = [];
      for (const [slot, report] of reports.entries()) {
        assert.equal(report.revision, revision); assert.equal(report.phase, 'results');
        assert.equal(report.mode, slot === 0 ? 'host' : 'guest');
        assert.deepEqual(report.match.players.map(player => player.character), pair);
        assert.ok(report.session.phases.results.elapsedMs >= 4500, 'complete score/trophy reveal retained');
        assert.ok(report.playTrace.events.length <= 256 && race.playTrace.events.length <= 256, 'bounded public trace');
        assert.equal(report.network.transport, 'webrtc', 'this matrix documents direct WebRTC');
        assert.ok(report.network.roundTrip.sampleCount > 0 && report.network.roundTrip.sampleCount <= 60);
        const row = { slot, leaps: count(race, slot, 'jump'), strikes: count(reports[0], slot, 'attack') + count(reports[0], slot, 'counter'), evades: count(reports[0], slot, 'evade'), successfulEvades: count(reports[0], slot, 'evade-success'), counters: count(reports[0], slot, 'counter'), damageReceived: 100 - report.match.players[slot].hp };
        assert.ok(row.leaps >= 2 && row.strikes >= 2 && row.evades >= 1 && row.successfulEvades >= 1 && row.damageReceived > 0, 'both roles must perform consequential actions');
        assert.ok(row.counters >= 1, `${basename(directory)}/${name}/slot${slot}: authoritative counter reply required inside the earned opening`);
        actions.push(row);
        assert.ok((await stat(resolve(directory, `${name}-${slot ? 'guest' : 'host'}-results.png`))).size > 1000);
      }
      assert.deepEqual(reports[0].match.players, reports[1].match.players);
      assert.deepEqual(reports[0].match.result, reports[1].match.result);
      assert.deepEqual(reports[0].match.result, result.rounds[round - 1].result, 're-derived result agrees with recorded verification');
      const recording = summary.media.find(item => item.file === `${name}-host-recording-review.mp4`);
      assert.ok(recording, 'at least one complete recording per round');
      rounds.push({ directory: basename(directory), name, pair, round, result: reports[0].match.result, players: reports[0].match.players, actions, network: reports.map(report => report.network), reportHashes: await Promise.all(['host', 'guest'].map(async role => sha(await readFile(resolve(directory, `${name}-${role}-final-report.json`))))) });
    }
  }
  for (const item of summary.media) {
    assert.equal(item.rawDecode, 'complete; no errors with passthrough microsecond output timebase');
    assert.equal(item.outputDecode, 'complete; no errors');
    const bytes = await readFile(resolve(directory, item.file));
    assert.equal(bytes.length, item.bytes); assert.equal(sha(bytes), item.sha256);
    const sidecar = await load(resolve(directory, item.file + '.json'));
    assert.deepEqual(sidecar, item);
    const accepted = rounds.some(round => round.directory === basename(directory) && item.file.startsWith(round.name + '-'));
    assert.ok(Number(item.outputProbe.format.duration) > (accepted ? 60 : 1), accepted ? 'complete championship length, not a short connection clip' : 'failed-attempt recording retains playable motion');
    media.push({ accepted, directory: basename(directory), file: item.file, bytes: item.bytes, duration: Number(item.outputProbe.format.duration), sha256: item.sha256 });
  }
}
assert.deepEqual([...paired].sort(), [...expectedPairs].sort(), selectedPairs ? 'all explicitly requested affected pairings required' : 'all nine ordered pairings required');
assert.ok(rounds.some(round => round.round === 2), 'one complete agreed rematch required');
const output = {
  verifiedAt: new Date().toISOString(), classification: 'Loaded same-machine normal-control installed Chrome integration only; not physical-phone, separate-network, human feel, controlled performance or visual-art acceptance.',
  expectedPairs, coverage: selectedPairs ? 'explicit affected subset; not full nine-pair matrix' : 'all nine ordered pairings', sourceFingerprint: fingerprint, revision, buildId, runs, pairCount: paired.size, roundCount: rounds.length, rounds, failures, reactions, media,
  limitations: ['Shared machine/network and recording/rendering contention.', 'Canvas recordings omit DOM; screenshots and public reports supply HUD evidence.', 'Observed cue-to-click includes automation overhead and is not human reaction latency.', 'Art acceptance requires exact-revision renderer and complete motion review; this report only verifies functional observations and media integrity.', 'Media hashes rechecked here; full clean raw/output decodes were performed by each run media helper.'],
};
const outputPath = resolve(evidenceRoot, `aggregate-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
await writeFile(outputPath, JSON.stringify(output, null, 2) + '\n', { flag: 'wx' });
console.table(rounds.map(round => ({ pair: round.pair.join('/'), round: round.round, score: round.result.total.join('/'), leaps: round.actions.map(row => row.leaps).join('/'), evades: round.actions.map(row => row.successfulEvades).join('/'), damageReceived: round.actions.map(row => row.damageReceived).join('/') })));
console.log(`Evidence: ${outputPath}`);
console.log(`SAVED BROWSER MATRIX VERIFIED — ${paired.size} pairings, ${rounds.length} full rounds, ${media.filter(item => item.accepted).length} accepted portable recordings (${media.length} including failed attempts); loaded same-machine only`);
