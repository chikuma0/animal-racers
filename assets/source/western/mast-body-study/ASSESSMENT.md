# Native Mast body — reject as the whole-body production base

**Decision: REJECT_WHOLE_BODY_PRODUCTION_BASE.** Retain this CC0 source as an anatomical and rig reference, and keep the separately assessed facial topology available for rework. The native continuous neck removes the cut-head junction, but the whole body is a muscular human form with a feline head, five-finger hands and plantigrade feet. Converting it into the commission's recognizably animal Lion in two coordinated stances would replace most of the anatomy and animation assumptions that make this source useful. Native articulation alone does not justify adopting it.

The assessment is complete; the artwork is not accepted. No canonical file, completed head study, game rule, runtime export or deployment changed. Cinematic A2 and owner/device acceptance remain open.

## Original source and actual continuity

[Mast by Djsedj](https://opengameart.org/content/mast-blender-425) and the same author's stated UV antecedent [Aedan](https://opengameart.org/content/aedan-blend) are listed as CC0 by their publisher. Exact primary HTML, archive and complete source are retained in `inputs/`. Original Mast SHA-256 is `e3c29d87557d29ca70b700b1861149bf6111711f065c5d5c2379427630441838`. `provenance.json` also freezes all 12 canonical source/runtime assets and every file of the completed head study.

All Blender loads disable automatic execution and use `use_scripts=False`. The original has no authored actions, drivers or external libraries. Its embedded text is inventoried by hash without execution, then removed from the isolated copy. Only the known local authoring recipe is executed. The original archive and source remain byte-identical.

The body has 4,379 cage vertices. A single **3,463-vertex skin component** contains all predominantly weighted vertices in the measured head, neck, chest, hip, left-hand and left-foot regions. This is an actual topological connection, unlike the separate rigs and overlapping neck cap in the head-fit study. Eye and oral details account for the other 916 vertices. The complete source body retains 252 boundary edges and 16 edges incident to more than two faces; it is not a watertight production mesh assertion.

The native rig contains 210 bones and 133 constraints: 98 mane bones, 30 finger bones, spine/head/face chains and wrist/foot IK controls. Left arm segments are 0.2759/0.2753 m with a 0.1367 m hand bone; leg segments are 0.3517/0.3798 m. The foot bone runs 0.2207 m along a low sole at about 0.0209 m height. These lengths, the long fingers and the heel/ankle placement support the visible humanoid classification; renaming bones would not create paws or animal hindlimbs.

Raw source deformation weights use at most four named bone influences, but are not normalized: maximum weight-sum deviation from one is 2.0. A production export must deliberately normalize and verify skinning, not assume the editable Blender result transfers unchanged.

## Cost and display decision

| Geometry measured with native modifiers | Subdivision 0 | Subdivision 1 |
|---|---:|---:|
| Complete main body, including eyes/oral details | 8,456 triangles | 33,864 triangles |
| Separate imported mane, with solidify | 5,748 triangles | 23,032 triangles |
| Combined original | 14,204 triangles | 56,896 triangles |

The imported curled curtain mane was already rejected for this visual target. It is retained as a separate hidden source object, not counted in the visible body's cost. The three uncropped full-body views and probe use subdivision 1 to expose the anatomical surface clearly: **33,864 visible triangles, already 1,864 over the 32k working budget before a replacement mane or costume**. Subdivision 0 is cheap but does not solve the wrong proportions. No runtime batching, phone timing or texture-memory claim follows from these source counts.

The isolated copy preserves all original body vertices, faces and skin weights exactly. It adds a neutral/gold vertex-color material for review, strips embedded text and adds cameras plus a deliberate probe action. Workbench still displayed the source's mauve color even after the single permitted display correction selected the new render color attribute. That correction and the initial views/source are preserved in `before-display-correction/`. The intended gold layer is present in the saved source and confirmed by the audit, but **gold display validation failed**. No further display/model correction was attempted, and the evidence is not presented as final shading. This limitation does not hide the plainly visible anatomical mismatch.

## Full views and complete native probe

Review all three `qa/body-{front,side,three-quarter}.png` files, not a flattering face crop. The small feline head sits on broad human trapezius/pectoral/deltoid forms; the front has a human abdominal layout, and the profile has a vertical human pelvis and low heel. The hands visibly have long individually articulated digits and an opposable thumb. The toes and flat foot do not read as Lion paws. A neutral color change cannot correct those forms.

`qa/native-probe.mp4` and `qa/every-frame.jpg` cover **all 37 samples**, 0–2.4 s at 15 fps, 384px; encoded duration is approximately 2.467 s. The probe uses actual native `Pulso.L.001` / `Pulso.R.001` wrist targets, `Root` and `Head`, retaining source shoulder tracking, limb IK and copy constraints. It is authored for this inspection, not supplied animation or a game retarget. Its three pulses are:

1. Both wrists rise overhead, then return, during 0–0.8 s.
2. The left wrist reaches forward with a small head turn, then returns, during 0.8–1.6 s.
3. Root lowers 0.20 m against fixed native foot targets, then returns, during 1.6–2.4 s.

Every rendered frame and full-size peaks 0006/0018/0030 were reviewed. The connected neck stays continuous and the native knees bend; there is no cut-junction separation. Overhead motion pulls the broad pectoral/underarm surfaces into long sheets. The strike remains an open human-hand reach; crouching remains a human squat. These are useful observations of the existing rig, not proof of good animal fighting animation.

Both foot pivots remain within 0.000051 m of their initial positions across the probe. This is a native IK measurement only: the visible sole begins slightly below source Z=0, and no game grounding, shuffle, gait, cup grip or contact guarantee is established. Maximum evaluated edge-length ratio is 9.4435 and maximum 99th-percentile ratio 1.7471. Small source edges can amplify this metric; it is retained with the full views rather than turned into an invented deformation pass.

The editable `native-body-study.blend` contains the newly authored 73-key-sample action over frames 1–73 at 30 fps. A fresh load replays five checkpoints and compares actual evaluated bounds with the rendered probe; all agree within 0.0001 m. Its body geometry/weight signature still equals the original. Exact source and audit hashes are bound by `evidence.json`.

## Construction and animation work still required

The continuous native skin is structurally better than the failed cut-head fit, but adopting this complete body would still require all of the following. These are construction costs, not a promise of a quick retarget:

- Rebuild shoulder blade/ribcage, torso-to-pelvis proportions and neck/head scale for a Lion; replace human hands with padded animal forepaws and reconstruct the heel/hock/toe chain. Existing fingers and flat feet cannot merely be scaled into that anatomy.
- Replace the mane entirely, clean oral/detail topology and normalize/export-test weights. Selected smooth body geometry must lose at least 1,864 triangles just to meet 32k with no mane. For example, reserving 6k for mane/costume would cap body at 26k and require a measured 7,864-triangle reduction from this display version; that is a planning allocation, not an implemented result.
- Rebuild/prune the 210-bone native hierarchy and 133 Blender constraints into a runtime deformation skeleton with explicit baked actions. Removing the 98 mane bones still leaves 112 bones; finger/facial/control reduction and retained expression needs must be evaluated together. No hierarchy reduction was attempted here.
- Design a genuine quadruped barrel/spine/scapula/pelvis and limb rest arrangement, then validate a corresponding coordinated upright form. These upright stills and human squat supply no quadruped feasibility evidence. A body conversion needs new topology/weights and animal locomotion tests, not rotation of this upright rig.
- Author or meaningfully retarget the game's 14 race and 11 dedicated-upright named clip contracts, including native-speed foot contact, strike timing, special actions, defeat and 2.50 m trophy grip. Mast supplies zero authored actions; this short probe satisfies none of those gameplay contracts.

The next viable direction is an animal-specific connected body design or a separately licensed true quadruped anatomical base, evaluated before committing to a two-form rig. The Mast face/neck topology can remain reference material. Do not continue stretching this humanoid source or repeatedly offsetting the previous cut-head fit. This leaf starts no such new construction.

## Verification and reproduction

The source oracle verifies original/archive/license identity, canonical and completed-study freezes, actual continuity/cost/IK records, and in-memory corrupt-source and broken-neck negative controls. The evidence oracle binds every retained file, saved body identity, all views, complete motion coverage and independently reloaded action checkpoints. Neither oracle labels art, palette, quadruped adaptation or phone performance accepted.

From repository root use Blender 4.5.9 with `--background --factory-startup --disable-autoexec --python-exit-code 1 -t 2 --python scripts/assets/study_mast_body.py -- MODE`. Modes are `inspect`, `build`, `views`, `display` (build + views), `probe`, and `audit`. `inspection-recipe.py` records the exact earlier inspection recipe. Never run embedded source text. Coordinate one owned CPU/Workbench process at a time with parent browser windows; no Metal is used. Re-running build/probe overwrites isolated study outputs, so preserve this reviewed snapshot first. Blender binary serialization is not assumed deterministic.

`package.py` encodes completed frames using one CPU thread. It requires the full 37-frame PNG sequence; full movie, every-frame sheet, frame hashes and seven peak/rest checkpoints remain after transient PNG pruning. All initial and successful command logs are retained. The implementation/review/defect/polish passes consist of safe source measurement and display, uncropped anatomical and native-control review, the single failed color-selection correction with saved-action audit, then this explicit rejection and compact evidence packaging. No outstanding third modeling pass or production work is hidden in a research completion claim.
