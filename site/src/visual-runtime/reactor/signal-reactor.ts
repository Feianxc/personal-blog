import { createFrameLoop } from '../core/frame-budget'
import { publishVisualQuality, resolveVisualRuntimeProfile } from '../core/quality'
import { readMotionPreferences } from '../core/motion-preferences'

type ReactorParticle = {
  angle: number
  radius: number
  speed: number
  size: number
  lane: number
  flicker: number
}

type ReactorOptions = {
  reducedMotion: boolean
}

type ReactorMode = 'work' | 'field' | 'life'

type PointerState = {
  x: number
  y: number
  energy: number
}

type ReactorRenderState = {
  width: number
  height: number
  time: number
  delta: number
  pointer: PointerState
  activeLane: number
  scrollEnergy: number
  glow: number
  shaderLike: boolean
  mode: number
}

type ReactorRenderer = {
  engine: 'webgl' | 'canvas'
  canvas: HTMLCanvasElement
  resize: (width: number, height: number, dpr: number) => void
  render: (state: ReactorRenderState) => void
  destroy: () => void
}

const modes: Array<{
  key: ReactorMode
  title: string
  copy: string
}> = [
  {
    key: 'work',
    title: '让日常工作更智能，也更直观',
    copy: '橙色这条线代表我最近在做的系统：重复步骤交给工具，关键信息直接看得见。',
  },
  {
    key: 'field',
    title: '先把现场状态看清楚，再动手处理',
    copy: '青色这条线代表工程现场：通信状态、排查顺序和前后变化，都尽量留得清楚。',
  },
  {
    key: 'life',
    title: '工作之外，也给兴趣留一块认真做东西的地方',
    copy: '金色这条线代表生活兴趣：喜欢的网站、研究和小工具，做完以后也想继续留着。',
  },
]

