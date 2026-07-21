import './index.css'
import './impact.css'
import './system-triptych.css'
import { setupGlobalEffects } from './global-effects'
import { setupImpactChoreography } from './impact-choreography'
import { createRainBackground } from './rain-background'
import { setupSystemTriptych } from './system-triptych'
import { setupSignalReactor } from './visual-runtime/reactor/signal-reactor'

document.documentElement.classList.add('js', 'impact-edition')

const sectionIds = ['cover', 'signals', 'feed', 'archive'] as const

type SectionId = (typeof sectionIds)[number]
type PointerPoint = Pick<PointerEvent, 'clientX' | 'clientY'>
type MotionState = 'active' | 'idle' | 'hidden'
type ScrollDirection = 'down' | 'up' | 'still'
type SignalAxisKey = 'agent' | 'field' | 'tool'
type PointerMode = 'default' | 'scan' | 'terminal' | 'index' | 'launch'
type SignalAxisProfile = {
  axis: SignalAxisKey
  detailKicker: string
  detailTitle: string
  detailCopy: string
  detailHref: string
  detailCta: string
  dashboardTitle: string
  dashboardStatus: string
  metrics: [string, string, string]
  metricLabels: [string, string, string]
}
type InteractionSnapshot = {
  rect: DOMRectReadOnly
  color?: [number, number, number]
}

const pageShell = document.querySelector<HTMLElement>('.page-shell')
const topNavLinks = Array.from(
  document.querySelectorAll<HTMLAnchorElement>('.topnav a[href^="#"]'),
)
const revealTargets = Array.from(
  document.querySelectorAll<HTMLElement>('[data-reveal]'),
)
const interactiveTargets = Array.from(
  document.querySelectorAll<HTMLElement>('[data-interactive-lens]'),
)
const coverAtmosphereTargets = Array.from(
  document.querySelectorAll<HTMLElement>('.cover-panel, .cover-object, .cover-log'),
)
const quietZoneTargets = Array.from(
  document.querySelectorAll<HTMLElement>(
    '.cover-panel, .cover-log, .feed-item, .evidence-card, .channel-register, .channel-link, .section-head, .signal-axis, .signal-dashboard, .signal-detail',
  ),
)
const registerItems = Array.from(
  document.querySelectorAll<HTMLElement>('[data-register-item]'),
)
const signalMap = document.querySelector<HTMLElement>('[data-signal-map]')
const signalAxisButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-signal-axis]'))
const signalDashboardTitle = document.querySelector<HTMLElement>('[data-signal-dashboard-title]')
const signalDashboardStatus = document.querySelector<HTMLElement>('[data-signal-dashboard-status]')
const signalDetailKicker = document.querySelector<HTMLElement>('[data-signal-detail-kicker]')
const signalDetailTitle = document.querySelector<HTMLElement>('[data-signal-detail-title]')
const signalDetailCopy = document.querySelector<HTMLElement>('[data-signal-detail-copy]')
const signalDetailLink = document.querySelector<HTMLAnchorElement>('[data-signal-detail-link]')
const signalMetricA = document.querySelector<HTMLElement>('[data-signal-metric-a]')
const signalMetricB = document.querySelector<HTMLElement>('[data-signal-metric-b]')
const signalMetricC = document.querySelector<HTMLElement>('[data-signal-metric-c]')
const signalMetricALabel = document.querySelector<HTMLElement>('[data-signal-metric-a-label]')
const signalMetricBLabel = document.querySelector<HTMLElement>('[data-signal-metric-b-label]')
const signalMetricCLabel = document.querySelector<HTMLElement>('[data-signal-metric-c-label]')
const pointerShell = document.querySelector<HTMLElement>('.pointer-shell')
const pointerLabel = document.querySelector<HTMLElement>('.pointer-label')
const clickLayer = document.querySelector<HTMLElement>('.click-layer')
const fxLayer = document.querySelector<HTMLElement>('.fx-layer')
const pointerWakeLayer =
  document.querySelector<HTMLElement>('.pointer-wake-layer') ??
  (fxLayer
    ? Object.assign(document.createElement('div'), {
        className: 'pointer-wake-layer',
      })
    : null)
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
const prefersReducedMotion = reducedMotionQuery.matches
const supportsFinePointer = window.matchMedia('(pointer: fine)').matches
const supportsHoverPointer = window.matchMedia('(hover: hover)').matches
const enhancedPointerEnabled = supportsFinePointer && supportsHoverPointer && !prefersReducedMotion

document.documentElement.classList.toggle('motion-reduce', prefersReducedMotion)
reducedMotionQuery.addEventListener('change', (event) => {
  document.documentElement.classList.toggle('motion-reduce', event.matches)
})

const rainCanvas = document.getElementById('rain-canvas') as HTMLCanvasElement | null
const rainBackground = rainCanvas
  ? createRainBackground(rainCanvas, { reducedMotion: prefersReducedMotion })
  : null
let signalReactor = setupSignalReactor({ reducedMotion: prefersReducedMotion })

window.addEventListener('feian:signal-mode', (event) => {
  const detail = (event as CustomEvent<{ mode: 'calm' | 'storm' | 'normal'; reducedMotion: boolean }>).detail
  const mode = detail?.mode || 'normal'

  markMotionActive(mode === 'storm' ? 2600 : 1500)

  if (mode === 'storm') {
    rainBackground?.setInteractionMode('action')

    if (!prefersReducedMotion && !detail?.reducedMotion) {
      rainBackground?.setScrollEnergy(1.05)
      ;[
        [window.innerWidth * 0.18, window.innerHeight * 0.22, 1],
        [window.innerWidth * 0.72, window.innerHeight * 0.34, 0.92],
        [window.innerWidth * 0.48, window.innerHeight * 0.68, 0.86],
      ].forEach(([x, y, strength]) => {
        rainBackground?.pushImpulse({ x, y, strength, kind: 'section' })
      })
    }

    return
  }

  if (mode === 'calm') {
    rainBackground?.setInteractionMode('idle')
    rainBackground?.clearInteraction()
    rainBackground?.setScrollEnergy(0)
    return
  }

  rainBackground?.setInteractionMode('idle')
})

window.addEventListener('feian:membrane-pulse', () => {
  if (prefersReducedMotion) return

  markMotionActive(2400)
  document.body.classList.add('is-physics-demo')
  window.setTimeout(() => document.body.classList.remove('is-physics-demo'), 1500)
  rainBackground?.setInteractionMode('cover')
  rainBackground?.setScrollEnergy(0.82)

  ;[
    [window.innerWidth * 0.28, window.innerHeight * 0.28, 0.82],
    [window.innerWidth * 0.58, window.innerHeight * 0.38, 0.74],
    [window.innerWidth * 0.46, window.innerHeight * 0.68, 0.68],
  ].forEach(([x, y, strength]) => {
    rainBackground?.pushImpulse({ x, y, strength, kind: 'section' })
  })

  window.setTimeout(() => {
    rainBackground?.setScrollEnergy(0)
    rainBackground?.setInteractionMode('idle')
  }, 1200)
})

const sections = sectionIds
  .map((id) => document.getElementById(id))
  .filter((section): section is HTMLElement => Boolean(section))

