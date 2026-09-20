# Character asset production

## Revision2 roster — canonical integration for gameplay review

Six coordinated, editable animated animals now have rebuilt orbital/skull/muzzle surfaces, recessed almond eyes, species ears, revised coat regions, shaped mane/cheek/tail fur and fitted western collars. The continuous body skins and proven articulated rigs are retained with species mass corrections. Lion has a broader feline whisker field and overlapping tapered crown/cheek/chest fur; Wolf has a longer muzzle, pointed triangular ears and a connected cheek-fur field; Unicorn has a continuous long equine muzzle, surface-following nostrils/lip seam and a spiral horn. The upright ready stance, committed species strike and evade are newly authored.

**This is a material improvement over the immutable f600be2 control, not cinematic or owner acceptance.** The mane/coat still have a simplified sculpted appearance, brows/eyes have limited facial performance, and raised shoulders remain stylized. Parent reviewed all six current material proofs and all nine ordered runtime strike pairings at both1.75m and1.85m, and approved exact-byte canonical promotion for integrated gameplay review. Physical iPhone verification and full cinematic acceptance remain required. Reviewed files are retained under `assets/source/western/revision2/candidate/`; `public/assets/western/roster-v2.json` and `revision2/canonical-integration.json` record the twelve promoted source/export hashes.

| Character | Race triangles | Upright triangles | Material primitives | Race / upright GLB bytes |
|---|---:|---:|---:|---:|
| Fire Lion | 24,351 | 28,871 | 7 / 7 | 1,620,884 / 1,690,132 |
| Water Wolf | 17,551 | 22,066 | 8 / 8 | 1,361,220 / 1,422,932 |
| Rainbow Unicorn | 17,783 | 20,641 | 8 / 8 | 1,359,136 / 1,347,872 |

The six canonical paths retain the existing names: `assets/source/western/{lion,wolf,unicorn}.blend`, `{lion,wolf,unicorn}-upright.blend`, and matching `public/assets/western/*.glb`. Each source contains named editable meshes, source colors/UVs, embedded authored short-fur normal data, the deformation skeleton, and real actions/NLA tracks. The head is a separate editable skinned surface over the continuous neck; this is not a claim of one welded whole-animal topology. Each runtime file is one batched skinned mesh. Race uses 22 bones and two corrective morphs; upright uses the existing 25-bone fixed-length hierarchy. No rig or deformation budget was increased.

### Current recipe and verification

Use Blender4.5.9 with Python execution disabled for loaded files. The current recipe is `scripts/assets/rebuild_roster_v2.py`; older generators below are historical recipes and do not reproduce Revision2.

```sh
blender --background --factory-startup --disable-autoexec --python-exit-code 1 -t 2 --python scripts/assets/rebuild_roster_v2.py -- build all all
node scripts/assets/verify-assets.mjs --candidate
node scripts/assets/verify-upright.mjs --candidate
blender --background --factory-startup --disable-autoexec --python-exit-code 1 -t 2 --python scripts/assets/rebuild_roster_v2.py -- reproduce
blender --background --factory-startup --disable-autoexec --python-exit-code 1 -t 2 --python scripts/assets/rebuild_roster_v2.py -- inspect all all
node scripts/assets/verify-roster-v2.mjs --source-only
```

`build` writes the isolated candidate folder. `reproduce` performs a fresh isolated six-file construction and compares exact GLB bytes plus editable mesh/topology/weights/colors/UV/morph/rig/action semantics; it does not replace reviewed source files. Blender binary serialization metadata itself is not deterministic. The explicit local `promote` command copies the reviewed sources/GLBs to canonical paths and records their hashes; it performs no network publication. After integration, run both production asset oracles and `node scripts/assets/verify-roster-v2.mjs --canonical`.

The baseline is copied from commit `f600be2`, with all12 source/export hashes in `revision2/baseline.json`. Original textures, geometry and actions were authored for this commission. No downloaded Wolf/Mast/LazyGraph/Sketchfab geometry, source-study head, motion pack, or third-party texture is included in these six outputs. The owner may retain, edit and distribute them with the game; this adds no repository-wide public license. Historical licensed studies retain their own original source/license records and remain unintegrated.

### Revision2 animation contract

Metres, glTF+Y up/+Z forward, in-place motion. Runtime supplies world movement, evade displacement, jump height and facing. The race gallop remains native8m/s; the upright shuffle remains native3.6m/s, so use `abs(worldSpeed)/3.6` for species speeds3.4/4.2/3.6 and reverse for backward motion. Cup paw pivots remain `(±.37,2.50,.43)` with the existing .35s smoothstep lift; runtime cup attachment/platform offset remain separate.

