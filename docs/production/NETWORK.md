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

## Revision 2 — bounded local visual feedback

`src/championship/prediction.ts` exports `GuestPrediction` and `PREDICTION_LIMITS`. This is a pure stateful presentation helper: the caller supplies every timestamp, input and authority snapshot. It has no timer, socket, DOM dependency, simulation call or input replay queue. It retains one authority projection, one visual pose, one lateral correction and one vertical correction. `sample` may replace **only the local player's `x`, `y`, `action`, and `actionTime`** in a render copy. Rival state, forward distance/progress, health, invulnerability, cooldowns, counter state, events, phase, tick, score and results are unchanged. The returned copy must never be passed to `stepMatch`, the network, scoring, authoritative audio or gameplay UI.

The API is:

```ts
const prediction = new GuestPrediction(1); // Guest is slot 1; slot 0 is also supported.
prediction.reset(epoch);                  // Accepted new match/epoch, before observe.
prediction.observe(epoch, authority, performance.now());
prediction.updateInput(worldSpaceInput, performance.now());
const now = performance.now();
const rendered = prediction.sample(presentationSample, now);
prediction.disconnect();                  // Leave, interruption, hidden page or lost peer.
```

Root integration calls `observe` only after its existing snapshot admission/validation, and `reset` on each accepted epoch. Wrong-epoch, duplicate and reordered ticks do not update prediction or renew snapshot freshness. Call `updateInput` from the control publisher on **press and release**, so a tap between render callbacks survives, and optionally repeat it each frame. Identical updates do not restart an action or renew its deadline. Inputs use simulation/world coordinates: apply the same race steering sign conversion as the host. Use `performance.now()` consistently for predictor calls, including inside RAF; its supplied frame timestamp can precede an input/snapshot handler that already ran. Call `sample` after the ordinary presentation buffer, immediately before rendering. Disconnect is terminal until an explicit reset, so late packets cannot restart feedback.

Race feedback is lateral steering and a leap. Fight feedback is a grounded evade and a strike windup, including the legacy input aliases as one combined held group. Movement, leap, species evade and strike/counter timings come from the simulation's exported constants. Forward running, drafting, course drift, contacts and other players are not locally simulated. The local player's position starts from the newest received authority, while the rival retains existing interpolation; this avoids handing a local correction back to an older interpolated position.

An unconfirmed pose lasts at most **250 ms**. Strike previews are capped at 45% of the known windup and 180 ms, so speculative animation cannot reach its active/contact portion. A known busy action, cooldown, stun, finished racer or stale snapshot prevents a new conflicting preview. Held buttons and taps made while busy are consumed without a deferred visual queue. Phase cuts and resets preserve release latches, preventing a held race leap from becoming an arena evade or old-match strike. Health loss, hit/stumble, completed authoritative action and phase/character changes cancel the incompatible preview; results and disconnect never create a speculative winner.

Lateral prediction is limited to **0.65 m from newest authority**, the world edge and the known grounded rival's side. Integrations after a long callback gap advance at most 50 ms at once. No new pose starts after a 250 ms snapshot gap; remaining position error is withdrawn over at most 100 additional milliseconds. A leap that authority never accepts similarly returns over a 100 ms correction after its preview ends. Explicit hit/phase/disconnect corrections cancel immediately. New snapshots do not extend an unconfirmed pose's original deadline. There is no processed-action acknowledgement in the current wire protocol: a fresh idle packet may predate the local input, so the helper does not falsely label it a host rejection. It expires unconfirmed intent instead.

### Offline evidence and limits

`npx vitest run src/championship/prediction.test.ts` covers immutable gameplay state; immediate leap, steer, strike and grounded evade; counter windup limits; cooldown/recovery; short taps and combined aliases; repeated/held/busy inputs; wrong-epoch/duplicate/reordered snapshots; loss and expiry; release during stale delivery; hit and finished-action correction; phase/reset/disconnect; invalid clocks; and constant-size state over 2,000 updates.

