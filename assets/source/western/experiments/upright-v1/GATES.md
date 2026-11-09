# Upright Unicorn topology experiment
OWNS: assets/source/western/experiments/upright-v1/**, scripts/assets/experiment_upright.py
- [x] E1: Editable source and experimental GLB retain one connected upright body with intentional joint loops, a parented rig, and the existing Unicorn face/species identity.
  EVIDENCE: Actual Blender inspection: one body component, zero boundary/non-manifold edges, editable 887-vertex control cage retained, 25-bone parent tree. Matched high-resolution views confirm inherited Unicorn identity. manifest.json pairs frozen control and experimental source/runtime SHA-256.
- [x] E2: Independently evaluated defeat, strike, guard and cup clips have finite geometry, grounded hooves and fixed limb lengths; numerical limits are not art acceptance.
  CHECK: node assets/source/western/experiments/upright-v1/verify-runtime.mjs
  EXPECT: UPRIGHT_RUNTIME_CHECKS_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/chikumatsuboi/Code/animal-racers-western; path=4be47b90834f/25 entries; EXPECT=matched; output-sha256=88566f8efcf8a85cda4d95afc07f3fe5a322f603b0b6b77d50de71d5bf24bf41; output-bytes=90
- [x] E3: Matching gameplay-like front-three-quarter and side comparisons show whether the dedicated upright mesh removes crumpled torso and shoulder sheets through complete transitions.
  EVIDENCE: Both matched-angle Cycles stills and complete paired 15-fps transition sheets reviewed; defeat now bends hips/knees without the control torso collapse, and cup pose has separate connected arm volume instead of the long sheet. Root independently reviewed the critical views. Local edge distortion and the cinematic style gap remain explicitly open in README.md; this is experimental feasibility, not production acceptance.
- [x] E4: Findings, exact inputs/outputs, rejected attempts and remaining cinematic gaps are retained; production files are unchanged.
  EVIDENCE: README.md, manifest.json, source/runtime inspections, geometry-comparison.json, negative-control failure, paired movies/frame indexes retained. Transient numbered frames removed after coverage/duration checks. All six production source/runtime hashes match the frozen snapshot in production-unchanged.json. No runtime integration or current-asset mutation.
