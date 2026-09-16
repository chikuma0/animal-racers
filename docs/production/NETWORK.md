# Championship network transport

The new transport is isolated from the earlier game in `src/lib/multiplayer.ts`. It lazily loads Supabase only when the player connects; solo mode needs no environment variables. The current room namespace is `animal-racers-western-v2`, separating clients with expiring input history from the earlier v1 packet shape. Both players must load the same build before using an invitation. There are no database writes, schema changes, authentication-setting changes, or shared channel names.

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

## Offline response and convergence audit (Cycle 7)

The preserved `timing-audit-baseline-2316db7.mjs` harness audited the frozen Cycle-6 protocol at `cbcf856fd014150de5342e5b85adb4ab6a262a62`. The audit finished at repository HEAD `2316db74f0810a2e478010a3d0700b8845a5794c`, after an unrelated scenery commit; all five audited source hashes still match Cycle 6. It runs entirely in Node with injected sockets, a virtual clock, deterministic epoch labels and a renderer sink. It imports the actual exported transport, input, presentation and simulation implementation, and extracts the actual `begin`, `animate`, message-handler and rematch callbacks from the component's TypeScript AST. The result artifact preserves those callbacks verbatim, their line numbers and SHA-256 fingerprints, and fingerprints all five audited source files. Canonical source files are checked again before the artifact is written. The frozen revision remains available in Git.

This is a diagnosis harness, not a browser, native WebRTC or internet measurement. Both modeled app loops run at 60 Hz, with the guest half a frame later. Touch/keyboard dispatch, React scheduling, drawing, GPU/display latency, CPU stalls, native ICE negotiation and real acknowledgement/backpressure timing are excluded. A model-visible action means the actual presentation output first contains the matching authoritative event and action. The one local host press is deliberately aligned with its simulation frame; a zero-delay reading for that press does not mean zero hardware latency. Percentiles use nearest rank, and the five guest action samples per profile are a small deterministic sample, not a population estimate.

Profiles inject 1 ms one-way delay; a direct path with 2–120 ms delay, reordering and periodic drops; a 130 ms delay step; a 10 Hz Broadcast path with 82–250 ms one-way delays, reordering and periodic drops; and a one-second guest-input loss burst. Slow fallback values are inspired by the earlier small Broadcast observation, without claiming to reconstruct that run. Two additional scenarios lose every snapshot in the rematch countdown: one exercises the unchanged source, and one changes only the extracted in-memory condition to test a repair hypothesis. Virtual duration is limited to 340 seconds and fewer than 150,000 scheduled operations per scenario. Each ordinary scenario finishes two full championships, with normal movement and short button inputs producing real combat damage in the first.

Freshness is measured separately from action onset. Snapshot age is the time since the latest accepted snapshot was sent, using the harness's common clock. Host tick lag compares the live authority tick with the received canonical tick retained by presentation. Action-clock lag compares only matching live action instances; it excludes idle clocks and different attacks. Render output must retain the received canonical phase, health and score, and the guest's canonical match must remain unchanged by its frame callback. Race-position regressions and action-clock rewinds are recorded separately. Bounds inspect the actual presentation history, transient input queues, RTT sample history, rate windows and envelope sizes. The scheduler queue is a harness measurement, not a claim about a browser's memory. An additional 1,000-edge saturation control verifies the receiver retains at most two pending presses and does not replay duplicate cumulative counters.

The saved baseline `scripts/network/timing-audit-result.json` contains seven scenarios. Main-profile figures below are **synthetic model-to-render timings**, in milliseconds (p50 / p95, five guest presses per profile):

| Injected profile | Guest input → authority | Guest input → guest presentation | Accepted snapshot age p50 / p95 / max |
|---|---:|---:|---:|
| 1 ms direct | 16.67 / 33.33 | 41.67 / 58.33 | 25 / 41.67 / 41.67 |
| Direct jitter, loss and reordering | 66.67 / 100 | 75 / 175 | 25 / 108.33 / 208.33 |
| Slow Broadcast | 216.67 / 316.67 | 375 / 475 | 158.33 / 308.33 / 608.33 |

The 130 ms delay-step profile raised maximum snapshot age to 158.33 ms; its combat inputs occurred after that race-phase disturbance, so its action-onset figures match the 1 ms profile. Each ordinary profile completed matching first results of 43.7 / 56.3 after actual combat damage (75 / 100 HP), then a matching 50 / 50 rematch with no scripted second-match attacks. All six short presses reached authority. The slow fallback's guest response is materially longer than the 180 ms normal-attack windup; canonical agreement alone therefore does not establish suitable combat responsiveness.

No guest canonical mutation occurred. Observed peaks were eight presentation frames, one queued edge per button in the match scenarios (two in the explicit saturation control), 60 RTT samples, 32 entries in a transport rate window, 3,830 bytes per modeled envelope, and 14 scheduled harness events. Every scenario stayed below 46,082 scheduled operations, and both modeled transports released their channels/peer connections on cleanup. These are bounded-case observations and assertions, not a general browser heap profile.

The rematch reproduction is consequential: `Championship.tsx:496–500` admits a different epoch while waiting for a rematch only when the snapshot phase is `countdown`. Dropping the 60 countdown snapshots caused the guest to reject 100 later valid race snapshots at the epoch guard (`514–518`). The host continued in the new epoch, rejected the guest's old-epoch inputs, and interrupted. The guest remained on the previous results screen because that phase is excluded from the inactivity timeout. The counterfactual completed both matching results under the same loss burst.