`node scripts/network/prediction-audit.mjs` runs ten bounded race/fight scenarios against the **actual simulation, input buffers, presentation and predictor**. Each is 2.8 seconds of virtual time at 60 Hz; input/snapshot packet delays, sequence filtering and drops are modeled. It writes `scripts/network/prediction-audit-result.json`, including source hashes, individual response times, maximum position differences, correction observations and state bounds. The same slow schedule without prediction is a positive control: it must fail the one-frame feedback criterion. No browser, network service, GPU or physical device is involved.

In these specific schedules, fresh leap/strike/evade feedback appears on the next modeled frame, **7.33 ms after the scheduled press**. The corresponding unpredicted presentation waits 40.67 ms on the injected 1 ms direct path, 74 ms under direct jitter/loss/reordering, and 257.33 ms under the injected slow Broadcast profile. These are individual deterministic samples, not internet measurements or latency percentiles. Authoritative execution is unchanged: the same inputs still take 15.67–99 ms to reach the host in the ordinary cases. Local feedback therefore does not make damage, opponent response or a poor network path instantaneous.

The input-loss case demonstrates the cost explicitly: a lost leap is previewed, never executes on the host, and finishes correcting 357.33 ms after the press (the 350 ms bound plus sampling to the next frame). The expired strike likewise never executes and is not replayed. A leap pressed after snapshots have become stale is not previewed; a control pressed after disconnect does nothing. Across the modeled cases, the lateral error reaches the 0.65 m limit and the rejected leap can differ vertically by about 1.25 m. Visible cancellation/correction is expected when authority rejects or never receives an input. This is cosmetic anticipation, not rollback, collision prediction or a guarantee of competitive fairness. Browser input dispatch, frame stalls, display latency and actual visual acceptability still require root's normal-control integration tests and the open physical/internet acceptance gates.

Four passes covered the complete typed helper/API, shared mechanics constants and conservative eligibility, adversarial lifecycle/alias/stale-release corrections, and bounded measurement/positive controls plus documentation. Historical transport probes and previous audit artifacts remain unchanged.

### Revision 2 callback convergence

The gameplay reset uses channel namespace **`animal-racers-western-v3`**, isolating the new evade/strike fields and semantics from older clients. The current `node scripts/network/timing-audit.mjs` imports the revised implementation and extracts the actual `begin`, `animate`, receive, rematch and `publishControls` callbacks. Its new default output is **`timing-audit-revision2-result.json`**. The historical baseline/current JSON files and frozen baseline harness remain intact; references to `timing-audit-current-result.json` in the Cycle 7/8 sections describe that earlier run.

All six revised schedules complete two matching championships, including loss of every rematch-countdown snapshot. Both roles agree on 45.5 / 54.5 after actual first-match damage (82 / 100 HP), then 50 / 50 with neutral rematch controls. Both roles reset input and predictor state. Guest canonical mutations, prediction gameplay mutations, canonical action-clock rewinds and canonical race backtracks are zero. The audit samples ordinary presentation separately from the render-only predictor, so legitimate visual correction cannot hide a regression in canonical interpolation.

These are synthetic, five-press samples at fixed 60 Hz, in milliseconds (p50 / p95):

| Injected schedule | Guest press → host action | Guest press → authority-confirmed render action | Guest press → local visual feedback |
|---|---:|---:|---:|
| 1 ms direct | 33.33 / 33.33 | 41.67 / 41.67 | 8.33 / 8.33 |
| Direct jitter, loss and reorder | 16.67 / 50 | 25 / 58.33 | 8.33 / 8.33 |
| Slow Broadcast | 233.33 / 250 | 391.67 / 408.33 | 8.33 / 8.33 |

