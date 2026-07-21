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

type ReactorLaneKey = 'work' | 'field' | 'life'

const reactorLaneProfiles: Array<{
  key: ReactorLaneKey
  copy: string
}> = [
  { key: 'work', copy: '工作：把重复步骤做成网页和系统。' },
  { key: 'field', copy: '现场：让设备状态和排查过程更直观。' },
  { key: 'life', copy: '生活：把兴趣和记录做成愿意反复打开的体验。' },
]

export function setupSignalReactor(options: ReactorOptions) {
  const root = document.querySelector<HTMLElement>('[data-signal-reactor]')
  const canvas = root?.querySelector<HTMLCanvasElement>('.signal-reactor-canvas')
  if (!root || !canvas) return null

  const laneButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('button[data-reactor-lane]'),
  )
  const laneNodes = Array.from(
    root.querySelectorAll<HTMLElement>('[data-reactor-node]'),
  )
  const focusCopy = document.querySelector<HTMLElement>('[data-reactor-focus-copy]')
  const laneCleanups: Array<() => void> = []
  const defaultFocusCopy = focusCopy?.textContent?.trim() || ''
  let activeLane = -1
  let pinnedLane: number | null = null
  let laneBurstTimer = 0

  const setActiveLane = (lane: number) => {
    activeLane = lane
    const profile = lane >= 0 ? reactorLaneProfiles[lane] : undefined

    if (profile) root.dataset.reactorLane = profile.key
    else delete root.dataset.reactorLane

    laneButtons.forEach((button, index) => {
      button.classList.toggle('is-active', index === lane)
      button.setAttribute('aria-pressed', String(index === pinnedLane))
    })
    laneNodes.forEach((node) => {
      node.classList.toggle('is-active', node.dataset.reactorNode === profile?.key)
    })

    if (focusCopy) focusCopy.textContent = profile?.copy || defaultFocusCopy
  }

  laneButtons.forEach((button, index) => {
    const preview = () => setActiveLane(index)
    const restore = () => setActiveLane(pinnedLane ?? -1)
    const pin = () => {
      pinnedLane = pinnedLane === index ? null : index
      setActiveLane(pinnedLane ?? -1)
      root.classList.add('is-reactor-burst')
      window.clearTimeout(laneBurstTimer)
      laneBurstTimer = window.setTimeout(() => root.classList.remove('is-reactor-burst'), 760)
    }

    button.addEventListener('pointerenter', preview, { passive: true })
    button.addEventListener('pointerleave', restore, { passive: true })
    button.addEventListener('focus', preview)
    button.addEventListener('blur', restore)
    button.addEventListener('click', pin)
    laneCleanups.push(() => {
      button.removeEventListener('pointerenter', preview)
      button.removeEventListener('pointerleave', restore)
      button.removeEventListener('focus', preview)
      button.removeEventListener('blur', restore)
      button.removeEventListener('click', pin)
    })
  })
  setActiveLane(-1)

  const preferences = readMotionPreferences()
  const profile = resolveVisualRuntimeProfile({
    ...preferences,
    reducedMotion: options.reducedMotion || preferences.reducedMotion,
  })
  const context = canvas.getContext('2d', { alpha: true })
  publishVisualQuality(profile)

  root.dataset.reactorQuality = profile.quality
  root.dataset.reactorReady = profile.quality === 'calm' ? 'static' : 'booting'

  if (!context || profile.quality === 'calm') {
    root.dataset.reactorReady = 'static'
    return {
      destroy() {
        laneCleanups.forEach((cleanup) => cleanup())
        window.clearTimeout(laneBurstTimer)
      },
    }
  }

  const pointer = { x: 0.5, y: 0.5, energy: 0.18 }
  const particles = buildParticles(profile.particleCount)
  const feedItems = Array.from(document.querySelectorAll<HTMLElement>('.feed-item'))
  let width = 0
  let height = 0
  let dpr = 1
  let scrollEnergy = 0
  let intersectionObserver: IntersectionObserver | null = null

  const resize = () => {
    const rect = root.getBoundingClientRect()
    dpr = Math.min(window.devicePixelRatio || 1, profile.quality === 'ultra' ? 2 : 1.5)
    width = Math.max(1, Math.round(rect.width))
    height = Math.max(1, Math.round(rect.height))
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const setPointer = (clientX: number, clientY: number, energy = 0.64) => {
    const rect = root.getBoundingClientRect()
    pointer.x = clamp((clientX - rect.left) / Math.max(rect.width, 1), 0, 1)
    pointer.y = clamp((clientY - rect.top) / Math.max(rect.height, 1), 0, 1)
    pointer.energy = Math.max(pointer.energy, energy)
    root.style.setProperty('--reactor-x', `${(pointer.x * 100).toFixed(2)}%`)
    root.style.setProperty('--reactor-y', `${(pointer.y * 100).toFixed(2)}%`)
    root.style.setProperty('--reactor-energy', pointer.energy.toFixed(3))
  }

  const onPointerMove = (event: PointerEvent) => setPointer(event.clientX, event.clientY)
  const onPointerLeave = () => {
    pointer.energy = 0.22
    setActiveLane(pinnedLane ?? -1)
    root.style.setProperty('--reactor-energy', '0.22')
  }
  const onScroll = () => {
    scrollEnergy = clamp(window.scrollY / Math.max(window.innerHeight, 1), 0, 1)
    root.style.setProperty('--reactor-scroll', scrollEnergy.toFixed(3))
  }
  const onBurst = () => {
    pointer.energy = Math.max(pointer.energy, 1.08)
    root.classList.add('is-reactor-burst')
    window.setTimeout(() => root.classList.remove('is-reactor-burst'), 900)
  }

  feedItems.forEach((item, index) => {
    item.dataset.orbitCard = String(index + 1)
    item.addEventListener('mouseenter', () => {
      const linkedLane = index % reactorLaneProfiles.length
      setActiveLane(linkedLane)
      item.classList.add('is-orbit-linked')
    })
    item.addEventListener('mouseleave', () => {
      setActiveLane(pinnedLane ?? -1)
      item.classList.remove('is-orbit-linked')
    })
  })

  root.addEventListener('pointermove', onPointerMove)
  root.addEventListener('pointerleave', onPointerLeave)
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', resize)
  window.addEventListener('feian:signal-mode', onBurst)
  window.addEventListener('feian:membrane-pulse', onBurst)

  resize()
  onScroll()
  setPointer(window.innerWidth * 0.52, window.innerHeight * 0.28, 0.42)

  const loop = createFrameLoop(
    (time, delta) => {
      pointer.energy = pointer.energy * 0.92 + 0.16 * 0.08
      drawReactor(context, particles, {
        width,
        height,
        time,
        delta,
        pointer,
        activeLane,
        scrollEnergy,
        glow: profile.glow,
        shaderLike: profile.shaderLike,
      })
      root.dataset.reactorReady = 'active'
    },
    { fps: profile.fps },
  )

  loop.start()
  if ('IntersectionObserver' in window) {
    intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        const nearby = Boolean(entry?.isIntersecting)
        root.dataset.reactorPaused = nearby ? 'false' : 'true'
        if (nearby) loop.start()
        else loop.stop()
      },
      { rootMargin: '180px 0px' },
    )
    intersectionObserver.observe(root)
  }

  return {
    destroy() {
      loop.destroy()
      intersectionObserver?.disconnect()
      laneCleanups.forEach((cleanup) => cleanup())
      window.clearTimeout(laneBurstTimer)
      root.removeEventListener('pointermove', onPointerMove)
      root.removeEventListener('pointerleave', onPointerLeave)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', resize)
      window.removeEventListener('feian:signal-mode', onBurst)
      window.removeEventListener('feian:membrane-pulse', onBurst)
    },
  }
}

