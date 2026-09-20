# Cycle6 v2b — isolated contact anatomy and attachment repair

**Historical review, subsequently promoted:** Wave `contact-integration-6` copied these reviewed sources/exports into canonical upright paths. Current production manifests/checks are in `../../upright-v2/`. The text below records the pre-promotion experiment; its original copy is preserved under `upright-v2/inputs/pre-promotion`. Historical checks now resolve promoted Cycle5 files to explicit preserved controls, without claiming production is unchanged.

This candidate is ready for coordinated runtime contact review. It is **not cinematic acceptance**. No canonical race/upright source, export, or Cycle5 evidence was replaced. The first v2 candidate is rejected for its detached Unicorn mane and rotated collar; its source, exports and complete review remain preserved one directory above. `diagnostic-v2-snapshot.json` checks that history, while `frozen-cycle5.json` checks 110 production/control/evidence files from commit `f5cd5e683a848a40b45ab522c11099bd1fc38cb5`.

The intervention preserves exact head/jaw geometry and scale, moves their rest attachment 0.30 m backward, blends connected neck cross-section centers into that setback, and reduces normal-strike torso lean from .23 to .10 radians. Limb targets, animation timing, planted shuffle, 2.50 m cup pivot and .35 s lift are unchanged. A fixed pose is not inferred from targets: independent Three.js checks evaluate actual exported skin vertices.

The initial v2 failure came from applying the new neck rest rotation rigidly to every neck accessory. v2b restores those objects from the frozen control shape. Collars move backward .30 m without rotation. Unicorn mane and Wolf upper crest positions blend with the same neck setback as the body, and their upper vertices blend onto the head bone using smoothstep((height−1.88)/.28). Lower mane retains neck follow. No face mesh is reshaped. The source inspector verifies that every animation channel/key/interpolation and every connected-body vertex remains identical to v2; only those named accessory rest positions and weights change.

## Measured exported bounds

Metres in local runtime coordinates, +Y up and +Z forward. Head includes jaw and head-bound attachments, with the extremal point belonging to the actual nose/muzzle. Each region selects vertices with at least 50% summed influence from its named bones. These are bounds, not collision tests. `contact-comparison.json` retains exact XYZ, material, vertex index, left/right forelimb and pivot records.

| Species | Idle head / chest / paw | Normal contact head / chest / paw | Guard head / chest / paw |
|---|---|---|---|
| Lion | .562 / .372 / .774 | .647 / .430 / 1.294 | .597 / .396 / .894 |
| Wolf | .670 / .318 / .774 | .769 / .376 / 1.344 | .710 / .342 / .894 |
| Unicorn | .730 / .339 / .729 | .811 / .398 / 1.249 | .763 / .363 / .849 |

The 120 Hz sweep over normal active time .18–.28 s keeps maximum head extent below .82 m for all species. Full contact at .20 s retains approximately 1.25–1.34 m paw/hoof reach. No sampled active-window paw reach is shorter than the Cycle5 control. The first oracle incorrectly required every interpolated contact sample to equal peak reach: Unicorn at .18 s is 1.2258 m versus control 1.2204 m. The retained oracle checks the stated peak range and pointwise non-reduction; `../initial-bound-check.log` preserves this diagnostic failure. No model change was made to hide it.

Unicorn normal contact is lower: striking hoof vertices occupy about 1.207–1.458 m height, versus Lion 1.402–1.629 and Wolf 1.408–1.619 m. Pairing extents alone cannot certify a hit. Root/simulation received these limits for coordinated 1.75 m body separation and 1.90 m normal reach review. Unicorn special remains the braced ward pose (.849 m hoof extent), with the proposed short prism pulse owned by the renderer. No extra reach was forced into this asset.

## Retained evidence and review