The one-second input-loss schedule previews five local presses but only four execute: the original first strike reaches the receiver at age 63 host ticks, exceeds the 30-tick expiry policy and never executes. The audit records the first arrival of each original press id/tick, so that expired input is not mistaken for a responsiveness success. All five guest presses in the current slow-fallback artifact remain fresh and execute.

Visual handoff is still visible: the near-zero schedule records five local action-clock corrections, up to 67.67 ms; direct jitter records three up to 68.67 ms; slow fallback records one of 180 ms. These are render-only preview withdrawals or authority handoffs, separately reported from the zero canonical rewinds. Maximum local lateral differences are 0.16 / 0.21 / 0.62 m respectively. The smaller race/loss audit also observes a 0.72 m single-frame lateral position change when newest authority corrects position. The bounds therefore do not certify smoothness on a real display.

Observed full-match storage peaks are eight presentation snapshots, one pending input edge per button (two under the independent saturation control), 60 RTT samples, 32 rate-window entries, 14 queued harness events and 834 bytes of serialized predictor state. Largest modeled envelope is 6,153 bytes. These are inspected bounded structures and fixture observations, not a browser heap profile. No new service experiment was run.

### Reaction timing and host advantage

**Local prediction supplies feedback only. High-latency fallback still changes whether an evade arrives before the authoritative hit.** Eight milliseconds to a speculative pose is not eight milliseconds to a protected evade, a confirmed action or fair combat.

`node scripts/network/reaction-audit.mjs` writes `reaction-audit-result.json`. It runs the actual simulation, input sender/receiver, presentation and prediction, with modeled 60 Hz callbacks and ideal 30/10 Hz sends. Each case starts a normal strike at contact distance, then presses evade **300 ms after the defender first renders the received authoritative windup**. It covers all nine ordered attacker/defender species pairs, both defender roles, and injected constant 50/100/200 ms one-way transit: 108 cases. Another 108 no-defense controls must actually take the attack's specified damage, proving the fixtures are in reach. A separate dropped-input control proves expiry. These are offline injected schedules, without primary-case jitter, packet loss, browser/display latency or human response measurements. Counter strikes and movement before the evade are excluded.

Damage avoided, out of nine species pairs:

| Injected one-way transit | Host defender, 30 or 10 Hz | Guest defender, 30 Hz | Guest defender, 10 Hz |
|---|---:|---:|---:|
| 50 ms | 9 / 9 | 9 / 9 | 6 / 9 |
| 100 ms | 9 / 9 | 7 / 9 | 3 / 9 |
| 200 ms | 9 / 9 | 0 / 9 | 0 / 9 |

Host defense reaches its local receiver 300–316.67 ms after the authoritative strike begins. Guest defense arrives 441.67 / 525 / 758.33 ms after the strike at 30 Hz, or 541.67 / 591.67 / 891.67 ms at 10 Hz, for 50 / 100 / 200 ms transit respectively. The guest first learns of the strike after outbound snapshot transit/cadence, reacts, then incurs input cadence and return transit. The host defender sees the strike start on authority and has no return trip. These are the exact fixture timings, not worst-case bounds.

Every primary-case packet is fresh at the receiver and its edge is delivered into simulation; none of the primary failures is source expiry. Source age at reception is 7 / 12 / 26 ticks at 30 Hz and 9 / 12 / 30 ticks at 10 Hz. Those ages include the already-old snapshot used to stamp the press. Packet freshness, delivery to simulation, actual `evade` events and health outcomes are recorded separately. For example, at 100 ms and 30 Hz, Lion and Unicorn evades against Wolf execute at 650 ms, but take the hit at 666.67 ms before enough protective movement/startup. At 100 ms and 10 Hz, Wolf hits at 666.67 ms; the fresh defense arrives at 708.33 ms and a buffered evade can execute later at 850 ms, after damage. Showing an evade or acknowledging a packet would misclassify those outcomes.

