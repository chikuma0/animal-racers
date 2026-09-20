/** Invite-only, host-authoritative game transport. No backend is loaded for solo play. */
export const NETWORK_NAMESPACE = 'animal-racers-western-v3';
export const NETWORK_LIMITS = {
  messagesPerSecond: 12, directMessagesPerSecond: 36, maxBytes: 12_288, connectTimeoutMs: 6_000,
  roundTripSamples: 60, roundTripWindowMs: 120_000, roundTripTimeoutMs: 10_000,
} as const;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TOKEN = /^[a-f0-9]{32}$/;
const MESSAGE_TYPE = /^[a-z][a-z0-9_-]{0,31}$/;

export interface NetworkMessage { type: string; sender: string; data: unknown }
export interface NetworkChannel {
  onBroadcast(callback: (payload: unknown) => void): void;
  onPresence(callback: () => void): void;
  presenceState(): Record<string, unknown>;
  subscribe(callback: (status: string) => void): void;
  track(presence: Record<string, unknown>): Promise<string>;
  send(payload: unknown): Promise<string>;
  isJoined(): boolean;
}
export interface NetworkClient {
  channel(topic: string, id: string): NetworkChannel;
  removeChannel(channel: NetworkChannel): Promise<unknown>;
  disconnect(): void;
}
export interface NetworkOptions {
  createClient?: () => Promise<NetworkClient>;
  now?: () => number;
  connectTimeoutMs?: number;
  /** Override only for the test harness. Browsers use their native WebRTC implementation. */
  createPeerConnection?: () => RTCPeerConnection | null;
  enableWebRTC?: boolean;
}
export type GameTransport = 'broadcast' | 'webrtc';
export interface RoundTripStats {
  sampleCount: number; p50Ms: number | null; p95Ms: number | null; maxMs: number | null;
  timeoutCount: number; windowMs: number;
}
export interface NetworkStats {
  transport: GameTransport; roundTripMs: number | null; sent: number; received: number;
  roundTrip: RoundTripStats;
}
interface Presence { id: string; session: string; role: 'host' | 'guest'; peer: string | null; peerSession: string | null; v: 1 }
interface Envelope { v: 1; room: string; sender: string; session: string; recipient: string; seq: number; type: string; data: unknown }
interface Connection {
  client: NetworkClient; channel: NetworkChannel; code: string; host: boolean; session: string;
  ready: boolean; peer: Presence | null; peerPresent: boolean; seq: number; receivedSeq: number;
  sendTimes: number[]; receiveTimes: number[]; inFlight: number; trackingPeer: boolean;
  timer?: ReturnType<typeof setTimeout>; resolve: () => void; reject: (error: Error) => void;
  direct: { pc: RTCPeerConnection; channel: RTCDataChannel | null; deadline: ReturnType<typeof setTimeout>; retry: ReturnType<typeof setInterval>; signal: RTCSessionDescriptionInit | null; busy: boolean; remoteSet: boolean; cancelGather: (() => void) | null } | null;
  directAttempted: boolean; receivedSignalSeq: number; signalTimes: number[];
  pingTimer?: ReturnType<typeof setInterval>;
  pendingPing: { id: number; at: number; transport: GameTransport } | null; probeSequence: number;
  roundTrips: { at: number; ms: number }[]; roundTripTimeouts: number[];
  directGeneration: number; lastDirectReceivedAt: number | null;
  sent: number; received: number;
}

function randomToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('');
}