export function setupSignalReactor(options: ReactorOptions) {
  const root = document.querySelector<HTMLElement>('[data-signal-reactor]')
  const initialCanvas = root?.querySelector<HTMLCanvasElement>('.signal-reactor-canvas')
  if (!root || !initialCanvas) return null

  const preferences = readMotionPreferences()
  const profile = resolveVisualRuntimeProfile({
    ...preferences,
    reducedMotion: options.reducedMotion || preferences.reducedMotion,
  })
  publishVisualQuality(profile)

  const isStatic = profile.quality === 'calm'
  root.dataset.reactorQuality = profile.quality
  root.dataset.reactorReady = isStatic ? 'static' : 'booting'
  root.dataset.reactorLoop = isStatic ? 'static' : 'paused'

  const modeButtons = Array.from(
    root.closest('.reactor-stage')?.querySelectorAll<HTMLButtonElement>('button[data-reactor-mode]') ?? [],
  )
  const title = root.closest('.reactor-stage')?.querySelector<HTMLElement>('[data-reactor-title]')
  const copy = root.closest('.reactor-stage')?.querySelector<HTMLElement>('[data-reactor-copy]')
  const interactionSurface = (root.closest('.cover') as HTMLElement | null) ?? root
  const feedItems = Array.from(document.querySelectorAll<HTMLElement>('.feed-item'))
  const pointer: PointerState = { x: 0.5, y: 0.5, energy: 0.24 }
  const pointerTarget: PointerState = { x: 0.5, y: 0.5, energy: 0.24 }
  const particles = buildParticles(profile.particleCount)
  const modeListeners = new Map<HTMLButtonElement, () => void>()
  const feedListeners = new Map<HTMLElement, { enter: () => void; leave: () => void }>()

  let canvas = initialCanvas
  let renderer = createWebGLRenderer(canvas)

  if (!renderer) {
    const replacement = initialCanvas.cloneNode(true) as HTMLCanvasElement
    initialCanvas.replaceWith(replacement)
    canvas = replacement
    renderer = createCanvasRenderer(canvas, particles)
  }

  if (!renderer) {
    root.dataset.reactorReady = 'static'
    root.dataset.reactorEngine = 'canvas'
    return null
  }

  const activeRenderer = renderer
  const staticFallback = root.querySelector<HTMLElement>('.signal-reactor-shell')
  activeRenderer.canvas.setAttribute('aria-hidden', 'true')
  staticFallback?.setAttribute('aria-hidden', 'true')
  root.dataset.reactorEngine = activeRenderer.engine

  let width = 0
  let height = 0
  let dpr = 1
  let activeLane = -1
  let selectedMode = 0
  let targetMode = 0
  let scrollEnergy = 0
  let burstTimer = 0

  const resize = () => {
    const rect = root.getBoundingClientRect()
    const nextDpr = Math.min(window.devicePixelRatio || 1, profile.quality === 'ultra' ? 1.25 : 1)
    const nextWidth = Math.max(1, Math.round(root.offsetWidth || rect.width))
    const nextHeight = Math.max(1, Math.round(root.offsetHeight || rect.height))
    if (nextWidth === width && nextHeight === height && nextDpr === dpr) return

    dpr = nextDpr
    width = nextWidth
    height = nextHeight
    activeRenderer.resize(width, height, dpr)
    if (isStatic) renderStaticFrame()
  }
  const resizeObserver = new ResizeObserver(resize)

  function renderStaticFrame() {
    if (width < 1 || height < 1) return
    selectedMode = targetMode
    pointer.x = pointerTarget.x
    pointer.y = pointerTarget.y
    pointer.energy = pointerTarget.energy
    activeRenderer.render({
      width,
      height,
      time: 0,
      delta: 0,
      pointer,
      activeLane,
      scrollEnergy,
      glow: profile.glow,
      shaderLike: profile.shaderLike,
      mode: selectedMode,
    })
    root!.dataset.reactorReady = 'static'
    root!.dataset.reactorFrame = 'static'
  }

  const setPointer = (clientX: number, clientY: number, energy = 0.68) => {
    const rect = root.getBoundingClientRect()
    pointerTarget.x = clamp((clientX - rect.left) / Math.max(rect.width, 1), 0, 1)
    pointerTarget.y = clamp((clientY - rect.top) / Math.max(rect.height, 1), 0, 1)
    pointerTarget.energy = Math.max(pointerTarget.energy, energy)

    if (isStatic) {
      pointer.x = pointerTarget.x
      pointer.y = pointerTarget.y
      pointer.energy = pointerTarget.energy
      root.style.setProperty('--reactor-x', `${(pointer.x * 100).toFixed(2)}%`)
      root.style.setProperty('--reactor-y', `${(pointer.y * 100).toFixed(2)}%`)
      root.style.setProperty('--reactor-energy', pointer.energy.toFixed(3))
      renderStaticFrame()
    }
  }

  const applyMode = (index: number, announce = true) => {
    const nextIndex = clamp(Math.round(index), 0, modes.length - 1)
    const mode = modes[nextIndex]
    targetMode = nextIndex
    activeLane = nextIndex
    root.dataset.reactorMode = mode.key
    root.dataset.reactorLane = String(nextIndex + 1)
    if (!isStatic) {
      root.classList.add('is-reactor-burst')
      pointerTarget.energy = Math.max(pointerTarget.energy, 1.16)

      window.clearTimeout(burstTimer)
      burstTimer = window.setTimeout(() => root.classList.remove('is-reactor-burst'), 920)
    }

    modeButtons.forEach((button, buttonIndex) => {
      const isActive = buttonIndex === nextIndex
      button.classList.toggle('is-active', isActive)
      button.setAttribute('aria-pressed', String(isActive))
    })

    if (title) title.textContent = mode.title
    if (copy) copy.textContent = mode.copy

    if (announce) {
      window.dispatchEvent(
        new CustomEvent('feian:reactor-mode', {
          detail: { mode: mode.key, index: nextIndex },
        }),
      )
    }

    if (isStatic) renderStaticFrame()
  }

  const onPointerMove = (event: PointerEvent) => setPointer(event.clientX, event.clientY)
  const onPointerLeave = () => {
    pointerTarget.x = 0.5
    pointerTarget.y = 0.48
    pointerTarget.energy = 0.26
    activeLane = targetMode
  }
  const onScroll = () => {
    const coverRect = interactionSurface.getBoundingClientRect()
    scrollEnergy = clamp(-coverRect.top / Math.max(coverRect.height, 1), 0, 1)
    root.style.setProperty('--reactor-scroll', scrollEnergy.toFixed(3))
  }
  const onBurst = () => {
    pointerTarget.energy = Math.max(pointerTarget.energy, 1.22)
    root.classList.add('is-reactor-burst')
    window.clearTimeout(burstTimer)
    burstTimer = window.setTimeout(() => root.classList.remove('is-reactor-burst'), 920)
  }

  modeButtons.forEach((button, index) => {
    const listener = () => applyMode(index)
    modeListeners.set(button, listener)
    button.addEventListener('click', listener)
  })

  resizeObserver.observe(root)

  resize()
  applyMode(0, false)

  if (isStatic) {
    renderStaticFrame()

    return {
      destroy() {
        activeRenderer.destroy()
        resizeObserver.disconnect()
        window.clearTimeout(burstTimer)
        modeListeners.forEach((listener, button) => button.removeEventListener('click', listener))
        root.dataset.reactorLoop = 'stopped'
      },
    }
  }

  feedItems.forEach((item, index) => {
    item.dataset.orbitCard = String(index + 1)
    const enter = () => {
      activeLane = index % modes.length
      item.classList.add('is-orbit-linked')
      root.dataset.reactorLane = String(activeLane + 1)
      pointerTarget.energy = Math.max(pointerTarget.energy, 0.72)
    }
    const leave = () => {
      activeLane = targetMode
      item.classList.remove('is-orbit-linked')
      root.dataset.reactorLane = String(targetMode + 1)
    }
    feedListeners.set(item, { enter, leave })
    item.addEventListener('mouseenter', enter)
    item.addEventListener('mouseleave', leave)
  })

  interactionSurface.addEventListener('pointermove', onPointerMove, { passive: true })
  interactionSurface.addEventListener('pointerleave', onPointerLeave)
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', resize)
  window.addEventListener('feian:signal-mode', onBurst)
  window.addEventListener('feian:membrane-pulse', onBurst)

  onScroll()
  setPointer(window.innerWidth * 0.66, window.innerHeight * 0.42, 0.54)

  let lifecycleState: 'active' | 'context-lost' | 'destroyed' = 'active'

  const loop = createFrameLoop(
    (time, delta) => {
      if (lifecycleState !== 'active') return

      const pointerFollow = 1 - Math.exp(-Math.max(delta, 1) / 118)
      const energyFollow = 1 - Math.exp(-Math.max(delta, 1) / 170)
      pointer.x += (pointerTarget.x - pointer.x) * pointerFollow
      pointer.y += (pointerTarget.y - pointer.y) * pointerFollow
      pointer.energy += (pointerTarget.energy - pointer.energy) * energyFollow
      pointerTarget.energy += (0.18 - pointerTarget.energy) * Math.min(0.12, Math.max(delta / 1200, 0.018))
      selectedMode += (targetMode - selectedMode) * Math.min(0.14, Math.max(delta / 120, 0.045))

      root.style.setProperty('--reactor-x', `${(pointer.x * 100).toFixed(2)}%`)
      root.style.setProperty('--reactor-y', `${(pointer.y * 100).toFixed(2)}%`)
      root.style.setProperty('--reactor-energy', pointer.energy.toFixed(3))

      activeRenderer.render({
        width,
        height,
        time,
        delta,
        pointer,
        activeLane,
        scrollEnergy,
        glow: profile.glow,
        shaderLike: profile.shaderLike,
        mode: selectedMode,
      })
      root.dataset.reactorReady = 'active'
      root.dataset.reactorFrame = 'live'
    },
    { fps: profile.fps },
  )

  const isInsideObserverMargin = () => {
    const rect = root.getBoundingClientRect()
    const margin = window.innerHeight * 0.24
    return rect.bottom > -margin && rect.top < window.innerHeight + margin
  }

  const setLoopState = (running: boolean) => {
    if (lifecycleState === 'destroyed') {
      loop.stop()
      root.dataset.reactorLoop = 'stopped'
      return
    }

    if (lifecycleState === 'context-lost') {
      loop.stop()
      root.dataset.reactorLoop = 'static'
      return
    }

    root.dataset.reactorLoop = running ? 'running' : 'paused'
    if (running) loop.start()
    else loop.stop()
  }

  const syncLoopState = () => {
    setLoopState(!document.hidden && isInsideObserverMargin())
  }

  const visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      setLoopState(Boolean(entry?.isIntersecting) && !document.hidden)
    },
    { rootMargin: '24% 0px' },
  )
  const onContextLost = (event: Event) => {
    event.preventDefault()

    if (lifecycleState !== 'active') return

    lifecycleState = 'context-lost'
    setLoopState(false)
    root.classList.add('is-context-lost')
    root.dataset.reactorReady = 'static'
    root.dataset.reactorFrame = 'static'
    root.dataset.reactorEngine = 'css'
  }

  visibilityObserver.observe(root)
  document.addEventListener('visibilitychange', syncLoopState)
  activeRenderer.canvas.addEventListener('webglcontextlost', onContextLost)
  syncLoopState()

  return {
    destroy() {
      lifecycleState = 'destroyed'
      visibilityObserver.disconnect()
      document.removeEventListener('visibilitychange', syncLoopState)
      activeRenderer.canvas.removeEventListener('webglcontextlost', onContextLost)
      loop.destroy()
      activeRenderer.destroy()
      resizeObserver.disconnect()
      window.clearTimeout(burstTimer)
      interactionSurface.removeEventListener('pointermove', onPointerMove)
      interactionSurface.removeEventListener('pointerleave', onPointerLeave)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', resize)
      window.removeEventListener('feian:signal-mode', onBurst)
      window.removeEventListener('feian:membrane-pulse', onBurst)
      modeListeners.forEach((listener, button) => button.removeEventListener('click', listener))
      feedListeners.forEach((listeners, item) => {
        item.removeEventListener('mouseenter', listeners.enter)
        item.removeEventListener('mouseleave', listeners.leave)
      })
      root.dataset.reactorLoop = 'stopped'
    },
  }
}