const visitedSections = new Set<SectionId>()
const activeRevealTargets = new WeakSet<HTMLElement>()
const revealPulseTimers = new WeakMap<HTMLElement, number>()
const strikePulseTimers = new WeakMap<HTMLElement, number>()
const chargePulseTimers = new WeakMap<HTMLElement, number>()
const routePulseTimers = new WeakMap<HTMLElement, number>()
let interactionSnapshots = new WeakMap<HTMLElement, InteractionSnapshot>()
let activeSection: SectionId | null = null
let activeInteractiveTarget: HTMLElement | null = null

const pointerState = {
  x: window.innerWidth * 0.52,
  y: window.innerHeight * 0.28,
  targetX: window.innerWidth * 0.52,
  targetY: window.innerHeight * 0.28,
  visible: false,
}

let pointerRaf = 0
let pointerPressTimer = 0
let pointerChargeTimer = 0
let pointerSyncRaf = 0
let scrollRestTimer = 0
let scrollAmbientRaf = 0
let shellShiftTimer = 0
let interactiveBeatTimer = 0
let quietZoneRaf = 0
let quietZoneTimer = 0
let motionIdleTimer = 0
let interactivePointerRaf = 0
let scrollMetricsPrimeRaf = 0
let queuedInteractiveElement: HTMLElement | null = null
let queuedInteractiveX = pointerState.targetX
let queuedInteractiveY = pointerState.targetY
let surfaceAtmosphereRaf = 0
const queuedSurfaceAtmospheres = new Map<HTMLElement, { x: number; y: number }>()
let lastWakeAt = 0
let lastWakeX = pointerState.targetX
let lastWakeY = pointerState.targetY
let signalSwitchTimer = 0

setupGlobalEffects({
  context: 'home',
  reducedMotion: prefersReducedMotion,
})

let impactChoreography = setupImpactChoreography({
  reducedMotion: prefersReducedMotion,
})

const systemTriptych = setupSystemTriptych({
  reducedMotion: prefersReducedMotion,
})

reducedMotionQuery.addEventListener('change', (event) => {
  impactChoreography.destroy()
  signalReactor?.destroy()
  signalReactor = setupSignalReactor({ reducedMotion: event.matches })
  impactChoreography = setupImpactChoreography({ reducedMotion: event.matches })
})

const signalAxisProfiles: Record<SignalAxisKey, SignalAxisProfile> = {
  agent: {
    axis: 'agent',
    detailKicker: '这一条在做什么',
    detailTitle: '01 / 日常工作',
    detailCopy:
      '把反复整理、查询和交接的事做成网页或系统，下一次不必从头再来。',
    detailHref: '/workflow.html',
    detailCta: '看看这些过程',
    dashboardTitle: '工作里的重复步骤',
    dashboardStatus: '持续更新',
    metrics: ['16', '3', '持续'],
    metricLabels: ['公开页面', '常做方向', '更新状态'],
  },
  field: {
    axis: 'field',
    detailKicker: '这一条在做什么',
    detailTitle: '02 / 工程现场',
    detailCopy:
      '遇到设备通信和调试问题，先把状态、顺序和变化看清楚，再一点点缩小范围。',
    detailHref: '/lab-protocol-studio.html',
    detailCta: '看看现场工具',
    dashboardTitle: '设备状态和排查过程',
    dashboardStatus: '边做边记',
    metrics: ['MCGS', 'MODBUS', '复盘'],
    metricLabels: ['上位画面', '通信协议', '处理方式'],
  },
  tool: {
    axis: 'tool',
    detailKicker: '这一条在做什么',
    detailTitle: '03 / 个人工具',
    detailCopy:
      '自己经常要用的东西，就做成更顺手的版本：打开能看懂，用过还能接着改。',
    detailHref: '/archive.html',
    detailCta: '看看项目时间线',
    dashboardTitle: '给自己做的工具',
    dashboardStatus: '继续打磨',
    metrics: ['网页', '脚本', '本地'],
    metricLabels: ['直观入口', '重复动作', '私密记录'],
  },
}

setBodyMotionState(document.hidden ? 'hidden' : 'idle')

if (!document.hidden) {
  markMotionActive(2600)
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    window.clearTimeout(motionIdleTimer)
    setBodyMotionState('hidden')
    queuedInteractiveElement = null
    queuedSurfaceAtmospheres.clear()
    interactionSnapshots = new WeakMap<HTMLElement, InteractionSnapshot>()

    if (activeInteractiveTarget) {
      clearLocalPointerPosition(activeInteractiveTarget)
      clearInteractiveFocus(activeInteractiveTarget)
    } else {
      stopInteractiveBeat()
    }

    rainBackground?.clearInteraction()
    rainBackground?.setInteractionMode('idle')
    rainBackground?.setScrollEnergy(0)
    pointerState.visible = false

    if (pointerShell) {
      pointerShell.dataset.pointerState = 'hidden'
      animatePointerShell()
    }

    if (pointerRaf) {
      window.cancelAnimationFrame(pointerRaf)
      pointerRaf = 0
    }
    if (interactivePointerRaf) {
      window.cancelAnimationFrame(interactivePointerRaf)
      interactivePointerRaf = 0
    }
    if (surfaceAtmosphereRaf) {
      window.cancelAnimationFrame(surfaceAtmosphereRaf)
      surfaceAtmosphereRaf = 0
    }
    return
  }

  markMotionActive(1200)
})

if (pointerWakeLayer && !pointerWakeLayer.isConnected) {
  fxLayer?.append(pointerWakeLayer)
}

const scrollMotionState = {
  y: 0,
  time: performance.now(),
}

setAmbientPointerPosition(pointerState.targetX, pointerState.targetY)
primeScrollMotionState()

if (enhancedPointerEnabled) {
  document.body.classList.add('has-pointer-fx')
}

if (!supportsFinePointer || !supportsHoverPointer) {
  document.body.classList.add('has-touch-probe')
}

revealTargets.forEach((element, index) => {
  element.style.setProperty('--reveal-delay', `${Math.min(index % 5, 4) * 58}ms`)
  element.style.setProperty(
    '--reveal-offset-x',
    element.matches('.feed-item, .cover-log-item')
      ? '-18px'
      : element.matches('.channel-link')
        ? '18px'
        : '0px',
  )
  element.style.setProperty(
    '--reveal-offset-y',
    element.matches('.cover-panel, .cover-object, .evidence-card, .channel-register')
      ? '22px'
      : '16px',
  )
})

function setActiveSection(id: SectionId, observedRect?: DOMRectReadOnly) {
  if (activeSection === id) return

  const isInitialSection = activeSection === null

  activeSection = id
  visitedSections.add(id)
  document.body.dataset.section = id
  pageShell?.setAttribute('data-active-section', id)

  topNavLinks.forEach((link) => {
    const target = link.getAttribute('href')?.slice(1)
    const isActive = target === id

    link.classList.toggle('is-active', isActive)

    if (isActive) {
      link.setAttribute('aria-current', 'page')
    } else {
      link.removeAttribute('aria-current')
    }
  })

  registerItems.forEach((item) => {
    const itemId = item.dataset.registerItem as SectionId | undefined

    if (!itemId) return

    item.classList.toggle('is-active', itemId === id)
    item.classList.toggle('is-logged', visitedSections.has(itemId) && itemId !== id)
  })

  rainBackground?.setMood(id)

  if (isInitialSection) return

  pulsePageShellShift()

  const rect = observedRect ?? document.getElementById(id)?.getBoundingClientRect()
  if (rect) {
    rainBackground?.pushImpulse({
      x: window.innerWidth * 0.28,
      y: clamp(rect.top + 88, 96, window.innerHeight * 0.56),
      strength: id === 'cover' ? 0.5 : 0.62,
      kind: 'section',
    })
  }
}

