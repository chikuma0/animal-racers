# Tail attachment repair — isolated from canonical Revision2
OWNS: assets/source/western/revision2/tail-repair/**, scripts/assets/repair_tails.py, scripts/assets/verify-tail-repair.mjs

- [x] T1: All canonical source/runtime and src files remain byte-frozen; actual six-form source diagnosis identifies the disconnected or absent tail root and its deformation cause.
  CHECK: node scripts/assets/verify-tail-repair.mjs --freeze
  EXPECT: TAIL_INPUTS_FROZEN
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/chikumatsuboi/Code/animal-racers-western; path=275c74a51827/25 entries; EXPECT=matched; output-sha256=ac7b9bd828ffe2f66279d1c2ed640479f449b08ec2c04c147f318d529e10be1f; output-bytes=19
- [x] T2: Six candidates have coherent continuous full tail volume welded to the rump throughout all retained clips; only rump patch topology, tail meshes, tail_0..tail_3 translation channels, tail rotations in the four malformed upright attack/evade/fight_idle/fight_move clips, and upright evade may change. Original remaining body/head/limb vertices and non-tail channels remain exact, with exact editable reproduction and budget checks.
  CHECK: /Users/chikumatsuboi/Applications/Blender-4.5.9.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec --python-exit-code 1 -t 2 --python scripts/assets/repair_tails.py -- reproduce > assets/source/western/revision2/tail-repair/reproduce.log 2>&1 && /Users/chikumatsuboi/Applications/Blender-4.5.9.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec --python-exit-code 1 -t 2 --python scripts/assets/repair_tails.py -- verify > assets/source/western/revision2/tail-repair/verify.log 2>&1 && node scripts/assets/verify-tail-repair.mjs
  EXPECT: TAIL_REPAIR_GEOMETRY_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/chikumatsuboi/Code/animal-racers-western; path=275c74a51827/25 entries; EXPECT=matched; output-sha256=8aa2bca9b8ea27015b2f434e1c2dba2becc315b619609d5ded4cbf9a0cb5b6ce; output-bytes=24
- [x] T3: Side-on whole-body and cropped tail-root views plus complete affected cycles show attached and coherent Lion/Wolf/Unicorn tails in both forms; actual-renderer review includes hit, normal/counter strike and evade without camera concealment.
  EVIDENCE: Parent independently inspected all 18 actual-renderer poses and all 9 complete strike/counter/evade sheets plus side/root/full-source cycles; attached roots and hop lift/landing pass this bounded repair. Review: docs/production/evidence/revision2-tail-runtime/2026-09-20T03-50-31-404Z/parent-review.json; sha256=22575b77621763e8c2c8ab3b4015c62fb2fda4b86839e094f926e6477d556bb5. Ordinary-control integration, cinematic and owner acceptance remain open.
- [x] T4: Missing-root/distorted-attachment negative control fails the same meaningful attachment oracle; all evidence hashes and decoded motion coverage are current.
  CHECK: node scripts/assets/verify-tail-repair.mjs --evidence --negative-control
  EXPECT: TAIL_REPAIR_EVIDENCE_AND_NEGATIVE_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/chikumatsuboi/Code/animal-racers-western; path=275c74a51827/25 entries; EXPECT=matched; output-sha256=800d3092b2ea17237432409da3e242a98bc47762f24d3b44f3b2d55b1862c630; output-bytes=37
