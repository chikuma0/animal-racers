# Championship network transport

The new transport is isolated from the earlier game in `src/lib/multiplayer.ts`. It lazily loads Supabase only when the player connects; solo mode needs no environment variables. The room namespace is `animal-racers-western-v1`. There are no database writes, schema changes, authentication-setting changes, or shared channel names.

## API and integration contract

```ts
const network = new ChampionshipNetwork();
network.onStatus = status => { /* reflect connection health in the lobby */ };
network.onPresence = ids => { /* local id plus admitted peer, or [] after close */ };
network.onMessage = ({ type, sender, data }) => { /* validate gameplay payload */ };
await network.connect(generateInviteCode(), true); // guest uses the same code and false
network.send('snapshot', snapshot);
await network.disconnect();
```

`id` is a 128-bit random token. `peerId` is the admitted peer while present, otherwise null. Invite codes have ten cryptographically random base-32 characters (50 bits); pasted spaces, a hyphen and lowercase are normalized. `connect` resolves after subscription and tracking, so it can resolve while waiting for an opponent. Pairing requires `peerId`/two admitted presence ids. Connection setup times out after six seconds.

The host chooses one guest and announces that guest's id and connection nonce. The guest binds only to that explicit selection. Once paired, each side pins the other's id, role and connection nonce. Extra guests cannot take over the pair. Competing hosts close the conflicting room. A departing participant produces `peer-left`; neither host migration nor silent replacement is supported. Both players should return to the lobby and create/join a new room after a connection loss. An in-room rematch keeps the existing pair.

Statuses are `connecting`, `waiting`, `connected`, `peer-left`, `room-full`, `room-conflict`, `error`, `disconnected`, `invalid-message`, `rate-limited`, `send-error`, `webrtc-connecting`, `webrtc-connected`, and `broadcast-fallback`. Invalid/rate-limited/error sends are dropped. A closed/error channel rejects pending connection setup and clears presence; stale callbacks cannot revive it. Removal has a one-second fallback that closes the owned socket.

After pairing, the host offers one native WebRTC data channel and the guest answers through Supabase. The channel is unordered with zero retransmissions so obsolete snapshots cannot hold up newer frames. SDP is limited to 8 KiB and retried once a second for at most eight seconds; ICE gathering waits at most 1.5 seconds per description. Only the public Google STUN endpoint is configured. There is no TURN server, paid resource or media capture. Direct failure closes the peer connection and signals the other client to return to Broadcast. Networks that require TURN will use the slower fallback.

Read `transport` (`webrtc` or `broadcast`) and `sendHz` (30 or 10) to choose the application cadence. `stats` retains the transport, sent/received envelope counts, and latest completed application ping/pong `roundTripMs` (null until measured). Both roles independently probe every two seconds using their own monotonic clock. A unique probe id and timestamp must match the pending request; malformed, unsolicited, duplicate, wrong-path and expired replies cannot create a sample. Each role holds at most one pending request, which times out after ten seconds. No synchronized client clocks are required.

`stats.roundTrip` contains `sampleCount`, `p50Ms`, `p95Ms`, `maxMs`, `timeoutCount`, and `windowMs`. These are nearest-rank percentiles of at most 60 successful probes completed in the trailing 120 seconds for the current transport. Timeouts are reported separately in the same window, so a distribution of successful replies does not imply zero loss. Histories and pending requests reset when the transport changes or the peer leaves; disconnect stops both roles' timers. A rematch in the same connection retains the rolling history. The UI should label Broadcast as a slower fallback; channel establishment alone does not prove acceptable play.

A delayed Broadcast failure from before WebRTC opened is suppressed only while the replacing peer connection is connected, its channel is open without excessive buffering, and a valid peer packet arrived over that channel within the last second. An open-but-unresponsive channel, stale peer traffic, direct failure or active-relay failure still reports `send-error`. Subscription/presence failures are never hidden by this rule.

## Bounds and authority

Messages carry protocol version, room, sender, session nonce, recipient, strictly increasing sequence, type, and data. Replay, wrong recipient, other rooms/sessions/participants, malformed values and non-finite numbers are rejected. JSON payloads are bounded to 12 KiB including the envelope, 2,048 visited values, and nesting depth 12. Validation rejects cyclic/non-JSON values and prototype-sensitive keys. There is no unbounded retry queue.

Broadcast accepts/sends at most 12 messages per rolling second, with at most four sends awaiting acknowledgement. Direct traffic is capped at 36 messages per second, with a 64 KiB data-channel backpressure threshold; application cadence leaves room for control traffic. Broadcast acknowledgement confirms the service received a message, not that the opponent applied it. Broadcast sends require an active joined WebSocket and a present admitted peer, preventing the SDK's pre-subscription HTTP fallback. Payloads are copied before asynchronous delivery so mutable simulation objects cannot change an outgoing snapshot.