| Species | Attack windup / active / recovery | Gameplay total | Evade gameplay duration |
|---|---|---:|---:|
| Lion | .68 / .14 / .82s | 1.64s | .40s |
| Wolf | .55 / .12 / .82s | 1.49s | .38s |
| Unicorn | .60 / .14 / .76s | 1.50s | .42s |

Clip names are `attack` and `evade`. The strike visibly withdraws the paw/hoof, coils the torso and shoulders, extends into contact and recovers; the native sampled clip reaches extension by the active boundary. Successful-evade counter windup is .24s, and the renderer must retime only the authored startup segment; active/recovery semantics stay fixed. Sources sample at30fps, so clip endpoints differ slightly from gameplay durations. Use exported durations and the authoritative timing segments. The `evade` has a smooth crouch with planted feet and no root translation; simulation owns its travel and invulnerability.

The race files contain15 named clips (all14 legacy names plus `evade`); upright files contain12 (`transform`, `fight_idle`, `fight_move`, `attack`, `special`, `guard`, `hit`, `defeat`, `celebrate`, `jump`, `land`, `evade`). Runtime uses the quadruped form for countdown/race, and the dedicated upright form for menu/transition/fight/results. `special`, `guard`, and upright jump/land remain compatibility clips even though Revision2 fighting exposes only Strike/Evade. **The quadruped file's unused transform/combat corrective poses retain the older torso crease and are compatibility/bounds coverage, not accepted upright artwork.** The separate upright assets are required for the production scene cut.

Measured conservative torso-skin bounds across the entire gallop: widths Lion1.396m, Wolf1.101m, Unicorn1.189m; forward span1.761m. These exclude face and tail and support the current3.0m longitudinal/1.5m lateral queue spacing. Current active upright face/nose/jaw forward maxima are recorded independently in `*-source-inspection.json`; do not derive combat collision from total fur/tail bounds.

### Current visual and source evidence

`revision2/candidate-handoff.json` gives exact source/GLB hashes and uniquely named current material images under `revision2/qa/final-review/`. The six `qa/{species}/{race,upright}/` directories contain matched front/side/three-quarter/full-body views, actual CPU Cycles material proofs,81 complete matched animation movies and1,311 paired15fps frames in contact sheets. Each clip has an MP4 and an every-frame JPG; `complete-matched-cycles.mp4` contains the complete ordered sequence, and `index.html` labels the clips.

Motion compares immutable baseline on the left with candidate on the right. Baseline clips are uniformly time-normalized to each candidate duration for geometry comparison, with original duration retained in the sample record. Because the baseline had no evade, its `hit` pose is explicitly labeled as a different geometric control. Workbench motion does not certify material appearance; the matched CPU Cycles stills use the real material graphs. None of these are normal-control gameplay recordings.

`revision2/REVIEW.md` records the four implementation/review passes, concrete repaired defects and remaining limitations. After decoded-frame/hash verification, transient motion PNG directories were removed; all complete compressed movies and every-frame comparison sheets remain. Regenerate transient frames with `motion all all` before rerunning `package all all`.

The current oracles independently evaluate actual exported skinned geometry, exact clip sets, budgets, normalized weights, fixed upright limb lengths, planted feet, native gait speeds, cup lift and measurable strike anticipation. Negative controls remove the required attack name and distort a real arm bone, and both must fail. `verify-roster-v2.mjs` additionally verifies immutable controls, fresh reconstruction, current source/evidence hashes and decoded movie frame counts. Structural validity is never used to pass the cinematic gate.

Historical oracle receipts below certify their recorded commits/inputs only. They must not be read as proof that today's promoted canonical files still equal earlier frozen production hashes. `revision2/inputs/` preserves the f600be2 control bytes; previous study inputs and QA remain intact.

## Historical pipeline and review record (before Revision2)

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

The original provisional race snapshot remains frozen for root normal-control preview and owner device testing. Its current source movies contain six affected cycles per species (run, transform, fight_move, attack, special, celebrate); their frame coverage, duration and source/runtime SHA pairs were checked before transient PNG frame folders were removed. Older full-cycle movies and both repair manifests preserve comparison history.

## Dedicated upright integration candidate

Repeated repairs of the original quadruped surface did not resolve crumpled upright defeat or stretched raised shoulders. A bounded Unicorn experiment therefore built a separate connected upright torso/limb surface and articulated parent hierarchy. The matched control/experiment evidence is retained at `assets/source/western/experiments/upright-v1/`, including full transitions, topology checks and deformation diagnostics. This established a viable structural direction, not premium acceptance.

