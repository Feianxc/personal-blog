import {
  Application,
  Container,
  Graphics,
  RendererType,
  Text,
  type RendererPreference,
} from 'pixi.js'
import { gsap } from 'gsap'

export type SignalCanvasMode = 'calm' | 'storm' | 'hyper'

export type SignalCanvasSnapshot = {
  mode: SignalCanvasMode
  renderer: string
  particles: number
  webgpuRequested: boolean
  mounted: boolean
  error?: string
}

export type SignalCanvasController = {
  setMode: (mode: SignalCanvasMode) => void
  destroy: () => void
  getSnapshot: () => SignalCanvasSnapshot
}

type SignalNode = {
  x: number
  y: number
  baseX: number
  baseY: number
  radius: number
  phase: number
  speed: number
  drift: number
}

type SignalLine = {
  from: number
  to: number
  phase: number
}

type MountSignalCanvasOptions = {
  badgeText?: string
  initialMode?: SignalCanvasMode
  modeButtons?: HTMLButtonElement[]
  publicStateKey?: '__signalCanvasLab' | '__hyperSignalCanvas'
  rendererReadout?: HTMLElement | null
  tryWebGpu?: boolean
}

declare global {
  interface Window {
    __signalCanvasLab?: SignalCanvasSnapshot
    __hyperSignalCanvas?: SignalCanvasSnapshot
  }
}

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

