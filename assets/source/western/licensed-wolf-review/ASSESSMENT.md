# NewDLC Wolf: complete assessment, reject direct adoption

Decision: **REWORK-ONLY anatomical reference; reject direct production adoption.** The source provides connected canine proportions, digitigrade hind limbs and shaped paws at a modest geometry cost. It does not resolve the cinematic Water Wolf face/fur target or the two-stance animation requirement. No source was saved, retargeted, exported to runtime or integrated. Main cinematic A2 remains open.

## Provenance and safe source access

[NewDLC’s primary page](https://opengameart.org/content/3d-wolf) lists CC0 and provides the Blender archive. `ORIGIN-LICENSE.md`, the retained primary HTML and `provenance.json` record the publisher declaration, download URL, original archive members and SHA-256 values. The five extracted files match their archive bytes. Blender 4.5.9 opened the copy with `--disable-autoexec` and `use_scripts=False`; no text blocks, drivers or linked libraries were found. All twelve canonical race/upright Blender and GLB files still match the initial freeze.

## Actual mesh, rig and cost

| Item | Observed result |
|---|---|
| Geometry | One mesh, 2,923 vertices / 5,358 triangles; no subdivision; one material slot |
| Topology | 49 disconnected components including details/eyes; largest 1,501 vertices; 388 boundary edges, no edges with more than two incident faces, no zero-area faces |
| Skin | Every vertex weighted; at most four influences; maximum weight-sum error 0.0000538 |
| Rig | 36 deform bones, articulated spine/neck/jaw/eyes/limbs/tail; no constraints or authored actions |
| Facial controls | Jaw/eye bones; no shape keys, eyelid or brow performance system |
| Maps | Four 1024×1024 color/normal/roughness/specular PNGs, 1,343,394 compressed bytes |
| Texture estimate | 21.33 MiB if all four become RGBA8 with full mip chains; actual GPU formats/memory unmeasured |

The imported source height is approximately 3.282 world units with mesh scale 0.0254; forward is −Y and up is Z. Deliberate size/axis normalization is necessary. The mesh count is below the game’s 32k-triangle / 24-material source limits, but there is no runtime GLB measurement, shader/draw-call measurement or physical-phone result. The source file is 1,468,540 bytes. Of the 2,923 vertices, 2,364 have one bone influence; the two 353-vertex eye components account for some of this. This is a reason to inspect deformation, not proof that the whole body is rigid.

## Actual view and deformation review

The three `qa/rest-*.png` images use the same lighting/material/camera recipe at 512 px. The front image completed with Metal; that run then stalled and was stopped with exit 143 to release the host for browser verification. Its logs and `render-interruption.json` remain. The remaining two views completed on two CPU threads. The original material has no node graph: the supplied maps were rebound in memory to Principled for review. The specular-to-IOR-level mapping is an interpretation, not a claim of exact legacy shader reproduction.

The side view shows a useful continuous muzzle, ribcage, belly and leg silhouette. Compared with `reference/character-target-concept.png`, the large white eyes, rounded nose, friendly expression, blocky cheek fur and thick straight tail read as a low-poly cartoon dog/wolf. Painted fur detail is useful, but recoloring it blue would not create the target’s recessed sharp eyes, layered neck ruff, tapered tail or expressive upright face.

`qa/deliberate-fk-probe.mp4` is a **new synthetic inspection**, not supplied animation. All 37 samples from 0–2.4 s appear in `qa/every-probe-frame.jpg`; five full-size checkpoints are retained. Three 0.8 s pulses use actual source bones for jaw/neck, fore/hind flex and a stronger shoulder/spine stress. All return toward rest. The 15 fps encoding lasts 2.467 s. Workbench uses the supplied color map, not the final PBR response.

| Probe | Peak frame | Max edge ratio | 99th-percentile ratio | Edges over 2× at peak |
|---|---:|---:|---:|---:|
| Jaw/neck | 6 | 3.404 | 1.151 | 7 |
| Fore/hind flex | 18 | 4.489 | 1.230 | 9 |
| Shoulder/spine stress | 30 | 8.346 | 1.278 | 20 |

Ratios compare evaluated mesh-edge lengths with rest. All coordinates remain finite. The complete sheet shows jaw motion without a gross detached mandible at this scale; modest leg articulation remains recognizable. The raised-shoulder sample produces a broad stretched underside/underarm wedge and thin folded joint silhouettes. Numerical outliers require local weight/topology review before adopting that range; small source edges can amplify ratios, so these values alone do not prove tearing. Feet were deliberately moved with FK and were not constrained to the ground: this probe does not validate a planted gait, a trophy pose, upright fit, gameplay contact or a finished motion cycle.

## What adoption would actually require

A production derivative would need reconstructed/reweighted shoulder and axilla loops for upright reach, a coordinated upright body, shaped orbital lids/brows and wolf muzzle planes, irregular rooted ruff/tail masses, a new Water Wolf palette/costume, and texture/shader cleanup. All game clips and their native movement/contact/cup guarantees would still need authoring, exported verification and integrated review. The existing triangulated source and simple deformation skeleton are useful references, but merely transferring this skin to the current rig would leave the damaging style and raised-arm problems intact.

This is therefore not the next direct runtime replacement. Retain it as a licensed anatomical reference; assess a richer connected head/ruff source in a separately bounded task. Three structural/provenance/evidence oracles plus this explicit manual assessment complete this research leaf, not character acceptance.

## Reproduce the bounded inspection

From the repository root, using the installed Blender 4.5.9 executable:

```sh
/Users/chikumatsuboi/Applications/Blender-4.5.9.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec --python scripts/assets/review_licensed_wolf.py -- inspect
/Users/chikumatsuboi/Applications/Blender-4.5.9.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec --python scripts/assets/review_licensed_wolf.py -- render
```

The current recipe uses two CPU threads for all stills; this avoids the preserved Metal failure. It does not modify the source. `inspection-recipe.py` archives the exact earlier inspection version bound to `inspection.json`; the current script hash is bound to the final pose report. Do not run during another browser performance/capture window. The completed assessment needs no further render.
