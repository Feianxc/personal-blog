export type FrameLoop = {
  start: () => void
  stop: () => void
  destroy: () => void
}

export function createFrameLoop(
  render: (time: number, delta: number) => void,
  options: { fps: number; disabled?: boolean },
): FrameLoop {
  let frame = 0
  let running = false
  let last = 0
  const interval = 1000 / Math.max(options.fps, 1)

  const tick = (time: number) => {
    if (!running) return
    frame = window.requestAnimationFrame(tick)

    if (document.hidden) {
      last = time
      return
    }

    if (time - last < interval) return
    const delta = Math.min(time - last || interval, 64)
    last = time
    render(time, delta)
  }

  return {
    start() {
      if (running || options.disabled) return
      running = true
      last = performance.now()
      frame = window.requestAnimationFrame(tick)
    },
    stop() {
      running = false
      if (frame) window.cancelAnimationFrame(frame)
    },
    destroy() {
      running = false
      if (frame) window.cancelAnimationFrame(frame)
    },
  }
}
