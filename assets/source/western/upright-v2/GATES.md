# Canonical upright contact integration — wave contact-integration-6
OWNS: public/assets/western/*-upright.glb, assets/source/western/*-upright.blend, assets/source/western/upright-v2/**, scripts/assets/**, docs/production/ASSETS.md
- [x] I1: Both production asset oracles pass for the unchanged race roster and promoted reviewed upright roster.
  CHECK: node scripts/assets/verify-assets.mjs && node scripts/assets/verify-upright.mjs
  EXPECT: UPRIGHT_ROSTER_STRUCTURE_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/chikumatsuboi/Code/animal-racers-western; path=4be47b90834f/25 entries; EXPECT=matched; output-sha256=8534f4862c7ecb153445b1cd01574ddad340bd340e2c361f977533108f169de7; output-bytes=476
- [x] I3: The canonical authoring recipe independently rebuilds equivalent editable sources and byte-identical runtime exports without overwriting production or historical evidence.
  CHECK: /Users/chikumatsuboi/Applications/Blender-4.5.9.app/Contents/MacOS/Blender --background --python scripts/assets/build_upright.py -- reproduce
  EXPECT: UPRIGHT_CANONICAL_REPRODUCED
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/chikumatsuboi/Code/animal-racers-western; path=4be47b90834f/25 entries; EXPECT=matched; output-sha256=bc30ded410efd971898eb174ab43fa681c1adb1e109204b3b000f775a5481dba; output-bytes=3340
- [x] I2: Canonical six upright files exactly match reviewed v2b, all historical sources/exports/QA and six race files remain preserved, and current source/manifest/QA identities agree.
  CHECK: node scripts/assets/verify-upright-integration.mjs
  EXPECT: UPRIGHT_CANONICAL_INTEGRITY_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/chikumatsuboi/Code/animal-racers-western; path=4be47b90834f/25 entries; EXPECT=matched; output-sha256=5ef754ca64334880c8afc30d9791ea75980df1393bfd2ef6f94456995f55f99b; output-bytes=301
- [x] I4: Canonical source inspections, reproducible authoring/provenance instructions, integration hashes, and limitations are current; no already-identical motion is rerendered and cinematic A2 remains open.
  EVIDENCE: Canonical sources re-read across every 30 fps frame of all 11 actions; connected manifold/control cage/hierarchy and unit scales pass. Current README and ASSETS.md document canonical recipe, fresh reconstruction, reviewed binary normalization, explicit historical aliases, exact QA reuse and limits. Pre-promotion ledgers/scripts archived; initial freeze manifests and historical QA unchanged. Sources/exports are byte-identical to already-reviewed v2b, so no rerender was made. Cinematic A2 remains open; no renderer/simulation edits or publishing.