Use `sendHz` for snapshots and inputs, keeping lobby/control retries within the limit. Periodically resend current lobby state and the final snapshot; a one-off start/result/rematch message can be lost. The application must validate message-specific data, pin the game revision/match id, reject old match snapshots and input, clear stale remote input, preserve short input presses with cumulative edges, interpolate guest rendering, and keep canonical physics/damage/results on the host. Transport sequence checks do not establish gameplay freshness after a pause or enforce a particular game schema. `rtc_signal` and `transport_*` message names are reserved for the transport.

This is a casual, invitation-based public channel. Participant binding protects normal client state consistency; it does **not** authenticate a human or a sender against a malicious client possessing the invite. Presence and broadcast metadata are client-supplied. A malicious participant can impersonate known ids or run a modified authoritative host. There is no trusted server anti-cheat, signed result, private room authorization, or ranked-play guarantee. No private user data belongs in a room payload.

## Existing implementation findings

The older transport eagerly initialized Supabase, generated predictable four-digit room codes and `Math.random` ids, cast received data directly to its TypeScript message type, and had no envelope size/rate/replay guard. It assigned the active channel only after tracking completed, which left failed/cancelled subscription cleanup vulnerable. The new boundary addresses these defects without changing the old implementation or shared service settings. The gameplay integration must also remove the old model of trusting client-reported race times/damage.

## Verification and measured evidence

Run offline checks with `npx vitest run src/championship/network.test.ts`. Tests exercise malformed/cross-room/stale data, explicit host/guest pairing, third-player rejection, payload and rate limits, immutable snapshots, peer loss, subscription errors/timeouts, superseded callbacks, cleanup failure, a cancelled backend factory, pending-send bounds, direct negotiation/delivery, malformed direct packets, direct backpressure, and bounded fallback/cleanup. Additional cases verify independent known-delay RTT distributions on both roles, sample/window bounds, malformed and expired pongs, resets and timer cleanup, and positive/negative controls for stale relay errors. These are fake-backend protocol tests, not a claim about actual internet delivery.

The explicit smoke experiment is:

```sh
node --env-file-if-exists=.env.local --experimental-transform-types scripts/network/probe.mjs
```

It uses Node 22, two independent clients, one fresh random room, at most 24 application messages, and a hard active deadline below ten seconds. Each host ping includes 4,096 ASCII padding bytes; the guest echoes it with a timestamp. The script measures delivery counts and one-way/round-trip p50, p95 and maximum from the same computer's monotonic clock, closes both sockets, and saves `scripts/network/probe-result.json`. It prints no endpoint, invite, credential or participant identifier. It is never invoked automatically by `npm test` or a build.

On 2026-09-16 preview configuration initially lacked the two public Supabase values. They were subsequently retrieved from the existing production environment and copied only to ignored local configuration. A first actual attempt subscribed both clients but failed to pair within 6,518 ms, sending zero application packets. A subsequent bounded run completed in 3,915 ms, pairing at 1,465 ms and delivering all 12 pings and 12 pongs (no observed loss in this small sample):

| Direction | p50 | p95 / maximum |
|---|---:|---:|
| Host → guest | 88.49 ms | 254.21 ms |
| Guest → host | 82.35 ms | 250.31 ms |
| Application round trip | 216.57 ms | 463.24 ms |

`scripts/network/probe-result.json` records that successful Broadcast observation. These delays and the earlier pairing failure are material limitations for reactive combat, not acceptable-quality certification.

The measured delay motivated the direct WebRTC path. An initial isolated-browser attempt eventually opened native data channels at about 8.5 seconds but missed the bounded response window; it sent no application pings and is recorded as `failed-direct-connect-or-response` in `scripts/network/browser-probe-result.json`. It is not a successful direct latency measurement. Root subsequently verified a complete same-machine, two-tab match through normal controls, including actions from both roles, matching 53.4/46.6 results, rematch and interrupted-match handling; see [Cycle 2 evidence](evidence/CYCLE-2.md). The recorded single RTT readings varied roughly 7–233 ms under two WebGL contexts and recording. Those readings predate the rolling-distribution extension and must not be presented as its p50/p95 measurements. No physical internet or sustained-phone acceptance follows from this local result.

Even a successful smoke experiment would only measure two local clients routed through the service. Required acceptance still includes separate devices on different networks, both host/guest roles, complete race-to-fight-to-cup flow, all matchups, agreed outcomes/rematch, latency/jitter/loss experience, background/disconnect behavior, and physical-iPhone sustained performance with normal controls.

## Source references

Implementation was checked against the installed SDK and the official [Broadcast documentation](https://supabase.com/docs/guides/realtime/broadcast), [Presence documentation](https://supabase.com/docs/guides/realtime/presence), [subscription API](https://supabase.com/docs/reference/javascript/subscribe), [Realtime limits](https://supabase.com/docs/guides/realtime/limits), [WebRTC peer-connection guide](https://webrtc.org/getting-started/peer-connections), and Mozilla's [RTCDataChannel reference](https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel) on 2026-09-16. The project plan/quota was not queried or changed; no plan upgrade or paid resource was created.