The smallest proposed repair is to remove the countdown-only restriction from the guest's existing `different epoch && rematchPending` admission rule. Keep the validated snapshot shape, bound host/session, envelope sequence checks, epoch reset, and same-epoch tick ordering. This accepts the first surviving snapshot after the user has requested another match; it does not let a late old-epoch packet restart active play. This trust model still assumes the admitted host is authoritative, as the existing protocol already does. A rematch-wait timeout could also make a permanently unavailable host visible, but does not repair the epoch rejection itself.

The in-memory counterfactual is **not production repair verification**. The baseline artifact and original harness are retained. To reproduce that historical diagnosis, use a separate checkout of2316db7, copy `timing-audit-baseline-2316db7.mjs` into its `scripts/network/` directory and run it with that revision's dependencies. It deliberately expects the old deadlock. The current `timing-audit.mjs` instead verifies actual repaired source and writes `timing-audit-current-result.json`; `--expect-rematch-recovery` remains an alias.

Two additional baseline defects were subsequently repaired in Cycle8:

- Guest presentation can move backwards in time. With 1 ms delivery, the same attack's rendered clock fell from 33.33 ms to 7.33 ms while its received canonical tick and clock stayed unchanged. Switching from the newest action clock to delayed interpolation caused four action rewinds, up to 26 ms. Slow Broadcast produced nine rewinds up to 99.67 ms and 72 backward race-position frames, up to 0.12 m; direct jitter produced 11 backward frames up to 0.09 m. A narrow presentation repair should keep a monotonic playout cursor within a match and a monotonic clock for each identified action instance, resetting those caches at epoch/phase/action changes. Preserve immediate canonical phase, health and result handling. Do not clamp all world positions: legitimate arena retreat still needs to work.
- Cumulative edges have a memory bound but no action-age bound. A one-second guest-input loss burst delayed a released 20 ms attack to 1,033.33 ms at authority and 1,041.67 ms in guest presentation, despite fresh host snapshots. The 500 ms remote-input neutralization does not expire an unseen edge received later. If old combat taps should expire, add explicit bounded per-edge freshness and consume expired counters without replay; choose that policy and test it before changing the protocol. Preserving short taps alone does not prove timely intent.

The audit completed four passes: actual-code extraction and full-match schedules; independent clock/authority/memory measurements; stronger same-action identity, transient-queue and real-damage controls; then bounded cleanup, portable file URLs, preserved source evidence and a separate real-repair verification mode. The inspected gate run passed the 30 transport tests and all seven audit scenarios, including the required failure reproduction, in 95.42 seconds for the audit itself under host contention. `leaf-1.3` records 3 met, 0 unmet, 0 abandoned. A passing diagnosis gate records the defects; it does not certify multiplayer acceptance.

Required separate-device internet play and physical-iPhone sustained-performance acceptance remain open.

## Source references

Implementation was checked against the installed SDK and the official [Broadcast documentation](https://supabase.com/docs/guides/realtime/broadcast), [Presence documentation](https://supabase.com/docs/guides/realtime/presence), [subscription API](https://supabase.com/docs/reference/javascript/subscribe), [Realtime limits](https://supabase.com/docs/guides/realtime/limits), [WebRTC peer-connection guide](https://webrtc.org/getting-started/peer-connections), and Mozilla's [RTCDataChannel reference](https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel) on 2026-09-16. The project plan/quota was not queried or changed; no plan upgrade or paid resource was created.

## Cycle8 current repairs

The guest now adopts the first valid new epoch from its admitted host while a rematch is pending, regardless of phase. Existing participant/session/sequence validation and subsequent same-epoch tick ordering remain. Presentation holds a monotonic tick cursor within a phase, and keeps a separate monotonic rendered clock for each action instance. Phase/epoch/new-action resets remain explicit; arena retreat is not clamped and health/results still come directly from authority. The original33.33→7.33ms rewind is independently reproduced against2316db7 in `evidence/cycle-8-presentation-negative-control.json`; the repaired clock holds at33.33ms.

Input packets now contain at most the two latest presses per button, each with its cumulative id and the host tick known when it was pressed. Retransmission does not renew this tick. The host accepts a press for at most30 authority ticks (500ms of simulation time), consumes expired ids, and expires queued presses/held movement as the clock advances. A fresh tap after recovery still works. The guest stamp includes downstream snapshot delay, so this is deliberately conservative on a bad connection; inputs may be dropped rather than executing after their intended moment. It does not claim wall-clock synchronization, rollback, prediction or anti-cheat. Namespace v2 keeps incompatible old input schemas in separate rooms.

The final current-source offline audit covers six schedules: all five original profiles plus total rematch-countdown loss. All finish with matching results and rematches, zero measured action rewind/race backtrack frames, bounded histories and no guest canonical mutation. In the one-second input-loss burst the old press has no authority/visible event; the subsequent four guest presses and one host press execute. Normal synthetic response distributions remain41.67/58.33ms direct,75/175ms jitter and375/475ms slow Broadcast (p50/p95, five guest presses). Expiry improves stale-intent correctness; it does not make fallback combat responsive.

Current unit regressions, lint and production build pass. Actual current two-browser play passed Lion-host/Unicorn-guest results68.6/31.4, rematch start and no-award interruption after leaving. Both downloaded result objects match. The recording-on two-client desktop run still has substantial stalls; separate-device/physical-phone acceptance remains open. The shared owner preview remains4ed5042 until explicitly replaced. See `evidence/CYCLE-8-NETWORK.md` for the current build and play checkpoint.
