# Dedicated upright Unicorn experiment

The dedicated body and articulated rig visibly remove the frozen control's crumpled defeat torso and long shoulder sheet in the inspected three-quarter and side views. The experiment supports continuing this topology approach. It is not cinematic character acceptance, a runtime integration result, or a replacement for the racing asset.

`qa/*-comparison.png` and the two paired transition movies show **control on the left, experiment on the right**. Both use the same camera, lighting, source frame and render settings. The complete attack, guard, defeat and celebration transitions are sampled at 15 fps; the index records each included source frame and exact input/output hashes. Cycles stills inspect appearance; Workbench movies inspect deformation only. Numbered transient frames were removed after movie duration and coverage checks.

## What changed

The new body is one connected mesh with authored torso rings, shoulder openings, arm joint loops and a shared pelvic crotch seam branching into knee/ankle loops. It uses no voxel union or pose-space smoothing correction. The 887-vertex/857-face control cage remains in the editable Blender file as `Authored upright control loops`; the derived surface is subdivided once and normalized to the same four joint influences used by glTF.

A 25-bone parent hierarchy connects pelvis, spine, chest, neck, scapular controls and limb chains. Fixed-length two-link solves bend elbows and knees rather than resizing limbs or dragging the quadruped belly into the arms. The frozen source's face, eyes, horn, hoof geometry, palette, mane and tail preserve Unicorn identity for this controlled test. Those inherited features still have the prior simplified style.

## Evidence

- `source-inspection.json`: one closed connected body, zero boundary/non-manifold edges, explicit parent tree and unit bone scale over all five clips.
- `runtime-inspection.json`: independent Three.js evaluation of exported GLB, 41 skinned-bound samples per clip, normalized weights, fixed limb lengths and planted rear hoof pivots. Export: **19,916 triangles, 19 material primitives, 25 bones, 1,404,392 bytes**.
- Maximum evaluated limb-length error is below **0.000001 m**; maximum rear-paw pivot drift is **0.000081 m**. Cup pivot is **(0.37, 2.50, 0.43)** after the 0.35 s lift. All requested hand targets were reachable without limb scale.
- Negative control scales an arm in memory by three; the independent oracle fails as expected. It never changes the export.
- `geometry-comparison.json` records actual evaluated surface-edge and signed-volume diagnostics. At defeat, edges over twice their idle length fall from **4.60% to 1.44%**, and volume retained relative to each model's idle rises from **92.1% to 98.1%**. At the cup pose, those values improve from **3.18% to 1.69%** and **92.5% to 99.0%**. Different topology/proportions limit cross-model interpretation.
- Local outliers remain: experiment maximum edge ratios reach about **8.0× at defeat and 8.7× at celebration**, and the isolated strike maximum is worse than control. These ratios include short edges in compressed reference joints. They are disclosed diagnostics, not evidence that every joint is solved.
- `production-unchanged.json` confirms all six frozen production .blend/GLB files still match the prior snapshot.

## Remaining limits and next use

The most damaging body collapse is improved in both review angles and through the sampled transitions. Forelimbs and thighs still need species sculpt refinement; the inherited large eyes, blocky fetlocks, ribbon mane/tail, fixed facial performance and broad material treatment remain below the cinematic target. No phone performance claim or gameplay acceptance follows from this experiment. Only five experimental upright clips exist here; racing/scene-transition integration is outside this experiment.

The next authorized phase can extend the topology and hierarchy to species-specific upright assets and the complete combat/transition clip contract, keeping the original racing pipeline untouched. Runtime integration must be reviewed separately.

## Reproduce

Run with Blender 4.5.9 LTS, substituting its executable path:

```sh
blender --background --python scripts/assets/experiment_upright.py -- build
blender --background --python scripts/assets/experiment_upright.py -- inspect
node assets/source/western/experiments/upright-v1/verify-runtime.mjs
blender --background --python scripts/assets/experiment_upright.py -- compare
blender --background --python scripts/assets/experiment_upright.py -- render experiment
blender --background --python scripts/assets/experiment_upright.py -- render control
blender --background --python scripts/assets/experiment_upright.py -- package
```

Rendering is a separately coordinated GPU operation. `control-input.blend` is the frozen authored Unicorn input, with its exact SHA in `manifest.json`; build reads that copy and writes only inside this experiment directory. No paid or third-party assets/services were used.