The extension supplies separate `public/assets/western/{lion,wolf,unicorn}-upright.glb` and editable `assets/source/western/{lion,wolf,unicorn}-upright.blend`. Original race files and their 14-clip pipeline are untouched. The dedicated upright assets have 25 bones and 11 clips: transform, fight_idle, fight_move, attack, special, guard, hit, defeat, celebrate, jump and land. Their transform is a crouched arrival to stand after the scene cut. Lion/Wolf have connected padded paws with toe/claw detail; Unicorn keeps its hooves. Lion has a broader chest and forelimbs, Wolf a narrower build. Body construction uses authored connected joint loops and intentional skin weights, without the quadruped corrective morphs.

Run both `node scripts/assets/verify-assets.mjs` and `node scripts/assets/verify-upright.mjs`. The upright companion checks independent exports and measured animation behavior, including native 3.6 m/s planted shuffle and trophy pivots at `(±.37, 2.50, .43)` after a .35 s lift. Source/QA reports and build instructions are in `assets/source/western/upright-v1/README.md`. Full 30 fps source inspection and complete two-angle source-cycle evidence are distinct from runtime play acceptance. Main A2 remains open: richer anatomy, fur, mane, facial performance and gameplay-scale presentation still need review against the cinematic target.

## Cycle6 canonical contact anatomy

The coordinated experiment under `assets/source/western/contact-v2/` brought the head/neck attachment .30 m back over the ribcage and reduced normal-strike lean from .23 to .10 radians. The first isolated v2 passed numerical bounds but failed visible attachment review: its neck rest rotation detached the Unicorn mane and moved the collar onto the cheek. That rejected source/export/QA snapshot remains intact. Versioned v2b restores and reweights those accessories without changing v2 body vertices, facial identity, scale or pose channels.

After source/motion checks and root's actual-renderer review of all nine species strike pairings at 1.75 m separation, wave `contact-integration-6` promoted the reviewed v2b files byte-for-byte to the canonical `*-upright.blend` and `*-upright.glb` paths. Head-forward maxima through normal contact remain .647/.769/.811 m and striking paw peaks 1.294/1.344/1.249 m for Lion/Wolf/Unicorn. Root observed separated heads and contact with lowered rival forelimbs. Region bounds alone are not a collision proof, and this narrow acceptance does not close cinematic A2.

Current canonical manifests, source/runtime inspections, integration identity and reconstruction receipt are in `assets/source/western/upright-v2/`. `build_upright.py` builds the reviewed recipe from preserved race inputs; its `reproduce` command independently reconstructs all three in temporary storage, requiring byte-identical GLBs and exact editable mesh/weight/UV/color/control-cage/rig/action semantic identity. Canonical sources remain the exact reviewed source copies; Blender binary serialization is not assumed deterministic. `review_upright.py inspect all` now reads canonical sources and writes current upright-v2 reports. Both production oracles remain required.

All six race files are unchanged. Cycle5 upright source/export bytes live in `contact-v2/control/`; its generator is preserved in `contact-v2/inputs/build_upright.py`. Cycle5 QA and all initial freeze manifests remain unchanged. `upright-v2/history-resolution.json` explicitly redirects only the six promoted upright paths and old generator for historical checks. This preserves historical verification without claiming current canonical upright assets still equal Cycle5. Pre-promotion scripts, ledger and instructions are also archived.

The canonical files exactly match the reviewed v2b source/runtime hashes, so the six compact Workbench movies and 26 complete motion pages remain valid; no redundant render was made. Their source/hash associations and the lower scarf-fold occlusion remain documented. Richer head/lid/brow anatomy, fur/mane/tail form and facial performance are still below the cinematic target. A2 and physical-device/owner acceptance remain open.

## Cycle7 isolated Lion art study — rejected

`assets/source/western/hero-art-v1/` preserves a custom two-form Lion head experiment, its editable sources, exported GLBs and matched three-view evidence. Recessed almond eye apertures and a continuous cheek/nasal surface improve the prior spherical features, but repeated mane constructions failed parent visual review: curtain/helmet forms, then a broad ruff with thick inflated locks over a smooth shell. This study is not approved or integrated. `RECONSTRUCTION-DIAGNOSIS.md` identifies the need for reconstructed skull/ruff volumes, irregular rooted masses and retopology rather than more curve strips.

