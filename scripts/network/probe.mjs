/**
 * Manually invoked, bounded shared-service experiment. Never part of npm test/build.
 * node --env-file-if-exists=.env.local --experimental-transform-types scripts/network/probe.mjs
 */
import { writeFile } from 'node:fs/promises';
import { ChampionshipNetwork, generateInviteCode } from '../../src/championship/network.ts';

const output = new URL('./probe-result.json', import.meta.url);
const started = performance.now();
const statuses = { host: [], guest: [] };
const report = {
  recordedAt: new Date().toISOString(),
  experiment: 'Two independent clients on one computer, public Supabase Broadcast, one random isolated room',
  acceptance: 'Transport smoke experiment only. Does not establish physical-device, separate-network, full-match or gameplay latency acceptance.',
  budget: { maximumActiveMs: 10_000, maximumApplicationMessages: 24, pingPayloadPaddingBytes: 4_096 },
  status: 'pending',
  statuses,
};
const percentile = (samples, q) => {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted.length ? Math.round(sorted[Math.ceil(sorted.length * q) - 1] * 100) / 100 : null;
};
const distribution = samples => ({ count: samples.length, p50: percentile(samples, 0.5), p95: percentile(samples, 0.95), max: samples.length ? Math.round(Math.max(...samples) * 100) / 100 : null });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function save() {
  report.elapsedMs = Math.round(performance.now() - started);
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  report.status = 'blocked-missing-public-config';
  report.reason = 'NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY absent. No network connection attempted.';
  await save();
  process.exitCode = 2;
} else {
  const host = new ChampionshipNetwork();
  const guest = new ChampionshipNetwork();
  let sent = 0;
  const hostToGuest = new Map();
  const guestToHost = new Map();
  const roundTrips = new Map();
  const watchdog = setTimeout(async () => {
    report.status = 'failed-hard-deadline';
    await save();
    process.exit(1);
  }, 9_900);
  host.onStatus = status => { statuses.host.push({ status, atMs: Math.round(performance.now() - started) }); };
  guest.onStatus = status => { statuses.guest.push({ status, atMs: Math.round(performance.now() - started) }); };
  guest.onMessage = message => {
    const data = message.data;
    if (message.type !== 'probe_ping' || !Number.isInteger(data?.index) || typeof data?.at !== 'number') return;
    hostToGuest.set(data.index, performance.now() - data.at);
    guest.send('probe_pong', { index: data.index, at: data.at, guestAt: performance.now() });
  };
  host.onMessage = message => {
    const data = message.data;
    if (message.type !== 'probe_pong' || !Number.isInteger(data?.index) || typeof data?.guestAt !== 'number') return;
    guestToHost.set(data.index, performance.now() - data.guestAt);
    roundTrips.set(data.index, performance.now() - data.at);
  };
  try {
    const code = generateInviteCode();
    await Promise.all([host.connect(code, true), guest.connect(code, false)]);
    while ((!host.peerId || !guest.peerId) && performance.now() - started < 6_500) await pause(25);
    if (!host.peerId || !guest.peerId) throw new Error('pairing');
    report.pairedAtMs = Math.round(performance.now() - started);
    for (let index = 0; index < 12 && performance.now() - started < 7_500; index++) {
      host.send('probe_ping', { index, at: performance.now(), padding: 'x'.repeat(4_096) });
      sent++;
      await pause(167);
    }
    while (roundTrips.size < sent && performance.now() - started < 8_300) await pause(25);
    report.status = sent === 12 && roundTrips.size === sent ? 'completed' : 'completed-with-loss-or-deadline';
  } catch {
    // SDK exceptions can contain endpoint/key information. Report only a fixed safe diagnostic.
    report.status = 'failed-connect-or-pair';
    report.reason = 'Connection or pairing did not complete within the bounded experiment. See sanitized status values.';
  } finally {
    report.delivery = {
      hostPingsAttempted: sent,
      hostPingsReceived: hostToGuest.size,
      guestPongsReceived: guestToHost.size,
      roundTripsCompleted: roundTrips.size,
      pingLossFraction: sent ? (sent - hostToGuest.size) / sent : null,
      roundTripLossFraction: sent ? (sent - roundTrips.size) / sent : null,
    };
    report.timingMs = { hostToGuest: distribution([...hostToGuest.values()]), guestToHost: distribution([...guestToHost.values()]), roundTrip: distribution([...roundTrips.values()]) };
    await Promise.allSettled([host.disconnect(), guest.disconnect()]);
    clearTimeout(watchdog);
    await save();
    if (report.status !== 'completed') process.exitCode = 1;
  }
}
