# Animal Racers — Dust & Glory

A two-competitor western championship: choose Fire Lion, Water Wolf or Rainbow Unicorn, race on four feet, duel upright in the saloon, then combine both events for the gold cup. Solo CPU and invited online players share the same deterministic rules.

**Production status:** playable internal alpha, not an accepted release candidate. See [quality ledger](docs/production/QUALITY-LEDGER.md) and [current QA report](docs/production/QA-REPORT.md). Character polish, physical internet play, iPhone performance and owner acceptance remain open.

Current revision3 [immutable preview](https://animal-racers-26nxovh2m-dera-ai.vercel.app), report label `revision3-ecb5169e9917`. Open the complete private access link supplied directly to the owner first. The owner requested this review checkpoint; implementation is paused for feedback. See the current QA report for exact evidence and remaining gaps. The [revision2 preview](https://animal-racers-eg9gw1za9-dera-ai.vercel.app) is retained only as the owner-rejected comparison. [How to play and invite a friend](docs/production/PLAY-THIS-BUILD.md).

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

## 遊び方

日本語を使う3歳くらいからの子どもを想定した作業版です。動物をえらび、**あそぶ**→短い絵の案内→**スタート！**で始まります。相手と難易度は案内画面の「⚙ あいて・つよさ」で変えられます。実際の子どもの操作・楽しさは未検証です。

レースは自動で走ります。**←・→**でよけ、**ジャンプ**で低い障害物を越えます。キーボードは矢印/A/Dで左右、Space/Wでジャンプです。

バトルは**←・→・たたく**の3ボタンです。たたく（キーボードJ）を1回押すと、最大2.6秒だけ相手へ近づき、届く距離で1回パンチします。相手が守っている時は既存の強いパンチを使います。左右を押すと自動の接近は止まり、左右を押しながらでも新しいパンチを出せます。押しっぱなしでは連続攻撃しません。**バトルだけ あそぶ**ではレースを省いて練習できます。[詳しい遊び方](docs/production/PLAY-THIS-BUILD.md)。

結果画面は4秒間と、すべての指・キーを離して600ms経つまで次の操作を受け付けません。その後、**もういちど**か**どうぶつを えらぶ**を新しく押して離します。連打でトロフィーを飛ばさないための動作です。

レースとバトルは各50点を分け合い、合計で勝者が決まります。レースの差は4秒、バトルの差は残り体力100を上限とします。攻撃の威力、CPU難易度、得点、オンラインの勝敗判定は従来と同じです。[シミュレーション仕様](docs/production/SIMULATION.md)。

オンラインでは2人が同じ版を開き、**ともだちと あそぶ**でリンクか10文字のコードを渡します。2人とも準備を終えると開始し、再戦も2人の操作で始まります。試合中の切断は結果未確定となります。完了した結果は相手が離れても残ります。

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

[Phone/internet test protocol](docs/production/DEVICE-TEST.md) describes the outstanding acceptance session. Both players use the same immutable review build and open its complete owner-supplied access link before exchanging an invitation code. Do not test the new mechanics on an older preview. QA-REPORT.md identifies exact evidence and remaining device/owner gates; task-branch aliases can advance.

Use the in-game **⋯** panel for rolling frame intervals, fresh measurement, session JSON, canvas frames and recordings. Recording itself adds load; use a separate run for performance. Reports do not infer hardware identity or certify60fps.

The existing Vercel project can build this Next app. Supply only the two public backend variables for the target environment and set `NEXT_PUBLIC_BUILD_REVISION` to the delivered Git commit or the explicitly recorded source-fingerprint label. Preserve a manifest mapping that label to the exact source, runtime assets and deployment. A preview deploy is `npx vercel deploy`; production promotion is a separate delivery decision. Do not set `NEXT_PUBLIC_QA_CAPTURE_ORIGIN` on deployed builds. Optional local capture instructions: [capture notes](scripts/capture-notes.md).

Runtime character assets are original authored work; concepts and source provenance are documented in ASSETS.md. The environment geometry and canvas materials are original source in environment.ts/renderer.ts; the generated timber texture has separate provenance above. Third-party code retains its npm package licenses, including Three.js and its RoomEnvironment helper (MIT).
