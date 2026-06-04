# IMAGE2 Cursor Asset — FEIAN Signal Probe

## Purpose

The site now uses a distinctive IMAGE2-generated cursor so the pointer remains visible and on-brand. The native CSS cursor is the reliability fallback, while the existing pointer FX layer renders the larger signal-probe sprite as an enhanced visual trail.

## Final prompt

Use case: stylized-concept  
Asset type: custom website cursor sprite, project-bound transparent PNG source  
Primary request: Create a very distinctive FEIAN personal-lab mouse cursor asset: a futuristic signal-probe cursor shaped like a sharp graphite-black arrow/needle with a small luminous cyan core, subtle amber reactor accent, machined sci-fi bevels, and a tiny orbital ring around the tip. It should feel like a premium cybernetic instrument, not a generic cursor.  
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for background removal.  
Subject: single cursor pointer/probe only, angled up-left like a standard mouse cursor, tip clearly at the top-left hotspot, centered with generous padding.  
Style: high-end website UI asset, crisp raster illustration, dark graphite metal, cyan glow, amber micro accent, Signal Reactor aesthetic, clean silhouette, readable at 32px and 64px.  
Constraints: background must be one uniform #00ff00 color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #00ff00 anywhere in the subject. No text, no watermark, no extra icons, no drop shadow outside the subject, no UI mockup, no hand, no mouse device. Keep edges crisp for chroma-key cutout.

## Source and outputs

- Built-in IMAGE2 source: archived into `docs/design/image2/cursor/feian-signal-probe-cursor-source-chromakey.png` and `site/public/cursors/feian-signal-probe-cursor-source-chromakey.png`.
- Project chroma source: `site/public/cursors/feian-signal-probe-cursor-source-chromakey.png`
- Project transparent master: `site/public/cursors/feian-signal-probe-cursor-alpha-full.png`
- Cropped master: `site/public/cursors/feian-signal-probe-cursor-alpha-crop.png`
- Native CSS cursor: `site/public/cursors/feian-signal-probe-cursor-48.png`
- Enhanced pointer FX sprite: `site/public/cursors/feian-signal-probe-cursor-96.png`
- Additional sizes: `32`, `64`, `128`
- Metrics: `docs/design/image2/cursor/feian-signal-probe-cursor.metrics.json`

## Implementation

- `site/index.html` adds `.pointer-probe` image inside the existing pointer shell.
- `site/src/index.css` replaces `cursor: none` with the IMAGE2 native cursor fallback and styles the larger pointer probe.
- `site/scripts/full-site-qa.mjs` now checks the native IMAGE2 cursor fallback and pointer probe element on the desktop homepage.