if (sections.length > 0) {
  setActiveSection('cover')

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)

      if (visible[0]) {
        setActiveSection(visible[0].target.id as SectionId, visible[0].boundingClientRect)
      }
    },
    {
      rootMargin: '-30% 0px -42% 0px',
      threshold: [0.2, 0.38, 0.55, 0.72],
    },
  )

  sections.forEach((section) => sectionObserver.observe(section))
}

if (revealTargets.length > 0) {
  if (prefersReducedMotion) {
    revealTargets.forEach((element) => element.classList.add('is-visible'))
  } else {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const element = entry.target as HTMLElement
          const isVisible = entry.isIntersecting && entry.intersectionRatio >= 0.14

          if (isVisible) {
            if (activeRevealTargets.has(element)) return

            activeRevealTargets.add(element)
            element.classList.add('is-visible')
            pulseTransientState(element, 'is-revealing', 820, revealPulseTimers)

            const rect = entry.boundingClientRect

            rainBackground?.pushImpulse({
              x: rect.left + rect.width * 0.34,
              y: clamp(rect.top + rect.height * 0.4, 92, window.innerHeight - 92),
              strength: element.matches('.feed-item, .channel-link')
                ? 0.46
                : element.matches('.cover-log-item')
                  ? 0.38
                  : 0.3,
              kind: 'hover',
            })

            return
          }

          if (!activeRevealTargets.has(element)) return

          activeRevealTargets.delete(element)
          clearTransientState(element, 'is-revealing', revealPulseTimers)
        })
      },
      {
        rootMargin: '0px 0px -10% 0px',
        threshold: [0, 0.14, 0.28],
      },
    )

    revealTargets.forEach((element) => revealObserver.observe(element))
  }
}

interactiveTargets.forEach((element) => {
  const focusTarget = (event?: FocusEvent | PointerEvent) => {
    const pointerEvent = event instanceof PointerEvent ? event : undefined

    rememberInteractionSnapshot(element)

    if (pointerEvent) {
      writeLocalPointerPosition(element, pointerEvent)
      syncPointer(pointerEvent)
    } else if (enhancedPointerEnabled) {
      const rect = element.getBoundingClientRect()
      pointerState.targetX = rect.left + rect.width / 2
      pointerState.targetY = rect.top + rect.height / 2
      pointerState.visible = true
      animatePointerShell()
    }

    setInteractiveFocus(element, pointerEvent)
  }

  const moveTarget = (event: PointerEvent) => {
    queueInteractivePointer(element, event)
  }

  const clearTarget = () => {
    endPointerCharge(element)
    if (queuedInteractiveElement === element) {
      queuedInteractiveElement = null
    }
    clearLocalPointerPosition(element)

    if (activeInteractiveTarget === element) {
      clearInteractiveFocus(element)
    }
  }

  const pressTarget = (event: PointerEvent) => {
    if (event.button !== 0) return

    element.classList.remove('is-pressed')
    window.requestAnimationFrame(() => {
      element.classList.add('is-pressed')
    })

    if (!prefersReducedMotion && supportsImpactWave(element)) {
      pulseTransientState(
        element,
        'is-struck',
        element.matches('.feed-item, .channel-link, .cover-object') ? 620 : 480,
        strikePulseTimers,
      )
      spawnImpactWave(event, element)
    }

    if (enhancedPointerEnabled) {
      pulsePointerShell()
      spawnClickStamp(event, element)
      beginPointerCharge(element)
    } else {
      spawnTouchProbeRipple(event, element)
    }

    rainBackground?.pushImpulse({
      x: event.clientX,
      y: event.clientY,
      strength: 0.92,
      kind: 'click',
    })
  }

  const releaseTarget = () => {
    endPointerCharge(element)
    window.setTimeout(() => element.classList.remove('is-pressed'), 160)
  }

  element.addEventListener('pointerenter', focusTarget)
  element.addEventListener('pointermove', moveTarget, { passive: true })
  element.addEventListener('focus', focusTarget)
  element.addEventListener('pointerleave', clearTarget)
  element.addEventListener('blur', clearTarget)
  element.addEventListener('pointerdown', pressTarget)
  element.addEventListener('pointerup', releaseTarget)
  element.addEventListener('pointercancel', releaseTarget)
})

setupSignalAxisDashboard()

coverAtmosphereTargets.forEach((element) => {
  const moveSurface = (event: PointerEvent) => {
    queueSurfaceAtmosphere(element, event)
  }

  const clearSurface = () => {
    queuedSurfaceAtmospheres.delete(element)
    clearSurfaceAtmosphere(element)
  }

  element.addEventListener('pointerenter', moveSurface, { passive: true })
  element.addEventListener('pointermove', moveSurface, { passive: true })
  element.addEventListener('pointerleave', clearSurface)
  element.addEventListener('pointercancel', clearSurface)
})

window.addEventListener(
  'pointermove',
  (event) => {
    syncPointer(event)
  },
  { passive: true },
)

window.addEventListener('pointerleave', () => {
  pointerState.visible = false
  lastWakeAt = 0
  if (pointerShell) {
    pointerShell.dataset.pointerState = activeInteractiveTarget ? 'armed' : 'hidden'
  }
  animatePointerShell()
})

if (window.location.hash) {
  const target = document.getElementById(window.location.hash.slice(1))

  if (target) {
    window.setTimeout(() => {
      target.scrollIntoView({
        block: 'start',
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      })
    }, 60)
  }
}

