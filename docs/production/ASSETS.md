# Character asset production

**Current state: authored production study and integration candidate; visual acceptance remains open.** The three characters are actual rigged, deforming 3D assets. Structural tests and studio renders do not establish the requested premium cinematic gameplay quality, phone performance, or owner acceptance.

## Retained deliverables

| Character | Editable source | Runtime |
|---|---|---|
| Fire Lion | `assets/source/western/lion.blend` | `public/assets/western/lion.glb` |
| Water Wolf | `assets/source/western/wolf.blend` | `public/assets/western/wolf.glb` |
| Rainbow Unicorn | `assets/source/western/unicorn.blend` | `public/assets/western/unicorn.glb` |

Sources contain named anatomical meshes, a 22-bone skin with articulated jaw, editable actions/NLA tracks, two corrective sculpt shapes, vertex-painted coat regions, and a packed authored fur normal texture. Source objects remain separate for editing. The exporter batches runtime geometry into one glTF mesh with material primitives. Runtime coat colors use core glTF normalized RGBA16 (maximum conversion error below 0.000008); editable source colors remain full precision. This leaves room for the raised-arm corrective without reducing meshes, normal maps, skinning precision, or adding a runtime codec. No source art is reconstructed from screenshots.

The source generator is `scripts/assets/build_characters.py`; the review renderer is `scripts/assets/render_characters.py`; the independent geometry/animation oracle is `scripts/assets/verify-assets.mjs`. `assets/source/western/qa/structure-report.json` records exact current GLB hashes, triangle/material counts, animation durations and evaluated bounds.

`assets/source/western/reference/character-target-concept.png` is a **concept study**, generated with built-in imagegen from the retained prompt in `reference/PROMPT.md`. It records the cinematic western interpretation of the written commission because the original selected reference PNGs were unavailable. It is not a runtime render or evidence of mesh quality. Added decorative slogans in the generated board are not game-copy requirements.

## Toolchain and reproducible exports

Blender 4.5.9 LTS, official Apple Silicon distribution, was downloaded from `https://download.blender.org/release/Blender4.5/blender-4.5.9-macos-arm64.dmg`. Its SHA-256 matched the official `.sha256` list:

`e3a3d7aac381fb4e4d05197f99cd8899484d7e8bc4497c134066e6733f372238`

The local executable is `/Users/chikumatsuboi/Applications/Blender-4.5.9.app/Contents/MacOS/Blender`. On another machine substitute the installed Blender 4.5 executable; no external asset-generation account is required.

```sh
blender --background --python scripts/assets/build_characters.py -- all
node scripts/assets/verify-assets.mjs
blender --background --python scripts/assets/render_characters.py -- lion
blender --background --python scripts/assets/render_characters.py -- lion motion
blender --background --python scripts/assets/inspect_sources.py
python3 scripts/assets/assemble_motion.py
```

Repeat the render command for `wolf` and `unicorn`. All export inputs are in the repository, including deterministic seed 73145 for the numerical fur normal surface. Meshes, weights, clips, material regions and exports regenerate from the script. Blender files retain editable final results as well. Reproducibility refers to regenerated geometry/behavior, not byte-identical Blender metadata.

## Anatomy and rig choice

The first feasibility pass used a continuous quadruped sculpt formed by unioning anatomical ribcage, waist, pelvis and limb volumes, surface relaxation and mesh reduction. The volumes are discarded; the body/head runtime surfaces are continuous polygon meshes. Species-specific muzzles, ears, paws/hooves, mane, horn, tail, brows and eyelids are separately authored geometry bound to the same rig. The unicorn retains hoof anatomy in combat.

A single skeleton plus an upright-only corrective sculpt was chosen after the first actual renders exposed torso folds. Anatomically constrained vertex weights removed opposing-limb influence; posed-space relaxation produced a corrective shape that blends during `transform`. Applying that correction permanently had damaged the quadruped shoulder and was rejected. The retained version activates it only for upright states. This is a measured authoring choice, not a claim that one rig is always preferable to coordinated meshes.

Short-fur shading uses an original packed tangent-normal texture and matte region-painted skin. Sculpted shoulder/wrist fur, hoof feathering and mane locks contribute to the silhouette. A small weathered leather neckerchief, brass clasp and distinct raised elemental crest connect the roster to the western world without replacing animal anatomy with human clothing.

## Runtime contract

