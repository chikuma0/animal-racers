# Retained stricter-oracle failure

This original run passed its executed oracle: two complete championships, matching results, real race leaps, successful evades and damaging replies for both roles. Its source snapshot and result JSON remain unchanged.

Parent review strengthened the final saved-evidence oracle to require at least one **authoritative `counter` event in each role in every accepted round**, including the rematch. The first match has one counter in each role. The rematch host has one `evade-success`, but zero counters; its reply is an ordinary `attack`. The guest has one counter. The independent stronger check therefore rejects this run for final N6 acceptance rather than silently counting its normal reply as a counter.

The retained host report observes `evade-success` at fight time 5.7667 s and the next `attack` at 6.9667 s, a 1.2 s interval, beyond the 0.95 s counter window. The reply still removes 26 HP and both clients agree on 67/33. The automation timeline records a requested 360 ms inward hold taking 580 ms from key-down to key-up, followed by a 548 ms Strike click operation. This documents delayed automation; it does not isolate the operating-system/browser cause or certify human response. This run used two 1100×740 canvas recordings while other parent work could load the machine.

The next bounded run uses the unchanged production fingerprint at 844×390 with only the host canvas recording, while both roles still play normally and retain screenshots/reports. No physics, clocks, application source or result data is modified. The stronger runtime and saved-report assertions both require counters; a new self-test replaces a counter event with an ordinary attack and proves the oracle rejects it.

Reproduced negative command:

```sh
node scripts/network/verify-browser-evidence.mjs scripts/network/browser-revision2/run-2026-09-20T03-04-13-755Z scripts/network/browser-revision2/run-2026-09-20T03-10-27-135Z
```

Exit 1: `run-2026-09-20T03-04-13-755Z/01-lion-wolf-round2/slot0: authoritative counter reply required inside the earned opening`.

All four complete portable recordings and original reports remain retained. This historical failure cannot be replaced by a later passing capture. Visual tail defects and physical/internet acceptance are separate open requirements.