function setupSignalAxisDashboard() {
  if (!signalMap || signalAxisButtons.length === 0) return

  const map = signalMap
  const metricValues = [signalMetricA, signalMetricB, signalMetricC]
  const metricLabels = [signalMetricALabel, signalMetricBLabel, signalMetricCLabel]

  signalAxisButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
      const axis = readSignalAxis(button)
      if (!axis) return
      setActiveSignalAxis(axis, button)
    })

    button.addEventListener('keydown', (event) => {
      const key = event.key
      if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(key)) return

      event.preventDefault()
      const lastIndex = signalAxisButtons.length - 1
      const nextIndex =
        key === 'Home'
          ? 0
          : key === 'End'
            ? lastIndex
            : key === 'ArrowDown' || key === 'ArrowRight'
              ? (index + 1) % signalAxisButtons.length
              : (index - 1 + signalAxisButtons.length) % signalAxisButtons.length
      const nextButton = signalAxisButtons[nextIndex]
      const axis = readSignalAxis(nextButton)

      nextButton.focus()
      if (axis) setActiveSignalAxis(axis, nextButton)
    })
  })

  const initialButton = signalAxisButtons.find((button) => button.classList.contains('is-active')) || signalAxisButtons[0]
  const initialAxis = readSignalAxis(initialButton)
  if (initialAxis) {
    applySignalAxisProfile(initialAxis, { animate: false })
  }

  function setActiveSignalAxis(axis: SignalAxisKey, source: HTMLElement) {
    applySignalAxisProfile(axis, { animate: true, source })
  }

  function applySignalAxisProfile(
    axis: SignalAxisKey,
    options: { animate: boolean; source?: HTMLElement },
  ) {
    const profile = signalAxisProfiles[axis]

    map.dataset.activeAxis = profile.axis
    document.body.dataset.signalAxis = profile.axis

    signalAxisButtons.forEach((button) => {
      const selected = readSignalAxis(button) === profile.axis
      button.classList.toggle('is-active', selected)
      button.setAttribute('aria-selected', selected ? 'true' : 'false')
      button.tabIndex = selected ? 0 : -1
    })

    writeText(signalDetailKicker, profile.detailKicker)
    writeText(signalDetailTitle, profile.detailTitle)
    writeText(signalDetailCopy, profile.detailCopy)
    writeText(signalDashboardTitle, profile.dashboardTitle)
    writeText(signalDashboardStatus, profile.dashboardStatus)

    if (signalDetailLink) {
      signalDetailLink.href = profile.detailHref
      signalDetailLink.textContent = profile.detailCta
    }

    profile.metrics.forEach((metric, metricIndex) => writeText(metricValues[metricIndex], metric))
    profile.metricLabels.forEach((label, metricIndex) => writeText(metricLabels[metricIndex], label))

    if (!options.animate) return

    map.classList.remove('is-switching')
    void map.offsetWidth
    map.classList.add('is-switching')
    window.clearTimeout(signalSwitchTimer)
    signalSwitchTimer = window.setTimeout(() => map.classList.remove('is-switching'), 680)

    markMotionActive(1300)

    if (prefersReducedMotion) return

    const rect = options.source?.getBoundingClientRect() || map.getBoundingClientRect()
    rainBackground?.pushImpulse({
      x: clamp(rect.left + rect.width * 0.52, 80, window.innerWidth - 80),
      y: clamp(rect.top + rect.height * 0.52, 92, window.innerHeight - 92),
      strength: profile.axis === 'agent' ? 0.72 : profile.axis === 'field' ? 0.82 : 0.76,
      kind: 'section',
    })
  }
}

function readSignalAxis(element?: HTMLElement | null): SignalAxisKey | null {
  const axis = element?.dataset.signalAxis
  return axis === 'agent' || axis === 'field' || axis === 'tool' ? axis : null
}

function writeText(element: HTMLElement | null, value: string) {
  if (element) element.textContent = value
}

function animatePointerShell() {
  if (!pointerShell || pointerRaf) return

  const frame = () => {
    pointerState.x += (pointerState.targetX - pointerState.x) * 0.22
    pointerState.y += (pointerState.targetY - pointerState.y) * 0.22

    pointerShell.style.transform = `translate3d(${pointerState.x}px, ${pointerState.y}px, 0)`
    pointerShell.style.opacity = pointerState.visible ? '1' : '0'

    const drift =
      Math.abs(pointerState.targetX - pointerState.x) +
      Math.abs(pointerState.targetY - pointerState.y)
    const shellState = pointerShell.dataset.pointerState
    const shouldContinue =
      drift > 0.24 ||
      shellState === 'pressed' ||
      shellState === 'charging'

    if (shouldContinue) {
      pointerRaf = window.requestAnimationFrame(frame)
      return
    }

    pointerRaf = 0
  }

  pointerRaf = window.requestAnimationFrame(frame)
}

function syncPointer(event: PointerEvent) {
  if (!enhancedPointerEnabled) return

  markMotionActive(1500)
  pointerState.targetX = event.clientX
  pointerState.targetY = event.clientY
  pointerState.visible = true
  animatePointerShell()

  if (!pointerSyncRaf) {
    pointerSyncRaf = window.requestAnimationFrame(flushPointerSync)
  }
}

function flushPointerSync() {
  pointerSyncRaf = 0
  setAmbientPointerPosition(pointerState.targetX, pointerState.targetY)
  spawnPointerWake(pointerState.targetX, pointerState.targetY)

  if (pointerShell && pointerShell.dataset.pointerState === 'hidden') {
    pointerShell.dataset.pointerState = activeInteractiveTarget ? 'armed' : 'idle'
  }
}

function queueInteractivePointer(element: HTMLElement, event: PointerEvent) {
  syncPointer(event)
  queuedInteractiveElement = element
  queuedInteractiveX = event.clientX
  queuedInteractiveY = event.clientY

  if (!interactivePointerRaf) {
    interactivePointerRaf = window.requestAnimationFrame(flushInteractivePointer)
  }
}

function flushInteractivePointer() {
  interactivePointerRaf = 0

  const element = queuedInteractiveElement
  if (!element) return

  const point = {
    clientX: queuedInteractiveX,
    clientY: queuedInteractiveY,
  }

  writeLocalPointerPosition(element, point)

  if (activeInteractiveTarget === element) {
    rainBackground?.setInteraction(getInteractionTarget(element, point))
  }
}

function queueSurfaceAtmosphere(element: HTMLElement, event: PointerEvent) {
  markMotionActive(1500)
  queuedSurfaceAtmospheres.set(element, {
    x: event.clientX,
    y: event.clientY,
  })

  if (!surfaceAtmosphereRaf) {
    surfaceAtmosphereRaf = window.requestAnimationFrame(flushSurfaceAtmospheres)
  }
}

function flushSurfaceAtmospheres() {
  surfaceAtmosphereRaf = 0

  queuedSurfaceAtmospheres.forEach((point, element) => {
    writeSurfaceAtmosphere(element, {
      clientX: point.x,
      clientY: point.y,
    })
  })
  queuedSurfaceAtmospheres.clear()
}

function setInteractiveFocus(
  element: HTMLElement,
  event?: PointerEvent,
) {
  markMotionActive(1800)
  if (activeInteractiveTarget && activeInteractiveTarget !== element) {
    activeInteractiveTarget.classList.remove('is-hot')
    activeInteractiveTarget.classList.remove('is-charging', 'is-routing')
  }

  rememberInteractionSnapshot(element)
  activeInteractiveTarget = element
  element.classList.add('is-hot')

  const label = getPointerLabel(element)

  if (pointerLabel) {
    pointerLabel.textContent = label
  }

  if (pointerShell) {
    pointerShell.dataset.pointerState = 'armed'
    pointerShell.dataset.pointerLabel = label
    pointerShell.dataset.pointerMode = getPointerMode(element)
    writePointerTargetGeometry(pointerShell, element)
    animatePointerShell()
  }

  document.body.dataset.pointerMode = getPointerMode(element)

  rainBackground?.setInteractionMode(getInteractionMode(element))

  const interactionTarget = getInteractionTarget(element, event)
  if (!event && element.classList.contains('channel-link')) {
    primeRouteSignal(element)
  }
  setAmbientPointerPosition(interactionTarget.x, interactionTarget.y)
  rainBackground?.setInteraction(interactionTarget)
  rainBackground?.pushImpulse({
    x: interactionTarget.x,
    y: interactionTarget.y,
    strength: 0.42,
    kind: 'hover',
  })
  beginInteractiveBeat(element)
}

