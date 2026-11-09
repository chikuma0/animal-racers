import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChampionshipNetwork, generateInviteCode, NETWORK_LIMITS, NETWORK_NAMESPACE, type NetworkChannel, type NetworkClient, type NetworkOptions } from './network';

const CODE = 'ABCDEFGH23';
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

class Hub {
  channels: FakeChannel[] = [];
  clients: FakeClient[] = [];
  client = async () => {
    const client = new FakeClient(this);
    this.clients.push(client);
    return client;
  };
  sync() { for (const channel of [...this.channels]) channel.presence?.(); }
}
class FakeClient implements NetworkClient {
  disconnected = false;
  removed = 0;
  constructor(readonly hub: Hub) {}
  channel(topic: string, id: string): FakeChannel {
    const channel = new FakeChannel(this.hub, topic, id);
    this.hub.channels.push(channel);
    return channel;
  }
  async removeChannel(channel: NetworkChannel) {
    this.removed++;
    this.hub.channels = this.hub.channels.filter(other => other !== channel);
    this.hub.sync();
  }
  disconnect() { this.disconnected = true; }
}
class FakeChannel implements NetworkChannel {
  broadcast?: (payload: unknown) => void;
  presence?: () => void;
  status?: (status: string) => void;
  metadata: Record<string, unknown> | null = null;
  sent: unknown[] = [];
  joined = true;
  trackResult = 'ok';
  sendResult = 'ok';
  acknowledge?: () => Promise<string>;
  constructor(readonly hub: Hub, readonly topic: string, readonly id: string) {}
  onBroadcast(callback: (payload: unknown) => void) { this.broadcast = callback; }
  onPresence(callback: () => void) { this.presence = callback; }
  presenceState(): Record<string, unknown> {
    return Object.fromEntries(this.hub.channels.filter(channel => channel.topic === this.topic && channel.metadata).map(channel => [channel.id, [channel.metadata]]));
  }
  subscribe(callback: (status: string) => void) {
    this.status = callback;
    queueMicrotask(() => callback('SUBSCRIBED'));
  }
  async track(presence: Record<string, unknown>) {
    this.metadata = presence;
    queueMicrotask(() => this.hub.sync());
    return this.trackResult;
  }
  async send(payload: unknown) {
    this.sent.push(payload);
    for (const channel of this.hub.channels) if (channel !== this && channel.topic === this.topic) channel.broadcast?.(payload);
    return this.acknowledge ? this.acknowledge() : this.sendResult;
  }
  isJoined() { return this.joined; }
}

const networks: ChampionshipNetwork[] = [];
function network(hub: Hub, options: Parameters<typeof make>[1] = {}) { return make(hub, options); }
function make(hub: Hub, options: Omit<NetworkOptions, 'createClient'> = {}) {
  const net = new ChampionshipNetwork({ createClient: hub.client, ...options });
  networks.push(net);
  return net;
}
async function pair(options: { now?: () => number } = {}) {
  const hub = new Hub();
  const host = network(hub, options);
  const guest = network(hub, options);
  await host.connect(CODE, true);
  await guest.connect(CODE, false);
  await flush();
  return { hub, host, guest, hostChannel: hub.channels[0], guestChannel: hub.channels[1] };
}
afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(networks.splice(0).map(net => net.disconnect()));
  vi.unstubAllEnvs();
});

