import './global-effects.css'
import type {
  SignalCanvasController,
  SignalCanvasMode,
  SignalCanvasSnapshot,
} from './signal-canvas-layer'

type GlobalEffectsOptions = {
  context: 'home' | 'entry'
  reducedMotion: boolean
}

type PaletteCommand = {
  id: string
  title: string
  kicker: string
  url: string
  keywords: string
  action?: PaletteAction
  hidden?: boolean
}

type PaletteAction =
  | 'agent-core'
  | 'membrane-pulse'
  | 'debug-lines'
  | 'openclaw-burst'
  | 'xray'
  | 'visual-calm'
  | 'visual-storm'
  | 'visual-normal'
  | 'hyperstorm'
  | 'audio-toggle'

type SignalMode = 'calm' | 'storm' | 'normal'

type CommandPalette = {
  shell: HTMLElement
  trigger: HTMLButtonElement
  input: HTMLInputElement
  list: HTMLElement
  render: () => void
}

type CodeLineActivationOptions = {
  wrapper: HTMLElement
  button: HTMLButtonElement
  lineText: string
  lineNumber: number
  liveStatus: HTMLElement
  copyLine: boolean
}

type CodeLineRangeActivationOptions = {
  wrapper: HTMLElement
  startButton: HTMLButtonElement
  endButton: HTMLButtonElement
  lines: string[]
  liveStatus: HTMLElement
  copyRange: boolean
}

type HyperstormParticle = {
  x: number
  y: number
  vx: number
  vy: number
  phase: number
  size: number
  alpha: number
}

const routeDelay = 280
const routeStorageKey = 'feian-route-transition'
const signalModeStorageKey = 'feian-signal-mode'
const konamiSequence = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
]

const baseCommands: PaletteCommand[] = [
  command('home', '回到首页 / 信号膜', '首页 / home', '/index.html', '首页 home feian signal membrane'),
  command('workflow', '个人工作流账本', '工作流 / workflow', '/workflow.html', '工作流 codex claude agent'),
  command('field', '现场调试 / MCGS / MODBUS', '现场 / field', '/field.html', '现场 modbus mcgs incident rs485'),
  command('lab', '项目实验室', '项目 / lab', '/lab.html', 'lab 项目 实验 交付'),
  command('archive', '归档 / 时间线', '索引 / archive', '/archive.html', 'archive timeline 归档 时间线'),
  command('about', '关于 FEIAN', '关于 / profile', '/about.html', 'about profile 个人画像'),
  command('ohbp', 'OHBP / harnessbench 评测协议', '工作流案例 / workflow', '/workflow-harness-ohbp.html', 'ohbp harnessbench 评测 协议'),
  command('router', 'SkillOS Lite / Context Router', '工作流案例 / workflow', '/workflow-context-router.html', 'skillos context router 路由'),
  command('stock', '老板分身研究台 V1', '工作流案例 / workflow', '/workflow-stock-research-desk.html', '老板 分身 stock research desk'),
  command('protocol', '动环协议工作台', '项目案例 / lab', '/lab-protocol-studio.html', '协议 动环 protocol studio'),
  command('busbar', '母线槽选型平台', '项目案例 / lab', '/lab-busbar-platform.html', '母线槽 busbar excel'),
  command('cad', 'CAD 自动化实验', '项目案例 / lab', '/lab-cad-automation.html', 'cad 自动化 automation'),
  command('openclaw', 'OPENCLAW 一键安装交付', '项目案例 / lab', '/lab-openclaw-delivery.html', 'openclaw 交付 安装'),
  command('html-canvas', '信号画布实验 / Pixi + GSAP', '项目案例 / lab', '/lab-html-canvas-signal.html', 'html canvas pixi gsap webgl webgpu signal 实验'),
]

const hiddenCommands: PaletteCommand[] = [
  command(
    'hidden-agent-core',
    '信号控制台 / 核心诊断',
    '视觉控制 / 命令',
    'command://agent-core',
    ':agent agent core signal control',
    'agent-core',
    true,
  ),
  command(
    'hidden-membrane',
    '信号膜增压 / 风压脉冲',
    '视觉控制 / 命令',
    'command://membrane-pulse',
    ':membrane membrane pulse signal wind shader',
    'membrane-pulse',
    true,
  ),
  command(
    'hidden-xray',
    '页面结构透视 / 路线图',
    '视觉控制 / 命令',
    'command://xray',
    ':xray xray structure map dom route sections code console 透视 结构',
    'xray',
    true,
  ),
  command(
    'hidden-debug-lines',
    '代码行证据模式 / 行级证据',
    '视觉控制 / 命令',
    'command://debug-lines',
    ':lines code console line copy permalink',
    'debug-lines',
    true,
  ),
  command(
    'hidden-visual-calm',
    '降低视觉噪声 / 安静模式',
    '视觉控制 / 命令',
    'command://visual-calm',
    ':calm calm quiet signal mode low motion 视觉 强度 安静',
    'visual-calm',
    true,
  ),
  command(
    'hidden-visual-storm',
    '高能风暴模式 / 信号风暴',
    '视觉控制 / 命令',
    'command://visual-storm',
    ':storm storm high power wind shader signal membrane 风暴',
    'visual-storm',
    true,
  ),
  command(
    'hidden-hyperstorm',
    '终局视觉层 / 高能着色器',
    '视觉控制 / 命令',
    'command://hyperstorm',
    ':hyperstorm :shader shader webgl canvas gpu wind final storm 终局 视觉 惊艳',
    'hyperstorm',
    true,
  ),
  command(
    'hidden-visual-normal',
    '恢复默认强度 / 标准模式',
    '视觉控制 / 命令',
    'command://visual-normal',
    ':normal normal reset signal mode default 恢复 默认',
    'visual-normal',
    true,
  ),
  command(
    'hidden-audio-toggle',
    '打开或关闭点击声场',
    '视觉控制 / 声场',
    'command://audio-toggle',
    ':audio :sound soundfield 声场 点击 声音',
    'audio-toggle',
    true,
  ),
  command(
    'hidden-openclaw-burst',
    '交付案卷跃迁 / OpenClaw 路线脉冲',
    '视觉控制 / 命令',
    'command://openclaw-burst',
    ':openclaw openclaw burst route package delivery',
    'openclaw-burst',
    true,
  ),
]

let effectsReady = false
let reducedMotionPreference = false
let activePaletteTrigger: HTMLElement | null = null
let routeTransitionTimer: number | null = null
let codeConsoleSequence = 0
let konamiIndex = 0
let agentCoreTimer: number | null = null
let membranePulseTimer: number | null = null
let signalStormTimer: number | null = null
let heroBurstTimer: number | null = null
let hyperstormRaf: number | null = null
let hyperstormParticles: HyperstormParticle[] = []
let hyperstormResizeHandler: (() => void) | null = null
let hyperstormVisibilityHandler: (() => void) | null = null
let hyperstormFrameHandler: ((now: number) => void) | null = null
let hyperSignalCanvasController: SignalCanvasController | null = null
let hyperSignalCanvasModuleLoading: Promise<typeof import('./signal-canvas-layer')> | null = null
let hyperSignalCanvasLoading: Promise<SignalCanvasController | null> | null = null
let hyperSignalCanvasRequestId = 0
let activeContext: GlobalEffectsOptions['context'] = 'home'
let soundfieldContext: AudioContext | null = null
let soundfieldOutput: GainNode | null = null
let soundfieldEnabled = false
let soundfieldLastToneAt = 0

function restartClassNextFrame(element: HTMLElement, className: string) {
  element.classList.remove(className)
  window.requestAnimationFrame(() => {
    element.classList.add(className)
  })
}

export function setGlobalReducedMotionPreference(reducedMotion: boolean) {
  const changed = reducedMotionPreference !== reducedMotion
  reducedMotionPreference = reducedMotion

  if (reducedMotion) {
    stopHyperstorm()

    if (agentCoreTimer !== null) {
      window.clearTimeout(agentCoreTimer)
      agentCoreTimer = null
    }
    if (membranePulseTimer !== null) {
      window.clearTimeout(membranePulseTimer)
      membranePulseTimer = null
    }
    if (signalStormTimer !== null) {
      window.clearTimeout(signalStormTimer)
      signalStormTimer = null
    }
    if (heroBurstTimer !== null) {
      window.clearTimeout(heroBurstTimer)
      heroBurstTimer = null
    }

    document.body.classList.remove(
      'is-agent-core',
      'is-membrane-pulse',
      'is-signal-storm-burst',
      'is-hero-burst',
      'is-route-arrived',
    )
    document
      .querySelectorAll<HTMLElement>('.code-console.is-scanning, .code-console.is-dock-scanning')
      .forEach((console) => console.classList.remove('is-scanning', 'is-dock-scanning'))
    delete document.documentElement.dataset.agentCore
  }

  if (changed) {
    window.dispatchEvent(new CustomEvent('feian:reduced-motion-change', {
      detail: { reducedMotion },
    }))
  }
}

export function setupGlobalEffects(options: GlobalEffectsOptions) {
  setGlobalReducedMotionPreference(options.reducedMotion)
  activeContext = options.context
  document.documentElement.dataset.globalFx = options.context

  if (effectsReady) return

  effectsReady = true

  const routeLayer = buildRouteLayer()
  const hyperstormCanvas = buildHyperstormCanvas()
  const hyperSignalCanvasRoot = buildHyperSignalCanvasRoot()
  const stormLayer = buildSignalStormLayer()
  const xrayOverlay = buildXrayOverlay()
  const palette = buildCommandPalette(options.context)
  const quickActions = buildSignalQuickActions(palette)
  const agentCoreOverlay = buildAgentCoreOverlay()

  document.body.append(
    hyperstormCanvas,
    hyperSignalCanvasRoot,
    stormLayer,
    routeLayer,
    xrayOverlay,
    agentCoreOverlay,
    quickActions,
    palette.trigger,
    palette.shell,
  )
  applyStoredSignalMode()
  bindSoundfieldInteractions()
  playRouteArrival(routeLayer)
  bindRouteLinks(routeLayer)
  bindPaletteShortcuts(palette)
  bindKonamiSequence()
  bindXrayShortcuts()
}

