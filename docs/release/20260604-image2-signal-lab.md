# Public Release Evidence — 20260604 image2-signal-lab

## Summary

This release open-sources the public frontend source for FEIAN Signal Lab after the IMAGE2 redesign pass.

## Included public scope

- Vite multi-page website source under `site/`.
- IMAGE2 design reference library under `docs/design/`.
- Interactive Signals dashboard implementation.
- Featured Build topology mini-map.
- Machined visual control dock styles.
- QA stability improvement for local CDP-based full-site validation.

## Validation evidence from the private build workspace

Local validation command:

```bash
cd site
npm run validate
```

Result:

```text
Full site QA status: PASS
Routes: 15
Checks: 75
Warnings: 0
Failures: 0
```

Latest local QA report in the private workspace:

```text
.workspace/frontend-studio/runs/20260604-005346-full-site-qa/full-site-qa-report.md
```

Public validation result:

```text
Public site QA status: PASS
Routes: 15
Checks: 30
Warnings: 0
Failures: 0
```

Public marker scan confirmed:

- `class="signal-dashboard"`: present
- `持续运行的几条主轴`: present
- public-copy denylist hits: `0`

## Public site

- https://blog.feian.online/

## Notes

This public repo is a sanitized source export. It does not include local `.workspace/`, deployment packages, private progress logs, generated `dist/`, server paths, credentials, or long-running automation traces.