/** Ten unbiased base-32 characters: 50 random bits; never a predictable four-digit room. */
export function generateInviteCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), n => ALPHABET[n & 31]).join('');
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Bound work before stringify, reject non-JSON values, cycles, deep/large structures and non-finite numbers. */
function boundedJson(value: unknown): string | null {
  const stack = [{ value, depth: 0 }];
  let nodes = 0;
  let stringLength = 0;
  while (stack.length) {
    const next = stack.pop()!;
    if (++nodes > 2_048 || next.depth > 12) return null;
    const item = next.value;
    if (typeof item === 'string') stringLength += item.length;
    else if (typeof item === 'number') { if (!Number.isFinite(item)) return null; }
    else if (item !== null && typeof item !== 'boolean') {
      // Cycles necessarily exceed the depth bound; harmless shared references remain valid JSON.
      if (typeof item !== 'object') return null;
      if (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) return null;
      const entries = Object.entries(item);
      if (entries.length > 2_048) return null;
      for (const [key, child] of entries) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') return null;
        stringLength += key.length;
        stack.push({ value: child, depth: next.depth + 1 });
      }
    }
    if (stringLength > NETWORK_LIMITS.maxBytes) return null;
  }
  try {
    const json = JSON.stringify(value);
    return new TextEncoder().encode(json).length <= NETWORK_LIMITS.maxBytes ? json : null;
  } catch { return null; }
}

function readPresence(value: unknown, key: string): Presence | null {
  if (!record(value) || value.v !== 1 || value.id !== key || !TOKEN.test(key) ||
      typeof value.session !== 'string' || !TOKEN.test(value.session) ||
      (value.role !== 'host' && value.role !== 'guest') ||
      (value.peer !== null && (typeof value.peer !== 'string' || !TOKEN.test(value.peer))) ||
      (value.peerSession !== null && (typeof value.peerSession !== 'string' || !TOKEN.test(value.peerSession)))) return null;
  return value as unknown as Presence;
}

async function createBackend(): Promise<NetworkClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Online play is unavailable: the Supabase public URL and key are not configured. Solo play is available.');
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: NETWORK_LIMITS.messagesPerSecond } },
  });
  const rawChannels = new Map<NetworkChannel, ReturnType<typeof client.channel>>();
  return {
    channel(topic, id) {
      const raw = client.channel(topic, { config: { broadcast: { self: false, ack: true }, presence: { key: id } } });
      const adapter: NetworkChannel = {
        onBroadcast: cb => { raw.on('broadcast', { event: 'championship' }, message => cb(message.payload)); },
        onPresence: cb => { raw.on('presence', { event: 'sync' }, cb); },
        presenceState: () => raw.presenceState(),
        subscribe: cb => { raw.subscribe(cb); },
        track: presence => raw.track(presence, { timeout: 1_000 }),
        send: payload => raw.send({ type: 'broadcast', event: 'championship', payload }, { timeout: 1_000 }),
        isJoined: () => raw.state === 'joined' && client.realtime.isConnected(),
      };
      rawChannels.set(adapter, raw);
      return adapter;
    },
    removeChannel: async channel => {
      const raw = rawChannels.get(channel);
      if (raw) { rawChannels.delete(channel); await client.removeChannel(raw); }
    },
    disconnect: () => { client.realtime.disconnect(); },
  };
}

export class ChampionshipNetwork {
  readonly id = randomToken();
  onMessage: (message: NetworkMessage) => void = () => {};
  onPresence: (ids: string[]) => void = () => {};
  onStatus: (status: string) => void = () => {};
  private connection: Connection | null = null;
  private generation = 0;
  private cleanup: Promise<void> = Promise.resolve();
  private readonly now: () => number;
  constructor(private readonly options: NetworkOptions = {}) { this.now = options.now ?? (() => performance.now()); }
  get peerId(): string | null { return this.connection?.peerPresent ? this.connection.peer?.id ?? null : null; }
  get transport(): GameTransport { return this.connection?.direct?.channel?.readyState === 'open' ? 'webrtc' : 'broadcast'; }
  /** Application cadence; reserved transport traffic has separate headroom. */
  get sendHz(): number { return this.transport === 'webrtc' ? 30 : 10; }
  get stats(): NetworkStats {
    const state = this.connection;
    if (state) this.pruneRoundTrips(state);
    const samples = state?.roundTrips ?? [];
    const sorted = samples.map(sample => sample.ms).sort((a, b) => a - b);
    const percentile = (q: number) => sorted.length ? sorted[Math.ceil(sorted.length * q) - 1] : null;
    return {
      transport: this.transport, roundTripMs: samples[samples.length - 1]?.ms ?? null,
      sent: state?.sent ?? 0, received: state?.received ?? 0,
      roundTrip: { sampleCount: samples.length, p50Ms: percentile(.5), p95Ms: percentile(.95), maxMs: percentile(1), timeoutCount: state?.roundTripTimeouts.length ?? 0, windowMs: NETWORK_LIMITS.roundTripWindowMs },
    };
  }

