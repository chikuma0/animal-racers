# Cycle7 — storefront depth and road clearance

Internal alpha; this bounded improvement does not close cinematic world/character, physical-device or owner acceptance. Shared preview remains4ed5042. Baseline is the locally committed Cycle6 `cbcf856`; [candidate manifest](cycle-7-storefront-build-manifest.json) fingerprints source/runtime as `efdc45c08e95929f8e85f7f5a66e4a256f7d8bfc372e67207b2ae6a832e7e807`.

The actual menu/results screenshots exposed a flat box with surface window rectangles, thin posts and an untextured porch slab. `buildBuilding` now authors a hollow shell with recessed divided windows, framed doors, slatted shutters, stepped false front, pitched roof, boardwalk/steps, posts, knee braces and side rails. Four restrained timber tints distinguish storefronts. Shared timber materials reduce redundant batches. The scaled first-town distance now correctly selects the saloon façade. All geometry is original editable TypeScript; it reuses the existing documented timber texture and adds no downloaded runtime assets. Characters, simulation, scores, cameras and saloon interior are unchanged for this comparison.

## Actual runtime inspection

[Before/after menu canvases](cycle-7-storefront-before-after.jpg) use the same1280×720 viewport, DPR1 and Lion selection. Original PNGs: [before](animal-racers-select-1789561707229.png), [after](animal-racers-select-1789561956183.png). The in-app browser UI was inspected separately because saved canvases omit the HUD. Recessed windows, joined porch and door depth improve the background without covering the selected animal or controls. This is a presentation improvement, not the complete cinematic target.

The same menu view reports26draws/29,620triangles before and24draws/31,116 after:1,496 additional triangles and two fewer draw calls. These are actual Three renderer counts for that view. Concurrent Blender work and changing desktop load mean frame-time differences cannot be attributed to this change. Physical phone memory, loading, thermal and sustained60fps remain unverified.

A normal-control Lion/Wolf solo championship traversed the entire course and reached the cup. It used33 race jump/burst pairs and8 strike/element pairs through ordinary keyboard controls; input timing has gaps while inspecting, and is not a human skill/feel test. Final race times66.0603/59.6829s; fight13.8s with0/63HP; combined24.2/75.8. Wolf's raised cup remained clear of the actual score card.

- [Full replay](cycle-7-storefront-replay.mp4):102.233333s,1280×720,H.264/AAC,18,581,170bytes, SHA-256 `5fe75c083905ce9ab2f7ce399cd1f04b9d54cb13d19c69b248f2289d2691517e`. Full FFmpeg decode produced no errors. Its30fps delivery timeline does not measure runtime frame rate.
- [Eight course/handoff inspection samples](cycle-7-course-review.jpg) at roughly10s intervals show towns outside the readable hazard corridor. The root also inspected the live race, duel and results UI. Sparse samples do not establish animation-cycle acceptance.
- [Raw measurements](animal-racers-performance-1789562084651.json) and [result canvas](animal-racers-results-1789562085235.png). One M3 MacBook Air in-app client, recording on,1280×720,DPR1; Blender rendering could overlap. Racep50/p95/p99=10/20.25/30ms,max111.6ms; fight10/20/21.75ms,max50ms. No comparable performance improvement or physical60fps claim.

## Geometry and code evidence

[Geometry inspection](cycle-7-storefront-geometry.json) executes the actual authored `buildBuilding` and mesh helpers extracted through TypeScript AST, with a same-size sign plane in place of canvas text. All16 race placements were checked against the current500m track. Closest vertex clearance beyond the5.5m road half-width is.6550m; subtracting a conservative.0200m between-vertex curve bound leaves.6350m. The intentionally invalid6m placement control failed with a negative clearance. This is a scenery-bound check, not a collision/gameplay test. Placements/curve are explicitly fixed to the inspected source version and must be reviewed if they change.

Tests, lint and production build passed. G4 output SHA-256 `62516defa1e3bf3a27ea2b706f0efc3f5bdc184149e44a9aa1e3f79e6138fd78`. Geometry gate output SHA-256 `8d453ea2603dd6108e46b95e42266d478643ec3a766c6a9d04566faf9598e792`.

Remaining major art gaps include the toy-like animals, coarse canyon surfaces, sparse world staging and facial performance. The isolated Lion art study has not been integrated; its mane studies failed visual review and require a different surface construction or a suitable licensed starting mesh. Networking timing review and the physical playtest also remain active.
