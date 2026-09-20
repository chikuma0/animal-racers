# Animal Racers — Dust & Glory

A two-competitor western championship: choose Fire Lion, Water Wolf or Rainbow Unicorn, race on four feet, duel upright in the saloon, then combine both events for the gold cup. Solo CPU and invited online players share the same deterministic rules.

**Production status:** playable internal alpha, not an accepted release candidate. See [quality ledger](docs/production/QUALITY-LEDGER.md) and [current QA report](docs/production/QA-REPORT.md). Character polish, physical internet play, iPhone performance and owner acceptance remain open.

Current gameplay revision2 review: [immutable preview](https://animal-racers-eg9gw1za9-dera-ai.vercel.app), report label `revision2-de401d12cd83`. Open the full private access link supplied directly to the owner first. [How to play and invite a friend](docs/production/PLAY-THIS-BUILD.md).

## Run

Use Node22 or newer and npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Solo works without a backend. For online play, put the existing project's public Supabase URL and anonymous key in `.env.local`. Never use a service-role key. The game uses namespaced Realtime presence/signaling and native WebRTC; it does not require a database table or schema migration. It falls back to Broadcast where direct connectivity fails. That slower path is not yet accepted for responsive combat.

```sh
npm test
npm run lint
npm run typecheck
npm run verify:assets
npm run build
npm run start
```

## Play

Landscape touch controls appear along the bottom. The race runs automatically: **steer and leap**. Follow close behind to build a visible slipstream, then pull alongside to overtake. Choose a line through bends, leap low hurdles and go around loaded wagons. An obstacle costs speed briefly; drafting gives a trailing racer a way back into the contest.

The saloon duel uses **move, strike and evade**. Watch the opponent commit, evade the blow, then step in with a faster reply during the counter opening. Every attack has anticipation, contact and recovery. Lion hits harder, Wolf moves faster, and Unicorn has a longer protected evade. Their elemental effects follow these same actions. Keyboard: arrows/A/D move, Space/W leaps in the race and evades in combat, J strikes. [Approved gameplay brief](docs/production/GAMEPLAY-DESIGN.md).

Each event distributes50 points between the competitors. Race-time advantage is capped at4 seconds; combat uses remaining HP advantage, capped at100 HP. A close race loss can be recovered by a strong fight. No race buffs, attack-count points or hidden human handicaps. Exact examples and edge cases: [simulation specification](docs/production/SIMULATION.md).

For online play, both players open the same deployed version. One selects **Invite a friend** and shares its link or10-character code; the other selects a character and joins. Both ready up. Keep both screens open through the race, duel and result. Both must choose **Ride again** for a rematch. Leaving or losing connectivity during active play interrupts the match without a verified result. A completed score remains valid if a rival then leaves.

## Architecture and assets

- `src/championship/simulation.ts`:60Hz rules, CPU, hits, progression and scoring.
- `src/championship/network.ts`:bounded session transport. Host adjudicates; guest sends inputs.
- `input-buffer.ts`, `prediction.ts`, `presentation.ts`: tap delivery, bounded immediate guest action previews and reconciliation to host snapshots; presentation never decides damage or scores.
- `course.ts`: shared bend geometry and purposeful hurdle, barrel and wagon placement.
- `renderer.ts`, `environment.ts`, `impacts.ts`:Three.js world, material/terrain authoring, rigged GLB animation, confirmed-contact accents and cup.
- `Championship.tsx`:touch/keyboard UI, lifecycle, capture and measurements.
- Editable `.blend` files and reproducible export scripts: [asset production](docs/production/ASSETS.md).
- Separate racing and upright GLBs preserve each animal's face and palette while giving fighting poses a dedicated joint topology. Loading prepares outdoor and saloon lighting variants before play.
- Generated character/scene boards under source/reference and docs/visuals are concept targets, not screenshots. The [timber material](docs/production/visuals/environment/PROVENANCE.md) is an original generated runtime texture with its source and exact prompt retained.

The legacy Canvas implementation is retained in source history and unused components. The home page loads the new championship only.

## Test and publish

[Phone/internet test protocol](docs/production/DEVICE-TEST.md) describes the outstanding acceptance session. The earlier comparison build is [f600be2](https://animal-racers-4png9iy68-dera-ai.vercel.app); its scoped access link is shared privately. Both players must first open the full private link, then exchange an invitation code. That September17 build predates the approved gameplay redesign and rebuilt characters. The current revision2 preview above includes the approved gameplay redesign, rebuilt characters and connected-tail/evade repair. QA-REPORT.md identifies its exact evidence and remaining device/owner gates. Later task-branch previews may change; the immutable comparison URL remains fixed.

Use the in-game **⋯** panel for rolling frame intervals, fresh measurement, session JSON, canvas frames and recordings. Recording itself adds load; use a separate run for performance. Reports do not infer hardware identity or certify60fps.

The existing Vercel project can build this Next app. Supply only the two public backend variables for the target environment and set `NEXT_PUBLIC_BUILD_REVISION` to the delivered Git commit or the explicitly recorded source-fingerprint label. Preserve a manifest mapping that label to the exact source, runtime assets and deployment. A preview deploy is `npx vercel deploy`; production promotion is a separate delivery decision. Do not set `NEXT_PUBLIC_QA_CAPTURE_ORIGIN` on deployed builds. Optional local capture instructions: [capture notes](scripts/capture-notes.md).

Runtime character assets are original authored work; concepts and source provenance are documented in ASSETS.md. The environment geometry and canvas materials are original source in environment.ts/renderer.ts; the generated timber texture has separate provenance above. Third-party code retains its npm package licenses, including Three.js and its RoomEnvironment helper (MIT).