  async connect(code: string, host: boolean): Promise<void> {
    const normalized = code.trim().toUpperCase().replace(/[ -]/g, '');
    if (!/^[A-HJ-NP-Z2-9]{10}$/.test(normalized)) throw new Error('Use the 10-character invite code.');
    const generation = ++this.generation;
    this.close('disconnected', new Error('Connection replaced.'));
    await this.cleanup;
    if (generation !== this.generation) throw new Error('Connection cancelled.');
    this.onStatus('connecting');
    let client: NetworkClient;
    try { client = await (this.options.createClient ?? createBackend)(); }
    catch (error) { if (generation === this.generation) this.onStatus('error'); throw error; }
    if (generation !== this.generation) { client.disconnect(); throw new Error('Connection cancelled.'); }
    let channel: NetworkChannel;
    try { channel = client.channel(`${NETWORK_NAMESPACE}:${normalized}`, this.id); }
    catch { client.disconnect(); this.onStatus('error'); throw new Error('Could not create an online room.'); }
    return new Promise<void>((resolve, reject) => {
      const state: Connection = {
        client, channel, code: normalized, host, session: randomToken(), ready: false,
        peer: null, peerPresent: false, seq: 0, receivedSeq: 0, sendTimes: [], receiveTimes: [], inFlight: 0,
        trackingPeer: false, resolve, reject,
        direct: null, directAttempted: false, receivedSignalSeq: 0, signalTimes: [], pendingPing: null,
        probeSequence: 0, roundTrips: [], roundTripTimeouts: [], directGeneration: 0, lastDirectReceivedAt: null, sent: 0, received: 0,
      };
      this.connection = state;
      state.timer = setTimeout(() => {
        if (this.connection === state) this.close('error', new Error('Online connection timed out. Try again.'));
      }, this.options.connectTimeoutMs ?? NETWORK_LIMITS.connectTimeoutMs);
      try {
        channel.onBroadcast(payload => { if (this.connection === state) this.receive(state, payload); });
        channel.onPresence(() => { if (this.connection === state) this.syncPresence(state); });
        channel.subscribe(status => {
          if (this.connection !== state) return;
          if (status === 'SUBSCRIBED' && !state.ready) {
            void channel.track(this.presence(state)).then(result => {
              if (this.connection !== state) return;
              if (result !== 'ok') { this.close('error', new Error('Could not announce online presence.')); return; }
              state.ready = true;
              clearTimeout(state.timer);
              state.timer = undefined;
              this.onStatus('waiting');
              this.syncPresence(state);
              resolve();
            }, () => { if (this.connection === state) this.close('error', new Error('Could not announce online presence.')); });
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            this.close('error', new Error('Online connection lost. Return to the lobby and reconnect.'));
          }
        });
      } catch { this.close('error', new Error('Could not subscribe to the online room.')); }
    });
  }

  private presence(state: Connection): Record<string, unknown> {
    return { id: this.id, v: 1, session: state.session, role: state.host ? 'host' : 'guest', peer: state.host ? state.peer?.id ?? null : null, peerSession: state.host ? state.peer?.session ?? null : null };
  }