The explicit loss control preserves the press's original source tick through retransmission. Its first arrival has age 66 ticks: it is acknowledged as seen, never delivered as an evade edge and never executes. This differs from the fresh-but-late primary failures. Extending expiry would retain more old intent but could not prevent a hit that authority already applied.

The narrow contract-preserving action is to retain bounded visual feedback and treat a poor path as a combat-quality limitation. A low-latency connection is necessary evidence, and still needs play validation; no production cutoff is established by these small fixtures. Equalizing the reaction budget would require a shared gameplay/network policy—such as delaying authoritative decisions or bounded rollback—with explicit commitment, trust and correction rules. Raising windups globally changes combat pace; trusting guest-timed defense changes adjudication and abuse exposure. None of those policies is implemented or implied by this predictor. Root's two-client normal-control checks, required separate-network play, and physical-iPhone sustained acceptance remain open.

### Event delivery repair and comparison

The component now sends a guest input packet immediately when a control actually changes, using the existing cumulative press history and sequence. The ordinary 10/30 Hz held-input heartbeat remains. The host sends one snapshot on its next animation callback after a new attack, counter, evade, hit or transition/fight/results event; this also resets the normal snapshot cadence. Multiple new events in a callback still produce at most one snapshot. This removes avoidable batching waits without changing health rules, input expiry, participant trust or authoritative outcomes.

The original `reaction-audit-result.json` and `timing-audit-revision2-result.json` remain the preserved cadence-only evidence. Current commands write separate artifacts:

- `node scripts/network/reaction-audit.mjs` → `reaction-audit-cadence-control-result.json`, retaining the cadence-only negative control.
- `node scripts/network/reaction-audit.mjs --event-driven` → `reaction-audit-event-driven-result.json`, comparing both delivery modes under identical fixed-delay reaction fixtures.
- `node scripts/network/timing-audit.mjs` → `timing-audit-event-driven-result.json`, extracting and executing the actual revised component callbacks, including their urgent-event cursors and epoch resets.

The reaction comparison includes 216 primary cases, 216 no-defense hit controls, a forced-expiry control for each delivery mode and 288 additional guest cases sampling 50–200 ms one-way transit at 10 ms increments. Rules and windups are unchanged. With a 300 ms reaction to the first received authoritative windup, guest damage avoidance is:

| Injected one-way transit | Cadence only, 30 Hz | Cadence only, 10 Hz | Immediate events, either heartbeat |
|---|---:|---:|---:|
| 50 ms | 9 / 9 | 6 / 9 | 9 / 9 |
| 100 ms | 7 / 9 | 3 / 9 | 9 / 9 |
| 200 ms | 0 / 9 | 0 / 9 | 0 / 9 |

Host defense remains 9 / 9 throughout. With immediate events, the guest receives the windup 58.33 / 108.33 / 208.33 ms after authoritative onset and its response reaches the host 408.33 / 508.33 / 708.33 ms after onset. All primary inputs remain fresh. The losing 200 ms cases have already taken damage before the response arrives. An evade can execute after that hit; no local pose or packet receipt is counted as protection.

The tested 100 ms case needs **no extra windup time**. Against Wolf, each guest evade executes at 633.33 ms; Wolf's unchanged strike would first hit an undefended target at 666.67 ms. The actual movement/startup rules avoid damage in all three defender species. This is a narrow timing margin. On the fixed-delay grid, every pairing passes through the sampled 100 ms point; 110–120 ms passes 6 / 9, 130–140 ms passes 4 / 9, 150–170 ms passes 3 / 9, and 180–200 ms passes 0 / 9, at both heartbeat rates. These sampled boundaries depend on callback phase, contact distance and normal-strike fixtures. They do not establish a safe production RTT cutoff or cover jitter, counter strikes, display latency or slower human reactions. No counterfactual physics or windup repair is applied.

