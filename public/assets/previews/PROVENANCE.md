# Lion loading preview

`lion-menu.webp` is a 1280×720 WebP exported on 2026-10-20 from this game's existing `ChampionshipRenderer` menu with the original `lion-upright.glb`. It contains the existing 3D model and environment, with no UI or generated replacement art. The source renderer called `render(null, 0, 0, 0, 0, true)` and exported its canvas as WebP quality .85. No model or material was changed.

It is shown only while the original 3D preparation completes, then removed. Character selection is disabled during that preparation, so the static Lion never stands in for a different selected character. Runtime preparation performs no extra preview render or canvas image readback.
