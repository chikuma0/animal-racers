# Dedicated upright roster, integration candidate

This extends the reviewed Unicorn experiment to Fire Lion, Water Wolf and Rainbow Unicorn. It replaces the inappropriate stretched quadruped surface during upright scenes with a separate connected torso/limb topology and articulated hierarchy. It is not premium art acceptance. Original race `.blend` and `.glb` files remain byte-identical to the frozen control; `production-unchanged.json` records those hashes.

The source/export pairs are `assets/source/western/{lion,wolf,unicorn}-upright.blend` and `public/assets/western/{lion,wolf,unicorn}-upright.glb`. Per-species manifests identify exact input, source and runtime hashes. The renderer chooses these in upright scenes and retains the original race forms. The 1.2 second transform is a crouched arrival to standing after the saloon scene cut; it does not pretend that these separate surfaces geometrically morph into one another.

The connected body uses authored cross-section loops and shoulder branches, a shared crotch seam, joint transition loops and intentional skin weights. The editable coarse cage remains in each Blender file as the fake-user mesh `Authored upright control loops`, named by the rig property `control_topology_mesh`. The rendered derived surface is subdivided once and restricted to the same four normalized influences used at runtime. Lion has a broader/deeper ribcage and thicker forelimbs; Wolf is narrower and lighter; Unicorn retains the experimental proportions. Lion/Wolf palms and soles are continuous extensions of the body mesh, with original authored toes/claws retained. The head, species face, mane, horn, color family, hoof/toe detail and tail identity are preserved from the original authored sources.

The 25-bone hierarchy connects pelvis, spine, chest, neck, head and jaw; scapulae parent the front limbs, pelvis parents the rear limbs, and the tail is a four-segment chain. Fixed-length two-link solves are baked into the animation. There is no limb scaling, voxel union, corrective smoothing morph, or runtime IK dependency. Core glTF normalized 16-bit colors and skin weights keep the files under two million bytes; quantized skin weights sum exactly to 65535 and differ from source weights by less than 2/65535. Geometry, normals and textures are not reduced by this packing step.

## Runtime contract

Runtime coordinates are metres, +Y up and +Z forward. Local ground minima during idle/defeat are about +0.030 m for Lion/Wolf and +0.035 m for Unicorn. Rear ankle pivots sit at +0.18 m. Place the actor root at the platform top; a root at world zero inside a raised stage occludes the feet. The default upright facing remains +Z; the fight renderer rotates it to ±π/2.

| Clip | Nominal seconds | Intended coverage |
|---|---:|---|
| transform | 1.20 | Crouched arrival to stand; clamp during remaining 4 s scene transition |
| fight_idle | 2.00 | Breathing with rear paws planted |
| fight_move | 0.40 | Alternating shuffle; each 0.20 s stance travels 0.72 m backward, native 3.6 m/s |
| attack | 0.57 | Right contact pose approached by .18 s, held through .28 s, then recovery |
| special | Lion .94 / Wolf 1.14 / Unicorn .95 | Species fire strike, raised-head howl/jaw, braced horn/hoof pose |
| guard | .60 | Raise paws/hooves to protect head, then hold |
| hit | .40 | Recoil and return |
| defeat | 1.30 | Bent knees, lowered pelvis/head; tail curls to retain floor clearance |
| celebrate | 2.00 | .35 s smoothstep cup lift, then hold |
| jump | .80 | Local leg tuck and arm response; renderer supplies the world-height arc |
| land | .30 | Planted landing compression and return |

Animations are sampled at 30 fps. The actual GLB duration is .566667 for attack, .933333 for Lion/Unicorn special and 1.133333 for Wolf special; all other durations match the table. Runtime action timing remains authoritative. The .18 s contact pose is interpolated between frames at .166667 and .20; it is within a few centimetres of the held contact target. The runtime report includes actual measured contact positions. Native planted shuffle velocity measured from the exported animated rear paw is −3.595 m/s in local Z (the small difference from −3.6 comes from rotational interpolation). Reverse the clip for backward movement and scale by speed/3.6.

Trophy paw/hoof pivots finish at runtime `(±.37, 2.50, .43)`. Lift interpolation is smoothstep over .35 s, sampled at 30 fps; the fully raised sample is reached by .366667 s. The torso no longer stretches to achieve this height. Cup geometry and stage height remain renderer responsibilities.