function clearInteractiveFocus(element: HTMLElement) {
  element.classList.remove('is-hot')
  element.classList.remove('is-charging', 'is-routing')

  if (activeInteractiveTarget === element) {
    activeInteractiveTarget = null
    stopInteractiveBeat()
  }

  if (pointerLabel) {
    pointerLabel.textContent = 'probe'
  }

  if (pointerShell) {
    pointerShell.dataset.pointerState = pointerState.visible ? 'idle' : 'hidden'
    pointerShell.dataset.pointerLabel = 'probe'
    pointerShell.dataset.pointerKind = 'idle'
    pointerShell.dataset.pointerMode = 'default'
    pointerShell.style.removeProperty('--pointer-target-w')
    pointerShell.style.removeProperty('--pointer-target-h')
    pointerShell.style.removeProperty('--pointer-target-r')
    animatePointerShell()
  }

  document.body.dataset.pointerMode = 'default'

  rainBackground?.setInteractionMode('idle')
  rainBackground?.clearInteraction()
}

function beginInteractiveBeat(element: HTMLElement) {
  if (prefersReducedMotion) return

  window.clearInterval(interactiveBeatTimer)

  const isRoute = element.classList.contains('channel-link')
  if (!isRoute) return

  const beatInterval = 2600

  const beat = () => {
    if (activeInteractiveTarget !== element) return

    const interactionTarget = getInteractionTarget(element)
    pulseTransientState(element, 'is-charging', 620, chargePulseTimers)

    if (isRoute) {
      pulseTransientState(element, 'is-routing', 760, routePulseTimers)
      primeRouteSignal(element)
    }

    setAmbientPointerPosition(interactionTarget.x, interactionTarget.y)
    rainBackground?.setInteraction(interactionTarget)
    rainBackground?.pushImpulse({
      x: interactionTarget.x,
      y: interactionTarget.y,
      strength: 0.28,
      kind: 'hover',
    })
  }

  beat()
  interactiveBeatTimer = window.setInterval(beat, beatInterval)
}

function stopInteractiveBeat() {
  if (!interactiveBeatTimer) return

  window.clearInterval(interactiveBeatTimer)
  interactiveBeatTimer = 0
}

function getInteractionTarget(
  element: HTMLElement,
  event?: PointerPoint,
) {
  const { rect, color } = getInteractionSnapshot(element)
  const radius = clamp(Math.min(rect.width, rect.height) * 0.58, 74, 220)

  return {
    x:
      event?.clientX ??
      (rect.width > 420
        ? rect.left + Math.min(rect.width * 0.38, 280)
        : rect.left + rect.width / 2),
    y: event?.clientY ?? rect.top + rect.height / 2,
    radius,
    color,
    energy: element.classList.contains('channel-link')
      ? 1.22
      : element.classList.contains('cover-object')
        ? 1.18
        : element.classList.contains('feed-item')
          ? 1.06
          : 0.92,
  }
}

function rememberInteractionSnapshot(element: HTMLElement) {
  const snapshot = {
    rect: element.getBoundingClientRect(),
    color: readSignalColor(element),
  }

  interactionSnapshots.set(element, snapshot)

  return snapshot
}

function getInteractionSnapshot(element: HTMLElement) {
  const snapshot = interactionSnapshots.get(element)

  if (snapshot) return snapshot

  return rememberInteractionSnapshot(element)
}

function readSignalColor(element: HTMLElement): [number, number, number] | undefined {
  const computed = window.getComputedStyle(element)
  const raw =
    computed.getPropertyValue('--route-rgb').trim() ||
    computed.getPropertyValue('--section-rgb').trim() ||
    window.getComputedStyle(document.body).getPropertyValue('--section-rgb').trim() ||
    window.getComputedStyle(document.documentElement).getPropertyValue('--section-rgb').trim()
  const parts = raw
    .split(/[\s,]+/)
    .map((part) => Number.parseFloat(part))
    .filter((value) => Number.isFinite(value))

  if (parts.length < 3) return undefined

  return [
    clamp(parts[0] ?? 155, 0, 255),
    clamp(parts[1] ?? 188, 0, 255),
    clamp(parts[2] ?? 209, 0, 255),
  ]
}

function getPointerLabel(element: HTMLElement) {
  return (
    element.dataset.pointerLabel ??
    (element.classList.contains('feed-item')
      ? 'scan'
      : element.classList.contains('channel-link')
        ? 'index'
        : element.classList.contains('evidence-card')
          ? 'inspect'
        : 'open')
  )
}

function getPointerMode(element: HTMLElement): PointerMode {
  const explicitMode = element.dataset.pointerMode
  if (
    explicitMode === 'scan' ||
    explicitMode === 'terminal' ||
    explicitMode === 'index' ||
    explicitMode === 'launch'
  ) {
    return explicitMode
  }

  const label = getPointerLabel(element)
  const href = element instanceof HTMLAnchorElement ? element.href : ''
  const route = element.dataset.route || ''

  if (label === 'scan' || label === 'builds' || label === 'pull' || element.classList.contains('feed-item')) {
    return 'scan'
  }

  if (label === 'term' || label === 'logs' || route === 'workflow' || href.includes('/workflow')) {
    return 'terminal'
  }

  if (label === 'index' || route === 'archive' || href.includes('/archive')) {
    return 'index'
  }

  if (label === 'jump' || label === 'open' || href.includes('github.com')) {
    return 'launch'
  }

  return 'default'
}

function writePointerTargetGeometry(pointerShellElement: HTMLElement, element: HTMLElement) {
  const { rect } = getInteractionSnapshot(element)
  const mode = getPointerMode(element)
  const kind = mode === 'terminal'
    ? 'terminal'
    : mode === 'index'
      ? 'index'
      : mode === 'launch'
        ? 'launch'
        : element.classList.contains('channel-link')
          ? 'route'
          : element.classList.contains('feed-item')
            ? 'feed'
            : element.classList.contains('cover-object')
              ? 'inspect'
              : element.matches('.primary-link, .secondary-link, .cover-object-link')
                ? 'action'
                : 'link'
  const targetWidth =
    kind === 'route' || kind === 'feed' || kind === 'terminal'
      ? clamp(rect.width * 0.22, 78, 168)
      : kind === 'index'
        ? clamp(rect.width * 0.18, 54, 118)
        : kind === 'launch'
          ? clamp(rect.width * 0.3, 64, 138)
      : kind === 'inspect'
        ? clamp(Math.min(rect.width, rect.height) * 0.4, 68, 122)
        : kind === 'action'
          ? clamp(rect.width * 0.42, 58, 132)
          : 54
  const targetHeight =
    kind === 'route' || kind === 'feed'
      ? clamp(rect.height * 0.68, 42, 76)
      : kind === 'terminal'
        ? clamp(rect.height * 0.86, 46, 86)
        : kind === 'index'
          ? clamp(rect.height * 0.52, 38, 68)
          : kind === 'launch'
            ? clamp(rect.height * 0.72, 42, 74)
      : kind === 'inspect'
        ? clamp(Math.min(rect.width, rect.height) * 0.34, 60, 104)
        : kind === 'action'
          ? clamp(rect.height * 0.92, 42, 58)
          : 54

  pointerShellElement.dataset.pointerKind = kind
  pointerShellElement.dataset.pointerMode = mode
  pointerShellElement.style.setProperty('--pointer-target-w', `${targetWidth.toFixed(1)}px`)
  pointerShellElement.style.setProperty('--pointer-target-h', `${targetHeight.toFixed(1)}px`)
  pointerShellElement.style.setProperty(
    '--pointer-target-r',
    kind === 'link' || kind === 'index' ? '999px' : kind === 'action' ? '10px' : '16px',
  )
}

