# Revision2 production replacement
OWNS: assets/source/western/revision2/**, scripts/assets/rebuild_roster_v2.py
- [x] R1: Frozen f600be2 controls retained and reproducible six editable source/runtime replacements with authoritative attack and evade clips.
  CHECK: /Users/chikumatsuboi/Applications/Blender-4.5.9.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec --python-exit-code 1 -t 2 --python scripts/assets/rebuild_roster_v2.py -- reproduce > assets/source/western/revision2/gate-reproduction.log 2>&1 && node scripts/assets/verify-roster-v2.mjs --source-only
  EXPECT: REVISION2_EDITABLE_REPRODUCED
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/chikumatsuboi/Code/animal-racers-western; path=275c74a51827/25 entries; EXPECT=matched; output-sha256=d57900a6d6bf47814752b0ce3686e2431621b564a2a608f29f247bbf9fbad67f; output-bytes=30
- [x] R2: Matched full-body and gameplay-scale views show improved species anatomy, inset eyes and flowing tapered mane, with no primitive-assembly acceptance.
  EVIDENCE: Parent independently reviewed all six exact-hash material proofs listed in candidate-handoff.json, full Lion evade and Wolf/Unicorn strike sheets, and all nine ordered actual-renderer strike pairings at both 1.75m and 1.85m. Parent approved these exact six exports for canonical gameplay review on 2026-09-20; faces/anatomy materially improve f600be2 without gross head penetration. REVIEW.md records limitations; this does not pass the full cinematic/owner/phone gate.
- [x] R3: Complete required motion samples inspected, actual exported geometry and fixed limb/cup/gait contracts verified with a meaningful negative control.
  CHECK: node scripts/assets/verify-assets.mjs --candidate && node scripts/assets/verify-upright.mjs --candidate && node scripts/assets/verify-roster-v2.mjs
  EXPECT: REVISION2_REVIEW_EVIDENCE_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/chikumatsuboi/Code/animal-racers-western; path=275c74a51827/25 entries; EXPECT=matched; output-sha256=262bd40fcf275804e18bf8a3b344b369f5b51fcb359b6530425fc6c2b728389e; output-bytes=579
- [x] R4: Reviewed six sources and six runtime GLBs are integrated as the canonical roster with exact candidate hashes.
  CHECK: node scripts/assets/verify-assets.mjs && node scripts/assets/verify-upright.mjs && node scripts/assets/verify-roster-v2.mjs --canonical
  EXPECT: REVISION2_CANONICAL_ROSTER_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/chikumatsuboi/Code/animal-racers-western; path=275c74a51827/25 entries; EXPECT=matched; output-sha256=4517ab07ea868eedefd375180a37f570abe014109a5595be5e28b534f7ccbc22; output-bytes=500