The original long head/muzzle forms also impose a contact-spacing constraint. Actual exported skinned vertex measurements are retained in `contact-bounds.json` and reproducible with `node scripts/assets/measure_upright_contacts.mjs`:

| Species | Idle head/jaw forward extent | Head extent at normal contact (.20 s) | Striking paw/hoof forward tip at contact |
|---|---:|---:|---:|
| Lion | .862 m | 1.040 m | 1.294 m |
| Wolf | .970 m | 1.178 m | 1.344 m |
| Unicorn | 1.030 m | 1.196 m | 1.249 m |

These are region bounds selected by head/jaw or forepaw bone influence, not exact collision surfaces. They explain the muzzle overlap observed in root's close-combat capture: a .85 m minimum center separation and 1.25 m pursuit distance are smaller than the combined idle head projections (1.724–2.060 m). Merely increasing spacing can leave the current lower chest-directed strike short. Contact pose/anatomy and game spacing require a coordinated review; this extension does not claim that this gameplay presentation defect is solved.

## Reproduce and verify

From the repository root, with the installed Blender path:

```sh
/Users/chikumatsuboi/Applications/Blender-4.5.9.app/Contents/MacOS/Blender --background --python scripts/assets/build_upright.py -- build all
node scripts/assets/verify-assets.mjs
node scripts/assets/verify-upright.mjs
/Users/chikumatsuboi/Applications/Blender-4.5.9.app/Contents/MacOS/Blender --background --python scripts/assets/review_upright.py -- inspect all
```

The second oracle is deliberately separate so the original race oracle retains its existing contract. It checks all three independent GLBs, all 11 clips, 25-bone hierarchy, budgets, normalized weights, finite posed geometry, fixed limb lengths, planted feet where appropriate, native shuffle speed, local jump tuck and trophy timing/position. It samples actual skinned bounds 41 times per clip in Three.js; image decoding is stubbed, so it is geometry evidence rather than a texture/render test. `--negative-control` stretches a bone only in memory and must fail. Source inspection checks every 30 fps frame, connected/manifold topology, bone scales, edge stretch and signed volume diagnostics. These diagnostics do not prove the absence of self-intersection.

Coordinate a GPU window before the optional source review:

```sh
/Users/chikumatsuboi/Applications/Blender-4.5.9.app/Contents/MacOS/Blender --background --python scripts/assets/review_upright.py -- render all
/Users/chikumatsuboi/Applications/Blender-4.5.9.app/Contents/MacOS/Blender --background --python scripts/assets/review_upright.py -- package all
```

`qa/{species}/` retains representative Cycles material stills (idle and raised-cup poses), additional extreme-pose Workbench stills, and complete 15 fps Workbench cycles from three-quarter and side cameras. The index identifies each still's actual render engine; additional Lion Cycles views from the first pass are preserved. Each movie's index gives source frame coverage, timestamps and exact source/runtime hashes. Overview sheets contain one row per clip in manifest order and eight evenly spaced frames per row; numbered full-cycle pages preserve every sampled frame in reading order, with exact clip/frame mappings in the index. The review movies retain each clip's final endpoint frame, so their segment duration includes that extra frame hold and is not the runtime clip duration. Workbench shows deformation, not the final material response: its body material swatches do not reproduce the vertex-color shader. Stage shadows are disabled in the Workbench pass to avoid diagnostic shadow streaks. Packaging verifies coverage and encoded duration before removing only transient numbered frame folders.

## Review boundary

The completed matched before/after study lives separately in `../experiments/upright-v1/`; its control and experiment snapshots remain unchanged. That study supports the structural choice: bent-knee defeat and connected arm/shoulder contours are clearer than the prior crumpled torso and raised shoulder sheets. The extension still has simplified mascot anatomy, geometric mane/tail locks, fixed eye/brow expression, and local joint compression/stretch. Mass differences and a coherent shoulder surface are improvements, not evidence that the richer cinematic concept is reached. Source renders cannot replace normal-input gameplay, opponent contact/cup clearance review, physical-device performance or owner acceptance. Main visual gate A2 stays open.