- `qa/{species}/{front,side}-*-comparison.png`: matched Cycle5 left, v2b right, six poses per view.
- `qa/{species}/side-*-repair-triptych.png`: Cycle5 left, rejected v2 middle, repaired v2b right. Unicorn idle/attack/guard/cup and Wolf idle/howl directly expose the attachment repair.
- `qa/{species}/{front,side}-paired-cycles.mp4`: complete attack, guard, defeat and celebrate cycles; Wolf also includes special. Native source frames are sampled at 15 fps with the last source frame retained. Endpoint rounding adds small review holds; these movies do not redefine runtime timing.
- All 26 full-cycle pages were inspected, covering 468 paired frames: Lion/Unicorn 72 per view and Wolf 90 per view. Six movies are 4.8/6.0/4.8 seconds per view. `review-index.json` pairs every source/runtime SHA, source frame number and clip interval. Transient frames and duplicate unpaired stills were pruned after packaging checks. Useful repaired QA totals about 17 MiB.
- Side idle, contact, guard and cup show Unicorn's mane joining behind the ear, with no separate squared upper end. It stays attached through complete rise/crouch/contact cycles. Wolf's roll lies below the jaw, including maximum howl, rather than appearing on the cheek. Lion's head-bound rear mane remains joined. Front guards/cup lift retain the face and fixed limb volumes; no new visible attachment tear appeared in this bounded review.
- The lower scarf fold is more occluded by the chest. Mane/tail silhouettes remain angular, faces have limited expression, and joint compression/overall simplified anatomy remain below the cinematic concept. Workbench body material swatches appear white because this review intentionally omits shader vertex-color appearance. This is shape/deformation evidence, not material approval, runtime contact proof, physical-device performance, or owner acceptance.

## Reproduce and verify

Use Blender 4.5.9 and Node with the repository's Three.js dependency; ffmpeg/ffprobe are required to package/verify movies. From the repository root:

```sh
/Users/chikumatsuboi/Applications/Blender-4.5.9.app/Contents/MacOS/Blender --background --python scripts/assets/experiment_contact.py -- build all
/Users/chikumatsuboi/Applications/Blender-4.5.9.app/Contents/MacOS/Blender --background --python scripts/assets/experiment_contact.py -- inspect all
node assets/source/western/contact-v2/v2b/verify-runtime.mjs
node scripts/assets/verify-contact.mjs
```

Build writes only versioned v2b sources/exports. Rebuilding invalidates existing QA hashes; re-render/package before the evidence check. With a coordinated GPU window, use the same Blender command with `render all`, then `package all`. Production and rejected-v2 hash checks run before/after each stage. `node scripts/assets/verify-contact-evidence.mjs` checks frozen hashes, paired source/QA hashes, all sample endpoints, movie frame counts and dimensions. The runtime oracle's in-memory `--negative-control` distorts one arm and correctly fails, without changing files.

The source inspector reads every 30 fps frame of all eleven actions, checks finite body vertices and unit bone scales, verifies one closed manifold body, exact rigid translation of every original head/jaw-only mesh, preserved v2 body/actions and explicit accessory placement/upper-root weights. The independent runtime oracle samples every clip 41 times and checks skin normalization, full clip/hierarchy coverage, geometry budgets, fixed limb lengths, planted rear pivots, native 3.6 m/s backward stance, local jump tuck and .35 s cup lift. None of these assertions replaces the visual review.

| Species | Source SHA-256 | GLB SHA-256 |
|---|---|---|
| Lion | `43616c2625780ca6702c780f88b5e28992f5323ef7455ee986cf891014070405` | `9d56a26125fdae942bfe471633ed2afc9c6d0a85c0b9142d0098c8594dff25f3` |
| Wolf | `e2f1d75067e419b75286eb010e20cd5eeb62d86f07f79dfcb8e115cefc493c73` | `01bb159631ade33f6eaec07f37cd2c0fc7d021bb2095f31d8acbfedf9ccb1f01` |
| Unicorn | `f904600d339c9167654a20708cfcaf49eebb1a01fb79419d5191e325856df342` | `fe97d0c5db45e58debaa8e7cb4fb16e985a8995a7f405f3cfc44490e70654ceb` |

Source and GLB files are in `candidate/`. Original input/control files and exact frozen generators are retained above; current variant recipe is `scripts/assets/experiment_contact.py`. Root should integrate only this v2b version after the paired runtime review. Main visual gate A2 stays open.