- Metres; glTF +Y up, +Z forward. Source design coordinates are X/right, F/forward, H/up; Blender uses -Y/forward and +Z/up.
- Measured idle bounds including mane/horn: lion quadruped 2.085 m / upright 2.645 m high; wolf 2.035 / 2.595 m; unicorn 2.335 / 2.895 m. These exceed the early approximate 1.6/2.3 m targets. Ground minima are 0.004/0.020 m. Frame cameras against actual bounds. Uniform scale changes native ground-contact speed and requires corresponding gait-time mapping.
- `AnimalRig` metadata includes `nominalRunSpeed: 8`, `nominalFightMoveSpeed: 3.6`, `runStanceDuration: 0.125`, and `runStanceTravel: 1`.
- All clips are in place. Runtime owns world movement, jumping height, facing and course lean. Avoid adding a second gait bounce on top of the authored body motion.
- All skins use the same bone names. Load with `GLTFLoader`, clone with `SkeletonUtils.clone`, and use an independent `AnimationMixer` per competitor.
- Both upright and raised-arm corrective morph tracks are exported in the same named clips as skeletal motion. Do not drop either morph target or its animation tracks when cloning/filtering clips.
- `run`: 0.50-second gallop at native 8 m/s. Each paw moves backward exactly 1 m during its 0.125-second planted interval; the other 75% is airborne recovery. Hind and fore pairs are staggered. Use `timeScale = worldSpeed / 8`. Independent Three.js evaluation measured grounded forepaw velocity `[0, approximately 0, -8.0000004]` m/s.
- `fight_move`: 0.40-second shuffle at native 3.6 m/s. Feet alternate 50% stance, each moving backward 0.72 m over 0.20 s with a 0.10 m recovery lift. Map `timeScale = abs(worldSpeed) / 3.6`; reverse playback when moving backward relative to facing.
- Normal attack: anticipation 0–0.18 s, contact 0.18–0.28 s, recovery to 0.57 s. The sampled clip is 0.5667 s; map simulation time to clip time using `clip.duration / 0.57`.
- Specials: lion anticipation/contact/recovery 0.32/0.14/0.48 s; wolf 0.43/0.16/0.55 s; unicorn 0.40/0.12/0.43 s. Clip endings are quantized to 30 fps; map the full clip onto the gameplay duration.
- At normal-contact t=0.20 s, forepaw/hoof bone pivots are lion `(-0.23,1.55,0.96)`, wolf `(-0.35,1.55,1.01)`, unicorn `(-0.35,1.38,0.96)` in local runtime XYZ. Contact surfaces extend beyond the pivot. Validate adjudicated combat reach against runtime surfaces, not these pivots alone.

| Clip | Intended playback |
|---|---|
| race_idle | loop; breathing and tail motion |
| run | loop; speed mapped to native 8 m/s |
| jump | one shot; folded legs, runtime supplies jump arc |
| land | one shot; compression/recovery |
| stumble | one shot; recoil and recovery |
| transform | one shot and clamp; quadruped to upright with corrective shape |
| fight_idle | loop; breathing and stance |
| fight_move | loop; grounded step response |
| attack | one shot; timed species-specific paw/hoof strike |
| special | one shot; fire lunge / raised howl / protective forehoof pose |
| guard | guarded pose with breathing; blend in/out |
| hit | one shot; torso/head recoil |
| defeat | one shot and clamp; lowered defeated stance |
| celebrate | one shot and clamp; 0.35 s smoothstep lift, then raised forelimbs for runtime cup attachment |

Repeated attacks must restart at simulation `actionTime=0`. Transform and defeat must clamp at the last frame. World-space effects and championship-cup attachment are renderer responsibilities.

## Provenance and redistribution

All geometry, animation, material colors, surface data and production scripts were created for this commission. No downloaded character pack, motion library, commercial game asset, or externally sourced texture was used. There are no third-party asset attribution requirements attached to these authored mesh/animation outputs. The owner may retain, edit, build and distribute these commissioned assets with the game. This record does not impose a new public source license on the repository.

The concept PNG was generated using the built-in imagegen service and is retained with its prompt and tool provenance. It is a design reference, not a shipped runtime texture. Blender is the authoring tool; its application binary and third-party software dependencies are not redistributed in the repository.

## Evidence and remaining gaps

The geometry oracle independently loads each GLB through Three.js, checks nonempty exact clip coverage, skins and normalized weights, material/triangle/byte budgets, finite geometry, and 25 posed vertex-bound evaluations per clip. Texture decoding is stubbed in this Node-only geometry check; actual material appearance is assessed by the retained renders and browser captures. The oracle's result cannot certify good anatomy, foot contact, attractive animation or gameplay hit alignment.