  private syncPresence(state: Connection): void {
    if (!state.ready) return;
    const raw = state.channel.presenceState();
    const entries = Object.entries(raw);
    if (entries.length > 16) { this.close('room-full', new Error('This room is full.')); return; }
    const people: Presence[] = [];
    for (const [id, values] of entries) {
      if (!Array.isArray(values) || values.length !== 1) continue;
      const person = readPresence(values[0], id);
      if (person) people.push(person);
    }
    const hosts = people.filter(person => person.role === 'host');
    if (hosts.length > 1 || (state.host && hosts.some(person => person.id !== this.id))) {
      this.close('room-conflict', new Error('This invite already has a host. Create a new room.')); return;
    }
    if (!state.peer) {
      if (state.host) state.peer = people.filter(person => person.role === 'guest' && person.id !== this.id).sort((a, b) => a.id.localeCompare(b.id))[0] ?? null;
      else {
        const host = hosts[0];
        if (host?.peer && host.peer !== this.id) { this.close('room-full', new Error('This room already has two players.')); return; }
        if (host?.peer === this.id && host.peerSession !== state.session) {
          this.close('peer-left', new Error('The previous connection ended. Both players must return to the lobby.')); return;
        }
        if (host?.peer === this.id && host.peerSession === state.session) state.peer = host;
      }
    }
    if (state.host && state.peer && !state.trackingPeer) {
      state.trackingPeer = true;
      void state.channel.track(this.presence(state)).then(result => {
        if (this.connection === state && result !== 'ok') this.close('error', new Error('Could not pair online players.'));
      }, () => { if (this.connection === state) this.close('error', new Error('Could not pair online players.')); });
    }
    const present = Boolean(state.peer && people.some(person => person.id === state.peer!.id && person.session === state.peer!.session && person.role === state.peer!.role));
    const changed = state.peerPresent !== present;
    state.peerPresent = present;
    if (changed) this.onStatus(present ? 'connected' : 'peer-left');
    this.onPresence(present ? [this.id, state.peer!.id] : [this.id]);
    if (present) {
      this.startDirect(state);
      if (!state.pingTimer) state.pingTimer = setInterval(() => {
        if (this.connection !== state || !state.peerPresent) return;
        this.expirePing(state);
        if (state.pendingPing) return;
        state.pendingPing = { id: ++state.probeSequence, at: this.now(), transport: this.transport };
        if (!this.sendEnvelope('transport_ping', { id: state.pendingPing.id, at: state.pendingPing.at })) state.pendingPing = null;
      }, 2_000);
    } else if (state.peer) {
      clearInterval(state.pingTimer); state.pingTimer = undefined;
      this.stopDirect(state, false); this.resetRoundTrips(state);
    }
  }

  private budget(times: number[], limit: number = NETWORK_LIMITS.messagesPerSecond): boolean {
    const now = this.now();
    while (times.length && now - times[0] >= 1_000) times.shift();
    if (times.length >= limit) return false;
    times.push(now);
    return true;
  }

  send(type: string, data: unknown): void {
    if (type === 'rtc_signal' || type.startsWith('transport_')) { this.onStatus('invalid-message'); return; }
    this.sendEnvelope(type, data);
  }

  private sendEnvelope(type: string, data: unknown, forceBroadcast = false): boolean {
    const state = this.connection;
    if (!state?.ready || !state.peerPresent || !state.peer) return false;
    const direct = !forceBroadcast && state.direct?.channel?.readyState === 'open' ? state.direct.channel : null;
    if (!direct && !state.channel.isJoined()) return false;
    if (!MESSAGE_TYPE.test(type)) { this.onStatus('invalid-message'); return false; }
    const envelope: Envelope = { v: 1, room: state.code, sender: this.id, session: state.session, recipient: state.peer.id, seq: state.seq + 1, type, data };
    const json = boundedJson(envelope);
    if (!json) { this.onStatus('invalid-message'); return false; }
    const limit = direct ? NETWORK_LIMITS.directMessagesPerSecond : NETWORK_LIMITS.messagesPerSecond;
    if ((!direct && state.inFlight >= 4) || !this.budget(state.sendTimes, limit)) { this.onStatus('rate-limited'); return false; }
    state.seq++;
    if (direct) {
      if (direct.bufferedAmount > 65_536) { this.onStatus('rate-limited'); return false; }
      try { direct.send(json); state.sent++; }
      catch { this.stopDirect(state, true); return false; }
      return true;
    }
    const directGenerationAtSend = state.directGeneration;
    state.inFlight++;
    // Copy before asynchronous delivery: mutable simulation snapshots must not change after send().
    let pending: Promise<string>;
    try { pending = state.channel.send(JSON.parse(json)); state.sent++; }
    catch { state.inFlight--; this.reportRelayFailure(state, directGenerationAtSend); return false; }
    void pending.then(result => {
      if (result !== 'ok') this.reportRelayFailure(state, directGenerationAtSend);
    }, () => { this.reportRelayFailure(state, directGenerationAtSend); }).finally(() => { state.inFlight--; });
    return true;
  }

