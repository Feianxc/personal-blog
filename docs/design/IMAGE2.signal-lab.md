# IMAGE2 / image-to-code visual reference — FEIAN Signal Lab

Checked at: 2026-06-03
Implementation target: `site/index.html`, `site/src/index.css`, `site/src/global-effects.css`, `site/src/main.tsx`, `site/src/rain-background.ts`, `site/src/visual-runtime/reactor/signal-reactor.ts`

## Reference images

- Section 01 Cover: `docs/design/image2/section-01-cover.png`
- Section 02 Signals: `docs/design/image2/section-02-signals.png`
- Section 03 Builds: `docs/design/image2/section-03-builds.png`
- Section 04 Index: `docs/design/image2/section-04-index.png`

## Extracted design system

- Visual world: dark graphite signal-lab, warm cream typography, restrained orange as primary action, cyan as secondary signal trace.
- Hero: oversized Chinese display title, short operational lede, two clear CTAs, and a right-side Signal Reactor object with three nodes: workflow / field / lab.
- Components: thin hairline panels, evidence-log cards, route rows, artifact/build cards, monospace metadata, and visible hover/command affordances.
- Motion language: signal membrane, pointer wake, route transitions, command palette, and bounded visual controls. Motion must degrade under reduced motion.
- Chinese readability: no all-caps-only affordance for critical controls; primary labels remain Chinese; mobile nav is horizontal and touch-sized.

## Implementation notes

- The homepage now uses a four-section structure matching the IMAGE2 set: Cover, Signals, Selected Builds, Index.
- The old hero heading grid/constellation rules are explicitly overridden so the Chinese H1 owns a stable 650px desktop box and does not collide with the Reactor panel.
- Mobile navigation is a horizontal scrollable capsule row, preventing the nav from consuming the first screen.
- The fixed visual control bar remains visible for QA/runtime affordance, but the hero CTA stack now appears before it on mobile.
- Code console collapse was hardened in `site/src/global-effects.css` so short code blocks also clip correctly when collapsed.

## Browser/local evidence

- `npm run validate`: PASS — 15 routes × 5 viewports = 75 checks; warnings=0; failures=0.
- Latest full QA report: `.workspace/frontend-studio/runs/20260603-141426-full-site-qa/full-site-qa-report.md`.
- QA screenshots: `E:/codex_media/personal-blog/homepage-desktop.png`, `E:/codex_media/personal-blog/homepage-mobile.png`.
- Browser preview screenshot: `E:/codex_media/personal-blog/browser-preview-desktop.png`.
- Browser runtime evidence: title `FEIAN 的个人数字实验室`; Signal Reactor `data-reactor-ready=active`, `data-reactor-quality=ultra`; H1 box 650px wide; CTA visible in first screen; no console messages; horizontal overflow <= 0.

## Public-copy boundary

The visible homepage copy avoids internal model/reasoning wording and keeps the site framed as FEIAN's personal digital lab, not as an AI/model-generated artifact.