export async function mountSignalCanvasLayer(
  rootElement: HTMLElement,
  options: MountSignalCanvasOptions = {},
): Promise<SignalCanvasController> {
  const webgpuRequested = shouldTryWebGpu(options.tryWebGpu)
  const app = new Application()
  const preference: RendererPreference[] = webgpuRequested
    ? ['webgpu', 'webgl', 'canvas']
    : ['webgl', 'canvas']

  await app.init({
    resizeTo: rootElement,
    backgroundAlpha: 0,
    antialias: false,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 1.5),
    preference,
    powerPreference: 'low-power',
  })

  app.canvas.classList.add('html-canvas-signal-stage')
  rootElement.append(app.canvas)
  rootElement.classList.add('is-mounted')
  rootElement.dataset.canvasReady = 'true'

  const rendererLabel = getRendererLabel(app, webgpuRequested)
  rootElement.dataset.renderer = rendererLabel
  if (options.rendererReadout) options.rendererReadout.textContent = rendererLabel

  const membrane = new Graphics()
  const nodesLayer = new Container()
  const htmlBadge = new Text({
    text: stripInlineMarkup(options.badgeText ?? '视觉标签 / Canvas 气氛层'),
    style: {
      fontFamily: 'Arial, sans-serif',
      fontSize: 14,
      fill: '#d8e8f1',
      align: 'left',
      fontWeight: '600',
    },
  })

  htmlBadge.alpha = 0.82
  htmlBadge.position.set(22, 22)
  app.stage.addChild(membrane, nodesLayer, htmlBadge)

  let sceneLeft = 0
  let sceneTop = 0
  let sceneWidth = 1
  let sceneHeight = 1

  const updateSceneMetrics = () => {
    const rect = rootElement.getBoundingClientRect()
    sceneLeft = rect.left
    sceneTop = rect.top
    sceneWidth = Math.max(rect.width || rootElement.clientWidth || window.innerWidth, 320)
    sceneHeight = Math.max(rect.height || rootElement.clientHeight || window.innerHeight, 280)
  }

  updateSceneMetrics()

  const nodes = createNodes(sceneWidth, sceneHeight)
  const lines = createLines(nodes.length)
  const nodeViews = nodes.map((node, index) => {
    const view = new Graphics()
      .circle(0, 0, node.radius)
      .fill({ color: index % 3 === 0 ? 0xd7e6ef : 0x84cfbc, alpha: 0.34 })
      .circle(0, 0, Math.max(2, node.radius * 0.32))
      .fill({ color: 0xf3fbff, alpha: 0.82 })

    view.position.set(node.x, node.y)
    nodesLayer.addChild(view)
    return view
  })

  let mode: SignalCanvasMode = options.initialMode ?? 'calm'
  let pointerX = 0.5
  let pointerY = 0.42
  let disposed = false

  const state = {
    lineAlpha: 0.18,
    nodeAlpha: 0.68,
    badgeAlpha: 0.82,
    backgroundPulse: 0.48,
  }

  const getSnapshot = (): SignalCanvasSnapshot => ({
    mode,
    renderer: rendererLabel,
    particles: nodes.length,
    webgpuRequested,
    mounted: !disposed,
  })

  const syncPublicState = () => {
    const publicKey = options.publicStateKey
    if (!publicKey) return
    window[publicKey] = getSnapshot()
  }

  const setMode = (nextMode: SignalCanvasMode) => {
    if (disposed) return

    mode = nextMode
    const intensity = nextMode === 'hyper' ? 1 : nextMode === 'storm' ? 0.78 : 0.42

    options.modeButtons?.forEach((button) => {
      const active = button.dataset.canvasMode === nextMode
      button.classList.toggle('is-active', active)
      button.setAttribute('aria-pressed', String(active))
    })

    gsap.to(state, {
      lineAlpha: nextMode === 'hyper' ? 0.42 : nextMode === 'storm' ? 0.3 : 0.16,
      nodeAlpha: nextMode === 'hyper' ? 0.96 : nextMode === 'storm' ? 0.82 : 0.58,
      badgeAlpha: nextMode === 'hyper' ? 1 : 0.82,
      backgroundPulse: intensity,
      duration: reducedMotionQuery.matches ? 0.01 : 0.55,
      ease: 'power3.out',
    })

    gsap.to(rootElement, {
      '--canvas-pulse': intensity,
      duration: reducedMotionQuery.matches ? 0.01 : 0.55,
      ease: 'power3.out',
    })

    syncPublicState()
  }

  const resizeScene = () => {
    updateSceneMetrics()
    const freshNodes = createNodes(sceneWidth, sceneHeight)
    nodes.forEach((node, index) => {
      const next = freshNodes[index] ?? freshNodes[freshNodes.length - 1]
      if (!next) return
      node.baseX = next.baseX
      node.baseY = next.baseY
      node.radius = next.radius
      node.x = next.baseX
      node.y = next.baseY
    })
  }

  const renderFrame = () => {
    const width = sceneWidth || 1
    const height = sceneHeight || 1
    const now = performance.now() / 1000
    const motionFactor = reducedMotionQuery.matches ? 0.08 : mode === 'hyper' ? 1.65 : mode === 'storm' ? 1.05 : 0.46
    const pointerInfluence = reducedMotionQuery.matches ? 0 : mode === 'calm' ? 18 : mode === 'storm' ? 42 : 68
    const centerX = pointerX * width
    const centerY = pointerY * height

    membrane.clear()

    lines.forEach((line) => {
      const from = nodes[line.from]
      const to = nodes[line.to]
      const shimmer = 0.5 + Math.sin(now * (1.5 + motionFactor) + line.phase) * 0.5
      const alpha = state.lineAlpha * (0.64 + shimmer * 0.52)

      membrane
        .moveTo(from.x, from.y)
        .lineTo(to.x, to.y)
        .stroke({ width: mode === 'hyper' ? 1.2 : 0.78, color: 0x9bbcd1, alpha })
    })

    nodes.forEach((node, index) => {
      const dx = node.baseX - centerX
      const dy = node.baseY - centerY
      const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy))
      const pressure = Math.max(0, 1 - distance / Math.max(width, height) * 1.55)
      const orbit = Math.sin(now * node.speed * motionFactor + node.phase) * node.drift * motionFactor

      node.x = node.baseX + orbit + (dx / distance) * pressure * pointerInfluence
      node.y = node.baseY + Math.cos(now * node.speed * 0.82 * motionFactor + node.phase) * node.drift * 0.6 * motionFactor +
        (dy / distance) * pressure * pointerInfluence

      const view = nodeViews[index]
      view.position.set(node.x, node.y)
      view.alpha = state.nodeAlpha * (0.68 + pressure * 0.42)
      view.scale.set(1 + pressure * (mode === 'hyper' ? 0.88 : 0.38))
    })

    const glowRadius = Math.max(width, height) * (mode === 'hyper' ? 0.28 : 0.18)
    membrane
      .circle(centerX, centerY, glowRadius)
      .fill({ color: 0x84cfbc, alpha: state.backgroundPulse * 0.035 })

    htmlBadge.alpha = state.badgeAlpha
    htmlBadge.position.set(Math.max(18, width * 0.032), Math.max(18, height * 0.055))
  }

  const onPointerMove = (event: PointerEvent) => {
    pointerX = clamp((event.clientX - sceneLeft) / Math.max(sceneWidth, 1), 0, 1)
    pointerY = clamp((event.clientY - sceneTop) / Math.max(sceneHeight, 1), 0, 1)
  }

  const onVisibilityChange = () => {
    if (document.hidden) {
      app.ticker.stop()
      return
    }

    if (!reducedMotionQuery.matches) app.ticker.start()
  }

  const onReducedMotionChange = () => {
    if (reducedMotionQuery.matches) {
      app.ticker.stop()
      renderFrame()
      return
    }
    app.ticker.start()
  }

  const buttonCleanups = options.modeButtons?.map((button) => {
    button.setAttribute('aria-pressed', 'false')
    const onClick = () => {
      const nextMode = button.dataset.canvasMode
      if (nextMode === 'calm' || nextMode === 'storm' || nextMode === 'hyper') {
        setMode(nextMode)
      }
    }
    button.addEventListener('click', onClick)
    return () => button.removeEventListener('click', onClick)
  }) ?? []

  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('resize', resizeScene)
  document.addEventListener('visibilitychange', onVisibilityChange)
  reducedMotionQuery.addEventListener('change', onReducedMotionChange)

  const destroy = () => {
    if (disposed) return
    disposed = true
    buttonCleanups.forEach((cleanup) => cleanup())
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('resize', resizeScene)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    reducedMotionQuery.removeEventListener('change', onReducedMotionChange)
    app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true })
    rootElement.classList.remove('is-mounted')
    delete rootElement.dataset.canvasReady
    syncPublicState()
  }

  app.ticker.add(renderFrame)
  setMode(mode)
  renderFrame()

  if (reducedMotionQuery.matches) {
    app.ticker.stop()
  }

  syncPublicState()

  return {
    setMode,
    destroy,
    getSnapshot,
  }
}

