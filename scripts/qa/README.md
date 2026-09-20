# Local inspection and capture

Run these tools from the repository root after `npm ci`. They are excluded from Vercel deployments and are not imported by the game. They expose no production control API.

## Contact pose viewer

```sh
node scripts/qa/contact-preview.mjs
```

Open `http://localhost:3015` in a browser. The server binds only to `127.0.0.1`. It bundles the actual runtime renderer and loads canonical runtime assets. An optional directory under `assets/source/western/` selects candidate GLBs, for example `assets/source/western/revision2/candidate`. All three upright assets are required; race assets use the candidate when present and otherwise use the canonical file, preserving older upright-only studies. Scenery remains canonical. Restart the server and reload the page after changing code or assets: the bundle and source hashes are taken at server startup.

Choose the stage, both animals, actions, separation and elapsed time, then Apply pose. Active frame selects the chosen animal's strike windup plus .03s; Counter reply uses the actual shorter reply windup. Play cycle advances through the strike or evade duration (two seconds for other pose types) without stepping the simulation. Evade displacement previews the rules' speed and duration so foot lift can be judged against movement; it deliberately does not resolve collision, arena bounds or hits. Evasion, hit reaction, running and leaping can also be inspected. Saving writes an unmodified runtime canvas PNG and settings/hash JSON under `docs/production/evidence/contact-inspection/`.

These are pose inspections, **not normal-control gameplay, collision intersection, human feel, performance or multiplayer tests**. Actions are held deliberately, and idle animation continues independently. A paired image can expose contact gaps or overlaps but cannot certify complete motion or adjudication. The named renderer/rules/viewer code files and all six loaded animal GLBs are hashed in each pose record; scenery is outside this manifest. Full gameplay builds have separate manifests.

## Normal gameplay evidence sink

```sh
node scripts/qa/capture-server.mjs
```

This separate loopback server accepts only the `http://localhost:3013` origin. Run the built app on3013, use its Performance panel and normal controls, then save canvas recording, measurements or frame. Files are created with exclusive names under `docs/production/evidence/`; existing files are not overwritten. Canvas output omits DOM controls/HUD, so inspect the actual browser UI separately. Close both servers with Ctrl-C when finished.

## Storefront geometry inspection

`node scripts/qa/inspect-storefront.mjs [new-report.json]` executes the current renderer's actual storefront builder without WebGL, measures geometry/cost and checks the16 inspected race placements against the road envelope. Canvas sign text is omitted while preserving its plane geometry. The placement/curve constants are explicitly tied to the current500m course; review them if `buildRace` changes. This is a geometry inspection, not phone performance or a gameplay collision test.

## Normal-control solo matrix

```sh
node scripts/qa/solo-playthrough.mjs http://127.0.0.1:3013 docs/production/evidence/revision2-integrated/build-manifest.json revision2-dab6cd037a2a
```

Use the manifest and report label for the actual frozen production build. The optional fourth argument selects ordered pairs such as `lion:wolf,wolf:unicorn,unicorn:lion`; the default covers all nine. Do not edit runtime source/assets or rebuild while a matrix runs.

The harness uses an isolated installed Chrome context, visible DOM cues, ordinary keys/buttons and the game's own downloadable measurements/recording. It verifies served files and source hashes, completed races, actual leaps, successful evades, counters and damaging replies; it waits for the score reveal and cup before capture. It has no private game-state access and cannot force a result. Recordings omit the DOM HUD, which is retained in screenshots. A script-controlled desktop pass is not physical touch, human enjoyment or performance acceptance. Failed attempts and their diagnosis remain evidence.

## Tail-repair renderer inspection

`node scripts/qa/capture-pose-cycles.mjs` uses the loopback contact viewer UI to record each animal’s normal strike, counter reply and moving evade, plus contact/hit/race stills. It verifies unique saved settings and every candidate asset hash. This is deliberately separate from normal-control gameplay evidence. `prepare-pose-media.mjs` creates fully decoded H264 review copies of only its owned short silent recordings. See `docs/production/evidence/revision2-tail-runtime/2026-09-20T03-50-31-404Z/README.md`.