  private reportRelayFailure(state: Connection, directGenerationAtSend: number): void {
    if (this.connection !== state) return;
    const lastPacketAge = state.lastDirectReceivedAt === null ? Infinity : this.now() - state.lastDirectReceivedAt;
    // An open channel alone is not evidence of response. Preserve errors until the new path
    // has delivered a valid peer envelope recently, and never hide errors on the active relay.
    if (state.directGeneration > directGenerationAtSend && state.peerPresent &&
      state.direct?.channel?.readyState === 'open' && state.direct.pc.connectionState === 'connected' &&
      state.direct.channel.bufferedAmount <= 65_536 &&
      lastPacketAge >= 0 && lastPacketAge <= 1_000) return;
    this.onStatus('send-error');
  }

  private receive(state: Connection, payload: unknown, direct = false): void {
    if (!state.ready || !state.peerPresent || !state.peer || !record(payload) ||
      Object.keys(payload).length !== 8 || !Object.prototype.hasOwnProperty.call(payload, 'data') ||
      payload.v !== 1 || payload.room !== state.code || payload.sender !== state.peer.id ||
      payload.session !== state.peer.session || payload.recipient !== this.id ||
      typeof payload.type !== 'string' || !MESSAGE_TYPE.test(payload.type) ||
      !Number.isSafeInteger(payload.seq) || !boundedJson(payload)) return;
    if (payload.type === 'rtc_signal') {
      if (direct || (payload.seq as number) <= state.receivedSignalSeq || !this.budget(state.signalTimes, 3)) return;
      state.receivedSignalSeq = payload.seq as number;
      void this.receiveSignal(state, payload.data);
      return;
    }
    if ((payload.seq as number) <= state.receivedSeq || !this.budget(state.receiveTimes, direct ? NETWORK_LIMITS.directMessagesPerSecond : NETWORK_LIMITS.messagesPerSecond)) return;
    state.receivedSeq = payload.seq as number;
    state.received++;
    if (payload.type === 'transport_ping') {
      if (this.validProbe(payload.data)) {
        if (direct) state.lastDirectReceivedAt = this.now();
        this.sendEnvelope('transport_pong', { id: payload.data.id, at: payload.data.at });
      }
      return;
    }
    if (payload.type === 'transport_pong') {
      this.expirePing(state);
      const ping = state.pendingPing;
      if (this.validProbe(payload.data) && ping && payload.data.id === ping.id && payload.data.at === ping.at &&
        ping.transport === (direct ? 'webrtc' : 'broadcast') && ping.transport === this.transport) {
        const now = this.now(), elapsed = now - ping.at;
        if (elapsed >= 0 && Number.isFinite(elapsed)) {
          if (direct) state.lastDirectReceivedAt = now;
          state.roundTrips.push({ at: now, ms: elapsed });
          this.pruneRoundTrips(state);
          state.pendingPing = null;
        }
      }
      return;
    }
    if (payload.type.startsWith('transport_')) return;
    if (direct) state.lastDirectReceivedAt = this.now();
    this.onMessage({ type: payload.type, sender: payload.sender as string, data: payload.data });
  }

