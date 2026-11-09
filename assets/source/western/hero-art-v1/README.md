# Rejected Lion hero-art study

**Status: FAIL. Do not integrate.** Parent rejected the mane construction after matched visual review. Canonical assets and previous QA remain frozen.

The recessed eye apertures and continuous nasal bridge are useful design findings, but the thick repeated mane locks and smooth underlying shell remain far below the cinematic target. See [the reconstruction diagnosis](RECONSTRUCTION-DIAGNOSIS.md).

| Form | Triangles | Material primitives | GLB bytes |
|---|---:|---:|---:|
| race | 26,394 | 10 | 1,753,592 |
| upright | 31,116 | 10 | 1,818,148 |

Editable `.blend` and isolated `.glb` files are in `candidate/`. `final-study-manifest.json` binds them and matched front/side/three-quarter images in `qa/{race,upright}/` to SHA-256 hashes. View `control-*` and `candidate-*` at matching camera names. The body view is supplementary and is not claimed as current final collar evidence.

The final upright collar is fitted below the jaw and follows the existing chest bone. The muzzle/cheek accessory intrusion is removed in the inspected front and three-quarter views. No body, rig, action, gait, contact or trophy channels were edited.

The current full numerical pass samples 41 times per exported clip and measures zero bone/morph differences, with upright head forward at .5183 m through normal active contact. A deliberately displaced head vertex is rejected at 2.4187 m. Both exported-GLB checks ran after the final collar fit and match the final manifest hashes. The bounded Blender source inspection now also passes after that collar fit: both source hashes match the final manifest, the skull is one connected component with two intended eye apertures, and body/action signatures match the frozen controls. Earlier source reports are retained under `pre-final-collar-source-inspection/`. Current budgets and canonical freeze hashes also pass.

Full motion rendering was not started: parent required static silhouette acceptance first and then stopped this generator after its repeated visual failures. The final still preview was terminated during host contention; its completed three matching views are retained, and no owned GPU job remains.

## Recipe and completed structural checks

From repository root, using the installed Blender 4.5.9 executable:

```sh
/Users/chikumatsuboi/Applications/Blender-4.5.9.app/Contents/MacOS/Blender --background --python scripts/assets/experiment_hero.py -- build all
/Users/chikumatsuboi/Applications/Blender-4.5.9.app/Contents/MacOS/Blender --background --python scripts/assets/experiment_hero.py -- inspect all
node assets/source/western/hero-art-v1/verify.mjs
node assets/source/western/hero-art-v1/verify.mjs --negative
```

The parent released the pause for one bounded source inspection only; it is complete. No build, render or motion work was restarted. `motion` and `package` commands are present but unexecuted for this failed study; their existence is not motion evidence. `GATES.md` records H1, H2 and H4 met and H3 failed/abandoned. Structural success does not approve the art.

Rejected first-pass, helmet and radial studies remain in versioned subfolders. The helmet archive explicitly notes that its images predate a small nose/ear correction; it is diagnostic history, not a hash-matched acceptance set. No previous production QA was relabeled.