class FakeDataChannel {
  label = 'championship'; readyState = 'connecting'; bufferedAmount = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  peer: FakeDataChannel | null = null;
  sent: string[] = [];
  send(data: string) { this.sent.push(data); this.peer?.onmessage?.({ data }); }
  close() { this.readyState = 'closed'; this.onclose?.(); }
}
class FakePeerConnection {
  connectionState = 'new'; iceGatheringState = 'complete';
  localDescription: RTCSessionDescriptionInit | null = null;
  onconnectionstatechange: (() => void) | null = null;
  ondatachannel: ((event: { channel: RTCDataChannel }) => void) | null = null;
  data: FakeDataChannel | null = null;
  closed = false;
  readonly id: number;
  constructor(readonly registry: FakePeerConnection[]) { this.id = registry.length; registry.push(this); }
  createDataChannel() { this.data = new FakeDataChannel(); return this.data as unknown as RTCDataChannel; }
  async createOffer(): Promise<RTCSessionDescriptionInit> { return { type: 'offer', sdp: String(this.id) }; }
  async createAnswer(): Promise<RTCSessionDescriptionInit> { return { type: 'answer', sdp: String(this.id) }; }
  async setLocalDescription(description: RTCSessionDescriptionInit) { this.localDescription = description; }
  async setRemoteDescription(description: RTCSessionDescriptionInit) {
    if (description.type !== 'answer') return;
    const guest = this.registry[Number(description.sdp)];
    const channel = new FakeDataChannel();
    guest.data = channel;
    channel.peer = this.data;
    this.data!.peer = channel;
    guest.ondatachannel?.({ channel: channel as unknown as RTCDataChannel });
    this.connectionState = guest.connectionState = 'connected';
    queueMicrotask(() => {
      channel.readyState = this.data!.readyState = 'open';
      channel.onopen?.(); this.data!.onopen?.();
    });
  }
  close() { this.closed = true; this.connectionState = 'closed'; }
}
async function directPair(options: { now?: () => number; onChannel?: (channel: FakeChannel, index: number) => void } = {}) {
  const hub = new Hub();
  const createClient = hub.client;
  hub.client = async () => {
    const client = await createClient();
    const createChannel = client.channel.bind(client);
    client.channel = (topic, id) => {
      const channel = createChannel(topic, id);
      options.onChannel?.(channel, hub.channels.indexOf(channel));
      return channel;
    };
    return client;
  };
  const pcs: FakePeerConnection[] = [];
  const createPeerConnection = () => new FakePeerConnection(pcs) as unknown as RTCPeerConnection;
  const host = network(hub, { createPeerConnection, now: options.now });
  const guest = network(hub, { createPeerConnection, now: options.now });
  await host.connect(CODE, true); await guest.connect(CODE, false); await flush(); await flush();
  return { hub, host, guest, pcs };
}