export function setupCodeConsoleInteractions() {
  const blocks = Array.from(
    document.querySelectorAll<HTMLPreElement>('pre:not([data-code-console])'),
  )

  blocks.forEach((pre, index) => {
    const text = pre.textContent ?? ''
    if (!text.trim()) return

    const wrapper = document.createElement('section')
    const toolbar = document.createElement('div')
    const viewport = document.createElement('div')
    const lineRail = document.createElement('div')
    const lineMarker = document.createElement('div')
    const meta = document.createElement('div')
    const actions = document.createElement('div')
    const lineToggleButton = document.createElement('button')
    const scanButton = document.createElement('button')
    const copyButton = document.createElement('button')
    const foldButton = document.createElement('button')
    const liveStatus = document.createElement('span')
    const lines = normalizeCodeLines(text)
    const lineCount = lines.length
    const label = inferCodeLabel(text, index)
    const codeId = pre.id || `code-console-pre-${++codeConsoleSequence}`

    wrapper.className = 'code-console'
    wrapper.dataset.codeDock = 'ready'
    wrapper.setAttribute('role', 'group')
    wrapper.setAttribute('aria-label', `${label} 交互式代码块`)
    const dockDoor = decorativeElement('span', 'code-console-door')
    const dockEnergy = decorativeElement('span', 'code-console-energy')
    const dockLock = decorativeElement('span', 'code-console-lock')
    toolbar.className = 'code-console-toolbar'
    viewport.className = 'code-console-viewport'
    viewport.id = `${codeId}-viewport`
    lineRail.className = 'code-console-line-rail'
    lineRail.setAttribute('aria-label', '代码行快速复制与定位')
    lineMarker.className = 'code-console-line-marker'
    lineMarker.setAttribute('aria-hidden', 'true')
    meta.className = 'code-console-meta'
    actions.className = 'code-console-actions'
    liveStatus.className = 'code-console-status'
    liveStatus.setAttribute('aria-live', 'polite')

    meta.append(
      textNode('span', '代码信号'),
      textNode('strong', label),
      textNode('span', `${lineCount || 1} 行`),
    )

    configureButton(lineToggleButton, '行号', '显示或隐藏代码行号')
    lineToggleButton.setAttribute('aria-pressed', 'true')
    configureButton(scanButton, '扫描', '扫描代码块')
    configureButton(copyButton, '复制', '复制代码块')
    configureButton(foldButton, '折叠', '折叠代码块')
    foldButton.setAttribute('aria-expanded', 'true')
    foldButton.setAttribute('aria-controls', viewport.id)
    wrapper.classList.add('is-lines-pending')

    const syncScanMotionPreference = () => {
      const reducedMotion = reducedMotionPreference
      scanButton.disabled = reducedMotion
      scanButton.textContent = reducedMotion ? '静态' : '扫描'
      scanButton.setAttribute(
        'aria-label',
        reducedMotion ? '扫描动效已因减少动态效果关闭' : '扫描代码块',
      )
      if (reducedMotion) {
        wrapper.classList.remove('is-scanning', 'is-dock-scanning')
      }
    }

    syncScanMotionPreference()
    window.addEventListener('feian:reduced-motion-change', syncScanMotionPreference)

    actions.append(lineToggleButton, scanButton, copyButton, foldButton)
    toolbar.append(meta, actions, liveStatus)

    pre.dataset.codeConsole = 'true'
    pre.id = codeId
    pre.classList.add('code-console-pre')
    pre.setAttribute('tabindex', '0')

    pre.before(wrapper)
    let linesHydrated = false
    let lineHydrateTimer = 0
    let lineHydrateObserver: IntersectionObserver | null = null

    const appendLineButton = (line: string, lineIndex: number) => {
      const lineNumber = lineIndex + 1
      const lineButton = document.createElement('button')

      lineButton.type = 'button'
      lineButton.id = `${codeId}-L${lineNumber}`
      lineButton.className = 'code-console-line-button'
      lineButton.textContent = String(lineNumber).padStart(2, '0')
      lineButton.tabIndex = -1
      lineButton.dataset.line = String(lineNumber)
      lineButton.setAttribute('aria-label', `复制第 ${lineNumber} 行`)
      lineButton.addEventListener('click', async (event) => {
        const activeButton = wrapper.querySelector<HTMLButtonElement>(
          '.code-console-line-button.is-selected',
        )

        if (event.shiftKey && activeButton && activeButton !== lineButton) {
          await activateCodeLineRange({
            wrapper,
            startButton: activeButton,
            endButton: lineButton,
            lines,
            liveStatus,
            copyRange: true,
          })
          return
        }

        await activateCodeLine({
          wrapper,
          button: lineButton,
          lineText: line,
          lineNumber,
          liveStatus,
          copyLine: true,
        })
      })

      lineRail.append(lineButton)
    }

    const hydrateLineRail = (immediate = false) => {
      if (linesHydrated) return

      linesHydrated = true
      wrapper.classList.remove('is-lines-pending')
      lineHydrateObserver?.disconnect()
      lineHydrateObserver = null

      let cursor = 0
      const chunkSize = immediate || lineCount < 140 ? Math.max(lineCount, 1) : 64
      const appendChunk = () => {
        const end = Math.min(cursor + chunkSize, lines.length)

        for (; cursor < end; cursor += 1) {
          appendLineButton(lines[cursor] ?? '', cursor)
        }

        if (cursor < lines.length) {
          lineHydrateTimer = window.setTimeout(appendChunk, 16)
          return
        }

        lineHydrateTimer = 0
      }

      appendChunk()
    }

    const scheduleLineRailHydration = () => {
      if (linesHydrated || lineHydrateTimer) return

      lineHydrateTimer = window.setTimeout(() => {
        lineHydrateTimer = 0
        hydrateLineRail(false)
      }, 160)
    }

    viewport.append(lineRail, lineMarker, pre)
    wrapper.append(dockDoor, dockEnergy, dockLock, toolbar, viewport)

    scanButton.addEventListener('click', () => {
      if (reducedMotionPreference) return
      restartClassNextFrame(wrapper, 'is-scanning')
      restartClassNextFrame(wrapper, 'is-dock-scanning')
      window.setTimeout(() => wrapper.classList.remove('is-scanning'), 1250)
      window.setTimeout(() => wrapper.classList.remove('is-dock-scanning'), 1250)
    })

    copyButton.addEventListener('click', async () => {
      const copied = await copyText(text)

      copyButton.textContent = copied ? '已复制' : '失败'
      liveStatus.textContent = copied ? '代码已复制' : '复制失败'
      wrapper.classList.toggle('is-copied', copied)
      wrapper.dataset.codeDock = copied ? 'copied' : 'ready'

      window.setTimeout(() => {
        copyButton.textContent = '复制'
        liveStatus.textContent = ''
        wrapper.classList.remove('is-copied')
        wrapper.dataset.codeDock = 'ready'
      }, 1200)
    })

    lineToggleButton.addEventListener('click', () => {
      hydrateLineRail(true)
      const hidden = !wrapper.classList.contains('is-lines-hidden')
      wrapper.classList.toggle('is-lines-hidden', hidden)
      lineToggleButton.setAttribute('aria-pressed', String(!hidden))
      lineToggleButton.textContent = hidden ? '行号关' : '行号'
    })

    foldButton.addEventListener('click', () => {
      const collapsed = !wrapper.classList.contains('is-collapsed')
      wrapper.classList.toggle('is-collapsed', collapsed)
      wrapper.classList.toggle('is-door-sealed', collapsed)
      viewport.style.height = collapsed ? 'var(--code-console-collapsed-height)' : ''
      viewport.style.maxHeight = collapsed ? 'var(--code-console-collapsed-height)' : ''
      foldButton.textContent = collapsed ? '展开' : '折叠'
      foldButton.setAttribute('aria-label', collapsed ? '展开代码块' : '折叠代码块')
      foldButton.setAttribute('aria-expanded', String(!collapsed))
    })

    pre.addEventListener('keydown', async (event) => {
      hydrateLineRail(true)
      const activeButton = wrapper.querySelector<HTMLButtonElement>(
        '.code-console-line-button.is-selected',
      )

      if (!activeButton) return

      if (event.key.toLowerCase() === 'c') {
        event.preventDefault()

        if (wrapper.classList.contains('has-line-range')) {
          const selected = Array.from(
            wrapper.querySelectorAll<HTMLButtonElement>('.code-console-line-button.is-selected'),
          )
          const first = selected[0]
          const last = selected[selected.length - 1]

          if (first && last) {
            await activateCodeLineRange({
              wrapper,
              startButton: first,
              endButton: last,
              lines,
              liveStatus,
              copyRange: true,
            })
          }
          return
        }

        const lineNumber = Number(activeButton.dataset.line || 0)
        await activateCodeLine({
          wrapper,
          button: activeButton,
          lineText: lines[lineNumber - 1] ?? '',
          lineNumber,
          liveStatus,
          copyLine: true,
        })
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        clearSelectedCodeLine(wrapper)
        liveStatus.textContent = '已清除代码行选择'
      }
    })

    if (window.location.hash.startsWith(`#${codeId}-L`)) {
      hydrateLineRail(true)
      activateInitialCodeLineFromHash(wrapper, codeId, liveStatus)
    } else if ('IntersectionObserver' in window) {
      lineHydrateObserver = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            scheduleLineRailHydration()
          }
        },
        { rootMargin: '360px 0px' },
      )
      lineHydrateObserver.observe(wrapper)
    } else {
      scheduleLineRailHydration()
    }
  })
}

function command(
  id: string,
  title: string,
  kicker: string,
  url: string,
  keywords: string,
  action?: PaletteAction,
  hidden?: boolean,
): PaletteCommand {
  return { id, title, kicker, url, keywords, action, hidden }
}

function buildRouteLayer() {
  const layer = document.createElement('div')
  const core = document.createElement('div')
  const grid = decorativeElement('span', 'route-transition-grid')
  const beam = decorativeElement('span', 'route-transition-beam')
  const shards = decorativeElement('span', 'route-transition-shards')
  const label = document.createElement('span')
  const target = document.createElement('strong')

  layer.className = 'route-transition-layer'
  layer.setAttribute('aria-hidden', 'true')
  core.className = 'route-transition-core'
  label.textContent = '路线包 / 信号膜'
  target.dataset.routeTransitionTarget = 'true'
  target.textContent = '正在打开下一份案卷'
  Array.from({ length: 7 }, (_, index) => {
    const shard = decorativeElement('i', 'route-transition-shard')
    shard.style.setProperty('--route-shard-index', String(index))
    shard.style.setProperty('--route-shard-delay', `${index * 34}ms`)
    shards.append(shard)
    return shard
  })
  core.append(label, target)
  layer.append(grid, beam, shards, core)

  return layer
}

function buildHyperstormCanvas() {
  const canvas = document.createElement('canvas')
  canvas.className = 'hyperstorm-canvas'
  canvas.width = 0
  canvas.height = 0
  canvas.setAttribute('aria-hidden', 'true')
  return canvas
}

function buildHyperSignalCanvasRoot() {
  const root = document.createElement('div')
  root.className = 'hyper-signal-canvas-root'
  root.setAttribute('aria-hidden', 'true')
  return root
}

