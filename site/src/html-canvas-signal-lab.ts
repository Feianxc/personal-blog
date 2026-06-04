import { mountSignalCanvasLayer } from './signal-canvas-layer'

const root = document.getElementById('signal-canvas-root')
const rendererReadout = document.querySelector<HTMLElement>('[data-canvas-renderer]')
const modeButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>('[data-canvas-mode]'),
)

if (root instanceof HTMLElement) {
  mountSignalCanvasLayer(root, {
    modeButtons,
    publicStateKey: '__signalCanvasLab',
    rendererReadout,
  }).catch((error: unknown) => {
    console.error('[signal-canvas-lab] failed to mount', error)
    root.dataset.canvasError = 'true'
    window.__signalCanvasLab = {
      mode: 'calm',
      renderer: '静态回退 / HTML',
      particles: 0,
      webgpuRequested: false,
      mounted: false,
      error: String(error),
    }
    if (rendererReadout) rendererReadout.textContent = '静态回退 / HTML'
  })
}