The final isolated upright collar/clasp correction removes intrusion into the muzzle and places the costume on the chest. Canonical sources/exports and previous QA are unchanged. Fresh file hashes and budgets are in `final-study-manifest.json`; fresh full exported clip/bone/morph/bounds checks and a displaced-head negative pass after the final collar fit. A bounded source reinspection now also matches both final source hashes and confirms preserved body/action signatures plus connected skulls with two intended eye apertures. Earlier reports are archived separately. Full motion rendering remains withheld after static rejection; H1/H2/H4 are met and visual H3 remains failed/abandoned. A2 remains open.

## Cycle8 licensed Wolf assessment — reference only

`assets/source/western/licensed-wolf-review/` retains NewDLC’s CC0-listed Blender archive, exact extracted sources, primary-page/license record, measured inspection and bounded visual evidence. The actual source has 2,923 vertices / 5,358 triangles, one material, 36 deform bones and **no authored animation actions**. Four 1024px maps are supplied; their RGBA8 mip estimate is 21.33 MiB, not a device measurement. Canonical race/upright sources and GLBs remain unchanged.

Three matched rest views and a 37-frame, 2.4 s deliberate FK probe show useful continuous canine anatomy, but cartoon eyes/fur/tail miss the cinematic target and raised forelimbs expose stretched underarm forms. The interrupted Metal attempt is preserved; remaining views and the Workbench probe completed with bounded CPU use. `ASSESSMENT.md` records the explicit decision: **rework-only anatomical reference; reject direct production adoption**. Upright reconstruction, facial/fur work, material adaptation and all game animation/contact guarantees remain necessary. No retarget, runtime export or integration was performed. This completes source assessment only; cinematic A2 and physical-device acceptance stay open.

## Cycle9 licensed Mast head study — rework required

`assets/source/western/mast-head-study/` retains Djsedj's CC0-listed Mast source, primary Mast/Aedan pages and archive identity, original topology/control inspection, isolated editable race/upright Lion head fits and complete bounded facial probes. The original source has no authored animation actions. Its connected cheek/nasal/orbital topology and jaw/brow/lid controls provide a more useful anatomical foundation than the earlier primitive face. The imported curled curtain mane is rejected; the canonical ruff remains an explicitly provisional control. Canonical sources and GLBs are unchanged.

Selected skin-only subdivision produces **24,202 race / 28,664 upright triangles for the complete animal**, including retained body and ruff. These are source feasibility costs, not phone measurements or a runtime export. The facial rig remains separate; original body geometry/weights/morphs and game-action curves are independently hash-checked in the final sources. Actual upright head extent remains within 0.68 m during the sampled normal-contact interval (maximum 0.659671 m).

Two bounded corrections improve rounded ears/cheek planes, face scale, jaw/chest clearance and lid direction. Complete before/after 31-frame probes preserve the confirmed initial jaw/chest intersection and the corrected result. Final lids still do not seal; neck-junction diagnostics remain positive in some samples; inherited oral-detail topology needs cleanup. The soft expression and rocky canonical mane/body still miss the cinematic target. `ASSESSMENT.md` records **REWORK — no runtime promotion** and a viable next approach: reconstruct a continuous production head/neck attachment, complete feline facial/lid anatomy and deliberate control mapping, and rebuild the mane. No third repair is hidden in this leaf. A2 and owner/device acceptance remain open.

## Cycle10 native Mast body assessment — rejected production base

`assets/source/western/mast-body-study/` examines the original licensed full body rather than attaching its cut head to the existing body. One 3,463-vertex skin component connects the native head, neck, torso, hands and feet. A 37-frame native wrist/foot-IK probe verifies that the saved editable action reproduces the observed overhead reach, forward strike and 0.20 m crouch. The body geometry and weights remain exactly those of the original; canonical assets and the completed head study remain frozen.

Three uncropped views show human muscular torso proportions, five-finger hands and flat plantigrade feet. Overhead motion pulls broad chest/underarm sheets. Subdivision 1 costs 33,864 triangles for the main body alone, above the 32k working budget before replacing the rejected mane; subdivision 0 is 8,456 triangles. The source has 210 bones, 133 constraints and no supplied animation actions. The isolated gold palette exists, but Workbench still shows the source's mauve display after the sole correction; this failed display validation is retained explicitly.

`ASSESSMENT.md` records **REJECT_WHOLE_BODY_PRODUCTION_BASE**. The continuous neck is useful reference anatomy but does not offset the required animal torso/paw/hock reconstruction, runtime rig reduction, normalized skin export and all race/upright animation work. No quadruped, retarget, phone-performance or art acceptance is inferred. This research ends without another source correction or production export; A2 remains open.
