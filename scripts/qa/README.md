# Local inspection and capture

Run these tools from the repository root after `npm ci`. They are excluded from Vercel deployments and are not imported by the game. They expose no production control API.

## Contact pose viewer

```sh
node scripts/qa/contact-preview.mjs
```

Open `http://localhost:3015` in a browser. The server binds only to `127.0.0.1`. It bundles the actual runtime renderer and loads canonical runtime assets. An optional directory under `assets/source/western/` selects isolated upright GLBs, for example `assets/source/western/contact-v2/v2b/candidate`; racing assets and scenery remain canonical. Restart the server and reload the page after changing code or assets: the bundle and source hashes are taken at server startup.

Choose both animals, actions, separation and elapsed time, then Apply pose. Active frame selects normal attack at .21s or the selected special's windup plus .03s. Play cycle advances authored time without stepping the simulation. Guard can be inspected beyond its .6s authored duration to verify that the renderer holds the raised endpoint. Saving writes an unmodified runtime canvas PNG and settings/hash JSON under `docs/production/evidence/contact-inspection/`.

These are pose inspections, **not normal-control gameplay, collision intersection, human feel, performance or multiplayer tests**. Actions are held deliberately, and idle animation continues independently. A paired image can expose contact gaps or overlaps but cannot certify complete motion or adjudication. Only the named code files and three upright GLBs are hashed in each pose record. Full gameplay builds have separate manifests.

## Normal gameplay evidence sink

```sh
node scripts/qa/capture-server.mjs
```

This separate loopback server accepts only the `http://localhost:3013` origin. Run the built app on3013, use its Performance panel and normal controls, then save canvas recording, measurements or frame. Files are created with exclusive names under `docs/production/evidence/`; existing files are not overwritten. Canvas output omits DOM controls/HUD, so inspect the actual browser UI separately. Close both servers with Ctrl-C when finished.
