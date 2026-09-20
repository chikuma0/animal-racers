# Isolated Lion hero-art experiment — wave hero-art-7
OWNS: assets/source/western/hero-art-v1/**, scripts/assets/experiment_hero.py

Status: returned failed art study. Parent stopped further generator tweaks and motion; canonical assets remain frozen. The parent released one bounded source inspection; it passed, and no build/render/motion work was restarted. Original required outcomes remain visible below.

- [x] H1: One custom authored Lion head design transfers consistently to race and dedicated upright sources while preserving original body, rig, animation and canonical/history hashes.
  CHECK: /Users/chikumatsuboi/Applications/Blender-4.5.9.app/Contents/MacOS/Blender --background --python scripts/assets/experiment_hero.py -- inspect all && node scripts/assets/verify-upright-integration.mjs
  EXPECT: UPRIGHT_CANONICAL_INTEGRITY_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/chikumatsuboi/Code/animal-racers-western; path=4be47b90834f/25 entries; EXPECT=matched; output-sha256=caeb5c7a708e21e717c14babb3422a45e23851c6e01ffb8e379c239f6000c5eb; output-bytes=910

- [x] H2: Actual exported upright head remains at or below .68 m forward throughout normal active contact; both forms retain clip, gait, limb and cup behavior inside current geometry/material/byte budgets.
  CHECK: node assets/source/western/hero-art-v1/verify.mjs && node assets/source/western/hero-art-v1/verify.mjs --negative
  EXPECT: HERO_NEGATIVE_REJECTED
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/chikumatsuboi/Code/animal-racers-western; path=4be47b90834f/25 entries; EXPECT=matched; output-sha256=162849bdc82c59381c097582a94b327b05a0f0cc1f1d1c34f7556a4fbc38c60e; output-bytes=399

- [ ] H3: Matched front/side/three-quarter views and complete affected head-motion cycles show a meaningful improvement toward the actual concept: recessed shaped eyes/lids, expressive brows, continuous feline muzzle/cheeks and flowing tapered mane, without new holes/detachment or lost Lion identity.
  EVIDENCE: FAIL by parent review of the current paired views: orbital/nasal form improves but mane remains thick repeated inflated locks over a smooth shell. Earlier curtain/helmet and flat radial studies are retained. Parent withheld full motion after static rejection and directed reassessment of the starting mesh. See RECONSTRUCTION-DIAGNOSIS.md. Cinematic A2 remains open.

- [x] H4: Editable isolated sources, exact recipe, paired before/after evidence, measured cost and honest remaining gaps are retained; no production integration occurs.
  CHECK: node assets/source/western/hero-art-v1/verify-evidence.mjs
  EXPECT: REJECTED_HERO_STUDY_INTEGRITY_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/chikumatsuboi/Code/animal-racers-western; path=4be47b90834f/25 entries; EXPECT=matched; output-sha256=e5c1281dec8df8a369438454f8180c0f463944c367fcb20a6278769bc85054fc; output-bytes=156

ABANDON: H3 Parent rejected the generated mane after repeated static studies and stopped this modeling approach before motion; actual skull/ruff reconstruction or a credible editable anatomical base requires a separate bounded experiment. This is a failed art outcome and required handoff, not scope reduction or acceptance.