function buildSignalStormLayer() {
  const layer = document.createElement('div')
  const stream = document.createElement('span')

  layer.className = 'signal-storm-layer'
  layer.setAttribute('aria-hidden', 'true')
  stream.textContent = '信号风暴 // 代理总线 // 膜层风压 // 结构透视 // '
  layer.append(stream)

  return layer
}

function buildXrayOverlay() {
  const overlay = document.createElement('aside')
  const panel = document.createElement('div')
  const head = document.createElement('div')
  const eyebrow = document.createElement('span')
  const title = document.createElement('strong')
  const closeButton = document.createElement('button')
  const body = document.createElement('div')
  const footer = document.createElement('p')

  overlay.className = 'xray-overlay'
  overlay.hidden = true
  overlay.inert = true
  overlay.setAttribute('aria-hidden', 'true')
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-label', '页面结构透视层')
  panel.className = 'xray-panel'
  panel.tabIndex = -1
  head.className = 'xray-head'
  eyebrow.textContent = '透视路线包'
  title.textContent = '页面结构拓扑图'
  closeButton.type = 'button'
  closeButton.className = 'xray-close'
  closeButton.textContent = '关闭'
  closeButton.setAttribute('aria-label', '关闭页面结构透视层')
  body.className = 'xray-body'
  body.dataset.xrayBody = 'true'
  footer.className = 'xray-footer'
  footer.textContent = '点击区块聚焦页面位置 · 按 Esc 关闭'

  closeButton.addEventListener('click', closeXrayOverlay)
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeXrayOverlay()
  })
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeXrayOverlay()
      return
    }

    if (event.key === 'Tab') {
      trapPaletteFocus(overlay, event)
    }
  })

  head.append(eyebrow, title, closeButton)
  panel.append(head, body, footer)
  overlay.append(panel)

  return overlay
}

function buildAgentCoreOverlay() {
  const overlay = document.createElement('aside')
  const panel = document.createElement('div')
  const eyebrow = document.createElement('span')
  const title = document.createElement('strong')
  const list = document.createElement('ul')
  const footer = document.createElement('em')

  overlay.className = 'agent-core-overlay'
  overlay.setAttribute('aria-hidden', 'true')
  panel.className = 'agent-core-panel'
  eyebrow.textContent = '信号控制 / 路线诊断'
  title.textContent = '信号核心已就绪'
  footer.textContent = '信号膜就绪 · 证据轨道就绪'

  ;[
    '命令路由：可用页面路线已同步',
    '信号膜：风压状态已同步',
    '代码控制台：复制与永久链接已就绪',
  ].forEach((item) => {
    const line = document.createElement('li')
    line.textContent = item
    list.append(line)
  })

  panel.append(eyebrow, title, list, footer)
  overlay.append(panel)

  return overlay
}

function buildSignalQuickActions(palette: CommandPalette) {
  const dock = document.createElement('div')
  const label = document.createElement('span')
  const hint = document.createElement('span')
  const buttons: HTMLButtonElement[] = []
  const actions: Array<{
    key: 'wind' | 'storm' | 'xray' | 'hyper' | 'audio' | 'calm' | 'cmd'
    label: string
    action?: PaletteAction
    openPalette?: boolean
    title: string
    tip: string
  }> = [
    { key: 'wind', label: '风压', action: 'membrane-pulse', title: '吹动首页信号膜', tip: '吹动背景信号膜：看纸张和雨幕被风压掀起来。' },
    { key: 'storm', label: '风暴', action: 'visual-storm', title: '开启高能风暴模式', tip: '高能风暴模式：增强雨幕、扫描线和页面响应。' },
    { key: 'xray', label: '透视', action: 'xray', title: '页面结构透视层', tip: '结构透视：当前页面区块图。' },
    { key: 'hyper', label: '高能', action: 'hyperstorm', title: '启动终局视觉层', tip: '终局视觉层：启动最强的 Canvas / shader 风格效果。' },
    { key: 'audio', label: '声场', action: 'audio-toggle', title: '打开或关闭点击声场', tip: '点击声场：用很轻的合成音反馈按钮和路线切换，可随时关闭。' },
    { key: 'calm', label: '安静', action: 'visual-calm', title: '降噪恢复', tip: '安静模式：降低动效强度，恢复阅读优先。' },
    { key: 'cmd', label: '命令', openPalette: true, title: '全站命令导航', tip: '命令导航：搜索文章、项目和页面路线。' },
  ]

  dock.className = 'signal-quick-actions'
  dock.setAttribute('aria-label', '可见特效控制台')
  label.className = 'signal-quick-actions-label'
  label.textContent = '视觉控制台'
  hint.className = 'signal-quick-actions-hint'
  hint.textContent = '视觉模式：风压、风暴、高能、声场、安静。'
  dock.append(label, hint)

  const syncActionState = () => {
    const mode = document.documentElement.dataset.signalMode || 'normal'
    const isHyper = document.body.classList.contains('is-hyperstorm')
    const isXray = document.body.classList.contains('is-xray-open')
    const isWind = document.body.classList.contains('is-membrane-pulse')
    const isAudio = document.body.classList.contains('is-soundfield-on')

    dock.dataset.signalState = isAudio ? 'audio' : isHyper ? 'hyper' : isXray ? 'xray' : isWind ? 'wind' : mode

    buttons.forEach((button) => {
      const action = button.dataset.signalAction
      const active =
        (action === 'wind' && isWind) ||
        (action === 'storm' && mode === 'storm' && !isHyper) ||
        (action === 'hyper' && isHyper) ||
        (action === 'audio' && isAudio) ||
        (action === 'xray' && isXray) ||
        (action === 'calm' && mode === 'calm')

      button.classList.toggle('is-active', active)
      button.setAttribute('aria-pressed', String(active))
    })
  }

  actions.forEach((item) => {
    const button = document.createElement('button')

    button.type = 'button'
    button.className = 'signal-quick-action'
    button.textContent = item.label
    button.title = `${item.label}：${item.title}`
    button.setAttribute('aria-label', `${item.label}：${item.title}`)
    button.dataset.signalTip = item.tip
    button.dataset.signalAction = item.key
    button.setAttribute('aria-pressed', 'false')
    if (item.action === 'hyperstorm' && !reducedMotionPreference) {
      button.addEventListener('pointerenter', preloadHyperSignalCanvasModule, { passive: true })
      button.addEventListener('focus', preloadHyperSignalCanvasModule)
    }
    button.addEventListener('click', () => {
      dock.classList.add('has-user-signal')
      if (item.openPalette) {
        openPalette(palette)
        window.requestAnimationFrame(syncActionState)
        window.setTimeout(syncActionState, 1900)
        return
      }

      if (item.action) {
        runPaletteAction(item.action)
        window.requestAnimationFrame(syncActionState)
        window.setTimeout(syncActionState, 1900)
      }
    })
    buttons.push(button)
    dock.append(button)
  })

  window.addEventListener('feian:signal-mode', () => {
    window.requestAnimationFrame(syncActionState)
  })
  window.addEventListener('feian:soundfield-change', () => {
    window.requestAnimationFrame(syncActionState)
  })
  syncActionState()

  return dock
}

function buildCommandPalette(context: GlobalEffectsOptions['context']): CommandPalette {
  const shell = document.createElement('div')
  const trigger = document.createElement('button')
  const dialog = document.createElement('div')
  const head = document.createElement('div')
  const rail = document.createElement('div')
  const status = document.createElement('div')
  const input = document.createElement('input')
  const list = document.createElement('div')
  const hint = document.createElement('span')
  const label = document.createElement('strong')
  const closeButton = document.createElement('button')
  const dialogId = 'global-command-palette-dialog'
  const inputId = 'global-command-palette-input'
  const listId = 'global-command-palette-list'
  let activeIndex = 0
  let currentCommands = getPaletteCommands(context)

  trigger.type = 'button'
  trigger.className = 'command-palette-trigger'
  trigger.setAttribute('aria-haspopup', 'dialog')
  trigger.setAttribute('aria-controls', dialogId)
  trigger.setAttribute('aria-expanded', 'false')
  trigger.setAttribute('aria-keyshortcuts', 'Control+K Meta+K')
  trigger.setAttribute('aria-description', '命令导航：搜索文章、项目和页面路线')
  trigger.title = '命令导航：搜索文章、项目和页面路线'
  trigger.dataset.commandTip = '打开命令导航：搜索文章、项目和页面路线。'
  trigger.append(textNode('span', '命令'), textNode('strong', '⌘K'))

  shell.className = 'command-palette-shell'
  shell.hidden = true
  shell.inert = true
  shell.setAttribute('aria-hidden', 'true')
  dialog.className = 'command-palette'
  dialog.dataset.commandHud = 'ready'
  dialog.id = dialogId
  dialog.setAttribute('role', 'dialog')
  dialog.setAttribute('aria-modal', 'true')
  dialog.setAttribute('aria-label', '全站命令导航')
  head.className = 'command-palette-head'
  rail.className = 'command-palette-rail'
  rail.setAttribute('aria-hidden', 'true')
  ;['路线', '索引', '项目', '现场'].forEach((item) => {
    const chip = document.createElement('span')
    chip.textContent = item
    rail.append(chip)
  })
  status.className = 'command-palette-status'
  status.setAttribute('aria-live', 'polite')
  label.textContent = '全站命令路由 / FEIAN'
  hint.textContent = 'CTRL / ⌘ + K'
  closeButton.type = 'button'
  closeButton.className = 'command-palette-close'
  closeButton.textContent = '关闭'
  closeButton.setAttribute('aria-label', '关闭全站命令导航')
  input.className = 'command-palette-input'
  input.id = inputId
  input.type = 'search'
  input.setAttribute('role', 'combobox')
  input.setAttribute('aria-label', '搜索全站导航')
  input.setAttribute('aria-controls', listId)
  input.setAttribute('aria-expanded', 'false')
  input.setAttribute('aria-autocomplete', 'list')
  input.placeholder = '搜索文章、现场、项目、路由…'
  input.autocomplete = 'off'
  input.spellcheck = false
  list.className = 'command-palette-list'
  list.id = listId
  list.setAttribute('role', 'listbox')

  head.append(label, hint, closeButton)
  dialog.append(head, rail, input, status, list)
  shell.append(dialog)

  const render = () => {
    list.replaceChildren()
    const query = normalize(input.value)
    currentCommands = filterCommands(getPaletteCommands(context), query)
    const visibleCommands = currentCommands.slice(0, 9)
    activeIndex = clampIndex(activeIndex, visibleCommands.length)

    if (visibleCommands.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'command-palette-empty'
      empty.textContent = '没有匹配的路线'
      list.append(empty)
      input.removeAttribute('aria-activedescendant')
      status.textContent = '0 条路线'
      return
    }

    visibleCommands.forEach((item, index) => {
      const button = document.createElement('button')
      const copy = document.createElement('span')
      const title = document.createElement('strong')
      const url = document.createElement('em')
      const optionId = `${listId}-option-${index}`

      button.type = 'button'
      button.id = optionId
      button.className = 'command-palette-item'
      button.classList.toggle('is-active', index === activeIndex)
      button.setAttribute('role', 'option')
      button.setAttribute('aria-selected', String(index === activeIndex))
      button.setAttribute('tabindex', '-1')
      title.textContent = item.title
      copy.textContent = `${item.kicker} `
      url.textContent = formatUrl(item.url)
      copy.append(title)
      button.append(copy, url)
      button.addEventListener('mouseenter', () => {
        activeIndex = index
        render()
      })
      button.addEventListener('click', () => {
        closePalette(shell, { restoreFocus: false })
        runPaletteCommand(item)
      })
      list.append(button)
    })

    input.setAttribute('aria-activedescendant', `${listId}-option-${activeIndex}`)
    status.textContent = `${visibleCommands.length} 条路线 · 当前 ${activeIndex + 1}`
  }

  input.addEventListener('input', () => {
    activeIndex = 0
    render()
  })

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      activeIndex = clampIndex(activeIndex + 1, Math.min(currentCommands.length, 9))
      render()
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      activeIndex = clampIndex(activeIndex - 1, Math.min(currentCommands.length, 9))
      render()
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const target = currentCommands[activeIndex]
      if (target) {
        closePalette(shell, { restoreFocus: false })
        runPaletteCommand(target)
      }
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closePalette(shell)
    }
  })

  shell.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closePalette(shell)
      return
    }

    if (event.key === 'Tab') {
      trapPaletteFocus(shell, event)
    }
  })

  shell.addEventListener('click', (event) => {
    if (event.target === shell) closePalette(shell)
  })

  closeButton.addEventListener('click', () => closePalette(shell))
  trigger.addEventListener('click', () => {
    if (shell.hidden) {
      openPalette({ shell, trigger, input, list, render })
    } else {
      closePalette(shell)
    }
  })

  render()

  return { shell, trigger, input, list, render }
}