describe('championship realtime boundary', () => {
  it('generates crypto invite codes and leaves solo construction independent of configuration', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    const codes = new Set(Array.from({ length: 128 }, generateInviteCode));
    expect(codes.size).toBe(128);
    for (const code of codes) expect(code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
    const offline = new ChampionshipNetwork();
    expect(offline.id).toMatch(/^[a-f0-9]{32}$/);
    await expect(offline.connect(CODE, true)).rejects.toThrow('Solo play is available');
  });

  it('normalizes a pasted code and rejects invalid codes before creating a backend', async () => {
    const hub = new Hub();
    const net = network(hub);
    await expect(net.connect('1234', true)).rejects.toThrow('10-character');
    expect(hub.clients).toHaveLength(0);
    await net.connect(' abcde-fgh23 ', true);
    expect(hub.channels[0].topic).toBe(`${NETWORK_NAMESPACE}:${CODE}`);
  });

  it('pairs roles explicitly and copies a mutable snapshot before delivering it', async () => {
    const { host, guest, hostChannel } = await pair();
    expect(host.peerId).toBe(guest.id);
    expect(guest.peerId).toBe(host.id);
    const receive = vi.fn();
    guest.onMessage = receive;
    const snapshot = { tick: 4, players: [{ hp: 90 }] };
    host.send('snapshot', snapshot);
    snapshot.players[0].hp = 1;
    expect(receive).toHaveBeenCalledWith({ type: 'snapshot', sender: host.id, data: { tick: 4, players: [{ hp: 90 }] } });
    expect((hostChannel.sent[0] as { data: unknown }).data).not.toBe(snapshot);
    host.send('snapshot', { first: snapshot.players[0], second: snapshot.players[0] });
    expect(receive).toHaveBeenLastCalledWith({ type: 'snapshot', sender: host.id, data: { first: { hp: 1 }, second: { hp: 1 } } });
  });

  it('rejects unknown participants and an extra guest without taking over a bound pair', async () => {
    const { hub, host, guest, hostChannel, guestChannel } = await pair();
    const extra = network(hub);
    const statuses: string[] = [];
    extra.onStatus = status => statuses.push(status);
    await expect(extra.connect(CODE, false)).rejects.toThrow('already has two players');
    await flush();
    expect(statuses).toContain('room-full');
    expect(host.peerId).toBe(guest.id);
    expect(guest.peerId).toBe(host.id);
    const receive = vi.fn();
    host.onMessage = receive;
    guest.send('input', { move: 1 });
    const message = guestChannel.sent[0] as Record<string, unknown>;
    hostChannel.broadcast?.({ ...message, sender: extra.id, seq: 2 });
    expect(receive).toHaveBeenCalledTimes(1);
  });

  it('detects a conflicting host instead of arbitrarily authorizing two authorities', async () => {
    const hub = new Hub();
    const first = network(hub);
    const second = network(hub);
    const statuses: string[] = [];
    first.onStatus = second.onStatus = status => statuses.push(status);
    await first.connect(CODE, true);
    await Promise.allSettled([second.connect(CODE, true)]);
    await flush();
    expect(statuses).toContain('room-conflict');
    expect(hub.channels.length).toBeLessThanOrEqual(1);
    expect(first.peerId).toBeNull();
    expect(second.peerId).toBeNull();
  });

  it('rejects stale, spoofed, cross-room, misdirected and malformed envelopes', async () => {
    const { host, guest, hostChannel, guestChannel } = await pair();
    const receive = vi.fn();
    host.onMessage = receive;
    guest.send('input', { move: 1 });
    const message = guestChannel.sent[0] as Record<string, unknown>;
    const invalid = [
      null, [], 'input', message,
      { v: 1, room: CODE, sender: guest.id, session: message.session, recipient: host.id, seq: 2, type: 'input' },
      { ...message, seq: 2, extra: true },
      { ...message, seq: 0 }, { ...message, seq: 1.5 }, { ...message, seq: Number.MAX_VALUE },
      { ...message, seq: 2, v: 0 }, { ...message, seq: 2, sender: host.id },
      { ...message, seq: 2, session: '0'.repeat(32) }, { ...message, seq: 2, room: 'OTHERROOM2' },
      { ...message, seq: 2, recipient: guest.id }, { ...message, seq: 2, type: 'INVALID/TYPE' },
      { ...message, seq: 2, data: { move: Infinity } }, { ...message, seq: 2, data: { move: NaN } },
      { ...message, seq: 2, data: 'a'.repeat(NETWORK_LIMITS.maxBytes + 1) },
      { ...message, seq: 2, data: JSON.parse('{"__proto__":{"polluted":true}}') },
    ];
    for (const bad of invalid) hostChannel.broadcast?.(bad);
    expect(receive).toHaveBeenCalledTimes(1);
  });

  it('bounds outgoing structure, payload bytes, send rate and disconnected sends', async () => {
    let now = 0;
    const { host, hostChannel } = await pair({ now: () => now });
    const statuses: string[] = [];
    host.onStatus = status => statuses.push(status);
    const cycle: Record<string, unknown> = {}; cycle.self = cycle;
    let deep: unknown = null; for (let i = 0; i < 15; i++) deep = { deep };
    for (const data of [cycle, deep, undefined, { bad: BigInt(3) }, new Date(), { bad: () => 1 }, '💛'.repeat(4000)]) host.send('snapshot', data);
    expect(hostChannel.sent).toHaveLength(0);
    expect(statuses).toContain('invalid-message');
    for (let i = 0; i < 20; i++) { host.send('snapshot', { tick: i }); await flush(); }
    expect(hostChannel.sent).toHaveLength(12);
    expect(statuses).toContain('rate-limited');
    now = 1_000;
    host.send('snapshot', { tick: 20 });
    expect(hostChannel.sent).toHaveLength(13);
    hostChannel.joined = false;
    host.send('snapshot', { tick: 21 });
    expect(hostChannel.sent).toHaveLength(13);
  });

  it('bounds inbound rate independently and accepts a fresh sequence after its window', async () => {
    let now = 0;
    const { host, guest, hostChannel, guestChannel } = await pair({ now: () => now });
    const receive = vi.fn(); host.onMessage = receive;
    guest.send('input', { move: 0 });
    const message = guestChannel.sent[0] as Record<string, unknown>;
    for (let seq = 2; seq <= 30; seq++) hostChannel.broadcast?.({ ...message, seq });
    expect(receive).toHaveBeenCalledTimes(12);
    now = 1_000;
    hostChannel.broadcast?.({ ...message, seq: 31 });
    expect(receive).toHaveBeenCalledTimes(13);
  });

  it('reports peer loss and never silently replaces a participant with a new session', async () => {
    const { hub, host, guest } = await pair();
    const statuses: string[] = []; host.onStatus = status => statuses.push(status);
    await guest.disconnect();
    expect(host.peerId).toBeNull();
    expect(statuses).toContain('peer-left');
    await expect(guest.connect(CODE, false)).rejects.toThrow('previous connection ended');
    await flush();
    expect(host.peerId).toBeNull();
    expect(hub.channels[0].metadata?.peer).toBe(guest.id);
  });

  it('cleans up on channel errors and ignores callbacks from a superseded connection', async () => {
    const { hub, host, hostChannel } = await pair();
    const receive = vi.fn(); host.onMessage = receive;
    hostChannel.status?.('CHANNEL_ERROR');
    await flush();
    expect(hub.clients[0].removed).toBe(1);
    expect(hub.clients[0].disconnected).toBe(true);
    expect(host.peerId).toBeNull();
    await host.connect('ABCDEFGH24', true);
    hostChannel.status?.('SUBSCRIBED');
    hostChannel.status?.('CLOSED');
    hostChannel.broadcast?.({ type: 'snapshot' });
    expect(hub.channels.some(channel => channel.topic.endsWith('ABCDEFGH24'))).toBe(true);
    expect(receive).not.toHaveBeenCalled();
  });

  it('rejects failed tracking and completes removal even if the backend fails to remove', async () => {
    const hub = new Hub();
    hub.client = async () => {
      const client = new FakeClient(hub);
      const create = client.channel.bind(client);
      client.channel = (topic, id) => { const channel = create(topic, id); channel.trackResult = 'error'; return channel; };
      client.removeChannel = async () => { throw new Error('remove failed'); };
      hub.clients.push(client);
      return client;
    };
    await expect(network(hub).connect(CODE, true)).rejects.toThrow('announce online presence');
    await flush();
    expect(hub.clients[0].disconnected).toBe(true);
  });

  it('closes the socket after a one-second deadline when channel removal stalls', async () => {
    vi.useFakeTimers();
    const hub = new Hub();
    const net = network(hub);
    await net.connect(CODE, true);
    hub.clients[0].removeChannel = () => new Promise(() => {});
    let complete = false;
    const close = net.disconnect().then(() => { complete = true; });
    await vi.advanceTimersByTimeAsync(999);
    expect(complete).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await close;
    expect(hub.clients[0].disconnected).toBe(true);
    expect(complete).toBe(true);
  });

  it('times out a stalled subscription and cancels a pending subscription on disconnect', async () => {
    vi.useFakeTimers();
    const hub = new Hub();
    hub.client = async () => {
      const client = new FakeClient(hub);
      const create = client.channel.bind(client);
      client.channel = (topic, id) => { const channel = create(topic, id); channel.subscribe = cb => { channel.status = cb; }; return channel; };
      hub.clients.push(client);
      return client;
    };
    const net = network(hub, { connectTimeoutMs: 200 });
    const timeout = expect(net.connect(CODE, true)).rejects.toThrow('timed out');
    await flush();
    await vi.advanceTimersByTimeAsync(200);
    await timeout;
    expect(hub.clients[0].disconnected).toBe(true);
    const cancelled = expect(net.connect(CODE, true)).rejects.toThrow('cancelled');
    await flush();
    await net.disconnect();
    await cancelled;
    expect(hub.clients[1].disconnected).toBe(true);
  });

  it('disconnect cancels a backend factory still in flight', async () => {
    const hub = new Hub();
    const client = new FakeClient(hub);
    let release: ((value: NetworkClient) => void) | undefined;
    const net = new ChampionshipNetwork({ createClient: () => new Promise(resolve => { release = resolve; }) });
    networks.push(net);
    const cancelled = expect(net.connect(CODE, true)).rejects.toThrow('cancelled');
    await flush();
    await net.disconnect();
    release!(client);
    await cancelled;
    expect(client.disconnected).toBe(true);
    expect(hub.channels).toHaveLength(0);
  });

  it('reports a send failure and never leaves more than four sends in flight', async () => {
    const { host, hostChannel } = await pair();
    const statuses: string[] = []; host.onStatus = status => statuses.push(status);
    hostChannel.sendResult = 'timed out';
    host.send('snapshot', { tick: 1 });
    await flush();
    expect(statuses).toContain('send-error');
    const resolves: ((value: string) => void)[] = [];
    hostChannel.send = () => new Promise(resolve => resolves.push(resolve));
    for (let i = 0; i < 10; i++) host.send('snapshot', { tick: i + 2 });
    expect(resolves).toHaveLength(4);
    for (const resolve of resolves) resolve('ok');
    await flush();
  });

  it('negotiates direct messages through the same bound envelope and increases only the direct cadence', async () => {
    const { hub, host, guest, pcs } = await directPair();
    expect(host.transport).toBe('webrtc'); expect(guest.transport).toBe('webrtc');
    expect(host.sendHz).toBe(30);
    const broadcasts = hub.channels[0].sent.length;
    const receive = vi.fn(); guest.onMessage = receive;
    host.send('snapshot', { tick: 2 });
    expect(receive).toHaveBeenCalledWith({ type: 'snapshot', sender: host.id, data: { tick: 2 } });
    expect(hub.channels[0].sent).toHaveLength(broadcasts);
    expect(pcs[0].data!.sent).toHaveLength(1);
    expect(host.stats.sent).toBeGreaterThan(0);
    expect(guest.stats.received).toBe(1);
    // The same serialized frame cannot be replayed, and malformed/binary data never reaches the app.
    pcs[1].data!.onmessage?.({ data: pcs[0].data!.sent[0] });
    pcs[1].data!.onmessage?.({ data: '{broken' });
    pcs[1].data!.onmessage?.({ data: new Uint8Array(16) });
    expect(receive).toHaveBeenCalledTimes(1);
  });

  it('bounds direct backpressure and rate without filling a queue', async () => {
    const { host, pcs } = await directPair();
    const statuses: string[] = []; host.onStatus = status => statuses.push(status);
    pcs[0].data!.bufferedAmount = 65_537;
    host.send('snapshot', { tick: 0 });
    expect(pcs[0].data!.sent).toHaveLength(0);
    pcs[0].data!.bufferedAmount = 0;
    for (let i = 0; i < 50; i++) host.send('snapshot', { tick: i + 1 });
    expect(pcs[0].data!.sent.length).toBeLessThanOrEqual(36);
    expect(statuses).toContain('rate-limited');
  });

  it('falls back on direct failure and releases data channels, peer connections and timers', async () => {
    const { host, guest, pcs, hub } = await directPair();
    const statuses: string[] = []; host.onStatus = status => statuses.push(status);
    pcs[0].connectionState = 'failed'; pcs[0].onconnectionstatechange?.();
    expect(host.transport).toBe('broadcast'); expect(host.sendHz).toBe(10);
    expect(guest.transport).toBe('broadcast'); expect(guest.sendHz).toBe(10);
    expect(statuses).toContain('broadcast-fallback'); expect(pcs[0].closed).toBe(true);
    const receive = vi.fn(); guest.onMessage = receive;
    host.send('snapshot', { tick: 100 });
    expect(receive).toHaveBeenCalledWith({ type: 'snapshot', sender: host.id, data: { tick: 100 } });
    expect(hub.channels[0].sent.length).toBeGreaterThan(1);
    await guest.disconnect();
    expect(pcs[1].closed).toBe(true);
    expect(pcs[1].data!.onmessage).toBeNull();
  });

  it('ends uncompleted direct negotiation and keeps a functional broadcast fallback', async () => {
    vi.useFakeTimers();
    const hub = new Hub();
    const pcs: FakePeerConnection[] = [];
    const host = network(hub, { createPeerConnection: () => new FakePeerConnection(pcs) as unknown as RTCPeerConnection });
    const guest = network(hub, { enableWebRTC: false });
    await host.connect(CODE, true); await guest.connect(CODE, false); await flush();
    await vi.advanceTimersByTimeAsync(8_001);
    expect(host.transport).toBe('broadcast'); expect(pcs[0].closed).toBe(true);
    expect(hub.channels[0].sent.length).toBeLessThanOrEqual(17); // finite signaling + both roles' low-rate RTT probes
    const receive = vi.fn(); guest.onMessage = receive;
    host.send('snapshot', { tick: 10 });
    expect(receive).toHaveBeenCalledTimes(1);
  });

  it('measures independent host and guest RTT distributions with known delayed round trips', async () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    const { host, guest, hostChannel, guestChannel } = await pair({ now: () => Date.now() });
    const appMessages = vi.fn(); host.onMessage = guest.onMessage = appMessages;
    const delay = [10, 20];
    [hostChannel, guestChannel].forEach((channel, index) => {
      const send = channel.send.bind(channel);
      channel.send = payload => new Promise(resolve => { setTimeout(() => { void send(payload).then(resolve); }, delay[index]); });
    });
    await vi.advanceTimersByTimeAsync(2_100);
    delay[0] = 40; delay[1] = 10;
    await vi.advanceTimersByTimeAsync(2_100);
    delay[0] = 60; delay[1] = 30;
    await vi.advanceTimersByTimeAsync(2_100);
    for (const net of [host, guest]) {
      expect(net.stats.roundTripMs).toBe(90);
      expect(net.stats.roundTrip).toEqual({ sampleCount: 3, p50Ms: 50, p95Ms: 90, maxMs: 90, timeoutCount: 0, windowMs: 120_000 });
    }
    expect(appMessages).not.toHaveBeenCalled();
  });

  it('caps RTT history at 60 samples, ages out the rolling window and stops both probe timers', async () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    const { host, guest, hostChannel } = await pair({ now: () => Date.now() });
    await vi.advanceTimersByTimeAsync(124_000);
    expect(host.stats.roundTrip.sampleCount).toBe(60);
    expect(guest.stats.roundTrip.sampleCount).toBe(60);
    vi.setSystemTime(244_001);
    expect(host.stats.roundTrip.sampleCount).toBe(0);
    expect(host.stats.roundTrip.p95Ms).toBeNull();
    expect(host.stats.roundTripMs).toBeNull();
    const sent = hostChannel.sent.length;
    await Promise.all([host.disconnect(), guest.disconnect()]);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(hostChannel.sent).toHaveLength(sent);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects malformed, mismatched, duplicate and unsolicited pongs without corrupting RTT', async () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    const { host, guest, hostChannel, guestChannel } = await pair({ now: () => Date.now() });
    const pending: Record<string, unknown>[] = [];
    const send = guestChannel.send.bind(guestChannel);
    guestChannel.send = async payload => {
      if ((payload as Record<string, unknown>).type === 'transport_pong') { pending.push(payload as Record<string, unknown>); return 'ok'; }
      return send(payload);
    };
    await vi.advanceTimersByTimeAsync(2_100);
    const pong = pending[0], data = pong.data as { id: number; at: number };
    let seq = 100;
    for (const invalid of [{ at: data.at }, { ...data, extra: true }, { ...data, id: data.id + 1 }, { ...data, at: data.at + 1 }, { ...data, at: -1 }, { ...data, at: NaN }]) {
      hostChannel.broadcast?.({ ...pong, seq: seq++, data: invalid });
    }
    expect(host.stats.roundTrip.sampleCount).toBe(0);
    hostChannel.broadcast?.({ ...pong, seq: seq++ });
    expect(host.stats.roundTripMs).toBe(100);
    hostChannel.broadcast?.({ ...pong, seq: seq++ });
    expect(host.stats.roundTrip.sampleCount).toBe(1);
    expect(guest.stats.roundTrip.sampleCount).toBe(1);
  });

  it('counts unanswered probes as timeouts and rejects replies beyond the pending lifetime', async () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    const { host, hostChannel, guestChannel } = await pair({ now: () => Date.now() });
    let pong: Record<string, unknown> | undefined;
    const send = guestChannel.send.bind(guestChannel);
    guestChannel.send = async payload => {
      if ((payload as Record<string, unknown>).type === 'transport_pong') { pong = payload as Record<string, unknown>; return 'ok'; }
      return send(payload);
    };
    await vi.advanceTimersByTimeAsync(2_100);
    vi.setSystemTime(12_001);
    hostChannel.broadcast?.({ ...pong, seq: 100 });
    expect(host.stats.roundTrip.sampleCount).toBe(0);
    expect(host.stats.roundTrip.timeoutCount).toBe(1);
    hostChannel.broadcast?.({ ...pong, seq: 101 });
    expect(host.stats.roundTrip.timeoutCount).toBe(1);
  });

  it('resets both roles RTT histories and pending probes on path changes, departure and reconnect', async () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    const { host, guest, pcs } = await directPair({ now: () => Date.now() });
    await vi.advanceTimersByTimeAsync(2_100);
    expect(host.stats.roundTrip.sampleCount).toBe(1);
    expect(guest.stats.roundTrip.sampleCount).toBe(1);
    pcs[0].connectionState = 'failed'; pcs[0].onconnectionstatechange?.();
    expect(host.stats.roundTrip.sampleCount).toBe(0);
    expect(guest.stats.roundTrip.sampleCount).toBe(0);
    await vi.advanceTimersByTimeAsync(2_100);
    expect(host.stats.transport).toBe('broadcast');
    expect(host.stats.roundTrip.sampleCount).toBe(1);
    await guest.disconnect();
    expect(host.stats.roundTrip.sampleCount).toBe(0);
    await host.disconnect(); await host.connect('ABCDEFGH24', true);
    expect(host.stats.roundTripMs).toBeNull();
    expect(host.stats.roundTrip.timeoutCount).toBe(0);
  });

  it.each(['resolved error', 'rejected promise'])('suppresses a stale relay %s only after direct peer traffic proves the new path', async failure => {
    let settle: ((value: string) => void) | undefined;
    let reject: ((reason: Error) => void) | undefined;
    const { host, guest } = await directPair({ onChannel: (channel, index) => {
      if (index === 0) channel.acknowledge = () => new Promise((resolve, fail) => { settle = resolve; reject = fail; });
    } });
    expect(host.transport).toBe('webrtc');
    const statuses: string[] = []; host.onStatus = status => statuses.push(status);
    guest.send('input', { move: 1 });
    if (failure === 'resolved error') settle!('timed out'); else reject!(new Error('late relay failure'));
    await flush();
    expect(statuses).not.toContain('send-error');
  });

  it.each(['no response', 'stale response', 'failed path', 'backpressure'])('preserves late relay failure when the direct path has %s', async condition => {
    let now = 0;
    let settle: ((value: string) => void) | undefined;
    const { host, guest, pcs } = await directPair({ now: () => now, onChannel: (channel, index) => {
      if (index === 0) channel.acknowledge = () => new Promise(resolve => { settle = resolve; });
    } });
    const statuses: string[] = []; host.onStatus = status => statuses.push(status);
    if (condition !== 'no response') guest.send('input', { move: 1 });
    if (condition === 'stale response') now = 1_001;
    if (condition === 'failed path') pcs[0].connectionState = 'disconnected';
    if (condition === 'backpressure') pcs[0].data!.bufferedAmount = 65_537;
    settle!('error'); await flush();
    expect(statuses).toContain('send-error');
  });
});