  private validProbe(value: unknown): value is { id: number; at: number } {
    return record(value) && Object.keys(value).length === 2 && Number.isSafeInteger(value.id) && (value.id as number) > 0 &&
      typeof value.at === 'number' && Number.isFinite(value.at) && value.at >= 0;
  }

  private expirePing(state: Connection): void {
    if (state.pendingPing && this.now() - state.pendingPing.at >= NETWORK_LIMITS.roundTripTimeoutMs) {
      state.roundTripTimeouts.push(this.now()); state.pendingPing = null;
      this.pruneRoundTrips(state);
    }
  }

  private pruneRoundTrips(state: Connection): void {
    const oldest = this.now() - NETWORK_LIMITS.roundTripWindowMs;
    state.roundTrips = state.roundTrips.filter(sample => sample.at >= oldest).slice(-NETWORK_LIMITS.roundTripSamples);
    state.roundTripTimeouts = state.roundTripTimeouts.filter(at => at >= oldest).slice(-NETWORK_LIMITS.roundTripSamples);
  }

  private resetRoundTrips(state: Connection): void {
    state.pendingPing = null; state.roundTrips = []; state.roundTripTimeouts = [];
  }

  private startDirect(state: Connection): void {
    if (state.directAttempted) return;
    state.directAttempted = true;
    if (this.options.enableWebRTC === false) return;
    let pc: RTCPeerConnection | null;
    try {
      pc = this.options.createPeerConnection ? this.options.createPeerConnection() : typeof RTCPeerConnection === 'undefined' ? null : new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }], iceCandidatePoolSize: 0 });
    } catch { this.onStatus('broadcast-fallback'); return; }
    if (!pc) { this.onStatus('broadcast-fallback'); return; }
    const direct: NonNullable<Connection['direct']> = {
      pc, channel: null, signal: null, busy: false, remoteSet: false, cancelGather: null,
      deadline: setTimeout(() => { if (this.connection === state && this.transport !== 'webrtc') this.stopDirect(state, true); }, 8_000),
      retry: setInterval(() => { if (this.connection === state && state.direct === direct && direct.signal) this.sendEnvelope('rtc_signal', direct.signal, true); }, 1_000),
    };
    state.direct = direct;
    this.onStatus('webrtc-connecting');
    pc.onconnectionstatechange = () => {
      if (this.connection === state && state.direct === direct && ['failed', 'closed', 'disconnected'].includes(pc.connectionState)) this.stopDirect(state, true);
    };
    pc.ondatachannel = event => {
      if (this.connection !== state || state.direct !== direct || state.host || direct.channel || event.channel.label !== 'championship') { event.channel.close(); return; }
      this.attachDirect(state, event.channel);
    };
    if (state.host) {
      try {
        this.attachDirect(state, pc.createDataChannel('championship', { ordered: false, maxRetransmits: 0 }));
        void this.describeDirect(state, 'offer');
      } catch { this.stopDirect(state, true); }
    }
  }

  private attachDirect(state: Connection, channel: RTCDataChannel): void {
    const direct = state.direct;
    if (!direct) { channel.close(); return; }
    direct.channel = channel;
    channel.onopen = () => {
      if (this.connection !== state || state.direct !== direct) return;
      clearTimeout(direct.deadline); clearInterval(direct.retry);
      state.sendTimes = []; state.receiveTimes = []; state.directGeneration++; state.lastDirectReceivedAt = null;
      this.resetRoundTrips(state);
      this.onStatus('webrtc-connected');
    };
    channel.onmessage = event => {
      if (this.connection !== state || state.direct !== direct || typeof event.data !== 'string' || event.data.length > NETWORK_LIMITS.maxBytes) return;
      try { this.receive(state, JSON.parse(event.data), true); } catch { /* Ignore malformed packets. */ }
    };
    channel.onerror = channel.onclose = () => { if (this.connection === state && state.direct === direct) this.stopDirect(state, true); };
  }

  private async describeDirect(state: Connection, type: 'offer' | 'answer'): Promise<void> {
    const direct = state.direct;
    if (!direct) return;
    try {
      const description = type === 'offer' ? await direct.pc.createOffer() : await direct.pc.createAnswer();
      if (this.connection !== state || state.direct !== direct) return;
      await direct.pc.setLocalDescription(description);
      if (direct.pc.iceGatheringState !== 'complete') await new Promise<void>(resolve => {
        const done = () => { clearTimeout(timer); direct.pc.removeEventListener('icegatheringstatechange', changed); direct.cancelGather = null; resolve(); };
        const changed = () => { if (direct.pc.iceGatheringState === 'complete') done(); };
        const timer = setTimeout(done, 1_500);
        direct.cancelGather = done;
        direct.pc.addEventListener('icegatheringstatechange', changed);
      });
      if (this.connection !== state || state.direct !== direct) return;
      const sdp = direct.pc.localDescription?.sdp;
      if (!sdp || sdp.length > 8_192) { this.stopDirect(state, true); return; }
      direct.signal = { type, sdp };
      this.sendEnvelope('rtc_signal', direct.signal, true);
    } catch { if (this.connection === state && state.direct === direct) this.stopDirect(state, true); }
  }

  private async receiveSignal(state: Connection, payload: unknown): Promise<void> {
    if (record(payload) && payload.type === 'fallback') {
      this.stopDirect(state, false);
      this.onStatus('broadcast-fallback');
      return;
    }
    if (!record(payload) || typeof payload.sdp !== 'string' || payload.sdp.length > 8_192 || payload.type !== (state.host ? 'answer' : 'offer')) return;
    this.startDirect(state);
    const direct = state.direct;
    if (!direct || direct.busy || direct.remoteSet || this.transport === 'webrtc') return;
    direct.busy = true;
    try {
      await direct.pc.setRemoteDescription({ type: state.host ? 'answer' : 'offer', sdp: payload.sdp });
      if (this.connection !== state || state.direct !== direct) return;
      direct.remoteSet = true;
      if (!state.host) await this.describeDirect(state, 'answer');
    } catch { if (this.connection === state && state.direct === direct) this.stopDirect(state, true); }
    finally { direct.busy = false; }
  }

  private stopDirect(state: Connection, reportFallback: boolean): void {
    const direct = state.direct;
    state.direct = null;
    if (!direct) return;
    direct.cancelGather?.();
    clearTimeout(direct.deadline); clearInterval(direct.retry);
    direct.pc.onconnectionstatechange = null; direct.pc.ondatachannel = null;
    if (direct.channel) {
      direct.channel.onopen = direct.channel.onmessage = direct.channel.onclose = direct.channel.onerror = null;
      direct.channel.close();
    }
    direct.pc.close();
    state.sendTimes = []; state.receiveTimes = []; state.lastDirectReceivedAt = null;
    this.resetRoundTrips(state);
    if (reportFallback) {
      this.sendEnvelope('rtc_signal', { type: 'fallback', sdp: '' }, true);
      this.onStatus('broadcast-fallback');
    }
  }

  private close(status: string, reason: Error): void {
    const state = this.connection;
    if (!state) return;
    this.connection = null;
    clearTimeout(state.timer);
    clearInterval(state.pingTimer);
    this.stopDirect(state, false);
    state.reject(reason);
    this.onPresence([]);
    this.onStatus(status);
    const cleanup = async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          state.client.removeChannel(state.channel),
          new Promise<void>(resolve => { timer = setTimeout(resolve, 1_000); }),
        ]);
      } catch { /* Socket close below is the cleanup fallback. */ }
      finally { clearTimeout(timer); state.client.disconnect(); }
    };
    this.cleanup = cleanup();
  }

  async disconnect(): Promise<void> {
    ++this.generation;
    this.close('disconnected', new Error('Connection cancelled.'));
    await this.cleanup;
  }
}