function bindPaletteShortcuts(palette: CommandPalette) {
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault()

      if (palette.shell.hidden) {
        openPalette(palette)
      } else {
        closePalette(palette.shell)
      }
    }
  })
}

function bindKonamiSequence() {
  document.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement | null
    const tagName = target?.tagName?.toLowerCase()

    if (tagName === 'input' || tagName === 'textarea' || target?.isContentEditable) {
      return
    }

    const expected = konamiSequence[konamiIndex]
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key

    if (key === expected) {
      konamiIndex += 1
      if (konamiIndex === konamiSequence.length) {
        konamiIndex = 0
        activateAgentCore('konami')
      }
      return
    }

    konamiIndex = key === konamiSequence[0] ? 1 : 0
  })
}

function bindXrayShortcuts() {
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    if (!document.body.classList.contains('is-xray-open')) return

    event.preventDefault()
    closeXrayOverlay()
  })
}

function runPaletteCommand(commandItem: PaletteCommand) {
  if (commandItem.action) {
    runPaletteAction(commandItem.action)
    return
  }

  navigateWithRoute(commandItem.url)
}

function runPaletteAction(action: PaletteAction) {
  if (action === 'agent-core') {
    activateAgentCore('command')
    return
  }

  if (action === 'membrane-pulse') {
    activateMembranePulse()
    activateAgentCore('membrane')
    return
  }

  if (action === 'debug-lines') {
    document.body.classList.toggle('is-code-line-debug')
    activateAgentCore('line-debug')
    return
  }

  if (action === 'xray') {
    activateXrayOverlay('command')
    return
  }

  if (action === 'visual-calm') {
    setSignalMode('calm')
    return
  }

  if (action === 'visual-storm') {
    setSignalMode('storm')
    return
  }

  if (action === 'visual-normal') {
    setSignalMode('normal')
    return
  }

  if (action === 'hyperstorm') {
    setSignalMode('storm')
    activateHyperstorm()
    return
  }

  if (action === 'audio-toggle') {
    toggleSoundfield()
    return
  }

  if (action === 'openclaw-burst') {
    activateMembranePulse()
    window.setTimeout(() => {
      navigateWithRoute('/lab-openclaw-delivery.html')
    }, reducedMotionPreference ? 0 : 420)
  }
}

function bindRouteLinks(routeLayer: HTMLElement) {
  if (!reducedMotionPreference) {
    let routePointerRaf = 0
    let routePointerX = window.innerWidth * 0.52
    let routePointerY = window.innerHeight * 0.28

    document.addEventListener('pointermove', (event) => {
      if (
        !document.body.classList.contains('is-signal-storm') &&
        !document.body.classList.contains('is-command-open') &&
        !document.body.classList.contains('is-xray-open') &&
        !document.body.classList.contains('is-route-leaving') &&
        !document.body.classList.contains('is-route-arrived')
      ) {
        return
      }

      routePointerX = event.clientX
      routePointerY = event.clientY

      if (routePointerRaf) return

      routePointerRaf = window.requestAnimationFrame(() => {
        routePointerRaf = 0

        document.documentElement.style.setProperty('--route-x', `${routePointerX}px`)
        document.documentElement.style.setProperty('--route-y', `${routePointerY}px`)
      })
    }, { passive: true })
  }

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

    const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]')
    if (!anchor || anchor.hasAttribute('download') || anchor.hasAttribute('data-no-route')) return
    if (anchor.target && anchor.target !== '_self') return

    const url = toUrl(anchor.href)
    if (!url || url.origin !== window.location.origin) return
    if (isSamePageHash(url)) return
    if (!isDocumentRoute(url)) return

    event.preventDefault()
    document.documentElement.style.setProperty('--route-x', `${event.clientX}px`)
    document.documentElement.style.setProperty('--route-y', `${event.clientY}px`)
    primeRouteOrigin(anchor, url, routeLayer)
    routeLayer.querySelector('[data-route-transition-target]')?.replaceChildren(
      document.createTextNode(anchor.textContent?.trim() || formatUrl(url.pathname)),
    )
    startRouteTransition(url.href)
  })
}

function openPalette(palette: CommandPalette) {
  activePaletteTrigger = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : palette.trigger
  palette.shell.hidden = false
  palette.shell.inert = false
  palette.shell.setAttribute('aria-hidden', 'false')
  palette.trigger.setAttribute('aria-expanded', 'true')
  palette.input.setAttribute('aria-expanded', 'true')
  document.body.classList.add('is-command-open')
  palette.input.value = ''
  palette.render()
  window.setTimeout(() => palette.input.focus(), 20)
}

function closePalette(
  shell: HTMLElement,
  options: { restoreFocus?: boolean } = {},
) {
  const { restoreFocus = true } = options
  shell.hidden = true
  shell.inert = true
  shell.setAttribute('aria-hidden', 'true')
  document.body.classList.remove('is-command-open')

  const trigger = document.querySelector<HTMLButtonElement>('.command-palette-trigger')
  const input = shell.querySelector<HTMLInputElement>('.command-palette-input')
  trigger?.setAttribute('aria-expanded', 'false')
  input?.setAttribute('aria-expanded', 'false')

  if (restoreFocus && activePaletteTrigger && document.contains(activePaletteTrigger)) {
    activePaletteTrigger.focus({ preventScroll: true })
  }

  if (!restoreFocus) {
    activePaletteTrigger = null
  }
}

function trapPaletteFocus(shell: HTMLElement, event: KeyboardEvent) {
  const focusable = Array.from(
    shell.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.getClientRects().length > 0 && element.tabIndex >= 0)

  if (focusable.length === 0) {
    event.preventDefault()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement

  if (!active || !shell.contains(active)) {
    event.preventDefault()
    first.focus()
    return
  }

  if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
    return
  }

  if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

function activateAgentCore(source: string) {
  const overlay = document.querySelector<HTMLElement>('.agent-core-overlay')
  const panel = overlay?.querySelector<HTMLElement>('.agent-core-panel')

  document.documentElement.dataset.agentCore = source
  document.body.classList.add('is-agent-core')

  if (panel) {
    panel.style.setProperty('--agent-core-source', `"${source}"`)
  }

  if (agentCoreTimer !== null) {
    window.clearTimeout(agentCoreTimer)
  }

  agentCoreTimer = window.setTimeout(() => {
    document.body.classList.remove('is-agent-core')
    delete document.documentElement.dataset.agentCore
    agentCoreTimer = null
  }, reducedMotionPreference ? 2200 : 5200)
}

function activateMembranePulse() {
  restartClassNextFrame(document.body, 'is-membrane-pulse')
  playSoundfieldTone('wind')
  window.dispatchEvent(new CustomEvent('feian:membrane-pulse', {
    detail: { reducedMotion: reducedMotionPreference },
  }))

  if (membranePulseTimer !== null) {
    window.clearTimeout(membranePulseTimer)
  }

  membranePulseTimer = window.setTimeout(() => {
    document.body.classList.remove('is-membrane-pulse')
    membranePulseTimer = null
  }, reducedMotionPreference ? 600 : 1800)
}

function bindSoundfieldInteractions() {
  document.addEventListener('pointerdown', (event) => {
    if (!soundfieldEnabled || event.button !== 0) return

    const target = (event.target as Element | null)?.closest<HTMLElement>(
      'a[href], button, [data-interactive-lens], .code-console-line-button',
    )

    if (!target) return

    const tone = target.matches('a[href]')
      ? 'route'
      : target.matches('.signal-quick-action, .command-palette-trigger')
        ? 'control'
        : 'tap'

    playSoundfieldTone(tone, event)
  }, { passive: true })
}

function toggleSoundfield() {
  soundfieldEnabled = !soundfieldEnabled
  document.body.classList.toggle('is-soundfield-on', soundfieldEnabled)
  window.dispatchEvent(new CustomEvent('feian:soundfield-change', {
    detail: { enabled: soundfieldEnabled },
  }))

  if (!soundfieldEnabled) {
    playSoundfieldTone('off')
    activateAgentCore('sound-off')
    return
  }

  const canStartAudio = navigator.userActivation?.isActive ?? true
  if (canStartAudio) {
    ensureSoundfield()
    playSoundfieldTone('on')
  }
  activateAgentCore(canStartAudio ? 'sound-on' : 'sound-ready')
}

function ensureSoundfield() {
  if (reducedMotionPreference) return null
  if (soundfieldContext && soundfieldOutput) return soundfieldContext

  const AudioContextConstructor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextConstructor) return null

  soundfieldContext = new AudioContextConstructor()
  soundfieldOutput = soundfieldContext.createGain()
  soundfieldOutput.gain.value = 0.018
  soundfieldOutput.connect(soundfieldContext.destination)

  return soundfieldContext
}

