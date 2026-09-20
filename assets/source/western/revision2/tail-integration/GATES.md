# Approved tail repair — canonical integration
OWNS: assets/source/**, public/assets/western/**, scripts/assets/**, docs/production/ASSETS.md

- [x] I1: All twelve canonical files exactly match the approved tail candidates and explicit provenance chain; original integration receipt, repair recipe, prior candidates and evidence remain unchanged, with no src or unrelated public mutation.
  CHECK: node scripts/assets/tail-integration.mjs verify
  EXPECT: TAIL_CANONICAL_PROVENANCE_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/chikumatsuboi/Code/animal-racers-western; path=275c74a51827/25 entries; EXPECT=matched; output-sha256=d20bdd1df5e66a15d374bf096f688d0f8b508313022a11bbb31e5c8b6ba31425; output-bytes=29
- [x] I2: Actual canonical race and upright geometry passes existing contracts, including a lifting and landed evade instead of stationary paws; the roster verifier recognizes the explicit repair chain.
  CHECK: node scripts/assets/verify-assets.mjs && node scripts/assets/verify-upright.mjs && node scripts/assets/verify-roster-v2.mjs --canonical
  EXPECT: REVISION2_CANONICAL_ROSTER_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/chikumatsuboi/Code/animal-racers-western; path=275c74a51827/25 entries; EXPECT=matched; output-sha256=8086b4a16895d5331e8f2080f0a7e89ce08ad900aeb380c221edaf723bb42a6e; output-bytes=500
- [x] I3: A fresh isolated historical-root reconstruction reproduces all six approved runtime bytes and editable source semantics using the unchanged recipe, then passes original source/geometry/evidence and specific distorted-tail negative checks without weakening historical freeze gates.
  CHECK: node scripts/assets/tail-integration.mjs reproduce
  EXPECT: TAIL_CANONICAL_REPRODUCED
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/chikumatsuboi/Code/animal-racers-western; path=275c74a51827/25 entries; EXPECT=matched; output-sha256=a3dbf5ad70567967a7ae396a3a27910d1dd3a70d8e39a5b329924e8213161935; output-bytes=135
