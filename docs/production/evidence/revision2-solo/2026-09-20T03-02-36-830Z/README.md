# Complete normal-control solo matrix — September20

Frozen application `54ecd6e`, report label `revision2-dab6cd037a2a`, fingerprint `dab6cd037a2abcb0cb3758f7b66c2643ea0bcebbcb7bb6982a92e1b37aac967e`. The local production server was unchanged throughout. Source and actually served JS/assets were hashed before/after the runs. Installed Chrome,1100×740,DPR1, MacBook Air M3/24GB. Other QA/asset processes ran concurrently; measurements are not a controlled performance comparison.

The harness uses only ordinary buttons, keys, visible UI and exported reports. All9 ordered CPU matchups completed race→duel→score reveal→cup. Every human slot performed at least2 actual leaps, at least1 successful evade and a damaging counter reply. The parent independently read all9 downloaded reports, checked pair identity, finishing status, event counts and results; see `parent-report-verification.json`. Winning is deliberately not a passing criterion.

| Player / CPU | Final HP | Championship | Successful evades | Real passes |
|---|---|---|---|---|
| [lion / lion](lion-lion-recording-review.mp4) | 100 / 0 | 64.3 / 35.7 | 4 | 1 |
| [lion / wolf](lion-wolf-recording-review.mp4) | 100 / 0 | 64.2 / 35.8 | 4 | 1 |
| [lion / unicorn](lion-unicorn-recording-review.mp4) | 100 / 0 | 64.2 / 35.8 | 4 | 1 |
| [wolf / lion](wolf-lion-recording-review.mp4) | 100 / 0 | 64.2 / 35.8 | 6 | 1 |
| [wolf / wolf](wolf-wolf-recording-review.mp4) | 100 / 0 | 64.2 / 35.8 | 6 | 1 |
| [wolf / unicorn](wolf-unicorn-recording-review.mp4) | 78 / 0 | 58.7 / 41.3 | 6 | 1 |
| [unicorn / lion](unicorn-lion-recording-review.mp4) | 48 / 0 | 49.7 / 50.3 | 5 | 1 |
| [unicorn / wolf](unicorn-wolf-recording-review.mp4) | 100 / 0 | 64.2 / 35.8 | 5 | 1 |
| [unicorn / unicorn](unicorn-unicorn-recording-review.mp4) | 100 / 0 | 61.7 / 38.3 | 5 | 2 |

Unicorn/Lion is a useful split result: the player wins the duel48–0 but loses the championship49.7–50.3 because of the larger race deficit. The other8 reverse the race loss through a stronger duel. This illustrates the formula; it does not establish human-perceived balance or enjoyment.

`*-inputs.json` records attempted actions; the report trace records observed authoritative events. These differ intentionally: an attempted action can be unavailable during commitment or recovery. Videos are the real game canvas with audio and omit DOM controls/HUD; reply/result PNGs show the full interface. The4.5-second result wait captures the complete score reveal and lifted cup.

**Known failure in this build:** upright tails detach visually. These recordings prove functional behavior with those exact assets; they are not acceptance of the later tail/evade animation repair. Phone touch/performance, separate-device internet and owner visual/fun review remain open. Earlier failed harness attempts are retained in sibling directories and excluded from these9 passing matches.

All9 original recordings and H264/AAC review copies passed complete decoding. `portable-media-index.json` rehashes every retained movie and lists exact durations; per-movie sidecars retain original hashes/probes. Only the redundant original WebM copies were removed after verification.