function stripInlineMarkup(value: string) {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function createNodes(width: number, height: number): SignalNode[] {
  const safeWidth = Math.max(width, 320)
  const safeHeight = Math.max(height, 280)
  const coordinates: Array<[number, number]> = [
    [0.12, 0.26],
    [0.28, 0.18],
    [0.46, 0.31],
    [0.64, 0.18],
    [0.82, 0.28],
    [0.2, 0.62],
    [0.42, 0.74],
    [0.62, 0.61],
    [0.84, 0.74],
  ]

  return coordinates.map(([x, y], index) => ({
    x: x * safeWidth,
    y: y * safeHeight,
    baseX: x * safeWidth,
    baseY: y * safeHeight,
    radius: 5 + (index % 4) * 1.8,
    phase: index * 0.74,
    speed: 0.58 + (index % 5) * 0.11,
    drift: 10 + (index % 3) * 6,
  }))
}

function createLines(nodeCount: number): SignalLine[] {
  const pairs: Array<[number, number]> = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [0, 5],
    [2, 5],
    [2, 6],
    [3, 7],
    [4, 8],
    [5, 6],
    [6, 7],
    [7, 8],
    [1, 6],
    [3, 6],
  ]

  return pairs
    .filter(([from, to]) => from < nodeCount && to < nodeCount)
    .map(([from, to], index) => ({
      from,
      to,
      phase: index * 0.42,
    }))
}

function shouldTryWebGpu(tryWebGpu?: boolean) {
  const params = new URLSearchParams(window.location.search)
  return window.isSecureContext && (tryWebGpu || params.get('webgpu') === '1') && 'gpu' in navigator
}

function getRendererLabel(app: Application, webgpuRequested: boolean) {
  const renderer = app.renderer as typeof app.renderer & {
    gl?: unknown
    gpu?: unknown
    type?: RendererType
  }
  const ctor = renderer?.constructor?.name?.toLowerCase() || ''
  const canvas = app.canvas as HTMLCanvasElement
  let detected = 'pixi'

  if (renderer.type === RendererType.WEBGPU || renderer.gpu || ctor.includes('gpu')) {
    detected = 'webgpu'
  } else if (renderer.type === RendererType.WEBGL || renderer.gl || ctor.includes('gl')) {
    detected = 'webgl'
  } else if (renderer.type === RendererType.CANVAS || ctor.includes('canvas')) {
    detected = 'canvas'
  } else if (canvas.getContext('webgl2') || canvas.getContext('webgl')) {
    detected = 'webgl'
  } else if (canvas.getContext('2d')) {
    detected = 'canvas'
  }

  return `${detected}${webgpuRequested ? ' / requested webgpu' : ' / default'}`
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