function playSoundfieldTone(
  tone: 'tap' | 'route' | 'control' | 'wind' | 'on' | 'off',
  event?: PointerEvent,
) {
  if (!soundfieldEnabled && tone !== 'on' && tone !== 'off') return
  if (reducedMotionPreference) return

  const context = ensureSoundfield()
  if (!context || !soundfieldOutput) return

  const now = context.currentTime
  const timeMs = performance.now()
  if (timeMs - soundfieldLastToneAt < 42 && tone !== 'on' && tone !== 'off') return
  soundfieldLastToneAt = timeMs

  if (context.state === 'suspended') {
    void context.resume()
  }

  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const panner = 'createStereoPanner' in context
    ? context.createStereoPanner()
    : null
  const pan = event ? (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 1.3 : 0
  const baseFrequency = {
    tap: 520,
    route: 680,
    control: 740,
    wind: 420,
    on: 820,
    off: 260,
  }[tone]
  const duration = tone === 'wind' ? 0.2 : tone === 'route' ? 0.15 : 0.11

  oscillator.type = tone === 'wind' ? 'sine' : 'triangle'
  oscillator.frequency.setValueAtTime(baseFrequency, now)
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(90, tone === 'off' ? 140 : baseFrequency * 1.42),
    now + duration,
  )

  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(tone === 'off' ? 0.012 : 0.028, now + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

  if (panner) {
    panner.pan.setValueAtTime(Math.max(-0.8, Math.min(0.8, pan)), now)
    oscillator.connect(gain).connect(panner).connect(soundfieldOutput)
  } else {
    oscillator.connect(gain).connect(soundfieldOutput)
  }

  oscillator.start(now)
  oscillator.stop(now + duration + 0.02)
}

function activateXrayOverlay(source: string) {
  const overlay = document.querySelector<HTMLElement>('.xray-overlay')
  const panel = overlay?.querySelector<HTMLElement>('.xray-panel')
  const body = overlay?.querySelector<HTMLElement>('[data-xray-body]')

  if (!overlay || !panel || !body) return

  renderXrayBody(body, source)
  overlay.hidden = false
  overlay.inert = false
  overlay.setAttribute('aria-hidden', 'false')
  document.body.classList.add('is-xray-open')
  document.documentElement.dataset.xray = source
  activateAgentCore('xray')

  window.setTimeout(() => panel.focus({ preventScroll: true }), 20)
}

function closeXrayOverlay() {
  const overlay = document.querySelector<HTMLElement>('.xray-overlay')
  if (!overlay) return
  const activeElement = document.activeElement

  if (activeElement instanceof HTMLElement && overlay.contains(activeElement)) {
    const trigger =
      document.querySelector<HTMLElement>('.signal-quick-action[data-signal-action="xray"]') ||
      document.querySelector<HTMLElement>('.command-palette-trigger')

    if (trigger) {
      trigger.focus({ preventScroll: true })
    } else {
      activeElement.blur()
    }
  }

  overlay.hidden = true
  overlay.inert = true
  overlay.setAttribute('aria-hidden', 'true')
  document.body.classList.remove('is-xray-open')
  delete document.documentElement.dataset.xray
}

function renderXrayBody(body: HTMLElement, source: string) {
  const sections = collectXraySections()
  const codeConsoles = collectXrayCodeConsoles()
  const links = collectXrayLinks()
  const rawSignalMode = document.documentElement.dataset.signalMode || 'normal'
  const signalMode =
    rawSignalMode === 'storm' ? '风暴' : rawSignalMode === 'calm' ? '安静' : '标准'
  const contextLabel =
    activeContext === 'home' ? '首页' : activeContext === 'entry' ? '正文' : activeContext
  const sourceLabel = source === 'command' ? '命令' : source
  const route = formatUrl(window.location.pathname)
  const summary = document.createElement('div')
  const topology = buildXrayTopology(sections, codeConsoles, links)
  const sectionPanel = document.createElement('div')
  const codePanel = document.createElement('div')
  const linkPanel = document.createElement('div')

  body.replaceChildren()

  summary.className = 'xray-summary'
  ;[
    ['路线', route],
    ['场景', contextLabel],
    ['区块', String(sections.length)],
    ['代码行', String(codeConsoles.reduce((total, item) => total + item.lines, 0))],
    ['模式', signalMode],
    ['来源', sourceLabel],
  ].forEach(([label, value]) => {
    const item = document.createElement('div')
    const small = document.createElement('span')
    const strong = document.createElement('strong')

    small.textContent = label
    strong.textContent = value
    item.append(small, strong)
    summary.append(item)
  })

  sectionPanel.className = 'xray-card xray-sections'
  sectionPanel.append(textNode('strong', '页面区块包'))
  if (sections.length === 0) {
    sectionPanel.append(textNode('span', '没有检测到页面区块'))
  } else {
    sections.forEach((section, index) => {
      const row = document.createElement('button')
      const label = document.createElement('span')
      const title = document.createElement('strong')
      const hash = document.createElement('em')

      row.type = 'button'
      row.className = 'xray-row'
      row.dataset.xraySection = section.id
      label.textContent = `S${String(index + 1).padStart(2, '0')}`
      title.textContent = section.heading
      hash.textContent = `#${section.id}`
      row.append(label, title, hash)
      row.addEventListener('click', () => {
        focusHashTarget(new URL(`${window.location.pathname}#${section.id}`, window.location.href))
        closeXrayOverlay()
      })
      sectionPanel.append(row)
    })
  }

  codePanel.className = 'xray-card'
  codePanel.append(textNode('strong', '代码信号'))
  if (codeConsoles.length === 0) {
    codePanel.append(textNode('span', '当前路线没有代码控制台'))
  } else {
    codeConsoles.forEach((item, index) => {
      const row = document.createElement('div')
      const label = document.createElement('span')
      const title = document.createElement('strong')
      const meta = document.createElement('em')

      row.className = 'xray-row xray-row-static'
      label.textContent = `C${String(index + 1).padStart(2, '0')}`
      title.textContent = item.label
      meta.textContent = `${item.lines} 行`
      row.append(label, title, meta)
      codePanel.append(row)
    })
  }

  linkPanel.className = 'xray-card'
  linkPanel.append(textNode('strong', '路线链接'))
  ;[
    ['站内', links.internal],
    ['锚点', links.hash],
    ['外链', links.external],
  ].forEach(([label, count]) => {
    const row = document.createElement('div')
    const key = document.createElement('span')
    const value = document.createElement('strong')
    const meta = document.createElement('em')

    row.className = 'xray-row xray-row-static'
    key.textContent = String(label)
    value.textContent = String(count)
    meta.textContent = '个链接'
    row.append(key, value, meta)
    linkPanel.append(row)
  })

  body.append(summary, topology, sectionPanel, codePanel, linkPanel)
}

function buildXrayTopology(
  sections: ReturnType<typeof collectXraySections>,
  codeConsoles: ReturnType<typeof collectXrayCodeConsoles>,
  links: ReturnType<typeof collectXrayLinks>,
) {
  const namespace = 'http://www.w3.org/2000/svg'
  const wrap = document.createElement('div')
  const svg = document.createElementNS(namespace, 'svg')
  const title = document.createElementNS(namespace, 'title')
  const defs = document.createElementNS(namespace, 'defs')
  const gradient = document.createElementNS(namespace, 'linearGradient')
  const stops = [
    ['0%', 'rgba(132, 207, 188, 0)'],
    ['45%', 'rgba(213, 231, 242, 0.78)'],
    ['100%', 'rgba(132, 207, 188, 0.18)'],
  ]
  const hub = { x: 500, y: 148 }
  const sectionCount = Math.max(sections.length, 1)
  const codeCount = Math.max(codeConsoles.length, 1)

  wrap.className = 'xray-topology-wrap'
  svg.classList.add('xray-topology')
  svg.setAttribute('viewBox', '0 0 1000 340')
  svg.setAttribute('role', 'img')
  svg.setAttribute('aria-label', '页面结构拓扑连线图')
  title.textContent = '页面结构拓扑：路线中枢连接页面区块、代码信号和链接。'
  gradient.id = 'xray-topology-gradient'
  gradient.setAttribute('x1', '0%')
  gradient.setAttribute('x2', '100%')

  stops.forEach(([offset, color]) => {
    const stop = document.createElementNS(namespace, 'stop')
    stop.setAttribute('offset', offset)
    stop.setAttribute('stop-color', color)
    gradient.append(stop)
  })

  defs.append(gradient)
  svg.append(title, defs)
  appendTopologyNode(svg, hub.x, hub.y, 26, '中枢', 'xray-node-hub')

  sections.slice(0, 8).forEach((section, index) => {
    const y = 56 + index * Math.min(36, 230 / sectionCount)
    const target = { x: 150, y }
    appendTopologyPath(svg, target, hub, index)
    appendTopologyNode(svg, target.x, target.y, 12, `S${index + 1}`)
    appendTopologyLabel(svg, target.x + 22, target.y + 4, section.heading.slice(0, 26))
  })

  codeConsoles.slice(0, 7).forEach((code, index) => {
    const y = 62 + index * Math.min(40, 220 / codeCount)
    const target = { x: 842, y }
    appendTopologyPath(svg, hub, target, index + 8)
    appendTopologyNode(svg, target.x, target.y, 11, `C${index + 1}`)
    appendTopologyLabel(svg, target.x - 168, target.y + 4, `${code.lines}行 ${code.label.slice(0, 18)}`)
  })

  ;[
    ['站内', links.internal, 405],
    ['锚点', links.hash, 500],
    ['外链', links.external, 595],
  ].forEach(([label, count, x], index) => {
    const node = { x: Number(x), y: 286 }
    appendTopologyPath(svg, hub, node, index + 16)
    appendTopologyNode(svg, node.x, node.y, 10, String(count))
    appendTopologyLabel(svg, node.x - 36, node.y + 30, String(label))
  })

  wrap.append(svg)
  return wrap
}

function appendTopologyPath(
  svg: SVGSVGElement,
  from: { x: number; y: number },
  to: { x: number; y: number },
  index: number,
) {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  const midX = (from.x + to.x) / 2
  const bend = index % 2 === 0 ? -34 : 34

  path.classList.add('xray-topology-path')
  path.style.setProperty('--topology-delay', `${index * 90}ms`)
  path.setAttribute(
    'd',
    `M ${from.x} ${from.y} C ${midX} ${from.y + bend}, ${midX} ${to.y - bend}, ${to.x} ${to.y}`,
  )
  svg.append(path)
}

function appendTopologyNode(
  svg: SVGSVGElement,
  x: number,
  y: number,
  radius: number,
  label: string,
  className = '',
) {
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')

  group.classList.add('xray-topology-node')
  if (className) group.classList.add(className)
  circle.setAttribute('cx', String(x))
  circle.setAttribute('cy', String(y))
  circle.setAttribute('r', String(radius))
  text.setAttribute('x', String(x))
  text.setAttribute('y', String(y + 4))
  text.textContent = label
  group.append(circle, text)
  svg.append(group)
}

function appendTopologyLabel(svg: SVGSVGElement, x: number, y: number, label: string) {
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  text.classList.add('xray-topology-label')
  text.setAttribute('x', String(x))
  text.setAttribute('y', String(y))
  text.textContent = label
  svg.append(text)
}

function collectXraySections() {
  return Array.from(
    document.querySelectorAll<HTMLElement>('.entry-section[id], #cover, #feed, #archive'),
  ).map((section) => ({
    id: section.id,
    heading:
      section.querySelector<HTMLElement>('h1, h2, h3')?.textContent?.trim() ||
      section.id,
  }))
}

function collectXrayCodeConsoles() {
  return Array.from(document.querySelectorAll<HTMLElement>('.code-console')).map((consoleNode, index) => ({
    label:
      consoleNode.querySelector<HTMLElement>('.code-console-meta strong')?.textContent?.trim() ||
      `代码信号 ${index + 1}`,
    lines: consoleNode.querySelectorAll('.code-console-line-button').length,
  }))
}

function collectXrayLinks() {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
  return links.reduce(
    (result, link) => {
      const href = link.getAttribute('href') || ''

      if (href.startsWith('#')) {
        result.hash += 1
        return result
      }

      const url = toUrl(href)
      if (!url || url.origin !== window.location.origin) {
        result.external += 1
        return result
      }

      if (url.hash && url.pathname === window.location.pathname) {
        result.hash += 1
        return result
      }

      result.internal += 1
      return result
    },
    { internal: 0, hash: 0, external: 0 },
  )
}

function applyStoredSignalMode() {
  const mode = readSignalMode()
  if (!mode || mode === 'normal') return

  if (mode === 'storm') {
    writeSignalMode('normal')
    return
  }

  applySignalMode(mode, { persist: false, announce: false })
}

function setSignalMode(mode: SignalMode) {
  applySignalMode(mode, { persist: true, announce: true })
}

function applySignalMode(
  mode: SignalMode,
  options: { persist: boolean; announce: boolean },
) {
  document.body.classList.toggle('is-signal-calm', mode === 'calm')
  document.body.classList.toggle('is-signal-storm', mode === 'storm')

  if (mode !== 'storm') {
    stopHyperstorm()
  }

  if (mode === 'normal') {
    delete document.documentElement.dataset.signalMode
  } else {
    document.documentElement.dataset.signalMode = mode
  }

  if (options.persist) {
    writeSignalMode(mode)
  }

  window.dispatchEvent(new CustomEvent('feian:signal-mode', {
    detail: {
      mode,
      reducedMotion: reducedMotionPreference,
    },
  }))

  if (!options.announce) return

  if (mode === 'storm') {
    activateMembranePulse()
    triggerSignalStormBurst()
    triggerHeroBurst()
    activateAgentCore(reducedMotionPreference ? 'storm-static' : 'storm')
    return
  }

  if (mode === 'calm') {
    activateAgentCore('calm')
    return
  }

  activateAgentCore('normal')
}

function triggerSignalStormBurst() {
  if (reducedMotionPreference) {
    document.body.classList.add('is-signal-storm-burst')

    if (signalStormTimer !== null) {
      window.clearTimeout(signalStormTimer)
    }

    signalStormTimer = window.setTimeout(() => {
      document.body.classList.remove('is-signal-storm-burst')
      signalStormTimer = null
    }, 300)
    return
  }

  restartClassNextFrame(document.body, 'is-signal-storm-burst')

  if (signalStormTimer !== null) {
    window.clearTimeout(signalStormTimer)
  }

  signalStormTimer = window.setTimeout(() => {
    document.body.classList.remove('is-signal-storm-burst')
    signalStormTimer = null
  }, reducedMotionPreference ? 300 : 1900)
}

function triggerHeroBurst() {
  if (reducedMotionPreference) {
    document.body.classList.add('is-hero-burst')

    if (heroBurstTimer !== null) {
      window.clearTimeout(heroBurstTimer)
    }

    heroBurstTimer = window.setTimeout(() => {
      document.body.classList.remove('is-hero-burst')
      heroBurstTimer = null
    }, 500)
    return
  }

  restartClassNextFrame(document.body, 'is-hero-burst')

  if (heroBurstTimer !== null) {
    window.clearTimeout(heroBurstTimer)
  }

  heroBurstTimer = window.setTimeout(() => {
    document.body.classList.remove('is-hero-burst')
    heroBurstTimer = null
  }, reducedMotionPreference ? 500 : 2400)
}

function getHyperSignalCanvasRoot() {
  return document.querySelector<HTMLElement>('.hyper-signal-canvas-root')
}

function resetHyperSignalCanvasRoot(root: HTMLElement) {
  root.replaceChildren()
  root.classList.remove('is-mounted')
  delete root.dataset.canvasReady
  delete root.dataset.canvasLoading
  delete root.dataset.canvasError
  delete root.dataset.renderer
}

function setHyperSignalCanvasFallback(error: unknown) {
  window.__hyperSignalCanvas = {
    mode: 'hyper',
    renderer: 'fallback / 2d canvas',
    particles: 0,
    webgpuRequested: false,
    mounted: false,
    error: String(error),
  } satisfies SignalCanvasSnapshot
}

function preloadHyperSignalCanvasModule() {
  if (reducedMotionPreference) return null
  if (!hyperSignalCanvasModuleLoading) {
    hyperSignalCanvasModuleLoading = import('./signal-canvas-layer')
  }
  return hyperSignalCanvasModuleLoading
}

async function activateHyperSignalCanvas() {
  if (hyperSignalCanvasController) {
    hyperSignalCanvasController.setMode('hyper')
    return hyperSignalCanvasController
  }

  if (hyperSignalCanvasLoading) return hyperSignalCanvasLoading

  const root = getHyperSignalCanvasRoot()
  if (!root) return null

  const requestId = ++hyperSignalCanvasRequestId
  const initialMode: SignalCanvasMode = 'hyper'

  root.dataset.canvasLoading = 'true'
  delete root.dataset.canvasError

  const loading = (preloadHyperSignalCanvasModule() ?? import('./signal-canvas-layer'))
    .then(async ({ mountSignalCanvasLayer }) => {
      if (
        requestId !== hyperSignalCanvasRequestId ||
        !document.body.classList.contains('is-hyperstorm')
      ) {
        return null
      }

      const controller = await mountSignalCanvasLayer(root, {
        badgeText: '<strong>高能视觉层</strong> / PixiJS + GSAP / 按需加载',
        initialMode,
        publicStateKey: '__hyperSignalCanvas',
      })

      if (
        requestId !== hyperSignalCanvasRequestId ||
        !document.body.classList.contains('is-hyperstorm')
      ) {
        controller.destroy()
        return null
      }

      hyperSignalCanvasController = controller
      delete root.dataset.canvasLoading
      root.dataset.canvasReady = 'true'
      controller.setMode('hyper')
      return controller
    })
    .catch((error: unknown) => {
      if (requestId === hyperSignalCanvasRequestId) {
        console.error('[hyper-signal-canvas] failed to mount', error)
        root.dataset.canvasError = 'true'
        delete root.dataset.canvasLoading
        setHyperSignalCanvasFallback(error)
      }
      return null
    })
    .finally(() => {
      if (hyperSignalCanvasLoading === loading) {
        hyperSignalCanvasLoading = null
      }
    })

  hyperSignalCanvasLoading = loading
  return loading
}

function stopHyperSignalCanvas() {
  hyperSignalCanvasRequestId += 1
  hyperSignalCanvasLoading = null

  if (hyperSignalCanvasController) {
    hyperSignalCanvasController.destroy()
    hyperSignalCanvasController = null
  }

  const root = getHyperSignalCanvasRoot()
  if (root) resetHyperSignalCanvasRoot(root)
  delete window.__hyperSignalCanvas
}

function activateHyperstorm() {
  document.body.classList.remove('is-hyperstorm-pixi-ready')
  document.body.classList.add('is-hyperstorm')
  triggerHeroBurst()
  activateAgentCore(reducedMotionPreference ? 'shader-static' : 'hyperstorm')

  if (reducedMotionPreference) return

  void activateHyperSignalCanvas().then((controller) => {
    if (!controller || !document.body.classList.contains('is-hyperstorm')) return
    document.body.classList.add('is-hyperstorm-pixi-ready')
    stopLegacyHyperstormCanvas()
  })

  const canvas = document.querySelector<HTMLCanvasElement>('.hyperstorm-canvas')
  const context = canvas?.getContext('2d')
  if (!canvas || !context) return
  canvas.style.opacity = '1'

  if (hyperstormRaf !== null) {
    window.cancelAnimationFrame(hyperstormRaf)
  }

  if (hyperstormResizeHandler) {
    window.removeEventListener('resize', hyperstormResizeHandler)
    hyperstormResizeHandler = null
  }

  if (hyperstormVisibilityHandler) {
    document.removeEventListener('visibilitychange', hyperstormVisibilityHandler)
    hyperstormVisibilityHandler = null
  }

  const resize = () => {
    const dpr = getHyperstormDpr()
    canvas.width = Math.floor(window.innerWidth * dpr)
    canvas.height = Math.floor(window.innerHeight * dpr)
    canvas.style.width = `${window.innerWidth}px`
    canvas.style.height = `${window.innerHeight}px`
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  resize()
  hyperstormParticles = Array.from({ length: getHyperstormParticleCount() }, (_, index) => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    vx: 1.4 + Math.random() * 4.4,
    vy: -0.8 + Math.random() * 1.6,
    phase: Math.random() * Math.PI * 2 + index * 0.07,
    size: 22 + Math.random() * 76,
    alpha: 0.22 + Math.random() * 0.56,
  }))

  let last = performance.now()
  let burstUntil = performance.now() + 2300
  const frame = (now: number) => {
    if (document.hidden || !document.body.classList.contains('is-hyperstorm')) {
      hyperstormRaf = null
      return
    }

    const activeBurst = now < burstUntil
    const minInterval = activeBurst ? 1000 / 60 : window.innerWidth < 700 ? 1000 / 24 : 1000 / 32

    if (now - last < minInterval) {
      hyperstormRaf = window.requestAnimationFrame(frame)
      return
    }

    const dt = Math.min(0.05, (now - last) / 1000)
    const time = now / 1000
    last = now

    context.clearRect(0, 0, window.innerWidth, window.innerHeight)
    context.globalCompositeOperation = 'lighter'

    const gradient = context.createRadialGradient(
      window.innerWidth * 0.62,
      window.innerHeight * 0.28,
      0,
      window.innerWidth * 0.62,
      window.innerHeight * 0.28,
      Math.max(window.innerWidth, window.innerHeight) * 0.72,
    )
    gradient.addColorStop(0, activeBurst ? 'rgba(132, 207, 188, 0.14)' : 'rgba(132, 207, 188, 0.08)')
    gradient.addColorStop(0.52, activeBurst ? 'rgba(110, 160, 220, 0.06)' : 'rgba(110, 160, 220, 0.034)')
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, window.innerWidth, window.innerHeight)

    hyperstormParticles.forEach((particle, index) => {
      const curl = Math.sin(time * 1.8 + particle.phase + particle.y * 0.006) * 2.4
      const lift = Math.cos(time * 1.3 + particle.phase + particle.x * 0.004) * 1.4
      const intensity = activeBurst ? 1.12 : 0.74
      particle.x += (particle.vx + curl) * dt * 38 * intensity
      particle.y += (particle.vy + lift) * dt * 30 * intensity

      if (particle.x > window.innerWidth + particle.size) particle.x = -particle.size
      if (particle.x < -particle.size) particle.x = window.innerWidth + particle.size
      if (particle.y > window.innerHeight + particle.size) particle.y = -particle.size
      if (particle.y < -particle.size) particle.y = window.innerHeight + particle.size

      const length = particle.size * (1.2 + Math.sin(time + index) * 0.24)
      const x2 = particle.x - length
      const y2 = particle.y + Math.sin(time * 2 + particle.phase) * 18
      const beam = context.createLinearGradient(particle.x, particle.y, x2, y2)
      const alpha = particle.alpha * (activeBurst ? 0.58 : 0.38) *
        (0.78 + Math.sin(time * 2.3 + particle.phase) * 0.18)

      beam.addColorStop(0, `rgba(236, 246, 252, ${alpha})`)
      beam.addColorStop(0.42, `rgba(132, 207, 188, ${alpha * 0.62})`)
      beam.addColorStop(1, 'rgba(132, 207, 188, 0)')
      context.strokeStyle = beam
      context.lineWidth = index % 7 === 0 ? 1.4 : 0.72
      context.beginPath()
      context.moveTo(particle.x, particle.y)
      context.quadraticCurveTo(
        particle.x - length * 0.46,
        particle.y - Math.sin(time + particle.phase) * 24,
        x2,
        y2,
      )
      context.stroke()
    })

    hyperstormRaf = window.requestAnimationFrame(frame)
  }

  hyperstormResizeHandler = () => {
    resize()
    hyperstormParticles = hyperstormParticles.slice(0, getHyperstormParticleCount())
    burstUntil = performance.now() + 900
  }
  hyperstormVisibilityHandler = () => {
    if (document.hidden || !document.body.classList.contains('is-hyperstorm')) return
    last = performance.now()
    burstUntil = last + 900
    if (hyperstormRaf === null && hyperstormFrameHandler) {
      hyperstormRaf = window.requestAnimationFrame(hyperstormFrameHandler)
    }
  }
  hyperstormFrameHandler = frame

  window.addEventListener('resize', hyperstormResizeHandler)
  document.addEventListener('visibilitychange', hyperstormVisibilityHandler)
  hyperstormRaf = window.requestAnimationFrame(frame)
}

