# Frontend style scorecard

- Style reference: `Cursor` (`cursor`) as neutral developer/editorial visual grammar, combined with IMAGE2 Signal Lab art direction.
- DESIGN.md path: `docs/design/DESIGN.cursor.md`
- IMAGE2 reference: `docs/design/IMAGE2.signal-lab.md`
- Checked at: 2026-06-03

## Hard distinction

Token mapping passing is not the same as good design. This scorecard is marked PASS only after implementation, build, full-site QA, screenshots, and browser runtime checks.

| Area | Pass? | Evidence / notes |
|---|---:|---|
| Product/story context is clear: what is this UI, who is it for, what action matters | PASS | Homepage frames FEIAN as a personal digital lab and offers `查看构建物` / `阅读运行日志` as primary actions. |
| Visual focal point exists: hero, product panel, editorial image, or equivalent anchor | PASS | Hero pairs oversized Chinese title with the Signal Reactor visual panel and three axis nodes. |
| Information hierarchy is deliberate: title, lead, CTA, proof, secondary sections | PASS | Cover -> Signals -> Selected Builds -> Index structure matches the four IMAGE2 references. |
| Design tokens are implemented in CSS/theme, not only prose | PASS | `site/src/index.css` maps dark graphite, warm cream, orange accent, cyan trace, panel, type, nav, card, and responsive rules. |
| Colors and surfaces match the intended mood without becoming flat or muddy | PASS | Final desktop/mobile screenshots show dark signal-lab atmosphere with restrained orange/cyan contrast. |
| Typography works for Chinese and English, including line-height and wrapping | PASS | H1 uses explicit four-line spans and em-based width; mobile H1/lede/CTA remain visible before the fixed visual controls. |
| Components feel designed: buttons, cards, nav, panels, states, and spacing | PASS | Hero CTAs, horizontal mobile nav, signal axes, build cards, route cards, command HUD, and code dock states are styled. |
| Page has production polish: hover/focus states, rhythm, alignment, empty-space control | PASS | Runtime pointer/route effects remain enabled; register spine is hidden at normal desktop width to avoid title collision. |
| Responsive behavior works on desktop and mobile widths | PASS | `npm run validate` covers 15 routes × 5 viewports = 75 checks; final screenshots saved to `E:/codex_media/personal-blog/`. |
| Accessibility: contrast, focus, keyboard, semantic landmarks, touch targets | PASS | Browser snapshot exposes banner/nav/main/footer; command palette opens via keyboard; mobile controls stay visible and touch-sized. |
| Brand safety: no copied logos, product names, exact layouts, proprietary assets | PASS | Cursor reference is used only as visual grammar; public page keeps FEIAN identity and custom Signal Lab imagery. |
| Performance remains acceptable; decorative effects are bounded | PASS | Build succeeds; full-site QA warnings=0/failures=0; reduced-motion check passes; code console collapse hardened. |

## Verdict labels

- `FAIL`: script works but page is ugly, generic, or visually incoherent.
- `CANDIDATE`: style direction is visible but needs another design pass.
- `PASS`: browser-verified, coherent, usable, and brand-safe.

Final verdict: PASS