The actual revised callback audit completes both matching championships under all six delay/loss/rematch schedules. Each role still agrees on 45.5 / 54.5 after first-match damage and 50 / 50 after a neutral rematch. Canonical mutations, canonical backtracks/clock rewinds and prediction gameplay mutations remain zero. Added regressions assert that an unchanged control publication emits no immediate packet and that each callback emits at most one snapshot. Input-expiry and rematch reset assertions remain in force.

For the five scripted guest presses, near-zero delivery now reaches authority in 16.67 ms and authority-confirmed presentation in 25 ms (p50/p95). Direct jitter gives 16.67 / 33.33 ms to authority and 25 / 58.33 ms to confirmed presentation. The injected slow Broadcast schedule gives 116.67 / 116.67 ms and 375 / 375 ms respectively. Immediate visual feedback remains 8.33 ms. The slow confirmed response is still substantial; varied-delay profiles also shift which packet receives each injected delay when packet counts change, so the constant-delay reaction comparison is the controlled comparison of batching policy.

Visual correction also remains: slow fallback records two local clock corrections, up to 241.67 ms, with up to 0.43 m lateral difference. These are separated from canonical monotonicity. Measured rate-window occupancy peaks at 34 messages, below the existing bound; model envelope size stays at 6,153 bytes. None of these offline checks validates native RTC, real network capacity or sustained phone performance. Four passes covered the event/cadence comparison, actual callback integration, expiry and duplicate-publication/snapshot bounds, and preserved evidence plus the remaining timing limitation. Separate-device internet and physical-iPhone acceptance remain open.

### Frozen revision 2 normal-control browser matrix

The integrated production fingerprint **`dab6cd037a2abcb0cb3758f7b66c2643ea0bcebbcb7bb6982a92e1b37aac967e`**, public revision `revision2-dab6cd037a2a`, completed all nine ordered host/guest species pairings and a full agreed Lion/Wolf rematch. This is **loaded same-machine online-service integration**, using actual Supabase signaling and native WebRTC between two isolated installed Chrome profiles. It does not establish separate-network play, human feel, physical-phone performance or visual-art acceptance.

`scripts/network/browser-championship.mjs` uses normal selection/lobby/action buttons and keyboard input, observing only public phase/progress/health/windup/opening UI. It does not import gameplay code, read private app state, evaluate code inside the page, patch clocks/physics or install control hooks. The accepted runs use 844×390 CSS pixels at DPR1, with the host canvas recorded and both roles retaining UI screenshots and downloaded measurements. The viewport exercises a landscape layout; it does not emulate touch or a phone GPU. Parent rendering/recording work could load the same computer.

The accepted evidence directories under `scripts/network/browser-revision2/` are:

- `run-2026-09-20T03-10-27-135Z`: eight ordered pairings other than Lion/Wolf.
- `run-2026-09-20T03-29-25-720Z`: Lion/Wolf and its full agreed rematch, using the stronger counter oracle.

Each of the 20 role-rounds has **four authoritative race leaps, one successful evade and one actual counter event**, as well as further committed strikes and received damage. The controller first observes the rival's windup, waits 330 ms, evades, steps in and replies. Accepted observed-cue-to-completed-Evade-click times range 357–445 ms; these include automation overhead and begin when the polling controller reads the cue, not when the first pixel appears or a person notices it. A predicted pose, packet acknowledgement or ordinary late reply cannot satisfy the counter requirement. Both final reports agree exactly on full scoring, winner, health, finish times and race status in every round.

| Host / guest | Combined score, host / guest | Final HP, host / guest |
|---|---:|---:|
| Lion / Lion | 61.4 / 38.6 | 22 / 0 |
| Lion / Wolf | 67.4 / 32.6 | 46 / 0 |
| Lion / Wolf, rematch | 67.5 / 32.5 | 46 / 0 |
| Lion / Unicorn | 66.0 / 34.0 | 34 / 0 |
| Wolf / Lion | 50.9 / 49.1 | 0 / 28 |
| Wolf / Wolf | 60.3 / 39.7 | 10 / 0 |
| Wolf / Unicorn | 53.5 / 46.5 | 0 / 10 |
| Unicorn / Lion | 55.8 / 44.2 | 0 / 12 |
| Unicorn / Wolf | 59.1 / 40.9 | 28 / 0 |
| Unicorn / Unicorn | 59.1 / 40.9 | 12 / 0 |