function stopLegacyHyperstormCanvas() {
  if (hyperstormRaf !== null) {
    window.cancelAnimationFrame(hyperstormRaf)
    hyperstormRaf = null
  }

  if (hyperstormResizeHandler) {
    window.removeEventListener('resize', hyperstormResizeHandler)
    hyperstormResizeHandler = null
  }

  if (hyperstormVisibilityHandler) {
    document.removeEventListener('visibilitychange', hyperstormVisibilityHandler)
    hyperstormVisibilityHandler = null
  }

  hyperstormFrameHandler = null
  hyperstormParticles = []

  const canvas = document.querySelector<HTMLCanvasElement>('.hyperstorm-canvas')
  const context = canvas?.getContext('2d')
  if (canvas && context) {
    context.clearRect(0, 0, canvas.width, canvas.height)
    canvas.width = 0
    canvas.height = 0
    canvas.style.removeProperty('opacity')
  }
}

function stopHyperstorm() {
  document.body.classList.remove('is-hyperstorm')
  document.body.classList.remove('is-hyperstorm-pixi-ready')
  stopHyperSignalCanvas()
  stopLegacyHyperstormCanvas()
}

function getHyperstormDpr() {
  const rawDpr = window.devicePixelRatio || 1
  const baseCap = window.innerWidth < 700 ? 1.1 : 1.35
  const pixelBudget = window.innerWidth < 700 ? 850_000 : 1_850_000
  const budgetCap = Math.sqrt(pixelBudget / Math.max(window.innerWidth * window.innerHeight, 1))

  return Math.max(0.85, Math.min(rawDpr, baseCap, budgetCap))
}