function writeLocalPointerPosition(element: HTMLElement, event: PointerPoint) {
  const { rect } = getInteractionSnapshot(element)
  const localX = event.clientX - rect.left
  const localY = event.clientY - rect.top
  const xRatio = clamp(localX / Math.max(rect.width, 1), 0, 1)
  const yRatio = clamp(localY / Math.max(rect.height, 1), 0, 1)
  const membraneDriftX = (xRatio - 0.5) * 4.8
  const membraneDriftY = (yRatio - 0.5) * 3.8

  element.style.setProperty('--pointer-local-x', `${localX}px`)
  element.style.setProperty('--pointer-local-y', `${localY}px`)
  element.style.setProperty('--membrane-drift-x', `${membraneDriftX.toFixed(2)}px`)
  element.style.setProperty('--membrane-drift-y', `${membraneDriftY.toFixed(2)}px`)
  element.style.setProperty('--membrane-drift-x-soft', `${(membraneDriftX * 0.62).toFixed(2)}px`)
  element.style.setProperty('--membrane-skew-soft', `${((xRatio - 0.5) * 1.6).toFixed(2)}deg`)
  element.style.setProperty(
    '--membrane-stretch',
    (0.006 + Math.abs(xRatio - 0.5) * 0.016).toFixed(3),
  )

  if (element.classList.contains('channel-link')) {
    const routeRatio = clamp((localY - 18) / Math.max(rect.height - 36, 1), 0, 1)
    const routeEnergy = clamp(
      0.42 + (1 - Math.abs(xRatio - 0.44) * 1.45) * 0.48 + (1 - Math.abs(routeRatio - 0.46)) * 0.14,
      0.4,
      1,
    )

    element.style.setProperty(
      '--route-trace-x',
      `${clamp(localX, 84, rect.width - 74)}px`,
    )
    element.style.setProperty(
      '--route-trace-y',
      `${clamp(localY, 20, rect.height - 20)}px`,
    )
    element.style.setProperty('--route-flow-ratio', routeRatio.toFixed(3))
    element.style.setProperty('--route-flow-y', `${clamp(18 + routeRatio * 64, 18, 82).toFixed(1)}%`)
    element.style.setProperty('--route-energy', routeEnergy.toFixed(3))
    element.style.setProperty('--route-phase', xRatio.toFixed(3))
  }
}

function clearLocalPointerPosition(element: HTMLElement) {
  interactionSnapshots.delete(element)
  element.style.removeProperty('--pointer-local-x')
  element.style.removeProperty('--pointer-local-y')
  element.style.removeProperty('--route-trace-x')
  element.style.removeProperty('--route-trace-y')
  element.style.removeProperty('--route-flow-ratio')
  element.style.removeProperty('--route-flow-y')
  element.style.removeProperty('--route-energy')
  element.style.removeProperty('--route-phase')
  element.style.removeProperty('--membrane-drift-x')
  element.style.removeProperty('--membrane-drift-y')
  element.style.removeProperty('--membrane-drift-x-soft')
  element.style.removeProperty('--membrane-skew-soft')
  element.style.removeProperty('--membrane-stretch')
}

function primeRouteSignal(element: HTMLElement) {
  if (!element.classList.contains('channel-link')) return

  element.style.setProperty('--route-trace-x', '10.2rem')
  element.style.setProperty('--route-trace-y', '1.72rem')
  element.style.setProperty('--route-flow-ratio', '0.46')
  element.style.setProperty('--route-flow-y', '46%')
  element.style.setProperty('--route-energy', '0.78')
  element.style.setProperty('--route-phase', '0.44')
}

function pulsePointerShell() {
  if (!pointerShell) return

  window.clearTimeout(pointerPressTimer)
  pointerShell.dataset.pointerState = 'pressed'
  animatePointerShell()

  pointerPressTimer = window.setTimeout(() => {
    pointerShell.dataset.pointerState = activeInteractiveTarget ? 'armed' : pointerState.visible ? 'idle' : 'hidden'
    animatePointerShell()
  }, 170)
}

function beginPointerCharge(element: HTMLElement) {
  if (!pointerShell) return

  window.clearTimeout(pointerChargeTimer)
  pointerChargeTimer = window.setTimeout(() => {
    if (activeInteractiveTarget && activeInteractiveTarget !== element) return

    element.classList.add('is-charging')
    pointerShell.dataset.pointerState = 'charging'
    pointerShell.dataset.pointerMode = getPointerMode(element)
    pointerShell.dataset.pointerLabel = `${getPointerLabel(element)}+`
    animatePointerShell()

    const interactionTarget = getInteractionTarget(element)
    rainBackground?.pushImpulse({
      x: interactionTarget.x,
      y: interactionTarget.y,
      strength: 0.68,
      kind: 'click',
    })
  }, 340)
}

function endPointerCharge(element: HTMLElement) {
  window.clearTimeout(pointerChargeTimer)
  pointerChargeTimer = 0
  element.classList.remove('is-charging')

  if (!pointerShell) return

  pointerShell.dataset.pointerState = activeInteractiveTarget ? 'armed' : pointerState.visible ? 'idle' : 'hidden'
  pointerShell.dataset.pointerLabel = activeInteractiveTarget ? getPointerLabel(activeInteractiveTarget) : 'probe'
  pointerShell.dataset.pointerMode = activeInteractiveTarget ? getPointerMode(activeInteractiveTarget) : 'default'
  animatePointerShell()
}

function spawnClickStamp(event: PointerEvent, element: HTMLElement) {
  if (!clickLayer) return

  const stamp = document.createElement('span')
  stamp.className = 'click-stamp'
  stamp.dataset.label = getPointerLabel(element)
  stamp.dataset.mode = getPointerMode(element)
  stamp.style.setProperty('--stamp-x', `${event.clientX}px`)
  stamp.style.setProperty('--stamp-y', `${event.clientY}px`)
  clickLayer.appendChild(stamp)
  stamp.addEventListener('animationend', () => stamp.remove(), { once: true })
}

