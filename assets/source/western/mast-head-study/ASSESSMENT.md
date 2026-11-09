# Mast head study — rework, no runtime promotion

The licensed authored face is a more useful anatomical foundation than the earlier separate spherical cheeks and eyes. Its connected nasal bridge, cheek planes, mouth and facial controls survive a bounded two-form fit. **The current derivative is not ready to integrate.** It still reads soft and bear-like beside the cinematic Lion target; the retained canonical ruff/body remain conspicuously geometric. The final jaw probe clears the visible chest intersection, but eyelids only narrow and attachment diagnostics still expose a junction risk. Two permitted visual corrections are exhausted. No third repair, production export, runtime promotion or art acceptance is implied.

This is completion of a research decision. Main visual gate A2 and actual-device/owner acceptance remain open.

## Source and safe inspection

[Mast by Djsedj](https://opengameart.org/content/mast-blender-425) and the same author's stated UV antecedent [Aedan](https://opengameart.org/content/aedan-blend) are both listed as CC0 on their primary pages. Exact HTML, archive and original source are retained in `inputs/`; publisher declarations and SHA-256 values are in `provenance.json`. The full original is untouched. Its SHA-256 is `e3c29d87557d29ca70b700b1861149bf6111711f065c5d5c2379427630441838`.

All loads used `--disable-autoexec` and `use_scripts=False`. Inspection found no authored actions, drivers or linked libraries. One embedded text, `$Mudançalenha`, was inventoried but never executed; its hash is in `inspection.json`. The derivative removes embedded text and source constraints. No paid asset, private upload or external service was used. Twelve canonical source/runtime asset hashes are frozen and checked independently.

The original main mesh has 4,379 vertices / 8,456 evaluated triangles at subdivision 0; the separate mane has 1,437 vertices / 5,748 triangles with its existing solidify modifier. Their combined subdivision-1 cost is 56,896 triangles. There are 210 bones, including authored jaw, cheek, brow and lid controls, and no supplied animation clips. A vertex-color/procedural material graph supplies the source appearance; there are no supplied texture images. The retained source-front and source-three-quarter renders show the actual Blender 4.5 appearance, not a claim about the author's intended shader result.

The imported mane was rejected immediately: hollow rolled tips and a long curtain silhouette do not match the target's broad irregular Lion ruff. It remains in the original/extracted library, never in the candidate. The retained canonical ruff is explicitly a provisional control. The candidate uses a deliberate gold/cream skin palette, dark nose/gums and amber/ivory eyes. Workbench vertex-color views establish form and region placement only; they do not validate final PBR materials.

## Editable derivative and whole-animal cost

The native neck is cut at source height 1.50 m and its 28-edge cut capped. The extracted head contains 2,059 vertices. Existing skin, eye and oral topology and facial weights are retained; unrelated body and mane controls are removed. The 1,143-vertex connected skin is separated from 916 eye/oral-detail vertices so only the skin receives subdivision 1. An isolated 40-bone facial hierarchy, including a study neck anchor, follows the current game head. It is not yet a production facial/game animation mapping.

| Complete candidate | Skin subdivision 0 | Selected skin subdivision 1 | Evaluated vertices | Editable mesh/material primitive upper bound |
|---|---:|---:|---:|---:|
| Race | 17,514 triangles | 24,202 triangles | 12,685 | 138 |
| Upright | 21,976 triangles | 28,664 triangles | 14,916 | 138 |

Counts include retained canonical body, ruff, limbs and costume. Subdividing every face detail originally cost 33,456 upright triangles, so it was not retained. The selected candidates fit the 32k working geometry budget. The 138 value is the unbatched editable scene's material-bearing mesh count, **not measured runtime draw calls**. The separate facial/game rigs total 62 bones for race and 65 for upright. No GLB export, draw-call/material batching, complete gameplay retarget or phone budget measurement was performed for this source-feasibility study.

The fresh `final-source-audit.json` reads the final saved sources and confirms exact retained body geometry, weights, morphs and original game-action signatures. This preserves those data, not proof that every gameplay clip drives the new face correctly. Final source hashes:

- `candidate/lion-race.blend`: `8023c83c71947bde46ffccab5c14814e47e85d8a5f956353be9a179ead744a96`
- `candidate/lion-upright.blend`: `eb537869eac0562c9c006dc5a9d4ed5dbdf431259f476475fa8e45450c8d6c55`

## Two corrections and actual visual review

`before-correction-1/` preserves the initial source, recipe, reports and all matched views. It showed a small face within a large rock-like ruff, pointed ears and a canine/bear muzzle. Correction 1 reshaped existing cheek/muzzle/ear/brow vertices, rounded and shortened the ears, enlarged the face modestly, and applied subdivision only to connected skin. This improved continuity and facial scale, while still falling below a convincing cinematic Lion.

The complete first probe then exposed a consequential failure: at upright frame 0008 the opening jaw intersected the chest and teeth appeared on the chest; the supposed blink widened the eye. `before-correction-2/` preserves those exact sources, recipe, views, both complete movies and all-frame sheets. Parent independently confirmed the failure.

Correction 2 moved the upright upper face 0.22 m up and 0.06 m forward, reshaped/reweighted existing lower-neck rows toward an independent neck anchor, and reversed the eyelid rotation direction. No topology was added. The final full-size upright frames 0008 and 0023 and both complete 31-frame sheets were inspected; the jaw remains visible above the chest and the lid narrows rather than widens. Parent independently confirmed this improvement. The bounded lid angle does not fully close the eye. Neck and jaw still require a production junction, and the expression remains too soft for the target.

`qa/matched-complete.jpg` contains all 16 matched 512px inputs: rows are race control, race candidate, upright control, upright candidate; columns are front, side, three-quarter and full body. It makes the retained mane/body cost visible rather than hiding it in a face crop. Both final and before movies cover every sample; five full-resolution probe checkpoints are retained after transient frame pruning.

## Motion and attachment evidence

The newly authored `Mast head probe` is saved in each editable source: 61 key samples over frames 1–61 at 30 fps. Review uses 31 rendered samples over 0–2 s at 15 fps, 384px, giving a 2.067 s encoded movie. It deliberately moves real jaw, head, brow and lid bones. This is a source deformation probe, not an imported animation, complete gameplay clip set or animation-quality acceptance.

| Diagnostic over complete probe | Race | Upright |
|---|---:|---:|
| Maximum edge-length ratio | 5.306 | 5.306 |
| Maximum 99th-percentile edge ratio | 1.636 | 1.630 |
| Maximum signed nearest body-surface cap distance | +0.0250 m | +0.0637 m |
| Same cap metric before correction 2 | +0.0789 m | +0.1633 m |

Positive cap distance is a local normal-based warning, not a watertight collision proof. Residual positive values mean the neck is not certified sealed through motion. Very short source edges amplify maximum edge ratios; numerical ratios alone neither prove nor dismiss visible deformation. Full movies, sheets and per-frame measurements are retained for inspection.

Final upright posed head-forward extent is at most **0.659671 m** over 41 normal-contact samples from 0.18–0.28 s, within the 0.68 m study constraint. The race form's unused combat pose reaches 0.877424 m; the upright contact constraint does not apply to that form. These are actual evaluated source head bounds, not paired-fighter collision or runtime hit-contact proof.

Fresh source inspection finds at most three skin influences with maximum weight-sum error below 3e-8. The connected skin has no edge incident to more than two faces, but retains 52 facial/oral boundary edges. Separate oral/eye details retain 200 boundary edges and 16 inherited edges incident to more than two faces. They require cleanup; this is not a closed/watertight face assertion.

## Decision and next viable approach

**REWORK; reject current runtime promotion.** Retain the licensed face as an editable anatomical reference/base. Compared with the primitive study it provides useful connected facial planes and real expression controls, but topology provenance does not make the current fit or style acceptable. The rocky canonical ruff and torso, soft muzzle/large nose, incomplete lid seal, residual neck junction risk and unadapted separate facial hierarchy remain material defects.

The next viable step is a separately scoped production head-and-neck reconstruction: merge/retopologize the attachment into a continuous skinned surface; clean oral topology; establish feline orbital, nose and cheek proportions and complete lid closure; map facial and game controls deliberately; reconstruct the mane as authored irregular rooted volumes with a coherent surface treatment. Further offsets or added strips cannot make a two-rig overlapping neck into that surface, nor turn the retained ruff into cinematic fur. No such next work is silently started here.

## Reproduction and verification

From the repository root, the study recipe is `scripts/assets/study_mast_head.py`. Use the installed Blender 4.5.9 with `--background --factory-startup --disable-autoexec --python-exit-code 1 -t 2 --python scripts/assets/study_mast_head.py -- MODE`. Modes `prepare`, `matched_views`, `motion` recreate extraction/fits, matched stills and the probe; `inspect` and `source_views` are independent original-source review. Run one owned process at a time, and coordinate render windows with browser measurement. These commands overwrite isolated study candidates/evidence, so preserve the reviewed snapshot before repeating them. Blender binary serialization is not assumed deterministic.

`package-evidence.py` encodes complete rendered sequences using one CPU thread. It requires all 31 original PNGs per form; rerender `motion` before packaging a new version after pruning. Final frame hashes, full movies, all-frame sheets and checkpoints 0000/0008/0015/0023/0030 retain the reviewed evidence. Initial failed source-render and extraction logs remain alongside successful retry logs; a Blender exit 0 by itself was not treated as evidence of a successful render.

Run the three declared Node checks in `GATES.md` for input/license/freeze identity, source inspection/extraction and final hash-bound evidence. The candidate check binds the fresh saved-source audit, selected geometry budget, normal-contact bounds and full movie coverage. It intentionally records residual deformation limits rather than falsely treating them as passed art requirements. M4 is the manual rework decision supported above. The four passes were source/extraction implementation, topology/cost and visual review, two bounded failure corrections, then fresh source audit and compact evidence packaging. There is no outstanding third correction within this leaf.