function createWebGLRenderer(canvas: HTMLCanvasElement): ReactorRenderer | null {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    powerPreference: 'high-performance',
  })
  if (!gl) return null

  const vertexSource = `#version 300 es
    in vec2 aPosition;
    out vec2 vUv;
    void main() {
      vUv = aPosition * 0.5 + 0.5;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `

  const fragmentSource = `#version 300 es
    precision highp float;

    in vec2 vUv;
    out vec4 outColor;

    uniform vec2 uResolution;
    uniform vec2 uPointer;
    uniform float uTime;
    uniform float uEnergy;
    uniform float uScroll;
    uniform float uMode;
    uniform float uGlow;
    uniform float uDetail;

    const float PI = 3.14159265359;

    mat2 rotate2d(float angle) {
      float s = sin(angle);
      float c = cos(angle);
      return mat2(c, -s, s, c);
    }

    float hash21(vec2 point) {
      point = fract(point * vec2(123.34, 456.21));
      point += dot(point, point + 45.32);
      return fract(point.x * point.y);
    }

    float noise21(vec2 point) {
      vec2 cell = floor(point);
      vec2 local = fract(point);
      local = local * local * (3.0 - 2.0 * local);
      float a = hash21(cell);
      float b = hash21(cell + vec2(1.0, 0.0));
      float c = hash21(cell + vec2(0.0, 1.0));
      float d = hash21(cell + vec2(1.0, 1.0));
      return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
    }

    vec2 organicField(vec2 point, float time) {
      float angle = noise21(point * 1.35 + vec2(time * 0.045, -time * 0.032)) * PI * 2.0;
      vec2 flow = vec2(cos(angle), sin(angle));
      flow += vec2(
        sin(point.y * 2.7 - time * 0.12),
        cos(point.x * 2.3 + time * 0.1)
      ) * 0.32;
      return flow;
    }

    vec3 modeColor(float mode) {
      vec3 work = vec3(1.0, 0.255, 0.045);
      vec3 field = vec3(0.12, 0.78, 0.9);
      vec3 life = vec3(0.95, 0.69, 0.25);
      vec3 first = mix(work, field, smoothstep(0.18, 0.92, mode));
      return mix(first, life, smoothstep(1.12, 1.92, mode));
    }

    vec3 secondaryColor(float mode) {
      vec3 work = vec3(0.12, 0.72, 0.82);
      vec3 field = vec3(1.0, 0.31, 0.08);
      vec3 life = vec3(0.2, 0.68, 0.78);
      vec3 first = mix(work, field, smoothstep(0.18, 0.92, mode));
      return mix(first, life, smoothstep(1.12, 1.92, mode));
    }

    float sphereDistance(vec3 point, float radius) {
      return length(point) - radius;
    }

    float torusDistance(vec3 point, vec2 shape) {
      vec2 projected = vec2(length(point.xz) - shape.x, point.y);
      return length(projected) - shape.y;
    }

    vec3 orient(vec3 point) {
      float pointerX = (uPointer.x - 0.5) * 0.64;
      float pointerY = (uPointer.y - 0.5) * 0.48;
      float drift = uTime * 0.08 + uMode * 0.38 + uScroll * 0.74;
      float breath = sin(uTime * 0.37 + point.y * 1.8) * 0.035;
      point.xz *= rotate2d(pointerX + drift * 0.22 + breath);
      point.yz *= rotate2d(pointerY - 0.22 + sin(drift) * 0.09 + breath * 0.7);
      return point;
    }

    vec4 shapeDistances(vec3 sourcePoint) {
      vec3 point = orient(sourcePoint);
      float coreBreath = sin(uTime * 1.08) * 0.008 + sin(uTime * 0.41 + 1.7) * 0.006;
      float core = sphereDistance(point, 0.31 + coreBreath * (0.72 + uEnergy * 0.28));

      vec3 ringA = point;
      ringA.xy *= rotate2d(0.72 + uMode * 0.17 + sin(uTime * 0.23) * 0.035);
      float orbitA = torusDistance(ringA, vec2(0.88 + sin(uTime * 0.34) * 0.012, 0.018));

      vec3 ringB = point;
      ringB.yz *= rotate2d(-0.96 + uMode * 0.12 - sin(uTime * 0.19 + 1.1) * 0.04);
      ringB.xy *= rotate2d(0.36);
      float orbitB = torusDistance(ringB, vec2(1.08 + sin(uTime * 0.27 + 0.8) * 0.014, 0.014));

      vec3 ringC = point;
      ringC.xz *= rotate2d(1.12 - uMode * 0.1 + sin(uTime * 0.16 + 2.4) * 0.045);
      ringC.yz *= rotate2d(0.58);
      float orbitC = torusDistance(ringC, vec2(1.28 + sin(uTime * 0.21 + 2.1) * 0.016, 0.011));

      return vec4(core, orbitA, orbitB, orbitC);
    }

    float sceneDistance(vec3 point) {
      vec4 distances = shapeDistances(point);
      return min(min(distances.x, distances.y), min(distances.z, distances.w));
    }

    vec3 sceneNormal(vec3 point) {
      vec2 epsilon = vec2(0.002, 0.0);
      return normalize(vec3(
        sceneDistance(point + epsilon.xyy) - sceneDistance(point - epsilon.xyy),
        sceneDistance(point + epsilon.yxy) - sceneDistance(point - epsilon.yxy),
        sceneDistance(point + epsilon.yyx) - sceneDistance(point - epsilon.yyx)
      ));
    }

    void main() {
      vec2 resolution = max(uResolution, vec2(1.0));
      vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
      uv.y *= -1.0;

      vec2 parallax = (uPointer - 0.5) * vec2(0.22, -0.16);
      uv -= parallax;

      vec2 livingFlow = organicField(uv * 1.15 + vec2(uMode * 0.31), uTime);
      uv += livingFlow * (0.008 + uEnergy * 0.0035);

      vec2 riftSpace = rotate2d(-0.13 + uMode * 0.045) * uv;
      float riftBend =
        sin(riftSpace.y * 3.1 + uTime * 0.24) * (0.027 + uEnergy * 0.006) +
        sin(riftSpace.y * 8.7 - uTime * 0.17 + uMode) * 0.009 +
        livingFlow.x * 0.012;
      float riftDistance = abs(riftSpace.x - riftBend);
      float riftLens = exp(-riftDistance * 7.5) * (1.0 - smoothstep(0.18, 1.5, abs(riftSpace.y)));
      uv.x += sign(riftSpace.x - riftBend) * riftLens * (0.035 + uScroll * 0.03);

      float modePulse = 0.5 + 0.5 * sin(uTime * 0.72 + uMode * 1.7);
      vec3 primary = modeColor(uMode);
      vec3 secondary = secondaryColor(uMode);
      vec2 filamentSpaceA = rotate2d(0.36 + uMode * 0.08) * uv;
      vec2 filamentSpaceB = rotate2d(-0.52 + uMode * 0.04) * uv;
      float filamentA = exp(-abs(filamentSpaceA.y - sin(filamentSpaceA.x * 3.4 + uTime * 0.31) * 0.1) * 44.0);
      float filamentB = exp(-abs(filamentSpaceB.y - cos(filamentSpaceB.x * 4.1 - uTime * 0.22) * 0.08) * 52.0);
      filamentA *= 1.0 - smoothstep(0.34, 1.55, abs(filamentSpaceA.x));
      filamentB *= 1.0 - smoothstep(0.28, 1.48, abs(filamentSpaceB.x));
      vec3 rayOrigin = vec3(0.0, 0.0, 3.34 - uScroll * 0.3);
      vec3 rayDirection = normalize(vec3(uv * (0.94 + uScroll * 0.14), -1.95));

      float depth = 0.0;
      float hit = 0.0;
      float coreGlow = 0.0;
      float warmOrbitGlow = 0.0;
      float coolOrbitGlow = 0.0;
      vec3 hitPoint = vec3(0.0);

      for (int stepIndex = 0; stepIndex < 64; stepIndex++) {
        if (uDetail < 0.5 && stepIndex >= 40) break;

        vec3 point = rayOrigin + rayDirection * depth;
        vec4 distances = shapeDistances(point);
        float distanceToScene = min(min(distances.x, distances.y), min(distances.z, distances.w));

        coreGlow += 0.0024 / (0.035 + abs(distances.x)) * (0.62 + uEnergy * 0.22);
        warmOrbitGlow += 0.00125 / (0.014 + abs(distances.y));
        coolOrbitGlow += 0.00105 / (0.014 + abs(distances.z));
        coolOrbitGlow += 0.00082 / (0.013 + abs(distances.w));

        if (distanceToScene < 0.0015) {
          hit = 1.0;
          hitPoint = point;
          break;
        }

        depth += max(abs(distanceToScene) * 0.7, 0.008);
        if (depth > 7.5) break;
      }

      vec3 color = vec3(0.0);
      color += primary * min(coreGlow * 0.07, 1.05);
      color += primary * min(warmOrbitGlow * (0.32 + uEnergy * 0.08), 1.2);
      color += secondary * min(coolOrbitGlow * (0.3 + modePulse * 0.06), 1.1);

      if (hit > 0.5) {
        vec4 materialDistances = abs(shapeDistances(hitPoint));
        float orbitDistance = min(materialDistances.y, min(materialDistances.z, materialDistances.w));
        float coreMaterial = 1.0 - step(orbitDistance, materialDistances.x);
        vec3 normal = sceneNormal(hitPoint);
        vec3 lightDirection = normalize(vec3(-0.35, 0.62, 0.72));
        float diffuse = max(dot(normal, lightDirection), 0.0);
        float fresnel = pow(1.0 - max(dot(normal, -rayDirection), 0.0), 2.3);
        float innerSignal = 0.62 + 0.38 * sin((hitPoint.x + hitPoint.y + hitPoint.z) * 16.0 - uTime * 2.2);
        vec3 orbitSurface =
          vec3(1.0, 0.9, 0.72) * diffuse * 0.52 +
          primary * fresnel * (0.68 + uEnergy * 0.18) +
          secondary * innerSignal * 0.14;
        vec3 voidSurface =
          vec3(0.003, 0.006, 0.007) +
          primary * fresnel * (1.08 + uEnergy * 0.18) +
          secondary * innerSignal * 0.05;
        color += mix(orbitSurface, voidSurface, coreMaterial);
      }

      float halo = exp(-abs(length(uv * vec2(0.88, 1.0)) - 0.62) * 7.4);
      float horizon = exp(-abs(uv.y + sin(uv.x * 2.4 + uTime * 0.22) * 0.025) * 58.0);
      float flare = exp(-length(uv - vec2(-0.02, 0.01)) * 5.2);
      float riftEdge = exp(-abs(riftDistance - 0.018) * 116.0) * (1.0 - smoothstep(0.12, 1.42, abs(riftSpace.y)));
      float riftCore = exp(-riftDistance * 92.0) * (1.0 - smoothstep(0.08, 1.34, abs(riftSpace.y)));
      float riftPulse = 0.76 + 0.24 * sin(uTime * 1.4 - riftSpace.y * 7.0 + uMode * 1.6);
      color += secondary * halo * (0.025 + uEnergy * 0.014);
      color += mix(primary, secondary, 0.5) * horizon * (0.08 + uEnergy * 0.06);
      color += vec3(1.0, 0.72, 0.42) * flare * (0.025 + uEnergy * 0.018);
      color += primary * filamentA * (0.032 + uEnergy * 0.018);
      color += secondary * filamentB * (0.025 + modePulse * 0.012);
      color *= 1.0 - riftCore * 0.72;
      color += mix(primary, secondary, smoothstep(-0.9, 0.9, riftSpace.y)) * riftEdge * (0.72 + uEnergy * 0.24) * riftPulse;
      color += vec3(1.0, 0.92, 0.78) * riftEdge * riftEdge * 0.34;

      vec2 starCell = floor((uv + livingFlow * 0.018 + vec2(uTime * 0.005, -uTime * 0.003)) * 92.0);
      float starNoise = hash21(starCell);
      float star = smoothstep(0.992, 1.0, starNoise) * (0.18 + 0.22 * sin(uTime * 1.8 + starNoise * 12.0));
      color += mix(primary, vec3(0.88, 0.96, 1.0), 0.72) * star;

      color *= 0.88 + uGlow * 0.2;
      color = color / (1.0 + color * 0.62);
      color = pow(max(color, vec3(0.0)), vec3(0.86));

      float alpha = clamp(max(max(color.r, color.g), color.b) * 1.28 + star * 0.28, 0.0, 0.98);
      outColor = vec4(color, alpha);
    }
  `

  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  if (!vertexShader || !fragmentShader) return null

  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    gl.deleteProgram(program)
    return null
  }

  const buffer = gl.createBuffer()
  if (!buffer) return null
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  )

  const position = gl.getAttribLocation(program, 'aPosition')
  const uniforms = {
    resolution: gl.getUniformLocation(program, 'uResolution'),
    pointer: gl.getUniformLocation(program, 'uPointer'),
    time: gl.getUniformLocation(program, 'uTime'),
    energy: gl.getUniformLocation(program, 'uEnergy'),
    scroll: gl.getUniformLocation(program, 'uScroll'),
    mode: gl.getUniformLocation(program, 'uMode'),
    glow: gl.getUniformLocation(program, 'uGlow'),
    detail: gl.getUniformLocation(program, 'uDetail'),
  }

  gl.useProgram(program)
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  gl.clearColor(0, 0, 0, 0)

  return {
    engine: 'webgl',
    canvas,
    resize(width, height, dpr) {
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      gl.viewport(0, 0, canvas.width, canvas.height)
    },
    render(state) {
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.useProgram(program)
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height)
      gl.uniform2f(uniforms.pointer, state.pointer.x, state.pointer.y)
      gl.uniform1f(uniforms.time, state.time * 0.001)
      gl.uniform1f(uniforms.energy, state.pointer.energy)
      gl.uniform1f(uniforms.scroll, state.scrollEnergy)
      gl.uniform1f(uniforms.mode, state.mode)
      gl.uniform1f(uniforms.glow, state.glow)
      gl.uniform1f(uniforms.detail, state.shaderLike ? 1 : 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
    destroy() {
      gl.deleteBuffer(buffer)
      gl.deleteShader(vertexShader)
      gl.deleteShader(fragmentShader)
      gl.deleteProgram(program)
    },
  }
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function createCanvasRenderer(
  canvas: HTMLCanvasElement,
  particles: ReactorParticle[],
): ReactorRenderer | null {
  const context = canvas.getContext('2d', { alpha: true })
  if (!context) return null

  let dpr = 1

  return {
    engine: 'canvas',
    canvas,
    resize(width, height, nextDpr) {
      dpr = nextDpr
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    },
    render(state) {
      drawCanvasReactor(context, particles, state)
    },
    destroy() {
      context.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
    },
  }
}

function drawCanvasReactor(
  context: CanvasRenderingContext2D,
  particles: ReactorParticle[],
  state: ReactorRenderState,
) {
  const { width, height, time, pointer, activeLane, scrollEnergy, glow, mode } = state
  const centerX = width * (0.5 + (pointer.x - 0.5) * 0.08)
  const centerY = height * (0.5 + (pointer.y - 0.5) * 0.08 - scrollEnergy * 0.06)
  const minimum = Math.min(width, height)
  const pulse = 0.5 + Math.sin(time * 0.0022) * 0.5
  const energy = clamp(pointer.energy + pulse * 0.15, 0, 1.35)
  const colors = resolveCanvasPalette(mode)

  context.clearRect(0, 0, width, height)
  context.save()
  context.globalCompositeOperation = 'lighter'

  const coreRadius = minimum * (0.11 + energy * 0.018)
  const core = context.createRadialGradient(
    centerX,
    centerY,
    coreRadius * 0.05,
    centerX,
    centerY,
    coreRadius * 4.2,
  )
  core.addColorStop(0, `rgba(255,248,220,${0.94 * glow})`)
  core.addColorStop(0.14, colorToRgba(colors.primary, 0.7 * glow))
  core.addColorStop(0.44, colorToRgba(colors.secondary, 0.22 * glow))
  core.addColorStop(1, 'rgba(0,0,0,0)')
  context.fillStyle = core
  context.beginPath()
  context.arc(centerX, centerY, coreRadius * 4.2, 0, Math.PI * 2)
  context.fill()

  for (let lane = 0; lane < 4; lane += 1) {
    const radius = minimum * (0.24 + lane * 0.07)
    const laneFocus = activeLane === -1 || activeLane === lane % 3 ? 1 : 0.3
    const direction = lane % 2 ? -1 : 1
    const rotation = time * 0.0003 * direction + lane * 0.72 + mode * 0.26
    context.save()
    context.translate(centerX, centerY)
    context.rotate(rotation * 0.24)
    context.scale(1, 0.52 + lane * 0.035)
    context.strokeStyle = colorToRgba(
      lane % 2 ? colors.secondary : colors.primary,
      laneFocus * (0.22 + energy * 0.07),
    )
    context.lineWidth = activeLane === lane % 3 ? 2.1 : 1
    context.beginPath()
    context.ellipse(0, 0, radius * 1.32, radius, 0, rotation, rotation + Math.PI * 1.62)
    context.stroke()
    context.restore()
  }

  particles.forEach((particle) => {
    const laneFocus = activeLane === -1 || activeLane === particle.lane % 3 ? 1 : 0.3
    const angle = particle.angle + time * particle.speed * (particle.lane % 2 ? -1 : 1)
    const radius = minimum * particle.radius
    const x = centerX + Math.cos(angle) * radius * (1.05 + energy * 0.06)
    const y = centerY + Math.sin(angle) * radius * (0.54 + energy * 0.04)
    const alpha = laneFocus * (0.24 + energy * 0.24)
    context.fillStyle = colorToRgba(
      particle.lane % 2 ? colors.secondary : colors.primary,
      alpha,
    )
    context.beginPath()
    context.arc(x, y, particle.size * (0.82 + energy * 0.3), 0, Math.PI * 2)
    context.fill()
  })

  context.restore()
}

function resolveCanvasPalette(mode: number) {
  const palettes = [
    { primary: [255, 106, 26] as const, secondary: [81, 219, 231] as const },
    { primary: [50, 203, 226] as const, secondary: [255, 112, 44] as const },
    { primary: [237, 200, 120] as const, secondary: [72, 190, 210] as const },
  ]
  return palettes[clamp(Math.round(mode), 0, palettes.length - 1)]
}

function buildParticles(count: number): ReactorParticle[] {
  return Array.from({ length: count }, (_, index) => ({
    angle: (Math.PI * 2 * index) / Math.max(count, 1),
    radius: 0.22 + (index % 8) * 0.044 + Math.random() * 0.055,
    speed: 0.00016 + (index % 11) * 0.000026,
    size: 0.8 + Math.random() * 2.7,
    lane: index % 4,
    flicker: Math.random() * Math.PI * 2,
  }))
}

function colorToRgba(color: readonly [number, number, number], alpha: number) {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