This is not a balance contest: race steering holds differ by role, and the final alternating-strike sequence starts with the host. The win distribution cannot establish role fairness or species balance. Several combined winners lose the duel, confirming that both scoring components contribute in these actual runs.

Every final report records native WebRTC. The 20 per-role rolling RTT reports contain 47–60 samples each; their p50 values range 0.9–4.2 ms and p95 values 1.3–16.5 ms, with a largest individual sample 214.1 ms and zero recorded RTT probe timeouts. These are loaded same-computer path observations, not internet latency percentiles or a production cutoff. They do not erase the slow-path host advantage demonstrated by the separate injected-delay audit.

After both results phases, the harness waits at least 4.5 seconds before final screenshots/reports and stopping recording, retaining the complete score reveal and cup entrance. Accepted evidence includes ten portable H264/30fps/AAC review recordings totaling 94,899,278 bytes and 975.21 seconds. Every complete raw recording and encoded copy decoded cleanly before its raw duplicate was removed. Sidecars preserve both hashes, sizes and ffprobe metadata. Review encoding changes frame cadence and cannot certify performance. Canvas recordings omit DOM HUD/controls; the separate screenshots and public reports retain those. All owned temporary profiles and raw duplicates are removed.

Read-only re-verification of saved evidence:

```sh
node scripts/network/verify-browser-evidence.mjs scripts/network/browser-revision2/run-2026-09-20T03-29-25-720Z scripts/network/browser-revision2/run-2026-09-20T03-10-27-135Z
```

It independently re-derives action counts and exact result equality from UI downloads, requires all nine ordered pairs plus a rematch, checks the frozen identity and recorded served-file checks, and rehashes the portable media. It does not launch browsers or contact services. The accepted aggregate is `scripts/network/browser-revision2/aggregate-2026-09-20T03-33-10-433Z.json`. No browser runtime errors or served-file mismatches occurred. Source manifests, served asset/bundle hashes, executed harness/helper snapshots and input/cue timelines are retained.

Negative evidence remains visible. The initial diagnostic pilot in `run-2026-09-20T02-57-20-975Z` failed because an intended leap coincided with a stumble, leaving only one actual host leap; the input plan was improved without reducing the two-leap requirement. Its `DIAGNOSIS.md` also records media-validation recovery and the incomplete award capture. The later dual-recording pilot in `run-2026-09-20T03-04-13-755Z` completed both matches, but parent review found the rematch host's damaging reply occurred after the counter window: one successful evade, zero counters. `COUNTER-REVIEW.md` retains the exact failing stronger command and observed automation delays. The final lower-load rerun passes the stronger requirement for both roles in both rounds. Synthetic oracle self-tests reject missing successful evades, missing counters, divergent winners and passive no-damage fixtures; the saved verifier also rejects an incomplete single-pair subset.

**Art acceptance remains OPEN.** Actual combat screenshots show detached Lion tail bases, Wolf distal tufts and Unicorn rainbow tails. The Lion/Wolf diagnostic screenshot and the Lion/Unicorn and Unicorn/Unicorn reply screenshots retain this defect. These recordings are evidence for the original defective art fingerprint; later asset repairs need their own frozen runtime visual replay. Physical-iPhone, native-touch, separate-network play, sustained performance and owner acceptance also remain open.

Four passes covered complete normal-control flow and rematch, meaningful authoritative action/counter oracles, frozen-build/media integrity and retained negative reproductions, then portable evidence and explicit acceptance limits. No gameplay, service configuration or production asset source was changed by this browser leaf.
