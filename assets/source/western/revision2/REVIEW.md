# Revision2 character review

The parent approved these exact six files for canonical integrated gameplay review on 2026-09-20. This is relative visual improvement over immutable commit f600be2. It does not establish full cinematic quality, owner acceptance or iPhone performance.

## Four passes

1. **Implementation:** Retained the continuous body skins and fixed articulated rigs, revised species mass/coat regions, and replaced primitive head assemblies with editable orbital skull/muzzle surfaces, recessed almond eyes, shaped lids/brows, species ears and fitted accessories. Added committed species strike and planted-foot evade, preserving native race/shuffle and cup contracts.
2. **Domain review:** Initial matched views exposed a detached nose skirt/lower lip, stiff coat boundaries, insufficient chest ruff and upward-looking flat eyes. Surface-projected nose/nostrils and lip seams, smaller sclera, darker upper lids, smooth coat color transitions and connected chest/neck fur fields corrected these. Unicorn uses a continuous equine muzzle rather than the rejected separate feline jaw. Actual CPU material proofs verify matte fur instead of relying on Workbench color alone.
3. **Defect hunt:** Parent's actual renderer found a regular horizontal feather arrangement on Wolf and overly long thin Lion mane edges. Wolf now has a connected cheek field with short irregular tufts, blue roots and a shorter nape; Lion secondary locks were shortened and chest mass restored. Tail segmentation and collar/crest placement were corrected. Full motion found a 3.279mm Wolf evade foot drift; smoothing the authored crouch fixed it while retaining the original 3mm oracle. Authoritative startup durations were updated to .68/.55/.60s and extension was aligned to the active boundary.
4. **Polish and verification:** Reviewed current material images and complete motion sheets; packaged all 81 clips with 1,311 paired sampled frames and independent decoded-frame/hash checks. Fresh isolated reconstruction reproduced all six GLBs byte-for-byte and all source mesh/topology/weights/colors/UV/morph/rig/action semantics. Parent reviewed all six exact-hash materials and all nine ordered actual-renderer strike pairings at both1.75m and1.85m. Canonical promotion copies the reviewed bytes only; no additional visual edits occurred during integration.

## Evidence and scope

- `candidate-handoff.json`: exact six source/export hashes and uniquely named latest material proofs. The Wolf proofs show the final short irregular coat, not the rejected feather arrangement.
- `qa/{lion,wolf,unicorn}/{race,upright}/index.html`: matched body/face views, material proof and complete ordered motion movies. Every clip retains an every-frame comparison sheet; left is baseline, right is candidate.
- `*-source-inspection.json`: actual source deformation sampled every authored frame, continuous body topology and bounds. `race-runtime-inspection.json` and `runtime-inspection.json` evaluate real exported skinned geometry independently.
- `reproduction.json`: fresh recipe reconstruction; `baseline.json` and `inputs/` preserve all twelve f600be2 control files. Blender metadata serialization is not claimed byte-deterministic.
- `negative-controls.json`: missing required clip, distorted real arm bone, and altered expected hash must reject. No negative control modifies canonical bytes.
- `canonical-integration.json`: twelve current canonical hashes, equal to reviewed candidate files.

The head is an editable connected surface skinned over a continuous body neck, not a single welded animal. Crown/cheek/chest fur is shaped overlapping geometry, not strand simulation. Ears, muzzle and inset eyes read more clearly than the baseline; mane and coat still look simplified, facial performance remains limited and raised shoulders are stylized. These limitations prevent a full cinematic acceptance claim.

Actual production forms are quadruped race and dedicated upright menu/transition/fight/results. Legacy quadruped combat/transform clips remain for compatibility and bounds coverage; their older corrective torso crease is not accepted upright art. Baseline clips are time-normalized for matched geometry review, and baseline `hit` is explicitly used as the comparison for newly authored `evade`. Source/Workbench motion evidence is distinct from normal-input gameplay evidence owned by the parent.

All integrated geometry, textures and motions are original commission work derived from the original authored baseline. None of the researched external Mast/Wolf/Sketchfab geometry is used. The exact recipe and toolchain are documented in `docs/production/ASSETS.md`; historical studies and their source licenses remain unchanged.

After media hash and decoded-frame checks, transient rendered motion PNGs are pruned. All complete compressed movies, every-frame sheets, useful matched/material stills, earlier rejected proof stills, source files and diagnostics remain. Re-running `motion` then `package` regenerates the transient frames and delivery media.