function buildParticles(count: number): ReactorParticle[] {
  return Array.from({ length: count }, (_, index) => ({
    angle: (Math.PI * 2 * index) / Math.max(count, 1),
    radius: 0.24 + (index % 7) * 0.048 + Math.random() * 0.05,
    speed: 0.00018 + (index % 11) * 0.000026,
    size: 0.9 + Math.random() * 2.8,
    lane: index % reactorLaneProfiles.length,
    flicker: Math.random() * Math.PI * 2,
  }))
}

function drawReactor(
  context: CanvasRenderingContext2D,
  particles: ReactorParticle[],
  state: {
    width: number
    height: number
    time: number
    delta: number
    pointer: { x: number; y: number; energy: number }
    activeLane: number
    scrollEnergy: number
    glow: number
    shaderLike: boolean
  },
) {
  const { width, height, time, pointer, activeLane, scrollEnergy, glow, shaderLike } = state
  const cx = width * (0.5 + (pointer.x - 0.5) * 0.08)
  const cy = height * (0.5 + (pointer.y - 0.5) * 0.1 - scrollEnergy * 0.08)
  const min = Math.min(width, height)
  const pulse = 0.5 + Math.sin(time * 0.0022) * 0.5
  const energy = clamp(pointer.energy + pulse * 0.15, 0, 1.35)

  context.clearRect(0, 0, width, height)
  context.save()
  context.globalCompositeOperation = 'lighter'

  drawCore(context, cx, cy, min, energy, glow, shaderLike)
  drawOrbits(context, cx, cy, min, time, energy, activeLane)
  drawParticles(context, particles, cx, cy, min, time, energy, activeLane)
  drawPointerLens(context, width, height, pointer, energy)

  context.restore()
}