function spawnTouchProbeRipple(event: PointerEvent, element: HTMLElement) {
  if (!clickLayer || prefersReducedMotion) return

  const ripple = document.createElement('span')
  ripple.className = 'touch-probe-ripple'
  ripple.dataset.mode = getPointerMode(element)
  ripple.dataset.label = getPointerLabel(element)
  ripple.style.setProperty('--touch-x', `${event.clientX}px`)
  ripple.style.setProperty('--touch-y', `${event.clientY}px`)
  clickLayer.appendChild(ripple)

  while (clickLayer.querySelectorAll('.touch-probe-ripple').length > 6) {
    clickLayer.querySelector('.touch-probe-ripple')?.remove()
  }

  ripple.addEventListener('animationend', () => ripple.remove(), { once: true })
}

function spawnPointerWake(x: number, y: number) {
  if (!enhancedPointerEnabled || !pointerWakeLayer) return

  const now = performance.now()
  const dx = x - lastWakeX
  const dy = y - lastWakeY
  const distance = Math.hypot(dx, dy)
  const dt = Math.max(now - lastWakeAt, 16)

  if ((!activeInteractiveTarget && distance < 72) || distance < 20 || dt < 80) return

  const wake = document.createElement('span')
  const speed = clamp(distance / dt, 0.12, 1.8)
  const angle = Math.atan2(dy, dx)
  const length = clamp(26 + distance * 0.72 + speed * 24, 34, 96)
  const strength = clamp(0.42 + speed * 0.22, 0.42, 0.94)

  wake.className = 'pointer-wake'
  wake.style.setProperty('--wake-x', `${x}px`)
  wake.style.setProperty('--wake-y', `${y}px`)
  wake.style.setProperty('--wake-angle', `${angle}rad`)
  wake.style.setProperty('--wake-length', `${length.toFixed(1)}px`)
  wake.style.setProperty('--wake-strength', strength.toFixed(3))
  pointerWakeLayer.appendChild(wake)

  while (pointerWakeLayer.childElementCount > 8) {
    pointerWakeLayer.firstElementChild?.remove()
  }

  wake.addEventListener('animationend', () => wake.remove(), { once: true })
  lastWakeAt = now
  lastWakeX = x
  lastWakeY = y
}

function spawnImpactWave(event: PointerEvent, element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  const impact = document.createElement('span')
  const impactKind = element.matches('.primary-link, .secondary-link, .cover-object-link')
    ? 'button'
    : element.matches('.feed-item, .channel-link, .cover-object')
      ? 'surface'
      : 'link'

  impact.className = `impact-wave impact-wave--${impactKind}`
  impact.style.left = `${event.clientX - rect.left}px`
  impact.style.top = `${event.clientY - rect.top}px`
  impact.style.setProperty('--impact-span', `${Math.max(rect.width, rect.height)}px`)
  element.appendChild(impact)
  impact.addEventListener('animationend', () => impact.remove(), { once: true })
}

function supportsImpactWave(element: HTMLElement) {
  return element.matches(
    '.primary-link, .secondary-link, .cover-object-link, .cover-log-item, .feed-item, .channel-link, .cover-object',
  )
}

function pulsePageShellShift() {
  if (!pageShell) return

  window.clearTimeout(shellShiftTimer)
  pageShell.classList.add('is-section-shifting')

  shellShiftTimer = window.setTimeout(() => {
    pageShell.classList.remove('is-section-shifting')
  }, 860)
}

function setAmbientPointerPosition(x: number, y: number) {
  const xRatio = clamp(x / Math.max(window.innerWidth, 1), 0, 1)
  const yRatio = clamp(y / Math.max(window.innerHeight, 1), 0, 1)
  const driftX = (xRatio - 0.5) * 6.4
  const driftY = (yRatio - 0.5) * 4.8

  document.documentElement.style.setProperty('--ambient-x', `${x}px`)
  document.documentElement.style.setProperty('--ambient-y', `${y}px`)
  document.documentElement.style.setProperty('--global-membrane-drift-x', `${driftX.toFixed(2)}px`)
  document.documentElement.style.setProperty('--global-membrane-drift-y', `${driftY.toFixed(2)}px`)
  document.documentElement.style.setProperty('--global-membrane-drift-x-soft', `${(driftX * 0.52).toFixed(2)}px`)
  document.documentElement.style.setProperty('--global-membrane-skew', `${((xRatio - 0.5) * 1.55).toFixed(2)}deg`)
  document.documentElement.style.setProperty(
    '--global-membrane-stretch',
    (0.004 + Math.abs(xRatio - 0.5) * 0.012).toFixed(3),
  )
}

function getInteractionMode(
  element: HTMLElement,
): 'idle' | 'cover' | 'feed' | 'route' | 'action' {
  if (element.classList.contains('channel-link')) {
    return 'route'
  }

  if (element.classList.contains('feed-item') || element.classList.contains('cover-log-item')) {
    return 'feed'
  }

  if (element.classList.contains('cover-object')) {
    return 'cover'
  }

  return 'action'
}

function pulseTransientState(
  element: HTMLElement,
  className: string,
  duration: number,
  timers: WeakMap<HTMLElement, number>,
) {
  const timer = timers.get(element)

  if (timer) {
    window.clearTimeout(timer)
  }

  element.classList.add(className)

  const nextTimer = window.setTimeout(() => {
    element.classList.remove(className)
    timers.delete(element)
  }, duration)

  timers.set(element, nextTimer)
}

function clearTransientState(
  element: HTMLElement,
  className: string,
  timers: WeakMap<HTMLElement, number>,
) {
  const timer = timers.get(element)

  if (timer) {
    window.clearTimeout(timer)
    timers.delete(element)
  }

  element.classList.remove(className)
}

function writeSurfaceAtmosphere(element: HTMLElement, event: PointerPoint) {
  const { rect } = getInteractionSnapshot(element)
  const xRatio = clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1)
  const yRatio = clamp((event.clientY - rect.top) / Math.max(rect.height, 1), 0, 1)
  const tiltX = ((0.5 - yRatio) * 1.6).toFixed(2)
  const tiltY = ((xRatio - 0.5) * 2.2).toFixed(2)
  const shiftX = ((xRatio - 0.5) * 4).toFixed(2)
  const shiftY = ((yRatio - 0.5) * 4).toFixed(2)
  const membraneDriftX = (xRatio - 0.5) * 3.2
  const membraneDriftY = (yRatio - 0.5) * 2.4
  const membraneSkew = (xRatio - 0.5) * 1.35
  const membraneStretch = 0.004 + Math.abs(xRatio - 0.5) * 0.012
  const membraneLift = -1.6 - (1 - yRatio) * 1.8
  const membraneRotate = (xRatio - 0.5) * 0.72
  const membraneEdge = clamp(1.2 + yRatio * 4.2, 1.2, 5.4)

  element.classList.add('is-surfing')
  element.style.setProperty('--surface-glow-x', `${(xRatio * 100).toFixed(2)}%`)
  element.style.setProperty('--surface-glow-y', `${(yRatio * 100).toFixed(2)}%`)
  element.style.setProperty('--surface-tilt-x', `${tiltX}deg`)
  element.style.setProperty('--surface-tilt-y', `${tiltY}deg`)
  element.style.setProperty('--surface-shift-x', `${shiftX}px`)
  element.style.setProperty('--surface-shift-y', `${shiftY}px`)
  element.style.setProperty('--membrane-drift-x', `${membraneDriftX.toFixed(2)}px`)
  element.style.setProperty('--membrane-drift-y', `${membraneDriftY.toFixed(2)}px`)
  element.style.setProperty('--membrane-drift-x-soft', `${(membraneDriftX * 0.62).toFixed(2)}px`)
  element.style.setProperty('--membrane-drift-y-soft', `${(membraneDriftY * 0.62).toFixed(2)}px`)
  element.style.setProperty('--membrane-drift-x-hard', `${(membraneDriftX * 1.34).toFixed(2)}px`)
  element.style.setProperty('--membrane-skew', `${membraneSkew.toFixed(2)}deg`)
  element.style.setProperty('--membrane-skew-soft', `${(membraneSkew * 0.52).toFixed(2)}deg`)
  element.style.setProperty('--membrane-stretch', membraneStretch.toFixed(3))
  element.style.setProperty('--membrane-lift', `${membraneLift.toFixed(2)}px`)
  element.style.setProperty('--membrane-rotate', `${membraneRotate.toFixed(2)}deg`)
  element.style.setProperty('--membrane-edge-y', `${membraneEdge.toFixed(2)}%`)
}