function getHyperstormParticleCount() {
  const pixels = window.innerWidth * window.innerHeight
  const base = window.innerWidth < 700 ? 32 : window.innerWidth < 1120 ? 52 : 76
  const pixelScale = pixels > 2_100_000 ? 0.72 : pixels > 1_450_000 ? 0.86 : 1

  return Math.max(24, Math.round(base * pixelScale))
}

function readSignalMode(): SignalMode | null {
  try {
    const value = window.sessionStorage.getItem(signalModeStorageKey)
    return value === 'calm' || value === 'storm' || value === 'normal'
      ? value
      : null
  } catch {
    return null
  }
}

function writeSignalMode(mode: SignalMode) {
  try {
    if (mode === 'normal') {
      window.sessionStorage.removeItem(signalModeStorageKey)
    } else {
      window.sessionStorage.setItem(signalModeStorageKey, mode)
    }
  } catch {
    // Visual intensity still works without session persistence.
  }
}

function playRouteArrival(routeLayer: HTMLElement) {
  if (reducedMotionPreference) return
  const target = readRouteTarget()
  if (!target) return

  clearRouteTarget()
  document.documentElement.dataset.routePhase = 'arrived'
  document.documentElement.dataset.routeIntent = inferRouteIntent(target)
  routeLayer.dataset.routeIntent = inferRouteIntent(target)
  routeLayer.querySelector('[data-route-transition-target]')?.replaceChildren(
    document.createTextNode(formatUrl(target)),
  )
  document.body.classList.add('is-route-arrived')
  window.setTimeout(() => {
    document.body.classList.remove('is-route-arrived')
    delete document.documentElement.dataset.routePhase
    delete document.documentElement.dataset.routeIntent
    delete routeLayer.dataset.routeIntent
  }, 680)
}

function navigateWithRoute(url: string) {
  const nextUrl = toUrl(url)
  if (!nextUrl) return

  if (isSamePageHash(nextUrl)) {
    focusHashTarget(nextUrl)
    return
  }

  startRouteTransition(nextUrl.href)
}

function startRouteTransition(url: string) {
  if (reducedMotionPreference) {
    window.location.href = url
    return
  }

  writeRouteTarget(url)
  document.documentElement.dataset.routePhase = 'leaving'
  document.documentElement.dataset.routeIntent = inferRouteIntent(url)
  document.body.classList.add('is-route-leaving')
  playSoundfieldTone('route')

  if (routeTransitionTimer !== null) {
    window.clearTimeout(routeTransitionTimer)
  }

  routeTransitionTimer = window.setTimeout(() => {
    window.location.href = url
    routeTransitionTimer = null
  }, routeDelay)
}

function primeRouteOrigin(anchor: HTMLAnchorElement, url: URL, routeLayer: HTMLElement) {
  const rect = anchor.getBoundingClientRect()
  const x = rect.left + rect.width / 2
  const y = rect.top + rect.height / 2
  const intent = inferRouteIntent(url.href)

  document.documentElement.style.setProperty('--route-origin-x', `${x}px`)
  document.documentElement.style.setProperty('--route-origin-y', `${y}px`)
  document.documentElement.style.setProperty('--route-origin-width', `${Math.max(rect.width, 44)}px`)
  document.documentElement.style.setProperty('--route-origin-height', `${Math.max(rect.height, 44)}px`)
  document.documentElement.dataset.routeIntent = intent
  routeLayer.dataset.routeIntent = intent
  anchor.classList.add('is-route-origin')
  anchor.style.setProperty('view-transition-name', 'route-origin')

  window.setTimeout(() => {
    anchor.classList.remove('is-route-origin')
    anchor.style.removeProperty('view-transition-name')
  }, routeDelay + 140)
}

function inferRouteIntent(url: string) {
  const nextUrl = toUrl(url)
  const path = nextUrl?.pathname || url

  if (/workflow/i.test(path)) return 'workflow'
  if (/lab/i.test(path)) return 'lab'
  if (/field/i.test(path)) return 'field'
  if (/archive/i.test(path)) return 'archive'
  if (/about/i.test(path)) return 'about'
  return 'home'
}

