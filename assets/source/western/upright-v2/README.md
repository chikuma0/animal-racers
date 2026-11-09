# Canonical upright contact integration — Cycle6

Wave `contact-integration-6` promotes the reviewed `contact-v2/v2b/candidate` files byte-for-byte to the three canonical upright Blender sources and three runtime GLBs. It adds no new geometry, weights, pose or animation changes. Root independently reviewed all nine actual-renderer normal-strike species pairings at 1.75 m body separation and .21 s: heads remain apart and paws/hooves reach the opponent's lowered forelimbs. Cinematic A2 remains open.

`integration-manifest.json` records exact canonical/reviewed paths and SHA-256 identities. Per-species manifests and current full source/runtime inspections live here. The existing reviewed source motion is valid because the sources/exports are identical: six compact movies, 26 full-frame pages and explicit source/hash associations remain under `contact-v2/v2b/qa`. No motion was rerendered for promotion.

## Build and inspect

Run from the repository root with Blender 4.5.9 and installed repository Node dependencies:

```sh
/Users/chikumatsuboi/Applications/Blender-4.5.9.app/Contents/MacOS/Blender --background --python scripts/assets/build_upright.py -- reproduce
/Users/chikumatsuboi/Applications/Blender-4.5.9.app/Contents/MacOS/Blender --background --python scripts/assets/review_upright.py -- inspect all
node scripts/assets/verify-assets.mjs
node scripts/assets/verify-upright.mjs
node scripts/assets/verify-upright-integration.mjs
```

`reproduce` performs a fresh construction from frozen race inputs in temporary storage. Every new GLB must be byte-identical to reviewed v2b. Editable sources must match the reviewed and canonical sources exactly in mesh positions/topology, weights, UVs, vertex colors, material slots, modifiers, retained edit cage, bone hierarchy/rest matrices and animation channels. Runtime byte identity additionally covers exported material/shader data. Temporary rebuilt artifacts are deleted only after comparison; `reproduction.json` records the result and current recipe hashes. This requires no GPU rendering and does not mutate production.

`build all` (or one species) invokes the same recipe and writes canonical outputs. It validates the fresh GLB/source semantics against the reviewed version, then normalizes the source file to the retained reviewed binary because Blender's binary serialization is not deterministic. That normalization occurs only after real reconstruction agrees; it is not a substitute for reconstruction. A new visual design must be reviewed/versioned separately before changing this approved recipe. `review_upright.py` now reads canonical sources and writes upright-v2 reports via the current authoring module. The original Cycle5 generator remains separately archived.

The current structural oracle still checks all 11 clips, 25-bone hierarchy, skin normalization, 41 skinned-bound samples per clip, fixed limb lengths, planted feet, native 3.6 m/s shuffle, jump tuck and the 2.50 m cup pivot with .35 s lift. The contact-specific identity/attachment source inspection is copied here with exact same source/runtime hashes; the canonical source inspector also re-read all 30 fps action frames after promotion.

## Historical integrity

`contact-v2/frozen-cycle5.json` is the unchanged original 110-file freeze receipt. `history-resolution.json` explicitly redirects only six promoted upright paths and the old build script to preserved Cycle5 bytes. All other entries still check their original current paths, including the six race files and Cycle5 QA. The integration oracle asserts this exact seven-entry alias map; it cannot silently redirect another changed file. Historical verification now says that controls/history are preserved, not that current canonical upright files still equal Cycle5.

Cycle5 sources/exports: `contact-v2/control/`; Cycle5 generator: `contact-v2/inputs/build_upright.py`; Cycle5 QA: `upright-v1/`. Rejected v2 remains protected by `diagnostic-v2-snapshot.json`. All 91 reviewed v2b artifacts remain unchanged. `inputs/pre-promotion/` and `pre-promotion-files.json` preserve the scripts, ledgers and instructions that existed before this authorized promotion, including original freeze claims. Historical recipe hashes resolve to those archives where the current command was intentionally updated. None of these records is relabeled as evidence for the new canonical version.

The partially occluded lower scarf fold, angular mane/tail, simple eye/lid/brow anatomy, limited facial performance and remaining stylized body forms are still below the cinematic concept. This wave verifies a narrow contact-anatomy integration; it does not certify physical-device performance or owner art acceptance. No paid assets, external uploads or publishing occurred.