function drawCore(
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  min: number,
  energy: number,
  glow: number,
  shaderLike: boolean,
) {
  const radius = min * (0.13 + energy * 0.018)
  const gradient = context.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius * 3.4)
  gradient.addColorStop(0, `rgba(255,244,214,${0.92 * glow})`)
  gradient.addColorStop(0.16, `rgba(255,138,53,${0.64 * glow})`)
  gradient.addColorStop(0.42, `rgba(110,217,230,${0.24 * glow})`)
  gradient.addColorStop(0.72, `rgba(243,106,29,${0.12 * glow})`)
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  context.fillStyle = gradient
  context.beginPath()
  context.arc(cx, cy, radius * 3.4, 0, Math.PI * 2)
  context.fill()

  context.lineWidth = shaderLike ? 1.4 : 1
  for (let i = 0; i < 5; i += 1) {
    const laneRadius = radius * (1.08 + i * 0.42)
    context.strokeStyle = `rgba(${220 + i * 10}, ${142 + i * 18}, ${70 + i * 26}, ${0.2 - i * 0.016})`
    context.beginPath()
    context.ellipse(cx, cy, laneRadius * (1.38 + i * 0.08), laneRadius * (0.62 + i * 0.025), Math.PI * (0.06 * i), 0, Math.PI * 2)
    context.stroke()
  }
}

function drawOrbits(
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  min: number,
  time: number,
  energy: number,
  activeLane: number,
) {
  for (let lane = 0; lane < reactorLaneProfiles.length; lane += 1) {
    const radius = min * (0.24 + lane * 0.065)
    const alpha = activeLane === -1 || activeLane === lane ? 0.32 : 0.1
    const start = time * 0.00038 * (lane % 2 ? -1 : 1) + lane
    const palette = [
      [243, 106, 29],
      [110, 217, 230],
      [233, 200, 133],
    ][lane]
    context.strokeStyle = `rgba(${palette[0]}, ${palette[1]}, ${palette[2]}, ${alpha + energy * 0.06})`
    context.lineWidth = activeLane === lane ? 2.2 : 1.1
    context.beginPath()
    context.arc(cx, cy, radius, start, start + Math.PI * (0.72 + energy * 0.26))
    context.stroke()
  }
}

function drawParticles(
  context: CanvasRenderingContext2D,
  particles: ReactorParticle[],
  cx: number,
  cy: number,
  min: number,
  time: number,
  energy: number,
  activeLane: number,
) {
  particles.forEach((particle) => {
    const laneFocus = activeLane === -1 || activeLane === particle.lane ? 1 : 0.34
    const angle = particle.angle + time * particle.speed * (particle.lane % 2 ? -1 : 1)
    const radius = min * particle.radius * (1 + Math.sin(time * 0.001 + particle.flicker) * 0.03)
    const x = cx + Math.cos(angle) * radius * (1.02 + energy * 0.08)
    const y = cy + Math.sin(angle) * radius * (0.58 + energy * 0.04)
    const alpha = laneFocus * (0.28 + energy * 0.22)
    const warm = particle.lane % 2 === 0
    context.fillStyle = warm ? `rgba(255, 154, 72, ${alpha})` : `rgba(154, 231, 238, ${alpha})`
    context.beginPath()
    context.arc(x, y, particle.size * (0.8 + energy * 0.3), 0, Math.PI * 2)
    context.fill()
  })
}

function drawPointerLens(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  pointer: { x: number; y: number; energy: number },
  energy: number,
) {
  const x = pointer.x * width
  const y = pointer.y * height
  const gradient = context.createRadialGradient(x, y, 0, x, y, Math.min(width, height) * 0.36)
  gradient.addColorStop(0, `rgba(255,255,255,${0.08 * energy})`)
  gradient.addColorStop(0.3, `rgba(255,138,53,${0.08 * energy})`)
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, width, height)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