function getPaletteCommands(context: GlobalEffectsOptions['context']) {
  const collected = collectDocumentCommands(context)
  const seen = new Set<string>()

  return [...baseCommands, ...hiddenCommands, ...collected].filter((item) => {
    const key = item.action ? `action:${item.action}` : item.url
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function collectDocumentCommands(context: GlobalEffectsOptions['context']) {
  const commands: PaletteCommand[] = []

  document.querySelectorAll<HTMLElement>('.entry-section[id], #cover, #feed, #archive').forEach((section) => {
    const heading =
      section.querySelector<HTMLElement>('h1, h2, h3')?.textContent?.trim() ||
      section.id
    commands.push(
      command(
        `section-${section.id}`,
        heading,
        context === 'home' ? '首页区块' : '正文区块',
        `${window.location.pathname}#${section.id}`,
        `${heading} ${section.id}`,
      ),
    )
  })

  document.querySelectorAll<HTMLAnchorElement>('.entry-nav a, .entry-footer a, .entry-anchor-nav a, .topnav a').forEach((link, index) => {
    const title = link.textContent?.trim()
    const href = link.getAttribute('href')
    if (!title || !href || href.startsWith('http')) return

    commands.push(
      command(
        `link-${index}-${href}`,
        title,
        '页面链接',
        href,
        `${title} ${href}`,
      ),
    )
  })

  return commands
}

function filterCommands(commands: PaletteCommand[], query: string) {
  if (!query) return commands.filter((item) => !item.hidden)

  return commands.filter((item) => {
    const haystack = normalize(`${item.title} ${item.kicker} ${item.url} ${item.keywords}`)
    return query.split(/\s+/).every((part) => haystack.includes(part))
  })
}

function normalize(value: string) {
  return value.trim().toLowerCase()
}

function formatUrl(url: string) {
  return url.replace(window.location.origin, '').replace(/^\/index\.html$/, '/')
}

function toUrl(url: string) {
  try {
    return new URL(url, window.location.href)
  } catch {
    return null
  }
}

function isDocumentRoute(url: URL) {
  const lastSegment = url.pathname.split('/').pop() || ''

  if (!lastSegment || lastSegment.endsWith('.html')) return true

  return !/\.[a-z0-9]{2,8}$/i.test(lastSegment)
}

function isSamePageHash(url: URL) {
  return (
    url.origin === window.location.origin &&
    url.pathname === window.location.pathname &&
    url.search === window.location.search &&
    Boolean(url.hash)
  )
}

function focusHashTarget(url: URL) {
  const hash = url.hash.slice(1)
  const target = document.getElementById(hash)

  if (!target) {
    focusCodeRangeHash(url, hash)
    return
  }

  const lineButton = target instanceof HTMLButtonElement &&
    target.classList.contains('code-console-line-button')

  if (lineButton) {
    const wrapper = target.closest<HTMLElement>('.code-console')
    const liveStatus = wrapper?.querySelector<HTMLElement>('.code-console-status')
    const preText = wrapper?.querySelector<HTMLPreElement>('pre')?.textContent ?? ''
    const lineNumber = Number(target.dataset.line || 0)

    if (wrapper && liveStatus && lineNumber > 0) {
      activateCodeLine({
        wrapper,
        button: target,
        lineText: normalizeCodeLines(preText)[lineNumber - 1] ?? '',
        lineNumber,
        liveStatus,
        copyLine: false,
      })
    }
  }

  target.scrollIntoView({
    block: 'start',
    behavior: reducedMotionPreference ? 'auto' : 'smooth',
  })

  window.history.pushState(null, '', url.href)

  const hadTabIndex = target.hasAttribute('tabindex')
  if (!hadTabIndex) target.setAttribute('tabindex', '-1')

  window.setTimeout(() => {
    target.focus({ preventScroll: true })
    if (!hadTabIndex) {
      target.addEventListener('blur', () => target.removeAttribute('tabindex'), {
        once: true,
      })
    }
  }, reducedMotionPreference ? 0 : 260)
}

function focusCodeRangeHash(url: URL, hash: string) {
  const match = hash.match(/^(.*)-L(\d+)(?:-L?(\d+))$/)
  if (!match) return

  const [, codeId, startRaw, endRaw] = match
  const startLine = Number(startRaw)
  const endLine = Number(endRaw)
  const wrapper = document.getElementById(codeId)?.closest<HTMLElement>('.code-console')
  const startButton = wrapper?.querySelector<HTMLButtonElement>(`#${CSS.escape(codeId)}-L${startLine}`)
  const endButton = wrapper?.querySelector<HTMLButtonElement>(`#${CSS.escape(codeId)}-L${endLine}`)
  const liveStatus = wrapper?.querySelector<HTMLElement>('.code-console-status')
  const lines = normalizeCodeLines(wrapper?.querySelector<HTMLPreElement>('pre')?.textContent ?? '')

  if (!wrapper || !startButton || !endButton || !liveStatus) return

  void activateCodeLineRange({
    wrapper,
    startButton,
    endButton,
    lines,
    liveStatus,
    copyRange: false,
  })
  startButton.scrollIntoView({
    block: 'center',
    behavior: reducedMotionPreference ? 'auto' : 'smooth',
  })
  window.history.pushState(null, '', url.href)
}

function readRouteTarget() {
  try {
    return window.sessionStorage.getItem(routeStorageKey)
  } catch {
    return null
  }
}

function writeRouteTarget(url: string) {
  try {
    window.sessionStorage.setItem(routeStorageKey, url)
  } catch {
    // Route transition still works without arrival metadata.
  }
}

function clearRouteTarget() {
  try {
    window.sessionStorage.removeItem(routeStorageKey)
  } catch {
    // Storage may be blocked; ignore and keep navigation functional.
  }
}

function clampIndex(index: number, length: number) {
  if (length <= 0) return 0
  return Math.min(Math.max(index, 0), length - 1)
}

function normalizeCodeLines(text: string) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')

  if (lines.length > 1 && lines[lines.length - 1] === '') {
    lines.pop()
  }

  return lines.length > 0 ? lines : ['']
}

async function activateCodeLine(options: CodeLineActivationOptions) {
  const { wrapper, button, lineText, lineNumber, liveStatus, copyLine } = options
  const marker = wrapper.querySelector<HTMLElement>('.code-console-line-marker')

  clearSelectedCodeLine(wrapper)
  wrapper.classList.add('has-line-selected')
  wrapper.style.setProperty('--active-code-line-top', `${button.offsetTop}px`)
  wrapper.style.setProperty('--active-code-line-number', `"${lineNumber}"`)
  button.classList.add('is-selected')
  button.setAttribute('aria-current', 'true')

  if (marker) {
    marker.textContent = `L${lineNumber}`
  }

  if (window.location.hash !== `#${button.id}`) {
    window.history.replaceState(null, '', `#${button.id}`)
  }

  if (!copyLine) {
    liveStatus.textContent = `已定位第 ${lineNumber} 行`
    return
  }

  const copied = await copyText(lineText)
  wrapper.classList.toggle('is-line-copied', copied)
  liveStatus.textContent = copied
    ? `已复制第 ${lineNumber} 行`
    : `第 ${lineNumber} 行复制失败`

  window.setTimeout(() => {
    wrapper.classList.remove('is-line-copied')
  }, 900)
}

async function activateCodeLineRange(options: CodeLineRangeActivationOptions) {
  const { wrapper, startButton, endButton, lines, liveStatus, copyRange } = options
  const marker = wrapper.querySelector<HTMLElement>('.code-console-line-marker')
  const start = Number(startButton.dataset.line || 0)
  const end = Number(endButton.dataset.line || 0)
  const from = Math.min(start, end)
  const to = Math.max(start, end)
  const buttons = Array.from(
    wrapper.querySelectorAll<HTMLButtonElement>('.code-console-line-button'),
  ).filter((button) => {
    const line = Number(button.dataset.line || 0)
    return line >= from && line <= to
  })
  const firstButton = buttons[0] ?? startButton
  const lastButton = buttons[buttons.length - 1] ?? endButton
  const lineHeight = Math.max(1, lastButton.offsetTop - firstButton.offsetTop + lastButton.offsetHeight)

  clearSelectedCodeLine(wrapper)
  wrapper.classList.add('has-line-selected', 'has-line-range')
  wrapper.style.setProperty('--active-code-line-top', `${firstButton.offsetTop}px`)
  wrapper.style.setProperty('--active-code-line-height', `${lineHeight}px`)
  wrapper.style.setProperty('--active-code-line-number', `"${from}-${to}"`)

  buttons.forEach((button) => {
    button.classList.add('is-selected')
    button.setAttribute('aria-current', 'true')
  })

  if (marker) {
    marker.textContent = `L${from}-L${to}`
  }

  const hash = `#${wrapper.querySelector<HTMLPreElement>('pre')?.id}-L${from}-L${to}`
  if (window.location.hash !== hash) {
    window.history.replaceState(null, '', hash)
  }

  if (!copyRange) {
    liveStatus.textContent = `已定位第 ${from} 到 ${to} 行`
    return
  }

  const copied = await copyText(lines.slice(from - 1, to).join('\n'))
  wrapper.classList.toggle('is-line-copied', copied)
  liveStatus.textContent = copied
    ? `已复制第 ${from} 到 ${to} 行`
    : `第 ${from} 到 ${to} 行复制失败`

  window.setTimeout(() => {
    wrapper.classList.remove('is-line-copied')
  }, 900)
}

function clearSelectedCodeLine(wrapper: HTMLElement) {
  wrapper.classList.remove('has-line-selected', 'has-line-range')
  wrapper.style.removeProperty('--active-code-line-height')
  wrapper.querySelectorAll('.code-console-line-button.is-selected').forEach((button) => {
    button.classList.remove('is-selected')
    button.removeAttribute('aria-current')
  })
}

function activateInitialCodeLineFromHash(
  wrapper: HTMLElement,
  codeId: string,
  liveStatus: HTMLElement,
) {
  if (!window.location.hash.startsWith(`#${codeId}-L`)) return

  const button = wrapper.querySelector<HTMLButtonElement>(window.location.hash)
  if (!button) {
    const match = window.location.hash.slice(1).match(/^(.*)-L(\d+)(?:-L?(\d+))$/)
    if (!match) return

    const startButton = wrapper.querySelector<HTMLButtonElement>(`#${CSS.escape(codeId)}-L${Number(match[2])}`)
    const endButton = wrapper.querySelector<HTMLButtonElement>(`#${CSS.escape(codeId)}-L${Number(match[3])}`)
    const lines = normalizeCodeLines(
      wrapper.querySelector<HTMLPreElement>('pre')?.textContent ?? '',
    )

    if (!startButton || !endButton) return

    void activateCodeLineRange({
      wrapper,
      startButton,
      endButton,
      lines,
      liveStatus,
      copyRange: false,
    })
    return
  }

  const lineNumber = Number(button.dataset.line || 0)
  const lines = normalizeCodeLines(
    wrapper.querySelector<HTMLPreElement>('pre')?.textContent ?? '',
  )

  void activateCodeLine({
    wrapper,
    button,
    lineText: lines[lineNumber - 1] ?? '',
    lineNumber,
    liveStatus,
    copyLine: false,
  })
}

function configureButton(button: HTMLButtonElement, text: string, label: string) {
  button.type = 'button'
  button.className = 'code-console-button'
  button.textContent = text
  button.setAttribute('aria-label', label)
}

function textNode(tag: 'span' | 'strong', text: string) {
  const element = document.createElement(tag)
  element.textContent = text
  return element
}

function decorativeElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
) {
  const element = document.createElement(tag)
  element.className = className
  element.setAttribute('aria-hidden', 'true')
  return element
}

function inferCodeLabel(text: string, index: number) {
  const firstLine = text.trim().split(/\r?\n/)[0]?.trim()

  if (!firstLine) return `capture ${String(index + 1).padStart(2, '0')}`
  if (/^\{|\[/.test(firstLine)) return 'json capture'
  if (/^\d{1,2}:\d{2}/.test(firstLine)) return 'field log capture'
  if (/port|localhost|vite|finalUrl/i.test(firstLine)) return 'runtime log'
  if (/agent|queue|workflow|context/i.test(firstLine)) return 'agent route trace'

  return firstLine.slice(0, 32)
}

async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fallback below.
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.append(textarea)
  textarea.select()

  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    textarea.remove()
  }
}

