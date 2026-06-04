# FEIAN Signal Lab Personal Site

A public source snapshot for [blog.feian.online](https://blog.feian.online/): FEIAN's personal digital lab, built as a Vite multi-page frontend with a dark graphite visual system, IMAGE2-generated art direction references, a Signal Reactor hero, interactive Signals dashboard, build topology cards, and command/dock micro-interactions.

## What is included

- `site/` — Vite / TypeScript / CSS source for the public static website.
- `docs/design/` — design references, IMAGE2 art library, frontend scorecard, and implementation notes.
- `docs/release/20260604-image2-signal-lab.md` — sanitized release evidence for the public IMAGE2 Signal Lab build.

This public repo intentionally excludes the private long-running workspace journal, local automation traces, deployment credentials, generated `dist/`, and local QA work directories.

## Run locally

```bash
cd site
npm ci
npm run validate
npm run dev
```

Useful scripts:

```bash
npm run lint
npm run build
npm run verify:entry
npm run qa:full
npm run preview
```

## Design direction

The current visual system is documented in:

- `docs/design/DESIGN.cursor.md`
- `docs/design/IMAGE2.signal-lab.md`
- `docs/design/IMAGE2.art-library.md`
- `docs/design/frontend-scorecard.md`

Core visual ideas:

- graphite / near-black metal surface
- warm cream Chinese headline typography
- orange active action states
- cyan signal traces
- gold evidence / delivery highlights
- interactive dashboard panels instead of static decoration

## Public site

- Production URL: https://blog.feian.online/
- Current public release: `20260604-image2-signal-lab`

## License

MIT. See `LICENSE`.