`qa/source-inspection.json` records actual Blender source inspection: each body and head has one connected closed mesh component, zero boundary edges and zero non-manifold edges; the source and runtime SHA-256 values are paired. The skeleton is a deformation rig whose bones share a root and whose absolute-target actions are authored by the retained script; it does not claim a separate animator-facing IK control rig.

The source review renders show all three species in quadruped/upright stances, contact poses, mid-transform and defeat. Full-cycle review movies are **source animation inspection**, not normal-control gameplay recordings. Workbench motion renders deliberately use studio shading and do not certify material appearance. Browser gameplay captures and actual-device tests remain required.

Open visual gaps against the cinematic concept: the current sculpt is simplified and still reads more like a compact stylized mascot than the target's richer anatomy and fur; mane/tuft clusters remain visibly geometric at close range; shoulder/armpit deformation and end-of-recovery interpolation need gameplay-scale review; facial expression has a wolf howl and lion attack jaw performance but fixed brows/eyes, rather than a complete facial performance rig. Cup grip and every race/fight transition require integrated views. Visual acceptance is **not passed** until the rendered game and full motion satisfy the owner; no structural result changes that status.

### Repair cycle 2 — mouth and rear mane

The generator adds a head/jaw-weighted oral sleeve, upper palate, mandible floor and external cheek bridges for Wolf. An initial full-width bridge made the mouth boxy, so the retained version shortens the cheek transition and reduces maximum gape. The reviewed maximum howl now keeps the mandible visually connected. Lion has a closed lofted rear mane cap and overlapping downward locks; the reviewed rear racing view no longer exposes the former bare neck tube. These are bounded repairs, not character acceptance.

Before images, the rejected first mouth bridge, intermediate after views, and paired source/runtime hashes are retained under `qa/repair-cycle-2/`. Its after images predate the following chest and raised-arm changes. Gait targets and attack/special timing are unchanged.

### Form cycle 3 — forequarter support and trophy lift

Actual profile gameplay in `docs/production/evidence/cycle-2-combat.png` made the narrow torso and attached-looking arms more apparent than the three-quarter studio views. The highest-impact shared change was a deeper continuous ribcage and scapular/upper-forelimb mass: heavier Lion forequarters, a leaner Wolf wedge and a deeper equine Unicorn barrel. A smooth sculpt field reshapes the existing connected body without adding separate shoulder parts or topology. Contact pads, bones and native movement speeds remain unchanged. A narrower forelimb weight region prevents belly/flank skin following the raised forearm into a long fold.

The requested trophy lift raises paw/hoof pivots from 1.49 m to 2.50 m over the existing 0.35 s smoothstep, with elbows ending at (±0.50, forward 0.15, height 2.10). A separate additive raised-arm corrective addresses the shoulder fold. An initial unbounded inverse skin correction passed the end-pose view but failed the oracle during Wolf interpolation; it was rejected. The retained correction bounds both posed and source-space offsets. Full reach remains stylized and requires integrated cup/face-clearance review. The raised shoulder silhouette remains somewhat sheet-like; this limitation is explicitly open. All three final poses and complete 0.35 s lift sequences were inspected, and the supported provisional local paw/hoof pivot is (±0.37, 2.50, 0.43) in runtime XYZ.

Current selected stills and affected source motion cycles are retained under `qa/form-cycle-3/after/`; its evidence manifest identifies exact source/runtime hashes and inspection scope. The `before/` body views are retained for comparison. Wolf's before body views predate the mouth repair; compare torso form there, and use cycle 2 for the mouth comparison. The older full-cycle movies in `qa/` remain historical baseline evidence and are paired with their original hashes; they are not labeled as current source coverage.

The body is fuller and the two local gaps are repaired, but the roster remains a simplified stylized study below the richer anatomy, fur and facial performance of the cinematic target. Mane locks and fur tufts are still visibly geometric; raised forelimbs and shoulder contact need gameplay-scale review; fixed brows/eyes limit expression. Root normal-control captures and physical iPhone performance remain necessary. A1 structural checks and A3 source retention cannot close the A2 visual gate.

The current provisional snapshot is frozen for root normal-control preview and owner device testing. Current source movies contain six affected cycles per species (run, transform, fight_move, attack, special, celebrate); their frame coverage, duration and source/runtime SHA pairs were checked before transient PNG frame folders were removed. Older full-cycle movies and both repair manifests preserve comparison history. No Blender render jobs remain active.
