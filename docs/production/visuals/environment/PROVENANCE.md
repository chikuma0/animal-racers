# Original timber texture

Generated 2026-09-16 with the built-in image-generation tool for this commission. No reference image, third-party texture, private project upload, or purchased asset was used. The retained PNG is the original generated output (1254×1254 RGB); its SHA-256 is `c7fe7a00afd779f1a9163853abb4aae30b054f9bb93ada52e33bedbd4f345e6f`. Lossless WebP encoding is the runtime derivative; the source pixels are unchanged. This record creates no new repository license. Runtime/source distribution follows the owner's existing rights and service terms; no separate stock-asset attribution is attached.

Source: `docs/production/visuals/environment/weathered-timber-source.png`
Runtime: `public/assets/environment/weathered-timber-v1.webp`
Consumer: `src/championship/renderer.ts`, shared base-color map with world-sized UVs. Lighting, shadows, roughness and scene geometry remain runtime authored. This texture is an asset study; integrated visual acceptance remains open.

Exact prompt:

```text
Use case: stylized-concept
Asset type: seamless square base-color game texture for a cinematic stylized spaghetti-western saloon, approximately 1024 by 1024 pixels.
Primary request: original weathered warm brown timber planking, four wide vertical boards across the tile, each continuing from top to bottom. Beautiful restrained stylized wood grain, occasional knots, hand-planed wear, small pale worn patches, darker narrow board joints, subtle aged nail heads. Rich tactile old-growth timber, premium animated-film material, not a photograph and not cartoon outlines.
Composition: perfectly flat orthographic material swatch filling every pixel, no perspective, no frame, no props. Seamlessly tileable on both axes, board joints aligned at the left/right boundary and grain continuing at the top/bottom boundary.
Lighting: uniform neutral diffuse albedo with no directional lighting, no cast shadows, no ambient vignette, no highlights baked in.
Palette: moderately desaturated honey walnut, tobacco brown, muted grey wear. Enough midtone detail for warm evening sunlight and a dim amber interior.
Constraints: only the wood surface, no text, no logo, no watermark. Avoid huge black cracks, strong contrast, red/orange saturation, repeating decorative patterns or a poster layout.
```

Reproduce the lossless encoding with:

```sh
node -e 'require("sharp")("docs/production/visuals/environment/weathered-timber-source.png").webp({lossless:true,effort:6}).toFile("public/assets/environment/weathered-timber-v1.webp")'
```

Runtime derivative SHA-256: `c2469c1b8c978606a77483efaf1307ce13a0a12114c48b2a50c7f551b8f1ffbd`; 1,965,682 bytes. Decoding both source and runtime with Sharp and comparing all RGB bytes produced exact equality. The installed FFmpeg lacks the libwebp encoder, so the retained command uses the project's installed Sharp dependency.