function clearSurfaceAtmosphere(element: HTMLElement) {
  interactionSnapshots.delete(element)
  element.classList.remove('is-surfing')
  element.style.removeProperty('--surface-glow-x')
  element.style.removeProperty('--surface-glow-y')
  element.style.removeProperty('--surface-tilt-x')
  element.style.removeProperty('--surface-tilt-y')
  element.style.removeProperty('--surface-shift-x')
  element.style.removeProperty('--surface-shift-y')
  element.style.removeProperty('--membrane-drift-x')
  element.style.removeProperty('--membrane-drift-y')
  element.style.removeProperty('--membrane-drift-x-soft')
  element.style.removeProperty('--membrane-drift-y-soft')
  element.style.removeProperty('--membrane-drift-x-hard')
  element.style.removeProperty('--membrane-skew')
  element.style.removeProperty('--membrane-skew-soft')
  element.style.removeProperty('--membrane-stretch')
  element.style.removeProperty('--membrane-lift')
  element.style.removeProperty('--membrane-rotate')
  element.style.removeProperty('--membrane-edge-y')
}

function markMotionActive(duration = 1800) {
  if (document.hidden) return

  setBodyMotionState('active')
  window.clearTimeout(motionIdleTimer)
  motionIdleTimer = window.setTimeout(() => {
    setBodyMotionState('idle')
    motionIdleTimer = 0
  }, duration)
}

function setBodyMotionState(state: MotionState) {
  if (document.body.dataset.motionState === state) return

  document.body.dataset.motionState = state
}

function setScrollDirection(direction: ScrollDirection) {
  if (document.body.dataset.scrollDir === direction) return

  document.body.dataset.scrollDir = direction
}

function setRootCssProperty(name: string, value: string) {
  if (document.documentElement.style.getPropertyValue(name) === value) return

  document.documentElement.style.setProperty(name, value)
}

function primeScrollMotionState() {
  if (scrollMetricsPrimeRaf) return

  scrollMetricsPrimeRaf = window.requestAnimationFrame(() => {
    scrollMetricsPrimeRaf = 0
    scrollMotionState.y = window.scrollY
    scrollMotionState.time = performance.now()
  })
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function updateScrollAmbient() {
  const now = performance.now()
  const nextY = window.scrollY
  const delta = Math.abs(nextY - scrollMotionState.y)
  const dt = Math.max(now - scrollMotionState.time, 16)
  const velocity = (delta / dt) * 1000
  const scrollable =
    document.documentElement.scrollHeight - window.innerHeight
  const scrollProgress = scrollable > 0 ? clamp(nextY / scrollable, 0, 1) : 0
  const scrollEnergy = clamp(velocity / 1800, 0, 1)
  const scrollDirection =
    nextY > scrollMotionState.y ? 'down' : nextY < scrollMotionState.y ? 'up' : 'still'

  markMotionActive(1200)
  setRootCssProperty('--scroll-progress', scrollProgress.toFixed(4))
  setRootCssProperty('--scroll-velocity', scrollEnergy.toFixed(3))
  setScrollDirection(scrollDirection)

  rainBackground?.setScrollEnergy(scrollEnergy)

  scrollMotionState.y = nextY
  scrollMotionState.time = now

  window.clearTimeout(scrollRestTimer)
  scrollRestTimer = window.setTimeout(() => {
    rainBackground?.setScrollEnergy(0)
    setRootCssProperty('--scroll-velocity', '0')
    setScrollDirection('still')
  }, 140)
}

function queueScrollAmbient() {
  interactionSnapshots = new WeakMap<HTMLElement, InteractionSnapshot>()

  if (scrollAmbientRaf) return

  scrollAmbientRaf = window.requestAnimationFrame(() => {
    scrollAmbientRaf = 0
    updateScrollAmbient()
  })
}

function updateQuietZones() {
  quietZoneRaf = 0
  if (!rainBackground || quietZoneTargets.length === 0) return

  rainBackground?.setQuietZones(
    quietZoneTargets.map((element) => {
      const rect = element.getBoundingClientRect()

      return {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      }
    }),
  )
}

function queueQuietZones() {
  if (quietZoneRaf || quietZoneTimer) return

  quietZoneTimer = window.setTimeout(() => {
    quietZoneTimer = 0
    quietZoneRaf = window.requestAnimationFrame(updateQuietZones)
  }, 90)
}

queueQuietZones()
window.addEventListener('resize', queueQuietZones)
window.addEventListener('resize', () => {
  interactionSnapshots = new WeakMap<HTMLElement, InteractionSnapshot>()
})
window.addEventListener('scroll', queueScrollAmbient, { passive: true })
window.addEventListener('scroll', queueQuietZones, { passive: true })
window.addEventListener('beforeunload', () => {
  if (pointerRaf) {
    window.cancelAnimationFrame(pointerRaf)
  }

  if (pointerSyncRaf) {
    window.cancelAnimationFrame(pointerSyncRaf)
  }

  if (scrollRestTimer) {
    window.clearTimeout(scrollRestTimer)
  }

  if (scrollAmbientRaf) {
    window.cancelAnimationFrame(scrollAmbientRaf)
  }

  if (scrollMetricsPrimeRaf) {
    window.cancelAnimationFrame(scrollMetricsPrimeRaf)
  }

  if (shellShiftTimer) {
    window.clearTimeout(shellShiftTimer)
  }

  if (quietZoneTimer) {
    window.clearTimeout(quietZoneTimer)
  }

  if (quietZoneRaf) {
    window.cancelAnimationFrame(quietZoneRaf)
  }

  if (motionIdleTimer) {
    window.clearTimeout(motionIdleTimer)
  }

  if (interactivePointerRaf) {
    window.cancelAnimationFrame(interactivePointerRaf)
  }

  if (surfaceAtmosphereRaf) {
    window.cancelAnimationFrame(surfaceAtmosphereRaf)
  }

  stopInteractiveBeat()
  systemTriptych.destroy()
  impactChoreography.destroy()
  signalReactor?.destroy()
  rainBackground?.destroy()
})
