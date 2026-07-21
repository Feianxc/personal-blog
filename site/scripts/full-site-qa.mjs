import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const siteRoot = resolve(scriptDir, '..')
const projectRoot = resolve(siteRoot, '..')
const distRoot = resolve(siteRoot, 'dist')
const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-')
const runRoot = resolve(projectRoot, '.workspace', 'frontend-studio', 'runs', `${timestamp}-full-site-qa`)
const mediaRoot = resolve('E:/codex_media/personal-blog')
const reportPath = join(runRoot, 'full-site-qa-report.json')
const reportMdPath = join(runRoot, 'full-site-qa-report.md')
const screenshotDesktop = join(mediaRoot, 'homepage-desktop.png')
const screenshotMobile = join(mediaRoot, 'homepage-mobile.png')

const viewportMatrix = [
  { name: 'desktop', width: 1440, height: 960, deviceScaleFactor: 1 },
  { name: 'tablet', width: 768, height: 1024, deviceScaleFactor: 1 },
  { name: 'mobile430', width: 430, height: 932, deviceScaleFactor: 2 },
  { name: 'mobile', width: 390, height: 844, deviceScaleFactor: 2 },
  { name: 'mobile360', width: 360, height: 800, deviceScaleFactor: 2 },
  { name: 'mobile320', width: 320, height: 568, deviceScaleFactor: 2 },
]

const requiredHomePhrases = [
  '个人数字实验室',
  '把日常工作',
  '生活里的事',
  '更智能',
  '更直观',
  '现场',
]

const forbiddenPublicCopy = [
  'AI-native',
  '个人操作系统',
  '证据工程',
  'Evidence',
  'evidence slice',
  'Agent',
  'Token',
  '喜欢把麻烦做成能点开的东西',
  '作为AI',
  '作为一个AI',
  '当然可以',
  '以下是',
  'lorem',
  'TODO',
  'FIXME',
  '占位文案',
  '示例文案',
  '由AI生成',
  '提示词',
  '思考过程',
  '用户要求',
  '用户给',
  '执行要求',
]

const maxRouteTransferKb = 700

if (!existsSync(distRoot)) {
  throw new Error(`dist directory not found: ${distRoot}. Run npm run build first.`)
}

mkdirSync(runRoot, { recursive: true })
mkdirSync(mediaRoot, { recursive: true })

const htmlFiles = readdirSync(distRoot)
  .filter((file) => file.endsWith('.html'))
  .sort((a, b) => a.localeCompare(b))
const routes = ['/', ...htmlFiles.filter((file) => file !== 'index.html').map((file) => `/${file}`)]

let baseUrl = ''
let cdp
const runtimeEvents = []
const networkEvents = []
const results = []
const interactionResults = []
const failures = []
const warnings = []

const cdpCommandTimeouts = {
  'Runtime.evaluate': 24_000,
  'Emulation.setDeviceMetricsOverride': 24_000,
  'Page.navigate': 20_000,
  'Page.captureScreenshot': 20_000,
}
const cdpRetryableMethods = new Set([
  'Emulation.setDeviceMetricsOverride',
  'Emulation.setEmulatedMedia',
  'Page.captureScreenshot',
])

async function main() {
  const staticCheck = runStaticLinkCheck(htmlFiles)
  const assetCheck = runNoStaleAssetCheck()
  const criticalFallbackCheck = runCriticalFallbackCheck()
  const motionSourceContractCheck = runMotionSourceContractCheck()
  const server = await startStaticServer(distRoot)
  baseUrl = `http://127.0.0.1:${server.port}`
  const chrome = await launchChrome()
  cdp = await createPageSession(chrome.port)

  cdp.on('Runtime.exceptionThrown', (event) => {
    const details = event.exceptionDetails || {}
    const stack = (details.stackTrace?.callFrames || [])
      .slice(0, 4)
      .map((frame) => `${frame.functionName || '<anonymous>'}@${frame.url || 'inline'}:${frame.lineNumber ?? 0}`)
      .join(' <- ')
    runtimeEvents.push({
      type: 'exception',
      text: [details.text, details.exception?.description, stack].filter(Boolean).join(' | ') || 'Runtime exception',
    })
  })
  cdp.on('Runtime.consoleAPICalled', (event) => {
    const level = event.type
    if (level === 'error' || level === 'warning') {
      runtimeEvents.push({
        type: `console:${level}`,
        text: (event.args || []).map((arg) => arg.value ?? arg.description ?? '').join(' '),
      })
    }
  })
  cdp.on('Log.entryAdded', (event) => {
    const level = event.entry?.level
    if (level === 'error' || level === 'warning') {
      runtimeEvents.push({
        type: `log:${level}`,
        text: event.entry?.text || '',
        url: event.entry?.url || '',
      })
    }
  })
  cdp.on('Network.responseReceived', (event) => {
    networkEvents.push({
      url: event.response?.url || '',
      status: event.response?.status || 0,
      type: event.type,
    })
  })
  cdp.on('Network.loadingFailed', (event) => {
    if (event.canceled || event.errorText === 'net::ERR_ABORTED') return
    runtimeEvents.push({
      type: 'network-error',
      text: event.errorText || 'Network loading failed',
      url: event.url || '',
    })
  })

  try {
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    await cdp.send('Log.enable')
    await cdp.send('Network.enable')

    for (const route of routes) {
      for (const viewport of viewportMatrix) {
        const pageResult = await auditRoute(route, viewport)
        results.push(pageResult)
        collectFindings(pageResult, failures, warnings)
      }
    }

    interactionResults.push(await auditHomeInteractions())
    interactionResults.push(await auditPointerPersonaStates())
    interactionResults.push(await auditTouchProbeFeedback())
    interactionResults.push(await auditProjectGalleryMotion())
    interactionResults.push(await auditMotionPreferenceLifecycle())
    interactionResults.push(await auditCoarsePointerCadMotion())
    interactionResults.push(await auditCommandPaletteKeyboard())
    interactionResults.push(await auditRouteTransitionSmoke())
    interactionResults.push(await auditReducedMotion())
    interactionResults.push(await auditProjectCaseReducedMotion())
    interactionResults.push(await auditReactorContextLoss())
    interactionResults.push(await auditCodeConsoleCollapse())
    interactionResults.forEach((result) => collectInteractionFindings(result, failures, warnings))
  } finally {
    await cdp.close().catch(() => {})
    await stopChrome(chrome.process, chrome.userDataDir)
    await server.close()
    rmSync(chrome.userDataDir, { recursive: true, force: true })
  }

  staticCheck.failures.forEach((item) => failures.push(item))
  staticCheck.warnings.forEach((item) => warnings.push(item))
  assetCheck.failures.forEach((item) => failures.push(item))
  assetCheck.warnings.forEach((item) => warnings.push(item))
  criticalFallbackCheck.failures.forEach((item) => failures.push(item))
  criticalFallbackCheck.warnings.forEach((item) => warnings.push(item))
  motionSourceContractCheck.failures.forEach((item) => failures.push(item))
  motionSourceContractCheck.warnings.forEach((item) => warnings.push(item))

  const report = {
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    baseUrl,
    generatedAt: new Date().toISOString(),
    siteRoot,
    distRoot,
    routes: routes.length,
    checks: results.length,
    staticLinkCheck: staticCheck,
    noStaleAssetCheck: assetCheck,
    criticalFallbackCheck,
    motionSourceContractCheck,
    results,
    interactionResults,
    screenshots: {
      desktop: screenshotDesktop,
      mobile: screenshotMobile,
    },
    warnings,
    failures,
  }

  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8')
  writeFileSync(reportMdPath, renderMarkdownReport(report), 'utf8')

  console.log(`Full site QA status: ${report.status}`)
  console.log(`Routes: ${routes.length}; checks: ${results.length}; warnings: ${warnings.length}; failures: ${failures.length}`)
  console.log(`Report: ${reportPath}`)
  console.log(`Markdown: ${reportMdPath}`)
  console.log(`Screenshots: ${screenshotDesktop}; ${screenshotMobile}`)

  if (failures.length > 0) {
    console.error(JSON.stringify(failures.slice(0, 12), null, 2))
    process.exitCode = 1
  }
}

async function auditRoute(route, viewport) {
  runtimeEvents.length = 0
  networkEvents.length = 0
  const mobileViewport = viewport.name.startsWith('mobile')
  await cdp.send(
    'Emulation.setTouchEmulationEnabled',
    mobileViewport ? { enabled: true, maxTouchPoints: 1 } : { enabled: false },
  )
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor,
    mobile: mobileViewport,
  })
  await cdp.send('Emulation.setEmulatedMedia', { features: [] })

  const url = `${baseUrl}${route}`
  const loadPromise = cdp.waitForEvent('Page.loadEventFired', () => true, 15_000)
  const nav = await cdp.send('Page.navigate', { url })
  if (nav.errorText) {
    runtimeEvents.push({ type: 'navigation', text: nav.errorText })
  }
  await loadPromise.catch((error) => {
    runtimeEvents.push({ type: 'load-timeout', text: error.message })
  })
  await delay(450)

  if (route === '/' && viewport.name === 'desktop') {
    await saveScreenshot(screenshotDesktop)
  }
  if (route === '/' && viewport.name === 'mobile') {
    await saveScreenshot(screenshotMobile)
  }

  const page = await evaluatePage()
  const documentStatus = networkEvents.find((event) => event.type === 'Document' && normalizeUrl(event.url) === normalizeUrl(url))?.status ?? 0
  const badResources = networkEvents
    .filter((event) => event.status >= 400)
    .filter((event) => !event.url.endsWith('/favicon.ico'))
    .slice(0, 8)

  return {
    route,
    viewport: viewport.name,
    url,
    documentStatus,
    title: page.title,
    h1: page.h1,
    readyState: page.readyState,
    textLength: page.textLength,
    chineseRatio: page.chineseRatio,
    horizontalOverflow: page.horizontalOverflow,
    widestVisible: page.widestVisible,
    commandTrigger: page.commandTrigger,
    quickActions: page.quickActions,
    quickActionMetrics: page.quickActionMetrics,
    liveSystems: page.liveSystems,
    reactor: page.reactor,
    projectGallery: page.projectGallery,
    orbitCards: page.orbitCards,
    cursor: page.cursor,
    clarity: page.clarity,
    forbiddenCopyHits: page.forbiddenCopyHits,
    navLinks: page.navLinks,
    navDurationMs: Math.round(page.navDurationMs),
    transferKb: Math.round(page.transferKb),
    badResources,
    runtimeEvents: runtimeEvents.slice(0, 8),
  }
}

async function auditHomeInteractions() {
  runtimeEvents.length = 0
  networkEvents.length = 0
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 960,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await cdp.send('Page.navigate', { url: `${baseUrl}/` })
  await cdp.waitForEvent('Page.loadEventFired', () => true, 15_000).catch(() => {})
  await delay(550)

  const before = await evalValue(`(() => Array.from(document.querySelectorAll('.signal-quick-action')).map((button) => button.textContent?.trim()))()`)
  await evalValue(`(() => {
    const find = (label) => Array.from(document.querySelectorAll('.signal-quick-action')).find((button) => button.textContent?.trim() === label)
    ;['风压', '风暴', '透视', '声场', '安静', '命令'].forEach((label, index) => {
      window.setTimeout(() => find(label)?.click(), index * 260)
    })
  })()`)
  await delay(2300)
  const after = await evalValue(`(() => ({
    labels: Array.from(document.querySelectorAll('.signal-quick-action')).map((button) => button.textContent?.trim()),
    commandOpen: document.body.classList.contains('is-command-open'),
    xrayExists: Boolean(document.querySelector('.xray-overlay')),
    xrayOpen: document.body.classList.contains('is-xray-open'),
    soundfieldOn: document.body.classList.contains('is-soundfield-on'),
    calm: document.body.classList.contains('is-signal-calm'),
    hyperCanvasReady: Boolean(document.querySelector('.hyper-signal-canvas-root[data-canvas-ready="true"]')),
    overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
  }))()`)

  return {
    name: 'homepage visual controls',
    before,
    after,
    runtimeEvents: runtimeEvents.slice(0, 8),
  }
}

async function auditPointerPersonaStates() {
  runtimeEvents.length = 0
  networkEvents.length = 0
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false })
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 960,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await cdp.send('Page.navigate', { url: `${baseUrl}/` })
  await cdp.waitForEvent('Page.loadEventFired', () => true, 15_000).catch(() => {})
  await delay(550)

  const result = await evalValue(`(async () => {
    const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))
    const failures = []
    const states = []
    const targets = [
      ['scan', '[data-clarity-map] [data-pointer-mode="scan"]'],
      ['terminal', '[data-clarity-map] [data-pointer-mode="terminal"]'],
      ['index', '[data-clarity-map] [data-pointer-mode="index"]'],
      ['launch', 'a[href*="github.com"][data-pointer-mode="launch"]'],
    ]

    if (typeof PointerEvent !== 'function') {
      failures.push('PointerEvent constructor is unavailable')
      return { states, failures }
    }

    for (const [mode, selector] of targets) {
      const target = document.querySelector(selector)
      if (!target) {
        failures.push('missing pointer persona target ' + mode + ' at ' + selector)
        continue
      }

      target.scrollIntoView({ block: 'center', inline: 'nearest' })
      await wait(80)
      const rect = target.getBoundingClientRect()
      const point = {
        clientX: rect.left + Math.min(Math.max(rect.width / 2, 12), rect.width - 4),
        clientY: rect.top + Math.min(Math.max(rect.height / 2, 12), rect.height - 4),
      }
      const options = { bubbles: true, cancelable: true, button: 0, buttons: 1, pointerId: 7, pointerType: 'mouse', ...point }
      target.dispatchEvent(new PointerEvent('pointerenter', options))
      target.dispatchEvent(new PointerEvent('pointermove', options))
      await wait(90)

      const shell = document.querySelector('.pointer-shell')
      const hoverState = {
        expected: mode,
        shellMode: shell?.dataset.pointerMode || '',
        shellKind: shell?.dataset.pointerKind || '',
        shellState: shell?.dataset.pointerState || '',
        bodyMode: document.body.dataset.pointerMode || '',
        label: shell?.dataset.pointerLabel || '',
      }
      if (hoverState.shellMode !== mode) failures.push(mode + ' hover shell mode is ' + (hoverState.shellMode || 'empty'))
      if (hoverState.bodyMode !== mode) failures.push(mode + ' body mode is ' + (hoverState.bodyMode || 'empty'))

      target.dispatchEvent(new PointerEvent('pointerdown', options))
      await wait(90)
      const clickStamp = document.querySelector('.click-stamp[data-mode="' + mode + '"]')
      if (!clickStamp) failures.push(mode + ' click scan wave was not stamped')

      let chargingState = null
      if (mode === 'scan') {
        await wait(310)
        chargingState = {
          shellState: shell?.dataset.pointerState || '',
          shellMode: shell?.dataset.pointerMode || '',
          label: shell?.dataset.pointerLabel || '',
          targetCharging: target.classList.contains('is-charging'),
        }
        if (chargingState.shellState !== 'charging') failures.push('long press did not enter charging state')
        if (chargingState.shellMode !== 'scan') failures.push('charging state lost scan mode')
        if (!chargingState.targetCharging) failures.push('long press target did not receive is-charging')
        if (!chargingState.label.endsWith('+')) failures.push('charging label did not expose plus marker')
      }

      target.dispatchEvent(new PointerEvent('pointerup', options))
      target.dispatchEvent(new PointerEvent('pointerleave', options))
      await wait(110)
      states.push({
        selector,
        hoverState,
        clickStamped: Boolean(clickStamp),
        chargingState,
        releasedState: shell?.dataset.pointerState || '',
      })
    }

    return {
      states,
      hasPointerFx: document.body.classList.contains('has-pointer-fx'),
      failures,
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
    }
  })()`)

  if (result.overflow > 2) {
    result.failures.push(`pointer persona overflow ${result.overflow}px`)
  }
  if (!result.hasPointerFx) {
    result.failures.push('desktop pointer FX class is missing')
  }

  return {
    name: 'pointer persona states',
    ...result,
    runtimeEvents: runtimeEvents.slice(0, 8),
  }
}

async function auditTouchProbeFeedback() {
  runtimeEvents.length = 0
  networkEvents.length = 0
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  })
  await cdp.send('Page.navigate', { url: `${baseUrl}/` })
  await cdp.waitForEvent('Page.loadEventFired', () => true, 15_000).catch(() => {})
  await delay(650)

  const result = await evalValue(`(async () => {
    const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))
    const failures = []
    const target = document.querySelector('[data-project-gallery] [data-project-card][data-pointer-mode="scan"]')

    if (typeof PointerEvent !== 'function') {
      failures.push('PointerEvent constructor is unavailable for touch audit')
      return { failures }
    }
    if (!target) {
      failures.push('touch probe target is missing')
      return { failures }
    }

    target.scrollIntoView({ block: 'center', inline: 'nearest' })
    await wait(90)
    const rect = target.getBoundingClientRect()
    const options = {
      bubbles: true,
      cancelable: true,
      button: 0,
      buttons: 1,
      pointerId: 11,
      pointerType: 'touch',
      clientX: rect.left + Math.min(Math.max(rect.width / 2, 16), rect.width - 6),
      clientY: rect.top + Math.min(Math.max(rect.height / 2, 16), rect.height - 6),
    }
    target.dispatchEvent(new PointerEvent('pointerdown', options))
    await wait(120)

    const ripple = document.querySelector('.touch-probe-ripple')
    const rippleStyle = ripple ? window.getComputedStyle(ripple) : null
    if (!document.body.classList.contains('has-touch-probe')) failures.push('mobile touch probe body class is missing')
    if (!ripple) failures.push('touch pointerdown did not create probe ripple')
    if (ripple && ripple.dataset.mode !== 'scan') failures.push('touch ripple mode is ' + (ripple.dataset.mode || 'empty'))
    if (rippleStyle && rippleStyle.animationName === 'none') failures.push('touch ripple animation is not active')
    if (!target.matches('[data-project-card]')) failures.push('touch audit did not exercise a project card')

    target.dispatchEvent(new PointerEvent('pointerup', options))
    await wait(80)

    return {
      hasTouchProbe: document.body.classList.contains('has-touch-probe'),
      rippleMode: ripple?.dataset.mode || '',
      rippleAnimation: rippleStyle?.animationName || '',
      targetKind: target.getAttribute('data-project-kind') || target.querySelector('h3')?.textContent?.trim() || '',
      failures,
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
    }
  })()`)

  if (result.overflow > 2) {
    result.failures.push(`touch probe overflow ${result.overflow}px`)
  }

  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false }).catch(() => {})

  return {
    name: 'touch probe feedback',
    ...result,
    runtimeEvents: runtimeEvents.slice(0, 8),
  }
}

async function auditLiveSystemsTabs() {
  runtimeEvents.length = 0
  networkEvents.length = 0
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 960,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await cdp.send('Emulation.setEmulatedMedia', { features: [] })
  await cdp.send('Page.navigate', { url: `${baseUrl}/` })
  await cdp.waitForEvent('Page.loadEventFired', () => true, 15_000).catch(() => {})
  await delay(550)

  const desktop = await evalValue(`(() => {
    const keys = ['protocol', 'mcgs', 'busbar']
    const root = document.querySelector('[data-live-systems]')
    const tabs = Array.from(root?.querySelectorAll('button[data-system-tab]') || [])
    const panels = Array.from(root?.querySelectorAll('[data-system-panel]') || [])
    const stage = root?.querySelector('[data-systems-stage]')

    const snapshot = (expected, action) => {
      const selectedTabs = tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true')
      const selectedKey = selectedTabs[0]?.dataset.systemTab || ''
      const selectedPanel = panels.find((panel) => panel.dataset.systemPanel === selectedKey)
      const inactivePanels = panels.filter((panel) => panel !== selectedPanel)
      const stageRect = stage?.getBoundingClientRect()

      return {
        action,
        expected,
        rootExists: Boolean(root),
        tabCount: tabs.length,
        panelCount: panels.length,
        activeSystem: root?.dataset.systemActive || '',
        selectedKey,
        selectedCount: selectedTabs.length,
        visiblePanelCount: panels.filter((panel) => panel.getAttribute('aria-hidden') === 'false').length,
        selectedPanelHidden: selectedPanel?.getAttribute('aria-hidden') ?? null,
        selectedPanelInert: Boolean(selectedPanel?.inert),
        inactivePanelCount: inactivePanels.length,
        inactiveInertCount: inactivePanels.filter((panel) => panel.inert).length,
        tabStopCount: tabs.filter((tab) => tab.tabIndex === 0).length,
        focusedKey: document.activeElement?.dataset?.systemTab || '',
        stageWidth: Math.round(stageRect?.width || 0),
        stageHeight: Math.round(stageRect?.height || 0),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      }
    }

    const before = snapshot('protocol', 'initial')
    const clickStates = keys.map((key) => {
      tabs.find((tab) => tab.dataset.systemTab === key)?.click()
      return snapshot(key, 'click')
    })

    tabs.find((tab) => tab.dataset.systemTab === 'protocol')?.click()
    tabs.find((tab) => tab.dataset.systemTab === 'protocol')?.focus()
    const keyboardSequence = [
      ['ArrowRight', 'mcgs'],
      ['ArrowDown', 'busbar'],
      ['ArrowRight', 'protocol'],
      ['ArrowLeft', 'busbar'],
      ['ArrowUp', 'mcgs'],
      ['Home', 'protocol'],
      ['End', 'busbar'],
    ]
    const keyboardStates = keyboardSequence.map(([key, expected]) => {
      const current = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true')
      current?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
      return snapshot(expected, key)
    })

    return { before, clickStates, keyboardStates }
  })()`)

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  })
  await cdp.send('Page.navigate', { url: `${baseUrl}/` })
  await cdp.waitForEvent('Page.loadEventFired', () => true, 15_000).catch(() => {})
  await delay(550)

  const mobile = await evalValue(`(async () => {
    const keys = ['protocol', 'mcgs', 'busbar']
    const root = document.querySelector('[data-live-systems]')
    const rail = root?.querySelector('.systems-rail')
    const tabs = Array.from(root?.querySelectorAll('button[data-system-tab]') || [])
    const panels = Array.from(root?.querySelectorAll('[data-system-panel]') || [])

    const snapshot = (expected) => {
      const selectedTabs = tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true')
      const selectedKey = selectedTabs[0]?.dataset.systemTab || ''
      const selectedPanel = panels.find((panel) => panel.dataset.systemPanel === selectedKey)
      const inactivePanels = panels.filter((panel) => panel !== selectedPanel)
      return {
        expected,
        activeSystem: root?.dataset.systemActive || '',
        selectedKey,
        selectedCount: selectedTabs.length,
        visiblePanelCount: panels.filter((panel) => panel.getAttribute('aria-hidden') === 'false').length,
        selectedPanelHidden: selectedPanel?.getAttribute('aria-hidden') ?? null,
        selectedPanelInert: Boolean(selectedPanel?.inert),
        inactivePanelCount: inactivePanels.length,
        inactiveInertCount: inactivePanels.filter((panel) => panel.inert).length,
        tabStopCount: tabs.filter((tab) => tab.tabIndex === 0).length,
        overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      }
    }

    const railRect = rail?.getBoundingClientRect()
    const overlapWithRail = (tab) => {
      if (!railRect) return 0
      const rect = tab.getBoundingClientRect()
      return Math.max(0, Math.min(rect.right, railRect.right) - Math.max(rect.left, railRect.left))
    }
    const tabMetrics = tabs.map((tab) => {
      const rect = tab.getBoundingClientRect()
      const overlap = overlapWithRail(tab)
      return {
        key: tab.dataset.systemTab || '',
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        visibleInitially: overlap >= Math.min(rect.width * 0.25, 32),
      }
    })
    const overflowX = rail ? window.getComputedStyle(rail).overflowX : ''
    const maxScrollLeft = rail ? Math.max(0, rail.scrollWidth - rail.clientWidth) : 0

    if (rail) rail.scrollLeft = maxScrollLeft
    await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)))

    const lastTab = tabs.at(-1)
    const lastRect = lastTab?.getBoundingClientRect()
    const lastOverlap = lastTab && railRect ? overlapWithRail(lastTab) : 0
    const lastReachable = Boolean(lastRect && lastOverlap >= Math.min(lastRect.width * 0.4, 48))
    const actualScrollLeft = Math.round(rail?.scrollLeft || 0)
    const clickStates = keys.map((key) => {
      tabs.find((tab) => tab.dataset.systemTab === key)?.click()
      return snapshot(key)
    })
    if (rail) rail.scrollLeft = 0

    return {
      rootExists: Boolean(root),
      tabCount: tabs.length,
      panelCount: panels.length,
      railWidth: Math.round(rail?.clientWidth || 0),
      railScrollWidth: Math.round(rail?.scrollWidth || 0),
      overflowX,
      maxScrollLeft: Math.round(maxScrollLeft),
      actualScrollLeft,
      allVisibleInitially: tabMetrics.every((tab) => tab.visibleInitially),
      lastReachable,
      tabMetrics,
      clickStates,
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
    }
  })()`)

  const failures = []
  const warnings = []
  const validateState = (state, label, expectFocus = false) => {
    if (!state) {
      failures.push(`${label} did not return a state`)
      return
    }
    if (state.activeSystem !== state.expected) failures.push(`${label} landed on ${state.activeSystem || 'empty'} instead of ${state.expected}`)
    if (state.selectedKey !== state.expected) failures.push(`${label} selected ${state.selectedKey || 'empty'} instead of ${state.expected}`)
    if (state.selectedCount !== 1) failures.push(`${label} selected tab count is ${state.selectedCount}`)
    if (state.visiblePanelCount !== 1) failures.push(`${label} visible panel count is ${state.visiblePanelCount}`)
    if (state.selectedPanelHidden !== 'false') failures.push(`${label} selected panel aria-hidden is ${state.selectedPanelHidden ?? 'missing'}`)
    if (state.selectedPanelInert) failures.push(`${label} selected panel is inert`)
    if (state.inactivePanelCount !== 2 || state.inactiveInertCount !== 2) {
      failures.push(`${label} inactive inert panels are ${state.inactiveInertCount}/${state.inactivePanelCount}`)
    }
    if (state.tabStopCount !== 1) failures.push(`${label} tab stop count is ${state.tabStopCount}`)
    if (expectFocus && state.focusedKey !== state.expected) failures.push(`${label} focus is on ${state.focusedKey || 'empty'}`)
    if (state.overflow > 2) failures.push(`${label} overflow ${state.overflow}px`)
  }

  if (!desktop.before.rootExists) failures.push('live systems section is missing on desktop')
  if (desktop.before.tabCount !== 3) failures.push(`expected 3 live system tabs, got ${desktop.before.tabCount}`)
  if (desktop.before.panelCount !== 3) failures.push(`expected 3 live system panels, got ${desktop.before.panelCount}`)
  validateState(desktop.before, 'desktop initial state')
  desktop.clickStates.forEach((state) => validateState(state, `desktop click ${state.expected}`))
  desktop.keyboardStates.forEach((state) => validateState(state, `desktop key ${state.action}`, true))

  const minDesktopStageWidth = Math.min(620, desktop.before.viewportWidth * 0.48)
  const minDesktopStageHeight = Math.min(560, desktop.before.viewportHeight * 0.62)
  if (desktop.before.stageWidth < minDesktopStageWidth) {
    failures.push(`desktop live systems stage is too narrow (${desktop.before.stageWidth}px)`)
  }
  if (desktop.before.stageHeight < minDesktopStageHeight) {
    failures.push(`desktop live systems stage is too short (${desktop.before.stageHeight}px)`)
  }
  if (desktop.before.stageHeight > desktop.before.viewportHeight * 1.2) {
    failures.push(`desktop live systems stage is excessively tall (${desktop.before.stageHeight}px)`)
  }

  if (!mobile.rootExists) failures.push('live systems section is missing on mobile')
  if (mobile.tabCount !== 3) failures.push(`mobile live system tabs are ${mobile.tabCount}/3`)
  if (mobile.panelCount !== 3) failures.push(`mobile live system panels are ${mobile.panelCount}/3`)
  const mobileTabsSized = mobile.tabMetrics.every((tab) => tab.width > 0 && tab.height >= 40)
  const mobileRailScrollable = /auto|scroll/.test(mobile.overflowX) && mobile.maxScrollLeft > 2 && mobile.actualScrollLeft > 2 && mobile.lastReachable
  if (!mobileTabsSized) failures.push(`mobile live system tabs are not usable ${JSON.stringify(mobile.tabMetrics)}`)
  if (!mobile.allVisibleInitially && !mobileRailScrollable) {
    failures.push(`mobile live system tabs are neither all visible nor horizontally reachable (overflow-x=${mobile.overflowX}, max=${mobile.maxScrollLeft}px, actual=${mobile.actualScrollLeft}px)`)
  }
  mobile.clickStates.forEach((state) => validateState(state, `mobile click ${state.expected}`))
  if (mobile.overflow > 2) failures.push(`mobile live systems overflow ${mobile.overflow}px`)

  const capturedRuntimeEvents = runtimeEvents.slice(0, 8)
  capturedRuntimeEvents.forEach((event) => {
    const message = `${event.type}: ${event.text || ''}`
    if (event.type.includes('error') || event.type === 'exception' || event.type === 'navigation') failures.push(`live systems runtime ${message}`)
    else warnings.push(`live systems runtime ${message}`)
  })

  return {
    name: 'live systems tabs',
    desktop,
    mobile,
    failures,
    warnings,
    runtimeEvents: capturedRuntimeEvents,
  }
}

async function auditProjectGalleryMotion() {
  runtimeEvents.length = 0
  networkEvents.length = 0
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false })
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 960,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await cdp.send('Emulation.setEmulatedMedia', { features: [] })
  await cdp.send('Page.navigate', { url: `${baseUrl}/` })
  await cdp.waitForEvent('Page.loadEventFired', () => true, 15_000).catch(() => {})
  await delay(650)

  const result = await evalValue(`(async () => {
    const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))
    const waitFrame = () => new Promise((resolve) => {
      let settled = false
      let watchdog = 0
      const finish = () => {
        if (settled) return
        settled = true
        window.clearTimeout(watchdog)
        resolve()
      }
      watchdog = window.setTimeout(finish, 34)
      window.requestAnimationFrame(finish)
    })
    const waitFrames = async (count = 1) => {
      for (let frame = 0; frame < count; frame += 1) await waitFrame()
    }
    const waitUntil = async (predicate, timeout = 850) => {
      const started = performance.now()
      while (performance.now() - started < timeout) {
        if (predicate()) return true
        await wait(50)
      }
      return predicate()
    }
    const cardPose = (card) => {
      const style = window.getComputedStyle(card)
      const matrix = style.transform === 'none' ? null : new DOMMatrixReadOnly(style.transform)
      return {
        opacity: Number(style.opacity || 1),
        translateY: matrix?.m42 || 0,
        transform: style.transform,
      }
    }
    const centerCard = (card) => {
      const rect = card.getBoundingClientRect()
      const absoluteTop = window.scrollY + rect.top
      const targetTop = Math.max(0, absoluteTop - Math.max(0, (window.innerHeight - rect.height) / 2))
      window.scrollTo({ top: targetTop, behavior: 'auto' })
      window.dispatchEvent(new Event('scroll'))
    }
    const failures = []
    const gallery = document.querySelector('[data-project-gallery]')
    const cards = Array.from(gallery?.querySelectorAll('[data-project-card]') || [])
    const first = cards[0]
    const motionParts = cards.map((card) => card.querySelector('[data-project-motion]'))
    const motionStates = []

    if (!gallery) failures.push('project gallery root is missing')
    if (cards.length !== 10) failures.push('project gallery card count is ' + cards.length + '/10')
    motionParts.forEach((part, index) => {
      if (!part) failures.push('project card ' + (index + 1) + ' has no motion sentinel')
    })
    if (!first) return { failures, cards: cards.length }

    const originalScrollBehavior = document.documentElement.style.scrollBehavior
    document.documentElement.style.scrollBehavior = 'auto'
    for (let index = 0; index < cards.length; index += 1) {
      const card = cards[index]
      const part = motionParts[index]
      centerCard(card)
      await waitFrames(2)
      const activated = await waitUntil(() => {
        const rect = card.getBoundingClientRect()
        return Boolean(
          rect.bottom > 0 &&
          rect.top < window.innerHeight &&
          card.classList.contains('is-in-view') &&
          (!part || window.getComputedStyle(part).animationPlayState === 'running')
        )
      })
      const rect = card.getBoundingClientRect()
      const playState = part ? window.getComputedStyle(part).animationPlayState : ''
      const animationName = part ? window.getComputedStyle(part).animationName : ''
      if (!activated) failures.push('project card ' + (index + 1) + ' did not activate in the viewport')
      if (part && animationName === 'none') failures.push('project card ' + (index + 1) + ' motion sentinel has no animation')
      if (part && playState !== 'running') failures.push('project card ' + (index + 1) + ' animation is ' + (playState || 'unset') + ' in view')
      motionStates.push({
        index: index + 1,
        activated,
        animationName,
        playState,
        scrollY: Math.round(window.scrollY),
        rect: { top: Math.round(rect.top), bottom: Math.round(rect.bottom) },
      })
    }

    const markerStyle = window.getComputedStyle(first, '::before')
    const cardRect = first.getBoundingClientRect()
    const markerWidth = Number.parseFloat(markerStyle.width || '0')
    const markerHeight = Number.parseFloat(markerStyle.height || '0')

    if (markerStyle.borderTopWidth !== '0px') failures.push('obsolete square project marker still has a border')
    if (markerWidth < cardRect.width * 0.8 || markerHeight < cardRect.height * 0.8) {
      failures.push('project hover light is not a full-surface layer')
    }

    window.scrollTo({ top: 0, behavior: 'auto' })
    window.dispatchEvent(new Event('scroll'))
    const allPaused = await waitUntil(() => cards.every((card, index) => {
      const part = motionParts[index]
      const rect = card.getBoundingClientRect()
      const outsideViewport = rect.bottom <= 0 || rect.top >= window.innerHeight
      return outsideViewport && !card.classList.contains('is-in-view') && (!part || window.getComputedStyle(part).animationPlayState === 'paused')
    }), 1500)
    const activeAfterLeave = cards.filter((card) => card.classList.contains('is-in-view')).length
    const pausedAnimations = motionParts.filter((part) => part && window.getComputedStyle(part).animationPlayState === 'paused').length

    centerCard(first)
    const visibilityCardActivated = await waitUntil(() => first.classList.contains('is-in-view'))
    const entranceSettled = await waitUntil(() => {
      const pose = cardPose(first)
      return pose.opacity > 0.99 && Math.abs(pose.translateY) < 0.75
    }, 1600)
    const visibilityLifecycle = {
      supported: true,
      activated: visibilityCardActivated,
      entranceSettled,
      hiddenPaused: false,
      hiddenTimeStable: false,
      visibleResumed: false,
      replayDetected: false,
      samples: [],
    }
    const ownHiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden')
    let simulatedHidden = false

    try {
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => simulatedHidden,
      })
    } catch (error) {
      visibilityLifecycle.supported = false
      failures.push('page visibility simulation is unavailable: ' + (error?.message || String(error)))
    }

    if (visibilityLifecycle.supported) {
      const sentinelAnimation = motionParts[0]?.getAnimations()[0] || null
      simulatedHidden = true
      document.dispatchEvent(new Event('visibilitychange'))
      await waitFrames(1)
      const hiddenTimeStart = Number(sentinelAnimation?.currentTime ?? 0)
      await waitFrames(3)
      const hiddenTimeEnd = Number(sentinelAnimation?.currentTime ?? 0)
      visibilityLifecycle.hiddenPaused =
        gallery.classList.contains('is-page-hidden') &&
        (!motionParts[0] || window.getComputedStyle(motionParts[0]).animationPlayState === 'paused')
      visibilityLifecycle.hiddenTimeStable =
        !sentinelAnimation || Math.abs(hiddenTimeEnd - hiddenTimeStart) < 1

      simulatedHidden = false
      document.dispatchEvent(new Event('visibilitychange'))
      visibilityLifecycle.samples.push(cardPose(first))
      for (let frame = 0; frame < 8; frame += 1) {
        await waitFrames(1)
        visibilityLifecycle.samples.push(cardPose(first))
      }
      visibilityLifecycle.visibleResumed =
        !gallery.classList.contains('is-page-hidden') &&
        first.classList.contains('is-in-view') &&
        (!motionParts[0] || window.getComputedStyle(motionParts[0]).animationPlayState === 'running')
      visibilityLifecycle.replayDetected = visibilityLifecycle.samples.some((sample) =>
        sample.opacity < 0.98 || Math.abs(sample.translateY) > 1.5
      )

      if (!visibilityLifecycle.hiddenPaused) failures.push('project motion did not pause while the page was hidden')
      if (!visibilityLifecycle.hiddenTimeStable) failures.push('project animation time advanced while the page was hidden')
      if (!visibilityLifecycle.visibleResumed) failures.push('project motion did not resume after the page became visible')
      if (visibilityLifecycle.replayDetected) failures.push('project card entrance replayed after hidden to visible')
    }

    if (ownHiddenDescriptor) {
      Object.defineProperty(document, 'hidden', ownHiddenDescriptor)
    } else {
      delete document.hidden
    }
    document.documentElement.style.scrollBehavior = originalScrollBehavior

    if (!allPaused) failures.push('project animations did not all pause after leaving the gallery')
    if (!visibilityCardActivated) failures.push('visibility lifecycle card did not activate')
    if (!entranceSettled) failures.push('visibility lifecycle card entrance did not settle')

    return {
      cards: cards.length,
      features: gallery.querySelectorAll('.project-feature').length,
      shelfCards: gallery.querySelectorAll('.project-shelf-card').length,
      geoCards: gallery.querySelectorAll('[data-project-kind="geo"]').length,
      motionStates,
      activeAfterLeave,
      pausedAnimations,
      visibilityLifecycle,
      markerBorderWidth: markerStyle.borderTopWidth,
      markerWidth: Math.round(markerWidth),
      markerHeight: Math.round(markerHeight),
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      failures,
    }
  })()`, {
    label: 'auditProjectGalleryMotion',
    timeout: 20_000,
    retries: 0,
  })

  const dispatchTab = async (shiftKey = false) => {
    if (shiftKey) {
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'Shift',
        code: 'ShiftLeft',
        modifiers: 8,
        windowsVirtualKeyCode: 16,
        nativeVirtualKeyCode: 16,
      })
    }

    const modifiers = shiftKey ? 8 : 0
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Tab',
      code: 'Tab',
      modifiers,
      windowsVirtualKeyCode: 9,
      nativeVirtualKeyCode: 9,
    })
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Tab',
      code: 'Tab',
      modifiers,
      windowsVirtualKeyCode: 9,
      nativeVirtualKeyCode: 9,
    })

    if (shiftKey) {
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'Shift',
        code: 'ShiftLeft',
        modifiers: 0,
        windowsVirtualKeyCode: 16,
        nativeVirtualKeyCode: 16,
      })
    }

    await delay(24)
  }

  const keyboardFocus = {
    setup: null,
    forward: [],
    reverse: [],
    trustedTabKeydowns: 0,
    trustedShiftTabs: 0,
    untrustedTabKeydowns: 0,
  }

  const readProjectFocusSnapshot = () => evalValue(`(() => {
    const cards = Array.from(document.querySelectorAll('[data-project-card]'))
    const card = document.activeElement?.matches?.('[data-project-card]')
      ? document.activeElement
      : null
    const style = card ? window.getComputedStyle(card) : null
    const lightStyle = card ? window.getComputedStyle(card, '::before') : null
    const durationIsZero = (value) => String(value || '').split(',').every((token) => {
      const amount = Number.parseFloat(token) || 0
      return token.trim().endsWith('ms') ? amount <= 0.01 : amount <= 0.00001
    })
    const capturePointerOnlyState = () => {
      const pointer = document.querySelector('.pointer-shell')
      const reactor = document.querySelector('[data-signal-reactor]')
      const rain = document.querySelector('.rain-canvas')
      return {
        bodyPointerMode: document.body.dataset.pointerMode || '',
        pointerState: pointer?.dataset.pointerState || '',
        pointerMode: pointer?.dataset.pointerMode || '',
        pointerKind: pointer?.dataset.pointerKind || '',
        pointerLabel: pointer?.dataset.pointerLabel || '',
        reactorMode: reactor?.dataset.reactorMode || '',
        reactorLane: reactor?.dataset.reactorLane || '',
        rainClass: rain?.className || '',
        rainStyle: rain?.getAttribute('style') || '',
      }
    }
    const pointerState = capturePointerOnlyState()
    const baseline = window.__projectCardKeyboardAudit?.baseline || null

    return {
      index: card ? cards.indexOf(card) + 1 : 0,
      focusVisible: Boolean(card?.matches(':focus-visible')),
      outlineVisible: Boolean(
        style &&
        style.outlineStyle !== 'none' &&
        Number.parseFloat(style.outlineWidth || '0') >= 1
      ),
      transitionDuration: style?.transitionDuration || '',
      transitionStopped: durationIsZero(style?.transitionDuration),
      lightTransitionDuration: lightStyle?.transitionDuration || '',
      lightTransitionStopped: durationIsZero(lightStyle?.transitionDuration),
      pointerClasses: card
        ? ['is-hot', 'is-charging', 'is-routing'].filter((name) => card.classList.contains(name))
        : [],
      pointerState,
      pointerStateStable: Boolean(baseline && JSON.stringify(pointerState) === JSON.stringify(baseline)),
    }
  })()`, { label: 'projectGallery.keyboardSnapshot', timeout: 2_000, retries: 0 })

  try {
    keyboardFocus.setup = await evalValue(`(async () => {
      window.__projectCardKeyboardAudit?.cleanup?.()
      const cards = Array.from(document.querySelectorAll('[data-project-card]'))
      const capturePointerOnlyState = () => {
        const pointer = document.querySelector('.pointer-shell')
        const reactor = document.querySelector('[data-signal-reactor]')
        const rain = document.querySelector('.rain-canvas')
        return {
          bodyPointerMode: document.body.dataset.pointerMode || '',
          pointerState: pointer?.dataset.pointerState || '',
          pointerMode: pointer?.dataset.pointerMode || '',
          pointerKind: pointer?.dataset.pointerKind || '',
          pointerLabel: pointer?.dataset.pointerLabel || '',
          reactorMode: reactor?.dataset.reactorMode || '',
          reactorLane: reactor?.dataset.reactorLane || '',
          rainClass: rain?.className || '',
          rainStyle: rain?.getAttribute('style') || '',
        }
      }
      const audit = {
        baseline: null,
        capturePointerOnlyState,
        trustedTabKeydowns: 0,
        trustedShiftTabs: 0,
        untrustedTabKeydowns: 0,
        listener: null,
        cleanup: null,
      }
      audit.listener = (event) => {
        if (event.key !== 'Tab') return
        if (event.isTrusted) {
          audit.trustedTabKeydowns += 1
          if (event.shiftKey) audit.trustedShiftTabs += 1
        } else {
          audit.untrustedTabKeydowns += 1
        }
      }
      audit.cleanup = () => document.removeEventListener('keydown', audit.listener, true)
      document.addEventListener('keydown', audit.listener, true)
      window.__projectCardKeyboardAudit = audit
      cards[0]?.focus({ preventScroll: true })
      await new Promise((resolve) => window.setTimeout(resolve, 80))
      audit.baseline = capturePointerOnlyState()
      return { cards: cards.length, baseline: audit.baseline }
    })()`, { label: 'projectGallery.keyboardSetup', timeout: 2_000, retries: 0 })

    await dispatchTab(true)
    await dispatchTab(false)
    keyboardFocus.setup.baseline = await evalValue(`(() => {
      const audit = window.__projectCardKeyboardAudit
      if (!audit?.capturePointerOnlyState) return null
      audit.baseline = audit.capturePointerOnlyState()
      return audit.baseline
    })()`, { label: 'projectGallery.keyboardBaseline', timeout: 2_000, retries: 0 })
    keyboardFocus.forward.push(await readProjectFocusSnapshot())
    for (let index = 1; index < 10; index += 1) {
      await dispatchTab(false)
      keyboardFocus.forward.push(await readProjectFocusSnapshot())
    }

    await dispatchTab(false)
    for (let index = 9; index >= 0; index -= 1) {
      await dispatchTab(true)
      keyboardFocus.reverse.push(await readProjectFocusSnapshot())
    }

    const keyStats = await evalValue(`(() => ({
      trustedTabKeydowns: window.__projectCardKeyboardAudit?.trustedTabKeydowns || 0,
      trustedShiftTabs: window.__projectCardKeyboardAudit?.trustedShiftTabs || 0,
      untrustedTabKeydowns: window.__projectCardKeyboardAudit?.untrustedTabKeydowns || 0,
    }))()`, { label: 'projectGallery.keyboardStats', timeout: 2_000, retries: 0 })
    Object.assign(keyboardFocus, keyStats)
  } catch (error) {
    result.failures.push(`project keyboard traversal failed: ${error?.message || String(error)}`)
  } finally {
    await evalValue(`(() => {
      window.__projectCardKeyboardAudit?.cleanup?.()
      document.activeElement?.blur?.()
      delete window.__projectCardKeyboardAudit
      return true
    })()`, { label: 'projectGallery.keyboardCleanup', timeout: 2_000, retries: 0 }).catch(() => {})
  }

  const validateKeyboardPass = (snapshots, expected, direction) => {
    if (snapshots.length !== expected.length) {
      result.failures.push(`project ${direction} keyboard traversal produced ${snapshots.length}/${expected.length} snapshots`)
    }
    snapshots.forEach((snapshot, position) => {
      const expectedIndex = expected[position]
      const label = `project card ${expectedIndex || position + 1} ${direction} focus`
      if (snapshot.index !== expectedIndex) result.failures.push(`${label} landed on card ${snapshot.index || 'none'}`)
      if (!snapshot.focusVisible) result.failures.push(`${label} did not match :focus-visible`)
      if (!snapshot.outlineVisible) result.failures.push(`${label} outline was not visibly rendered`)
      if (!snapshot.transitionStopped) result.failures.push(`${label} transition duration remained ${snapshot.transitionDuration || 'unset'}`)
      if (!snapshot.lightTransitionStopped) result.failures.push(`${label} ::before transition duration remained ${snapshot.lightTransitionDuration || 'unset'}`)
      if (snapshot.pointerClasses.length > 0) result.failures.push(`${label} added pointer-only classes ${snapshot.pointerClasses.join(', ')}`)
      if (!snapshot.pointerStateStable) result.failures.push(`${label} changed Reactor/rain pointer-only state`)
    })
  }

  validateKeyboardPass(keyboardFocus.forward, Array.from({ length: 10 }, (_, index) => index + 1), 'forward')
  validateKeyboardPass(keyboardFocus.reverse, Array.from({ length: 10 }, (_, index) => 10 - index), 'reverse')
  if (keyboardFocus.setup?.cards !== 10) result.failures.push(`project keyboard traversal found ${keyboardFocus.setup?.cards || 0}/10 cards`)
  if (keyboardFocus.trustedTabKeydowns < 22) result.failures.push(`project keyboard traversal received only ${keyboardFocus.trustedTabKeydowns}/22 trusted Tab keydowns`)
  if (keyboardFocus.trustedShiftTabs < 11) result.failures.push(`project keyboard traversal received only ${keyboardFocus.trustedShiftTabs}/11 trusted Shift+Tab keydowns`)
  if (keyboardFocus.untrustedTabKeydowns > 0) result.failures.push(`project keyboard traversal received ${keyboardFocus.untrustedTabKeydowns} untrusted Tab keydowns`)
  result.keyboardFocus = keyboardFocus

  if (result.overflow > 2) {
    result.failures.push(`project gallery motion overflow ${result.overflow}px`)
  }

  return {
    name: 'project gallery motion',
    ...result,
    runtimeEvents: runtimeEvents.slice(0, 8),
  }
}

async function auditMotionPreferenceLifecycle() {
  runtimeEvents.length = 0
  networkEvents.length = 0
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false })
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 960,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await cdp.send('Emulation.setEmulatedMedia', { features: [] })

  const loadPromise = cdp.waitForEvent('Page.loadEventFired', () => true, 15_000)
  const nav = await cdp.send('Page.navigate', { url: `${baseUrl}/` })
  await loadPromise.catch(() => {})

  const failures = []
  if (nav.errorText) failures.push(`navigation failed ${nav.errorText}`)
  let initial
  let reduced
  let restored

  try {
    initial = await evalValue(`(async () => {
      const waitFrame = () => new Promise((resolve) => {
        let settled = false
        let watchdog = 0
        const finish = () => {
          if (settled) return
          settled = true
          window.clearTimeout(watchdog)
          resolve()
        }
        watchdog = window.setTimeout(finish, 34)
        window.requestAnimationFrame(finish)
      })
      const waitUntil = async (predicate, timeout = 6000) => {
        const deadline = performance.now() + timeout
        while (performance.now() < deadline) {
          if (predicate()) return true
          await waitFrame()
        }
        return predicate()
      }
      const root = document.querySelector('[data-project-gallery]')
      const cards = Array.from(root?.querySelectorAll('[data-project-card]') || [])
      const parts = cards.map((card) => card.querySelector('[data-project-motion]'))
      const first = cards[0]
      const hyper = document.querySelector('[data-signal-action="hyper"]')
      const reactor = document.querySelector('[data-signal-reactor]')
      const localFailures = []

      window.__reactorLoopLifecycleAudit?.observer?.disconnect()
      const reactorLoopTransitions = []
      const reactorLoopObserver = reactor ? new MutationObserver((records) => {
        records.forEach((record) => {
          if (record.oldValue) reactorLoopTransitions.push(record.oldValue)
        })
        reactorLoopTransitions.push(reactor.dataset.reactorLoop || '')
      }) : null
      reactorLoopObserver?.observe(reactor, {
        attributes: true,
        attributeFilter: ['data-reactor-loop'],
        attributeOldValue: true,
      })
      window.__reactorLoopLifecycleAudit = {
        observer: reactorLoopObserver,
        transitions: reactorLoopTransitions,
      }

      const reactorInsideViewport = () => {
        const rect = reactor?.getBoundingClientRect()
        return Boolean(rect && rect.bottom > 0 && rect.top < window.innerHeight)
      }
      const centerReactor = () => {
        const rect = reactor?.getBoundingClientRect()
        if (!rect) return
        const absoluteTop = window.scrollY + rect.top
        const targetTop = Math.max(
          0,
          absoluteTop - Math.max(0, (window.innerHeight - rect.height) / 2),
        )
        window.scrollTo(0, targetTop)
      }

      if (!reactorInsideViewport()) {
        centerReactor()
        await waitFrame()
        await waitFrame()
      }
      const reactorActivated = await waitUntil(() => Boolean(
        reactorInsideViewport() &&
        reactor?.dataset.reactorReady === 'active' &&
        reactor?.dataset.reactorFrame === 'live' &&
        reactor?.dataset.reactorLoop === 'running'
      ), 3500)

      first?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' })
      const galleryReady = await waitUntil(() => Boolean(
          first?.classList.contains('is-in-view') &&
          parts[0] &&
          window.getComputedStyle(parts[0]).animationPlayState === 'running'
      ), 3500)
      const reactorPausedAfterGallery = await waitUntil(
        () => reactor?.dataset.reactorLoop === 'paused',
        1200,
      )
      const ready = reactorActivated && galleryReady && reactorPausedAfterGallery
      hyper?.click()
      const hyperStarted = await waitUntil(() => document.body.classList.contains('is-hyperstorm'), 1200)
      const animationNames = parts.map((part) => part ? window.getComputedStyle(part).animationName : '')

      if (!root) localFailures.push('project gallery root is missing before preference switch')
      if (cards.length !== 10) localFailures.push('project gallery card count is ' + cards.length + '/10 before preference switch')
      if (parts.some((part) => !part)) localFailures.push('at least one project card has no motion sentinel before preference switch')
      if (animationNames.some((name) => !name || name === 'none')) localFailures.push('at least one project motion sentinel has no animation before preference switch')
      if (!reactorActivated) localFailures.push('Signal Reactor did not render a running live frame before preference switch')
      if (!galleryReady) localFailures.push('project gallery baseline did not become ready before preference switch')
      if (!reactorPausedAfterGallery) localFailures.push('Signal Reactor loop did not pause after leaving the hero')
      if (!hyper) localFailures.push('global high-energy action is missing')
      if (!hyperStarted) localFailures.push('global high-energy effect did not start before preference switch')

      return {
        cards: cards.length,
        animationNames,
        firstPlayState: parts[0] ? window.getComputedStyle(parts[0]).animationPlayState : '',
        globalFx: document.documentElement.dataset.globalFx || '',
        reactorQuality: reactor?.dataset.reactorQuality || '',
        reactorReady: reactor?.dataset.reactorReady || '',
        reactorLoop: reactor?.dataset.reactorLoop || '',
        reactorPausedAfterGallery,
        hyperStarted,
        failures: localFailures,
      }
    })()`, {
      label: 'motionPreferenceLifecycle.initial',
      timeout: 12_000,
      retries: 0,
    })

    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    })
    reduced = await evalValue(`(async () => {
      const waitFrame = () => new Promise((resolve) => {
        let settled = false
        let watchdog = 0
        const finish = () => {
          if (settled) return
          settled = true
          window.clearTimeout(watchdog)
          resolve()
        }
        watchdog = window.setTimeout(finish, 34)
        window.requestAnimationFrame(finish)
      })
      const waitUntil = async (predicate, timeout = 6000) => {
        const deadline = performance.now() + timeout
        while (performance.now() < deadline) {
          if (predicate()) return true
          await waitFrame()
        }
        return predicate()
      }
      const durationIsZero = (value) => value.split(',').every((token) => {
        const amount = Number.parseFloat(token) || 0
        return token.trim().endsWith('ms') ? amount <= 0.01 : amount <= 0.00001
      })
      const ready = await waitUntil(() => {
        const root = document.querySelector('[data-project-gallery]')
        const reactor = document.querySelector('[data-signal-reactor]')
        const runningAnimations = root?.getAnimations({ subtree: true })
          .filter((animation) => animation.playState === 'running').length || 0
        return Boolean(
          document.documentElement.classList.contains('motion-reduce') &&
          root?.classList.contains('is-motion-reduced') &&
          reactor?.dataset.reactorQuality === 'calm' &&
          reactor?.dataset.reactorLoop === 'static' &&
          !document.body.classList.contains('is-hyperstorm') &&
          runningAnimations === 0
        )
      })
      await waitFrame()
      const root = document.querySelector('[data-project-gallery]')
      const cards = Array.from(root?.querySelectorAll('[data-project-card]') || [])
      const parts = cards.map((card) => card.querySelector('[data-project-motion]'))
      const animationNames = parts.map((part) => part ? window.getComputedStyle(part).animationName : '')
      const runningAnimations = root?.getAnimations({ subtree: true }).filter((animation) => animation.playState === 'running').length || 0
      const rain = document.querySelector('.rain-canvas')
      const rainStyle = rain ? window.getComputedStyle(rain) : null
      const rainStopped = !rain || rainStyle.display === 'none' || rainStyle.visibility === 'hidden' || Number(rainStyle.opacity) === 0
      const ctas = Array.from(document.querySelectorAll('.project-feature-cta, .project-shelf-cta'))
      const ctaTransitions = ctas.map((cta) => {
        const style = window.getComputedStyle(cta, '::after')
        return { duration: style.transitionDuration, property: style.transitionProperty }
      })
      const ctaTransitionsStopped = ctaTransitions.every((item) => durationIsZero(item.duration))
      const reactorDestroyTransitions = Array.from(
        window.__reactorLoopLifecycleAudit?.transitions || [],
      )
      const dynamicDestroyStopped = reactorDestroyTransitions.includes('stopped')
      if (window.__reactorLoopLifecycleAudit?.transitions) {
        window.__reactorLoopLifecycleAudit.transitions.length = 0
      }
      const localFailures = []

      if (!ready) localFailures.push('reduce preference did not propagate to gallery and global effects')
      if (cards.length !== 10) localFailures.push('project gallery card count is ' + cards.length + '/10 after reduce')
      if (animationNames.some((name) => name !== 'none')) localFailures.push('at least one project motion sentinel remained animated after reduce')
      if (runningAnimations > 0) localFailures.push(runningAnimations + ' gallery animations remained running after reduce')
      if (!rainStopped) localFailures.push('rain effect remained visible after reduce')
      if (document.body.classList.contains('is-hyperstorm')) localFailures.push('global high-energy effect remained active after reduce')
      if (ctas.length !== 10) localFailures.push('project CTA count is ' + ctas.length + '/10 under reduce')
      if (!ctaTransitionsStopped) localFailures.push('at least one project CTA transition remained active after reduce')
      if (!dynamicDestroyStopped) localFailures.push('dynamic Signal Reactor destroy did not publish stopped before calm rebuild')

      return {
        ready,
        cards: cards.length,
        animationNames,
        runningAnimations,
        rainStopped,
        hyperStopped: !document.body.classList.contains('is-hyperstorm'),
        reactorQuality: document.querySelector('[data-signal-reactor]')?.dataset.reactorQuality || '',
        reactorLoop: document.querySelector('[data-signal-reactor]')?.dataset.reactorLoop || '',
        reactorDestroyTransitions,
        dynamicDestroyStopped,
        ctaTransitions,
        ctaTransitionsStopped,
        failures: localFailures,
      }
    })()`, {
      label: 'motionPreferenceLifecycle.reduced',
      timeout: 12_000,
      retries: 0,
    })

    await cdp.send('Emulation.setEmulatedMedia', { features: [] })
    const expectedAnimationNames = JSON.stringify(initial.animationNames)
    const expectedReactorQuality = JSON.stringify(initial.reactorQuality)
    restored = await evalValue(`(async () => {
      const waitFrame = () => new Promise((resolve) => {
        let settled = false
        let watchdog = 0
        const finish = () => {
          if (settled) return
          settled = true
          window.clearTimeout(watchdog)
          resolve()
        }
        watchdog = window.setTimeout(finish, 34)
        window.requestAnimationFrame(finish)
      })
      const waitUntil = async (predicate, timeout = 6000) => {
        const deadline = performance.now() + timeout
        while (performance.now() < deadline) {
          if (predicate()) return true
          await waitFrame()
        }
        return predicate()
      }
      const expectedNames = ${expectedAnimationNames}
      const expectedQuality = ${expectedReactorQuality}
      const root = document.querySelector('[data-project-gallery]')
      const cards = Array.from(root?.querySelectorAll('[data-project-card]') || [])
      const parts = cards.map((card) => card.querySelector('[data-project-motion]'))
      const first = cards[0]
      const firstPart = parts[0]
      const reactor = document.querySelector('[data-signal-reactor]')
      const previousScrollBehavior = document.documentElement.style.scrollBehavior

      document.documentElement.style.scrollBehavior = 'auto'

      const galleryRestored = await waitUntil(() => {
        const rain = document.querySelector('.rain-canvas')
        const rainStyle = rain ? window.getComputedStyle(rain) : null
        const rainIsVisible = Boolean(
          rain &&
          rainStyle?.display !== 'none' &&
          rainStyle?.visibility !== 'hidden' &&
          Number(rainStyle?.opacity) > 0
        )
        return Boolean(
          !document.documentElement.classList.contains('motion-reduce') &&
          !root?.classList.contains('is-motion-reduced') &&
          firstPart &&
          window.getComputedStyle(firstPart).animationPlayState === 'running' &&
          reactor?.dataset.reactorQuality === expectedQuality &&
          rainIsVisible
        )
      }, 3000)

      const reactorInsideViewport = () => {
        const rect = reactor?.getBoundingClientRect()
        return Boolean(rect && rect.bottom > 0 && rect.top < window.innerHeight)
      }
      const centerReactor = () => {
        const rect = reactor?.getBoundingClientRect()
        if (!rect) return
        const absoluteTop = window.scrollY + rect.top
        const targetTop = Math.max(
          0,
          absoluteTop - Math.max(0, (window.innerHeight - rect.height) / 2),
        )
        window.scrollTo(0, targetTop)
      }

      await waitFrame()
      await waitFrame()
      await waitFrame()

      for (let attempt = 0; attempt < 3 && !reactorInsideViewport(); attempt += 1) {
        centerReactor()
        await waitFrame()
        await waitFrame()
      }

      const reactorLive = await waitUntil(() => Boolean(
        reactorInsideViewport() &&
        reactor?.dataset.reactorReady === 'active' &&
        reactor?.dataset.reactorFrame === 'live' &&
        reactor?.dataset.reactorLoop === 'running'
      ), 3000)
      const reactorInViewport = reactorInsideViewport()
      const reactorActivated = reactorInViewport && reactorLive
      const reactorAnchor = document.getElementById('cover')
        ?? reactor?.closest('.reactor-stage')
        ?? reactor
      const reactorRect = reactor?.getBoundingClientRect()
      const reactorAnchorRect = reactorAnchor?.getBoundingClientRect()
      const reactorCanvas = reactor?.querySelector('canvas')
      const reactorActivationState = {
        ready: reactor?.dataset.reactorReady || '',
        engine: reactor?.dataset.reactorEngine || '',
        frame: reactor?.dataset.reactorFrame || '',
        loop: reactor?.dataset.reactorLoop || '',
        quality: reactor?.dataset.reactorQuality || '',
        insideViewport: Boolean(
          reactorRect &&
          reactorRect.bottom > 0 &&
          reactorRect.top < window.innerHeight
        ),
        rect: reactorRect ? {
          top: Math.round(reactorRect.top),
          bottom: Math.round(reactorRect.bottom),
          width: Math.round(reactorRect.width),
          height: Math.round(reactorRect.height),
        } : null,
        anchorRect: reactorAnchorRect ? {
          top: Math.round(reactorAnchorRect.top),
          bottom: Math.round(reactorAnchorRect.bottom),
          width: Math.round(reactorAnchorRect.width),
          height: Math.round(reactorAnchorRect.height),
        } : null,
        canvas: reactorCanvas ? {
          width: reactorCanvas.width,
          height: reactorCanvas.height,
          connected: reactorCanvas.isConnected,
        } : null,
        scrollY: Math.round(window.scrollY),
        viewportHeight: window.innerHeight,
        documentHidden: document.hidden,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      }

      first?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' })
      const galleryResumed = await waitUntil(() => Boolean(
        first?.classList.contains('is-in-view') &&
        firstPart &&
        window.getComputedStyle(firstPart).animationPlayState === 'running'
      ), 2000)
      const reactorPausedAfterGallery = await waitUntil(
        () => reactor?.dataset.reactorLoop === 'paused',
        1200,
      )

      document.documentElement.style.scrollBehavior = previousScrollBehavior
      const animationNames = parts.map((part) => part ? window.getComputedStyle(part).animationName : '')
      const rain = document.querySelector('.rain-canvas')
      const rainStyle = rain ? window.getComputedStyle(rain) : null
      const rainRestored = Boolean(rain && rainStyle.display !== 'none' && rainStyle.visibility !== 'hidden' && Number(rainStyle.opacity) > 0)
      const hyper = document.querySelector('[data-signal-action="hyper"]')
      hyper?.click()
      const hyperRestored = await waitUntil(() => document.body.classList.contains('is-hyperstorm'), 1200)
      const localFailures = []
      const reactorDestroyTransitions = Array.from(
        window.__reactorLoopLifecycleAudit?.transitions || [],
      )
      const staticDestroyStopped = reactorDestroyTransitions.includes('stopped')

      if (!galleryRestored) localFailures.push('no-preference did not restore gallery, rain, and global effect quality')
      if (!reactorInViewport) localFailures.push('Signal Reactor scroll target did not enter the viewport after restore')
      if (!reactorLive) localFailures.push('Signal Reactor loop did not resume with a live frame after restore')
      if (!galleryResumed) localFailures.push('project gallery did not resume after returning from Signal Reactor')
      if (!reactorPausedAfterGallery) localFailures.push('Signal Reactor loop did not pause after returning to the project gallery')
      if (cards.length !== 10) localFailures.push('project gallery card count is ' + cards.length + '/10 after restore')
      if (JSON.stringify(animationNames) !== JSON.stringify(expectedNames)) localFailures.push('project motion sentinel animations did not restore after reduce')
      if (!rainRestored) localFailures.push('rain effect did not restore after reduce')
      if (!hyperRestored) localFailures.push('global high-energy effect could not restart after reduce')
      if (!staticDestroyStopped) localFailures.push('calm Signal Reactor destroy did not publish stopped before live rebuild')

      document.querySelector('[data-signal-action="calm"]')?.click()
      window.__reactorLoopLifecycleAudit?.observer?.disconnect()
      delete window.__reactorLoopLifecycleAudit
      return {
        ready: galleryRestored && reactorActivated && galleryResumed && reactorPausedAfterGallery,
        galleryRestored,
        reactorActivated,
        reactorInViewport,
        reactorLive,
        reactorActivationState,
        galleryResumed,
        reactorPausedAfterGallery,
        cards: cards.length,
        animationNames,
        firstPlayState: parts[0] ? window.getComputedStyle(parts[0]).animationPlayState : '',
        rainRestored,
        hyperRestored,
        reactorQuality: document.querySelector('[data-signal-reactor]')?.dataset.reactorQuality || '',
        reactorDestroyTransitions,
        staticDestroyStopped,
        failures: localFailures,
      }
    })()`, {
      label: 'motionPreferenceLifecycle.restored',
      timeout: 12_000,
      retries: 0,
    })
  } finally {
    await evalValue(`(() => {
      window.__reactorLoopLifecycleAudit?.observer?.disconnect()
      delete window.__reactorLoopLifecycleAudit
      return true
    })()`, { label: 'motionPreferenceLifecycle.cleanup', timeout: 2_000, retries: 0 }).catch(() => {})
    await cdp.send('Emulation.setEmulatedMedia', { features: [] }).catch(() => {})
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false }).catch(() => {})
  }

  failures.push(...(initial?.failures || []), ...(reduced?.failures || []), ...(restored?.failures || []))

  return {
    name: 'motion preference lifecycle',
    initial,
    reduced,
    restored,
    failures,
    runtimeEvents: runtimeEvents.slice(0, 8),
  }
}

async function auditCoarsePointerCadMotion() {
  runtimeEvents.length = 0
  networkEvents.length = 0
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 320,
    height: 568,
    deviceScaleFactor: 2,
    mobile: true,
  })
  await cdp.send('Emulation.setEmulatedMedia', { features: [] })

  const loadPromise = cdp.waitForEvent('Page.loadEventFired', () => true, 15_000)
  const nav = await cdp.send('Page.navigate', { url: `${baseUrl}/` })
  await loadPromise.catch(() => {})
  let result

  try {
    result = await evalValue(`(async () => {
      const waitFrame = () => new Promise((resolve) => {
        let settled = false
        let watchdog = 0
        const finish = () => {
          if (settled) return
          settled = true
          window.clearTimeout(watchdog)
          resolve()
        }
        watchdog = window.setTimeout(finish, 34)
        window.requestAnimationFrame(finish)
      })
      const waitUntil = async (predicate, timeout = 6000) => {
        const deadline = performance.now() + timeout
        while (performance.now() < deadline) {
          if (predicate()) return true
          await waitFrame()
        }
        return predicate()
      }
      const failures = []
      const shape = document.querySelector('.cad-shape')
      const card = shape?.closest('[data-project-card]')
      card?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' })
      const activated = await waitUntil(() => card?.classList.contains('is-in-view'))
      const directParts = Array.from(card?.querySelectorAll('.cad-axis-x, .cad-axis-y, .cad-shape, .cad-point') || [])
      const directAnimations = directParts.map((part) => ({
        className: part.className,
        animationName: window.getComputedStyle(part).animationName,
      }))
      const shapeStyle = shape ? window.getComputedStyle(shape) : null
      const shapeBefore = shape ? window.getComputedStyle(shape, '::before') : null
      const shapeAfter = shape ? window.getComputedStyle(shape, '::after') : null
      const anchor = card?.querySelector('.cad-axis-y')
      const anchorStyle = anchor ? window.getComputedStyle(anchor) : null
      const scan = card?.querySelector('.cad-axis-x')
      const scanStyle = scan ? window.getComputedStyle(scan) : null
      const points = Array.from(card?.querySelectorAll('.cad-point') || [])
      const pointsAtRest = points.every((point) => {
        const style = window.getComputedStyle(point)
        return Number(style.opacity) > 0.99 && (style.transform === 'none' || new DOMMatrixReadOnly(style.transform).a > 0.99)
      })
      const coarsePointer = window.matchMedia('(pointer: coarse)').matches
      const noHover = window.matchMedia('(hover: none)').matches
      const staticFrame = Boolean(
        shapeStyle && Number(shapeStyle.opacity) > 0.99 &&
        shapeBefore && Number(shapeBefore.opacity) > 0.99 && shapeBefore.transform === 'none' &&
        shapeAfter && Number(shapeAfter.opacity) > 0.99 && shapeAfter.transform === 'none' &&
        anchorStyle && Number(anchorStyle.opacity) > 0.99 &&
        scanStyle && Number(scanStyle.opacity) === 0 &&
        pointsAtRest
      )

      if (!shape || !card) failures.push('CAD project card is missing at 320px')
      if (!activated) failures.push('CAD project card did not activate at 320px')
      if (!coarsePointer || !noHover) failures.push('320px touch emulation did not expose a coarse non-hover pointer')
      if (directParts.length < 6) failures.push('CAD motion parts are incomplete (' + directParts.length + ')')
      if (directAnimations.some((item) => item.animationName !== 'none')) failures.push('CAD direct motion remained animated for a coarse pointer')
      if (shapeBefore?.animationName !== 'none' || shapeAfter?.animationName !== 'none') failures.push('CAD crop pseudo-elements remained animated for a coarse pointer')
      if (!staticFrame) failures.push('CAD coarse-pointer static frame did not reach the designed terminal state')

      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        coarsePointer,
        noHover,
        activated,
        directAnimations,
        pseudoAnimations: {
          before: shapeBefore?.animationName || '',
          after: shapeAfter?.animationName || '',
        },
        staticFrame,
        overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
        failures,
      }
    })()`, {
      label: 'coarsePointerCadMotion',
      timeout: 10_000,
      retries: 0,
    })
  } finally {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false }).catch(() => {})
  }

  if (nav.errorText) result.failures.push(`navigation failed ${nav.errorText}`)
  if (result.overflow > 2) result.failures.push(`CAD coarse-pointer overflow ${result.overflow}px`)

  return {
    name: 'coarse pointer CAD motion',
    ...result,
    runtimeEvents: runtimeEvents.slice(0, 8),
  }
}

async function auditCommandPaletteKeyboard() {
  runtimeEvents.length = 0
  networkEvents.length = 0
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  })
  await cdp.send('Emulation.setEmulatedMedia', { features: [] })
  await cdp.send('Page.navigate', { url: `${baseUrl}/` })
  await cdp.waitForEvent('Page.loadEventFired', () => true, 15_000).catch(() => {})
  await delay(550)

  const result = await evalValue(`(async () => {
    const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))
    const sendKey = (target, key, options = {}) => {
      target.dispatchEvent(new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
        ...options,
      }))
    }
    const failures = []
    const trigger = document.querySelector('.command-palette-trigger')
    trigger?.focus()
    sendKey(document, 'k', { ctrlKey: true })
    await wait(180)

    const shell = document.querySelector('.command-palette-shell')
    const dialog = document.querySelector('.command-palette')
    const rail = document.querySelector('.command-palette-rail')
    const status = document.querySelector('.command-palette-status')
    const input = document.querySelector('.command-palette-input')
    const opened = document.body.classList.contains('is-command-open') && shell && shell.hidden === false
    const focusedInput = document.activeElement === input
    if (!opened) failures.push('Ctrl+K did not open command palette')
    if (!focusedInput) failures.push('command input did not receive focus')
    if (dialog?.dataset.commandHud !== 'ready') failures.push('command HUD dataset is missing')
    if (!rail || rail.querySelectorAll('span').length < 4) failures.push('command HUD rail is missing')

    if (input) {
      input.value = 'canvas'
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'canvas' }))
      await wait(120)
      sendKey(input, 'ArrowDown')
      await wait(60)
      sendKey(input, 'ArrowUp')
      await wait(60)
    }

    const items = Array.from(document.querySelectorAll('.command-palette-item'))
    const activeItems = items.filter((item) => item.classList.contains('is-active'))
    if (items.length === 0) failures.push('command search returned no results for canvas')
    if (items.length > 0 && activeItems.length !== 1) failures.push('command keyboard active option is not stable')
    if (!status?.textContent?.includes('路线')) failures.push('command HUD status did not update')

    sendKey(input || document, 'Escape')
    await wait(140)
    const closed = !document.body.classList.contains('is-command-open') && shell && shell.hidden === true
    if (!closed) failures.push('Escape did not close command palette')

    return {
      opened: Boolean(opened),
      focusedInput,
      resultCount: items.length,
      activeCount: activeItems.length,
      railCount: rail?.querySelectorAll('span').length || 0,
      statusText: status?.textContent?.trim() || '',
      commandHud: dialog?.dataset.commandHud || '',
      closed: Boolean(closed),
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      failures,
    }
  })()`)

  if (result.overflow > 2) {
    result.failures.push(`command palette mobile overflow ${result.overflow}px`)
  }

  return {
    name: 'command palette keyboard',
    ...result,
    runtimeEvents: runtimeEvents.slice(0, 8),
  }
}

async function auditRouteTransitionSmoke() {
  const failures = []
  runtimeEvents.length = 0
  networkEvents.length = 0

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 960,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await cdp.send('Emulation.setEmulatedMedia', { features: [] })

  const loadHome = cdp.waitForEvent('Page.loadEventFired', () => true, 15_000)
  const homeNav = await cdp.send('Page.navigate', { url: `${baseUrl}/` })
  if (homeNav.errorText) failures.push(`home navigation failed ${homeNav.errorText}`)
  await loadHome.catch((error) => failures.push(`home load timeout ${error.message}`))
  await delay(620)

  const loadNext = cdp.waitForEvent('Page.loadEventFired', () => true, 15_000)
  const before = await evalValue(`(async () => {
    const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))
    const failures = []
    const anchor = Array.from(document.querySelectorAll('a[href]')).find((item) => {
      try {
        return new URL(item.href).pathname.endsWith('/workflow.html')
      } catch {
        return false
      }
    })
    const layer = document.querySelector('.route-transition-layer')
    const components = {
      layer: Boolean(layer),
      shards: document.querySelectorAll('.route-transition-shard').length,
      beam: Boolean(document.querySelector('.route-transition-beam')),
      grid: Boolean(document.querySelector('.route-transition-grid')),
    }
    if (!components.layer) failures.push('route transition layer is missing')
    if (components.shards < 5) failures.push('route transition shards are missing')
    if (!components.beam) failures.push('route transition beam is missing')
    if (!components.grid) failures.push('route transition grid is missing')
    if (!anchor) {
      failures.push('workflow route anchor is missing')
      return { components, failures }
    }
    anchor.click()
    await wait(120)
    return {
      components,
      leaving: document.body.classList.contains('is-route-leaving'),
      origin: anchor.classList.contains('is-route-origin'),
      intent: document.documentElement.dataset.routeIntent || '',
      phase: document.documentElement.dataset.routePhase || '',
      failures,
    }
  })()`)

  before.failures?.forEach((item) => failures.push(item))
  if (!before.leaving) failures.push('route click did not enter leaving state')
  if (!before.origin) failures.push('route origin was not marked')
  if (before.intent !== 'workflow') failures.push(`route intent is ${before.intent || 'empty'}, expected workflow`)
  if (before.phase !== 'leaving') failures.push(`route phase is ${before.phase || 'empty'}, expected leaving`)

  await loadNext.catch((error) => failures.push(`workflow load timeout ${error.message}`))
  await delay(280)

  const after = await evalValue(`(() => {
    const layer = document.querySelector('.route-transition-layer')
    return {
      path: window.location.pathname,
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.trim() || '',
      arrived: document.body.classList.contains('is-route-arrived'),
      intent: document.documentElement.dataset.routeIntent || '',
      phase: document.documentElement.dataset.routePhase || '',
      layer: Boolean(layer),
      shards: document.querySelectorAll('.route-transition-shard').length,
      beam: Boolean(document.querySelector('.route-transition-beam')),
      grid: Boolean(document.querySelector('.route-transition-grid')),
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
    }
  })()`)

  if (!after.path.endsWith('/workflow.html')) failures.push(`route transition landed on ${after.path}`)
  if (!after.h1) failures.push('route transition destination h1 is missing')
  if (!after.layer || after.shards < 5 || !after.beam || !after.grid) failures.push('route transition components missing after navigation')
  if (after.overflow > 2) failures.push(`route transition smoke overflow ${after.overflow}px`)

  return {
    name: 'route transition smoke',
    before,
    after,
    failures,
    runtimeEvents: runtimeEvents.slice(0, 8),
  }
}

async function auditReducedMotion() {
  runtimeEvents.length = 0
  networkEvents.length = 0
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  })
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  })
  await cdp.send('Page.navigate', { url: `${baseUrl}/` })
  await cdp.waitForEvent('Page.loadEventFired', () => true, 15_000).catch(() => {})
  await delay(550)

  const result = await evalValue(`(async () => {
    const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))
    const failures = []
    const find = (label) => Array.from(document.querySelectorAll('.signal-quick-action')).find((button) => button.textContent?.trim() === label)
    find('风暴')?.click()
    find('高能')?.click()
    await wait(520)
    const rain = document.querySelector('.rain-canvas')
    const rainStyle = rain ? window.getComputedStyle(rain) : null
    const hyperRoot = document.querySelector('.hyper-signal-canvas-root')
    const reactor = document.querySelector('[data-signal-reactor]')
    const reactorCanvas = reactor?.querySelector('.signal-reactor-canvas')
    const reactorCanvasRect = reactorCanvas?.getBoundingClientRect()
    const fieldMode = document.querySelector('button[data-reactor-mode="field"]')
    fieldMode?.click()
    await wait(80)
    const pixiResourceLoaded = performance.getEntriesByType('resource').some((item) => /signal-canvas-layer|pixi/i.test(item.name))
    const motionReduce = document.documentElement.classList.contains('motion-reduce')
    const rainHidden = !rain || rainStyle.display === 'none' || Number(rainStyle.opacity) === 0
    const heavyCanvasReady = hyperRoot?.dataset.canvasReady === 'true' || hyperRoot?.dataset.canvasLoading === 'true'
    const reactorReduced = reactor?.dataset.reactorReady === 'static' || reactor?.dataset.reactorQuality === 'calm'
    const reactorStaticFrame = reactor?.dataset.reactorFrame === 'static'
    const reactorCanvasVisible = Boolean(
      reactorCanvas &&
      reactorCanvasRect &&
      reactorCanvasRect.width > 1 &&
      reactorCanvasRect.height > 1 &&
      reactorCanvas.width > 1 &&
      reactorCanvas.height > 1 &&
      window.getComputedStyle(reactorCanvas).display !== 'none'
    )
    const fieldModeWorks =
      reactor?.dataset.reactorMode === 'field' &&
      fieldMode?.getAttribute('aria-pressed') === 'true' &&
      document.querySelector('[data-reactor-title]')?.textContent?.includes('现场')
    const projectCards = Array.from(document.querySelectorAll('[data-project-gallery] [data-project-card]'))
    const animatedProjectParts = Array.from(document.querySelectorAll('[data-project-gallery] *')).filter((element) => {
      const style = window.getComputedStyle(element)
      return style.animationName !== 'none' && style.animationDuration !== '0s'
    })
    const projectCardsVisible = projectCards.filter((card) => {
      const style = window.getComputedStyle(card)
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.05
    }).length
    if (!motionReduce) failures.push('html.motion-reduce was not set under reduced motion')
    if (!rainHidden) failures.push('rain canvas remained visible under reduced motion')
    if (heavyCanvasReady) failures.push('hyper canvas loaded under reduced motion')
    if (pixiResourceLoaded) failures.push('Pixi/signal canvas chunk loaded under reduced motion')
    if (!reactorReduced) failures.push('Signal Reactor did not downgrade under reduced motion')
    if (!reactorStaticFrame) failures.push('Signal Reactor did not publish a rendered static frame')
    if (!reactorCanvasVisible) failures.push('Signal Reactor static canvas is not visibly sized under reduced motion')
    if (!fieldModeWorks) failures.push('Signal Reactor mode controls stopped working under reduced motion')
    if (projectCards.length !== 10) failures.push('project gallery card count is ' + projectCards.length + '/10 under reduced motion')
    if (animatedProjectParts.length > 0) failures.push('project gallery animations remained active under reduced motion')
    if (projectCardsVisible !== projectCards.length) failures.push('project cards became hidden under reduced motion')
    return {
      motionReduce,
      rainHidden,
      heavyCanvasReady,
      pixiResourceLoaded,
      reactorReduced,
      reactorStaticFrame,
      reactorCanvasVisible,
      fieldModeWorks,
      animatedProjectParts: animatedProjectParts.length,
      projectCardsVisible,
      projectCards: projectCards.length,
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      failures,
    }
  })()`)

  if (result.overflow > 2) {
    result.failures.push(`reduced-motion overflow ${result.overflow}px`)
  }

  await cdp.send('Emulation.setEmulatedMedia', { features: [] })

  return {
    name: 'reduced motion',
    ...result,
    runtimeEvents: runtimeEvents.slice(0, 8),
  }
}

async function auditProjectCaseReducedMotion() {
  runtimeEvents.length = 0
  networkEvents.length = 0
  const caseRoutes = [
    '/lab-mcgs-chain.html',
    '/lab-busbar-debugging-platform.html',
    '/lab-protocol-studio.html',
    '/lab-geo-star-engine.html',
    '/lab-digital-busbar-chain.html',
    '/lab-mcgs-atlas.html',
    '/lab-scp-containment-admin.html',
  ]
  const failures = []
  const pages = []
  const lifecyclePages = []

  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  })
  await cdp.send('Emulation.setEmulatedMedia', { features: [] })

  for (const route of caseRoutes) {
    const loadPromise = cdp.waitForEvent('Page.loadEventFired', () => true, 15_000)
    const nav = await cdp.send('Page.navigate', { url: `${baseUrl}${route}` })
    if (nav.errorText) failures.push(`${route}: lifecycle navigation failed ${nav.errorText}`)
    await loadPromise.catch((error) => failures.push(`${route}: lifecycle load timeout ${error.message}`))
    await delay(360)
    const lifecycle = await evalValue(`(async () => {
      const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))
      const waitUntil = async (predicate, timeout = 1200) => {
        const started = performance.now()
        while (performance.now() - started < timeout) {
          if (predicate()) return true
          await wait(40)
        }
        return predicate()
      }
      const waitFrames = async (count = 1) => {
        for (let index = 0; index < count; index += 1) {
          await new Promise((resolve) => {
            let settled = false
            let watchdog = 0
            const finish = () => {
              if (settled) return
              settled = true
              window.clearTimeout(watchdog)
              resolve()
            }
            watchdog = window.setTimeout(finish, 34)
            window.requestAnimationFrame(finish)
          })
        }
      }
      const instrument = document.querySelector('.project-case-instrument, .story-visual')
      const animations = () => instrument?.getAnimations({ subtree: true }) || []
      const smilRoots = Array.from(instrument?.querySelectorAll('svg') || [])
        .filter((svg) => typeof svg.animationsPaused === 'function')
      const smilPaused = () => smilRoots.every((svg) => svg.animationsPaused())
      const isRunning = () => Boolean(
        instrument?.classList.contains('is-in-view') &&
        animations().length > 0 &&
        animations().some((animation) => animation.playState === 'running') &&
        smilRoots.every((svg) => !svg.animationsPaused())
      )
      const allPaused = () => (
        animations().every((animation) => animation.playState !== 'running') &&
        smilPaused()
      )
      const originalScrollY = window.scrollY
      const originalScrollBehavior = document.documentElement.style.scrollBehavior
      const ownHiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden')
      let simulatedHidden = false
      let hiddenOverrideInstalled = false
      const result = {
        route: window.location.pathname,
        instrument: Boolean(instrument),
        animationCount: animations().length,
        smilRoots: smilRoots.length,
        enteredRunning: false,
        exitedViewport: false,
        offscreenPaused: false,
        returnedRunning: false,
        visibilitySupported: true,
        hiddenPaused: false,
        visibleResumed: false,
      }

      try {
        document.documentElement.style.scrollBehavior = 'auto'
        instrument?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' })
        result.enteredRunning = await waitUntil(isRunning)

        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'auto' })
        result.exitedViewport = await waitUntil(() => {
          const rect = instrument?.getBoundingClientRect()
          return Boolean(rect && (rect.bottom < 0 || rect.top > window.innerHeight))
        })
        result.offscreenPaused = await waitUntil(() => Boolean(
          instrument &&
          !instrument.classList.contains('is-in-view') &&
          allPaused()
        ))

        instrument?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' })
        result.returnedRunning = await waitUntil(isRunning)

        try {
          Object.defineProperty(document, 'hidden', {
            configurable: true,
            get: () => simulatedHidden,
          })
          hiddenOverrideInstalled = true
        } catch {
          result.visibilitySupported = false
        }

        if (result.visibilitySupported) {
          simulatedHidden = true
          document.dispatchEvent(new Event('visibilitychange'))
          result.hiddenPaused = await waitUntil(() => Boolean(
            instrument?.classList.contains('is-page-hidden') && allPaused()
          ))

          simulatedHidden = false
          document.dispatchEvent(new Event('visibilitychange'))
          result.visibleResumed = await waitUntil(isRunning)
        }
      } finally {
        if (hiddenOverrideInstalled) {
          if (ownHiddenDescriptor) Object.defineProperty(document, 'hidden', ownHiddenDescriptor)
          else delete document.hidden
        }
        window.scrollTo({ top: originalScrollY, behavior: 'auto' })
        document.documentElement.style.scrollBehavior = originalScrollBehavior
      }

      return result
    })()`, { label: `projectCaseLifecycle.${route}`, timeout: 8_000, retries: 0 })

    if (!lifecycle.instrument) failures.push(`${route}: project case lifecycle instrument is missing`)
    if (lifecycle.animationCount < 1) failures.push(`${route}: project case lifecycle has no observable animation`)
    if (!lifecycle.enteredRunning) failures.push(`${route}: project case animation did not run in the viewport`)
    if (!lifecycle.exitedViewport) failures.push(`${route}: project case instrument did not leave the viewport`)
    if (!lifecycle.offscreenPaused) failures.push(`${route}: project case animation did not pause offscreen`)
    if (!lifecycle.returnedRunning) failures.push(`${route}: project case animation did not resume after returning`)
    if (!lifecycle.visibilitySupported) failures.push(`${route}: project case hidden-state simulation is unavailable`)
    if (lifecycle.visibilitySupported && !lifecycle.hiddenPaused) failures.push(`${route}: project case animation did not pause while hidden`)
    if (lifecycle.visibilitySupported && !lifecycle.visibleResumed) failures.push(`${route}: project case animation did not resume after visibility returned`)
    lifecyclePages.push(lifecycle)
  }

  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  })

  for (const route of caseRoutes) {
    const loadPromise = cdp.waitForEvent('Page.loadEventFired', () => true, 15_000)
    const nav = await cdp.send('Page.navigate', { url: `${baseUrl}${route}` })
    if (nav.errorText) failures.push(`${route}: navigation failed ${nav.errorText}`)
    await loadPromise.catch((error) => failures.push(`${route}: load timeout ${error.message}`))
    await delay(360)
    const page = await evalValue(`(() => {
      const instrument = document.querySelector('.project-case-instrument, .story-visual')
      const animations = instrument?.getAnimations({ subtree: true }) || []
      const smilRoots = Array.from(instrument?.querySelectorAll('svg') || [])
        .filter((svg) => typeof svg.animationsPaused === 'function')
      return {
        route: window.location.pathname,
        instrument: Boolean(instrument),
        runningAnimations: animations.filter((animation) => animation.playState === 'running').length,
        smilRoots: smilRoots.length,
        smilPaused: smilRoots.every((svg) => svg.animationsPaused()),
        scrollBehavior: window.getComputedStyle(document.documentElement).scrollBehavior,
        overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      }
    })()`)
    if (!page.instrument) failures.push(`${route}: project case instrument is missing`)
    if (page.runningAnimations > 0) failures.push(`${route}: ${page.runningAnimations} animations still run under reduced motion`)
    if (!page.smilPaused) failures.push(`${route}: SVG motion still runs under reduced motion`)
    if (page.scrollBehavior !== 'auto') failures.push(`${route}: scroll behavior remained ${page.scrollBehavior}`)
    if (page.overflow > 2) failures.push(`${route}: reduced-motion overflow ${page.overflow}px`)
    pages.push(page)
  }

  await cdp.send('Emulation.setEmulatedMedia', { features: [] })
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false }).catch(() => {})

  return {
    name: 'project case reduced motion',
    pages,
    lifecyclePages,
    failures,
    runtimeEvents: runtimeEvents.slice(0, 8),
  }
}

async function auditReactorContextLoss() {
  runtimeEvents.length = 0
  networkEvents.length = 0
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 960,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await cdp.send('Emulation.setEmulatedMedia', { features: [] })
  await cdp.send('Page.navigate', { url: `${baseUrl}/` })
  await cdp.waitForEvent('Page.loadEventFired', () => true, 15_000).catch(() => {})
  await delay(650)

  const result = await evalValue(`(async () => {
    const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))
    const waitFrame = () => new Promise((resolve) => {
      let settled = false
      let watchdog = 0
      const finish = () => {
        if (settled) return
        settled = true
        window.clearTimeout(watchdog)
        resolve()
      }
      watchdog = window.setTimeout(finish, 34)
      window.requestAnimationFrame(finish)
    })
    const waitFrames = async (count = 1) => {
      for (let frame = 0; frame < count; frame += 1) await waitFrame()
    }
    const waitUntil = async (predicate, timeout = 900) => {
      const started = performance.now()
      while (performance.now() - started < timeout) {
        if (predicate()) return true
        await wait(40)
      }
      return predicate()
    }
    const failures = []
    const reactor = document.querySelector('[data-signal-reactor]')
    const canvas = reactor?.querySelector('.signal-reactor-canvas')
    const shell = reactor?.querySelector('.signal-reactor-shell')
    const originalScrollY = window.scrollY
    const originalScrollBehavior = document.documentElement.style.scrollBehavior
    const before = {
      engine: reactor?.dataset.reactorEngine || '',
      ready: reactor?.dataset.reactorReady || '',
      frame: reactor?.dataset.reactorFrame || '',
      loop: reactor?.dataset.reactorLoop || '',
    }

    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl')
    const loseContext = gl?.getExtension('WEBGL_lose_context')
    if (!reactor || !canvas) failures.push('Signal Reactor canvas was not mounted')
    if (!gl) failures.push('Signal Reactor did not expose a WebGL context')
    if (!loseContext) failures.push('WEBGL_lose_context extension is unavailable')

    loseContext?.loseContext()
    await wait(180)

    const loopTransitions = []
    const loopObserver = reactor ? new MutationObserver(() => {
      loopTransitions.push(reactor.dataset.reactorLoop || '')
    }) : null
    loopObserver?.observe(reactor, { attributes: true, attributeFilter: ['data-reactor-loop'] })

    const canvasStyle = canvas ? window.getComputedStyle(canvas) : null
    const shellStyle = shell ? window.getComputedStyle(shell) : null
    const shellRect = shell?.getBoundingClientRect()
    const after = {
      contextLostClass: reactor?.classList.contains('is-context-lost') || false,
      engine: reactor?.dataset.reactorEngine || '',
      ready: reactor?.dataset.reactorReady || '',
      frame: reactor?.dataset.reactorFrame || '',
      loop: reactor?.dataset.reactorLoop || '',
      canvasAriaHidden: canvas?.getAttribute('aria-hidden') || '',
      shellAriaHidden: shell?.getAttribute('aria-hidden') || '',
      canvasOpacity: Number(canvasStyle?.opacity || 0),
      shellOpacity: Number(shellStyle?.opacity || 0),
      shellVisible: Boolean(
        shell &&
        shellRect &&
        shellRect.width > 1 &&
        shellRect.height > 1 &&
        shellStyle?.display !== 'none' &&
        Number(shellStyle?.opacity || 0) > 0.5
      ),
    }

    if (!after.contextLostClass) failures.push('context-loss class was not applied')
    if (after.engine !== 'css') failures.push(\`context-loss engine remained \${after.engine || 'unset'}\`)
    if (after.ready !== 'static') failures.push(\`context-loss ready state remained \${after.ready || 'unset'}\`)
    if (after.frame !== 'static') failures.push(\`context-loss frame state remained \${after.frame || 'unset'}\`)
    if (after.loop !== 'static') failures.push(\`context-loss loop state remained \${after.loop || 'unset'}\`)
    if (after.canvasAriaHidden !== 'true') failures.push(\`context-loss canvas aria-hidden is \${after.canvasAriaHidden || 'unset'}\`)
    if (after.shellAriaHidden !== 'true') failures.push(\`context-loss CSS fallback aria-hidden is \${after.shellAriaHidden || 'unset'}\`)
    if (after.canvasOpacity > 0.01) failures.push(\`context-loss canvas opacity remained \${after.canvasOpacity}\`)
    if (!after.shellVisible) failures.push('CSS reactor fallback was not visibly sized')

    const terminalSnapshot = () => ({
      loop: reactor?.dataset.reactorLoop || '',
      engine: reactor?.dataset.reactorEngine || '',
      ready: reactor?.dataset.reactorReady || '',
      frame: reactor?.dataset.reactorFrame || '',
      contextLostClass: reactor?.classList.contains('is-context-lost') || false,
    })
    const assertTerminal = (state, label) => {
      if (state.loop !== 'static') failures.push(label + ' loop became ' + (state.loop || 'unset'))
      if (state.engine !== 'css') failures.push(label + ' engine became ' + (state.engine || 'unset'))
      if (state.ready !== 'static' || state.frame !== 'static') {
        failures.push(label + ' fallback state became ' + (state.ready || 'unset') + '/' + (state.frame || 'unset'))
      }
      if (!state.contextLostClass) failures.push(label + ' lost the context-loss class')
    }

    const lifecycle = {
      visibilitySupported: true,
      hidden: null,
      visible: null,
      exitedViewport: false,
      offscreen: null,
      returnedToViewport: false,
      returned: null,
    }
    const ownHiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden')
    let simulatedHidden = false
    let hiddenOverrideInstalled = false

    try {
      document.documentElement.style.scrollBehavior = 'auto'
      try {
        Object.defineProperty(document, 'hidden', {
          configurable: true,
          get: () => simulatedHidden,
        })
        hiddenOverrideInstalled = true
      } catch (error) {
        lifecycle.visibilitySupported = false
        failures.push('context-loss visibility simulation is unavailable: ' + (error?.message || String(error)))
      }

      if (lifecycle.visibilitySupported) {
        simulatedHidden = true
        document.dispatchEvent(new Event('visibilitychange'))
        await waitFrames(2)
        lifecycle.hidden = terminalSnapshot()
        assertTerminal(lifecycle.hidden, 'hidden context-loss lifecycle')

        simulatedHidden = false
        document.dispatchEvent(new Event('visibilitychange'))
        await waitFrames(2)
        lifecycle.visible = terminalSnapshot()
        assertTerminal(lifecycle.visible, 'visible context-loss lifecycle')
      }

      const gallery = document.querySelector('[data-project-gallery]')
      gallery?.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'auto' })
      lifecycle.exitedViewport = await waitUntil(() => {
        const rect = reactor?.getBoundingClientRect()
        return Boolean(rect && (rect.bottom < 0 || rect.top > window.innerHeight))
      })
      await waitFrames(2)
      lifecycle.offscreen = terminalSnapshot()
      assertTerminal(lifecycle.offscreen, 'offscreen context-loss lifecycle')

      reactor?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' })
      lifecycle.returnedToViewport = await waitUntil(() => {
        const rect = reactor?.getBoundingClientRect()
        return Boolean(rect && rect.bottom > 0 && rect.top < window.innerHeight)
      })
      await waitFrames(2)
      lifecycle.returned = terminalSnapshot()
      assertTerminal(lifecycle.returned, 'returned context-loss lifecycle')
    } finally {
      loopObserver?.disconnect()
      if (hiddenOverrideInstalled) {
        if (ownHiddenDescriptor) Object.defineProperty(document, 'hidden', ownHiddenDescriptor)
        else delete document.hidden
      }
      window.scrollTo({ top: originalScrollY, behavior: 'auto' })
      document.documentElement.style.scrollBehavior = originalScrollBehavior
    }

    if (!lifecycle.exitedViewport) failures.push('context-loss reactor did not leave the viewport')
    if (!lifecycle.returnedToViewport) failures.push('context-loss reactor did not return to the viewport')
    if (loopTransitions.includes('running')) {
      failures.push('context-loss loop restarted during visibility or intersection lifecycle')
    }

    return {
      extensionAvailable: Boolean(loseContext),
      before,
      after,
      lifecycle,
      loopTransitions,
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      failures,
    }
  })()`)

  if (result.overflow > 2) {
    result.failures.push(`context-loss overflow ${result.overflow}px`)
  }

  return {
    name: 'reactor context loss fallback',
    ...result,
    runtimeEvents: runtimeEvents.slice(0, 8),
  }
}

async function auditCodeConsoleCollapse() {
  const routeResults = []
  const failures = []
  const warnings = []

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 960,
    deviceScaleFactor: 1,
    mobile: false,
  })

  for (const route of routes) {
    runtimeEvents.length = 0
    networkEvents.length = 0
    const url = `${baseUrl}${route}`
    const loadPromise = cdp.waitForEvent('Page.loadEventFired', () => true, 15_000)
    const nav = await cdp.send('Page.navigate', { url })
    if (nav.errorText) {
      failures.push(`${route}: navigation failed ${nav.errorText}`)
    }
    await loadPromise.catch((error) => {
      failures.push(`${route}: load timeout ${error.message}`)
    })
    await delay(550)

    const result = await evalValue(`(async () => {
      const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))
      const consoles = Array.from(document.querySelectorAll('.code-console'))
      const failures = []
      const samples = []

      const rectOf = (node) => {
        if (!node) return null
        const rect = node.getBoundingClientRect()
        return {
          height: Math.round(rect.height * 10) / 10,
          scrollHeight: node.scrollHeight,
          clientHeight: node.clientHeight,
        }
      }

      const measure = (target) => ({
        collapsed: target.classList.contains('is-collapsed'),
        wrapper: rectOf(target),
        viewport: rectOf(target.querySelector('.code-console-viewport')),
        pre: rectOf(target.querySelector('.code-console-pre')),
        rail: rectOf(target.querySelector('.code-console-line-rail')),
        lineButtons: target.querySelectorAll('.code-console-line-button').length,
      })

      const actionButton = (target, label) => Array
        .from(target.querySelectorAll('.code-console-toolbar .code-console-button'))
        .find((button) => button.textContent?.trim() === label)

      for (const [index, target] of consoles.entries()) {
        target.scrollIntoView({ block: 'center', inline: 'nearest' })
        await wait(180)

        const expandButton = actionButton(target, '展开')
        if (expandButton) {
          expandButton.click()
          await wait(320)
        }

        const lineToggle = target.querySelector('.code-console-toolbar .code-console-button[aria-label="显示或隐藏代码行号"]')
        if (lineToggle && target.querySelectorAll('.code-console-line-button').length === 0) {
          lineToggle.click()
          await wait(90)
          lineToggle.click()
          await wait(140)
        }

        const foldButton = actionButton(target, '折叠')
        const dockReady = target.dataset.codeDock === 'ready' || target.dataset.codeDock === 'copied'
        const hasDoor = Boolean(target.querySelector('.code-console-door'))
        const hasEnergy = Boolean(target.querySelector('.code-console-energy'))
        const hasLock = Boolean(target.querySelector('.code-console-lock'))
        if (!dockReady) failures.push('第 ' + (index + 1) + ' 个代码块缺少 data-code-dock')
        if (!hasDoor || !hasEnergy || !hasLock) {
          failures.push('第 ' + (index + 1) + ' 个代码块缺少代码舱装饰层')
        }
        if (!foldButton) {
          failures.push('第 ' + (index + 1) + ' 个代码块找不到折叠按钮')
          continue
        }

        const before = measure(target)
        foldButton.click()
        await wait(560)
        const after = measure(target)

        const isTallEnough = before.viewport?.height > 118
        const shouldShrinkClearly = before.viewport?.height > 160

        if (isTallEnough && after.viewport?.height > 112) {
          failures.push('第 ' + (index + 1) + ' 个代码块折叠后视口仍有 ' + after.viewport.height + 'px')
        }
        if (shouldShrinkClearly && after.viewport?.height >= before.viewport.height * 0.75) {
          failures.push('第 ' + (index + 1) + ' 个代码块折叠后视口没有明显变短：' + before.viewport.height + 'px -> ' + after.viewport.height + 'px')
        }
        if (shouldShrinkClearly && after.wrapper?.height >= before.wrapper.height * 0.86) {
          failures.push('第 ' + (index + 1) + ' 个代码块折叠后外框没有整体收起：' + before.wrapper.height + 'px -> ' + after.wrapper.height + 'px')
        }
        if (!target.classList.contains('is-door-sealed')) {
          failures.push('第 ' + (index + 1) + ' 个代码块折叠后没有进入舱门锁定状态')
        }
        if (after.pre?.height > (after.viewport?.height || 0) + 2) {
          failures.push('第 ' + (index + 1) + ' 个代码正文溢出折叠视口：pre ' + after.pre.height + 'px / viewport ' + after.viewport.height + 'px')
        }

        const restoreButton = actionButton(target, '展开')
        if (restoreButton) {
          restoreButton.click()
          await wait(80)
        }

        if (samples.length < 6) {
          samples.push({ index: index + 1, before, after })
        }
      }

      return {
        checked: consoles.length,
        failures,
        samples,
        horizontalOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      }
    })()`)

    if (result.checked > 0) {
      routeResults.push({ route, ...result, runtimeEvents: runtimeEvents.slice(0, 4) })
      result.failures.forEach((item) => failures.push(`${route}: ${item}`))
      if (result.horizontalOverflow > 2) {
        failures.push(`${route}: horizontal overflow after code collapse ${result.horizontalOverflow}px`)
      }
      if (runtimeEvents.length > 0) {
        warnings.push(`${route}: runtime events during code collapse ${JSON.stringify(runtimeEvents.slice(0, 4))}`)
      }
    }
  }

  return {
    name: 'code console collapse',
    checkedRoutes: routeResults.length,
    checkedBlocks: routeResults.reduce((total, item) => total + item.checked, 0),
    routes: routeResults,
    failures,
    warnings,
  }
}

async function evaluatePage() {
  return evalValue(`(() => {
    const forbiddenPublicCopy = ${JSON.stringify(forbiddenPublicCopy)}
    const text = document.body.innerText || ''
    const chinese = (text.match(/[\\u4e00-\\u9fff]/g) || []).length
    const latin = (text.match(/[A-Za-z]/g) || []).length
    const doc = document.documentElement
    const body = document.body
    const maxScrollWidth = Math.max(doc.scrollWidth, body.scrollWidth)
    const horizontalOverflow = Math.max(0, maxScrollWidth - window.innerWidth)
    const widestVisible = Array.from(document.body.querySelectorAll('*'))
      .map((element) => {
        const rect = element.getBoundingClientRect()
        const style = window.getComputedStyle(element)
        return {
          tag: element.tagName.toLowerCase(),
          className: typeof element.className === 'string' ? element.className.slice(0, 80) : '',
          text: (element.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 80),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          position: style.position,
          hidden: style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0,
        }
      })
      .filter((item) => !item.hidden && item.width > 0 && item.position !== 'fixed')
      .filter((item) => item.left < -2 || item.right > window.innerWidth + 2)
      .slice(0, 8)
    const nav = performance.getEntriesByType('navigation')[0]
    const resources = performance.getEntriesByType('resource')
    const transferKb = resources.reduce((total, item) => total + (item.transferSize || 0), 0) / 1024
    const quickActionMetrics = Array.from(document.querySelectorAll('.signal-quick-action')).map((button) => {
      const rect = button.getBoundingClientRect()
      const style = window.getComputedStyle(button)
      return {
        label: button.textContent?.trim() || '',
        visible: style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      }
    })
    const reactor = document.querySelector('[data-signal-reactor]')
    const reactorCanvas = reactor?.querySelector('.signal-reactor-canvas')
    const reactorRect = reactor?.getBoundingClientRect()
    const reactorCanvasRect = reactorCanvas?.getBoundingClientRect()
    const liveSystemsRoot = document.querySelector('[data-live-systems]')
    const liveSystemTabs = Array.from(liveSystemsRoot?.querySelectorAll('button[data-system-tab]') || [])
    const liveSystemPanels = Array.from(liveSystemsRoot?.querySelectorAll('[data-system-panel]') || [])
    const selectedLiveSystemTabs = liveSystemTabs.filter((tab) => tab.getAttribute('aria-selected') === 'true')
    const selectedLiveSystemKey = selectedLiveSystemTabs[0]?.dataset.systemTab || ''
    const selectedLiveSystemPanel = liveSystemPanels.find((panel) => panel.dataset.systemPanel === selectedLiveSystemKey)
    const inactiveLiveSystemPanels = liveSystemPanels.filter((panel) => panel !== selectedLiveSystemPanel)
    const liveSystemsStage = liveSystemsRoot?.querySelector('[data-systems-stage]')
    const liveSystemsStageRect = liveSystemsStage?.getBoundingClientRect()
    const liveSystemsRail = liveSystemsRoot?.querySelector('.systems-rail')
    const liveSystemsRailStyle = liveSystemsRail ? window.getComputedStyle(liveSystemsRail) : null
    const projectGalleryRoot = document.querySelector('[data-project-gallery]')
    const projectCards = Array.from(projectGalleryRoot?.querySelectorAll('[data-project-card]') || [])
    const projectFeatures = projectCards.filter((card) => card.classList.contains('project-feature'))
    const projectShelfCards = projectCards.filter((card) => card.classList.contains('project-shelf-card'))
    const firstProjectMarker = projectCards[0] ? window.getComputedStyle(projectCards[0], '::before') : null
    const pointerProbe = document.querySelector('.pointer-probe')
    const pointerProbeRect = pointerProbe?.getBoundingClientRect()
    const pointerProbeStyle = pointerProbe ? window.getComputedStyle(pointerProbe) : null
    const pointerProbeVisible = Boolean(
      pointerProbeRect &&
      pointerProbeStyle &&
      pointerProbeStyle.display !== 'none' &&
      pointerProbeStyle.visibility !== 'hidden' &&
      Number(pointerProbeStyle.opacity || 0) > 0.05 &&
      pointerProbeRect.width > 0 &&
      pointerProbeRect.height > 0,
    )
    const bodyCursor = window.getComputedStyle(document.body).cursor
    const clarityMap = document.querySelector('[data-clarity-map]')
    const personaTargets = Array.from(document.querySelectorAll('[data-pointer-mode]')).map((element) => ({
      tag: element.tagName.toLowerCase(),
      mode: element.getAttribute('data-pointer-mode') || '',
      label: element.getAttribute('data-pointer-label') || '',
      href: element.getAttribute('href') || '',
      text: (element.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 80),
    }))
    const pointerModes = Array.from(new Set(personaTargets.map((item) => item.mode).filter(Boolean))).sort()
    const touchBadgeSamples = Array.from(document.querySelectorAll('.feed-item[data-pointer-mode]'))
      .slice(0, 4)
      .map((element) => {
        const style = window.getComputedStyle(element, '::before')
        return {
          mode: element.getAttribute('data-pointer-mode') || '',
          label: element.getAttribute('data-pointer-label') || '',
          content: style.content || '',
          display: style.display || '',
        }
      })
    return {
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.trim() || '',
      readyState: document.readyState,
      textLength: text.trim().length,
      chineseRatio: chinese / Math.max(chinese + latin, 1),
      horizontalOverflow,
      widestVisible,
      commandTrigger: Boolean(document.querySelector('.command-palette-trigger')),
      quickActions: Array.from(document.querySelectorAll('.signal-quick-action')).map((button) => button.textContent?.trim()),
      quickActionMetrics,
      liveSystems: {
        exists: Boolean(liveSystemsRoot),
        tabs: liveSystemTabs.length,
        panels: liveSystemPanels.length,
        activeSystem: liveSystemsRoot?.dataset.systemActive || '',
        selectedKey: selectedLiveSystemKey,
        selectedTabs: selectedLiveSystemTabs.length,
        visiblePanels: liveSystemPanels.filter((panel) => panel.getAttribute('aria-hidden') === 'false').length,
        selectedPanelHidden: selectedLiveSystemPanel?.getAttribute('aria-hidden') ?? null,
        selectedPanelInert: Boolean(selectedLiveSystemPanel?.inert),
        inactivePanels: inactiveLiveSystemPanels.length,
        inactiveInertPanels: inactiveLiveSystemPanels.filter((panel) => panel.inert).length,
        tabStops: liveSystemTabs.filter((tab) => tab.tabIndex === 0).length,
        stageWidth: Math.round(liveSystemsStageRect?.width || 0),
        stageHeight: Math.round(liveSystemsStageRect?.height || 0),
        railWidth: Math.round(liveSystemsRail?.clientWidth || 0),
        railScrollWidth: Math.round(liveSystemsRail?.scrollWidth || 0),
        railOverflowX: liveSystemsRailStyle?.overflowX || '',
        tabMetrics: liveSystemTabs.map((tab) => {
          const rect = tab.getBoundingClientRect()
          return { key: tab.dataset.systemTab || '', width: Math.round(rect.width), height: Math.round(rect.height) }
        }),
      },
      reactor: {
        exists: Boolean(reactor),
        ready: reactor?.dataset.reactorReady || '',
        quality: reactor?.dataset.reactorQuality || document.documentElement.dataset.visualQuality || '',
        width: Math.round(reactorRect?.width || 0),
        height: Math.round(reactorRect?.height || 0),
        canvasVisible: Boolean(reactorCanvasRect && reactorCanvasRect.width > 0 && reactorCanvasRect.height > 0),
      },
      projectGallery: {
        exists: Boolean(projectGalleryRoot),
        cards: projectCards.length,
        features: projectFeatures.length,
        shelfCards: projectShelfCards.length,
        visuals: projectGalleryRoot?.querySelectorAll('.project-visual, .project-shelf-visual').length || 0,
        geoCards: projectGalleryRoot?.querySelectorAll('[data-project-kind="geo"]').length || 0,
        allCardsAreLinks: projectCards.every((card) => card.tagName === 'A' && Boolean(card.getAttribute('href'))),
        inViewCards: projectCards.filter((card) => card.classList.contains('is-in-view')).length,
        markerBorderWidth: firstProjectMarker?.borderTopWidth || '',
        markerWidth: firstProjectMarker?.width || '',
        markerHeight: firstProjectMarker?.height || '',
      },
      orbitCards: Array.from(document.querySelectorAll('[data-orbit-card]')).length,
      cursor: {
        bodyCursor,
        hasNativeImageCursor: bodyCursor.includes('feian-signal-probe-cursor-48.png'),
        pointerProbeExists: Boolean(pointerProbe),
        pointerProbeSrc: pointerProbe?.getAttribute('src') || '',
        pointerProbeWidth: Math.round(pointerProbeRect?.width || 0),
        pointerProbeHeight: Math.round(pointerProbeRect?.height || 0),
        pointerProbeOpacity: pointerProbeStyle?.opacity || '',
        pointerProbeDisplay: pointerProbeStyle?.display || '',
        pointerProbeVisible,
        pointerModes,
        modeTargets: personaTargets.length,
        touchProbeClass: document.body.classList.contains('has-touch-probe'),
        touchBadgeSamples,
      },
      clarity: {
        hasClarityMap: Boolean(clarityMap),
        text: clarityMap?.textContent?.trim().replace(/\\s+/g, ' ') || '',
        firstRunLinks: clarityMap?.querySelectorAll('a[href]').length || 0,
      },
      forbiddenCopyHits: forbiddenPublicCopy.filter((term) => text.includes(term)),
      navLinks: Array.from(document.querySelectorAll('a[href]')).length,
      navDurationMs: nav?.duration || 0,
      transferKb,
    }
  })()`)
}

function collectFindings(result, failureList, warningList) {
  const label = `${result.route} [${result.viewport}]`
  if (result.documentStatus !== 200) {
    failureList.push(`${label}: document HTTP status ${result.documentStatus}`)
  }
  if (result.readyState !== 'complete') {
    failureList.push(`${label}: document readyState is ${result.readyState}`)
  }
  if (!result.title || !result.h1) {
    failureList.push(`${label}: missing title or h1`)
  }
  if (result.textLength < 180) {
    failureList.push(`${label}: body text too short (${result.textLength})`)
  }
  if (result.horizontalOverflow > 2) {
    failureList.push(`${label}: horizontal overflow ${result.horizontalOverflow}px`)
  }
  if (result.badResources.length > 0) {
    failureList.push(`${label}: resource errors ${JSON.stringify(result.badResources)}`)
  }
  if (result.transferKb > maxRouteTransferKb) {
    warningList.push(`${label}: transfer budget high ${result.transferKb}KB > ${maxRouteTransferKb}KB`)
  }
  if (result.forbiddenCopyHits?.length > 0) {
    failureList.push(`${label}: forbidden public copy ${result.forbiddenCopyHits.join(', ')}`)
  }
  if (result.viewport.startsWith('mobile')) {
    const visibleActions = result.quickActionMetrics?.filter((item) => item.visible) || []
    if (result.quickActions?.length > 0 && visibleActions.length < 6) {
      failureList.push(`${label}: mobile visual controls are not visible enough (${visibleActions.length}/${result.quickActions.length})`)
    }
    const tooSmall = visibleActions.filter((item) => item.height < 36)
    if (tooSmall.length > 0) {
      failureList.push(`${label}: mobile visual controls are too small ${JSON.stringify(tooSmall.slice(0, 4))}`)
    }
  }
  const errors = result.runtimeEvents.filter((event) => event.type.includes('error') || event.type === 'exception' || event.type === 'navigation' || event.type === 'load-timeout')
  if (errors.length > 0) {
    failureList.push(`${label}: runtime errors ${JSON.stringify(errors)}`)
  }
  const runtimeWarnings = result.runtimeEvents.filter((event) => event.type.includes('warning'))
  if (runtimeWarnings.length > 0) {
    warningList.push(`${label}: runtime warnings ${JSON.stringify(runtimeWarnings)}`)
  }
  if (result.chineseRatio < 0.42) {
    warningList.push(`${label}: Chinese-first ratio is low (${result.chineseRatio.toFixed(2)})`)
  }
  if (result.route === '/') {
    const missing = requiredHomePhrases.filter((phrase) => !(`${result.title} ${result.h1}`).includes(phrase))
    if (missing.length === requiredHomePhrases.length) {
      warningList.push(`${label}: homepage title/h1 may be missing expected public positioning`)
    }
    if (!result.reactor?.exists) {
      failureList.push(`${label}: missing Signal Reactor visual runtime`)
    }
    if (!result.reactor?.ready) {
      failureList.push(`${label}: Signal Reactor did not publish ready state`)
    }
    if (result.viewport === 'desktop' && result.reactor?.height < 180) {
      failureList.push(`${label}: Signal Reactor is too small (${result.reactor.height}px)`)
    }
    if (result.orbitCards < 10) {
      failureList.push(`${label}: project motion cards not wired (${result.orbitCards}/10)`)
    }
    if (!result.projectGallery?.exists) {
      failureList.push(`${label}: project gallery is missing`)
    }
    if (result.projectGallery?.features !== 4) {
      failureList.push(`${label}: featured project count is ${result.projectGallery?.features || 0}/4`)
    }
    if ((result.projectGallery?.shelfCards || 0) < 6) {
      failureList.push(`${label}: supporting project count is ${result.projectGallery?.shelfCards || 0}/6`)
    }
    if ((result.projectGallery?.visuals || 0) < 10) {
      failureList.push(`${label}: project visuals are missing (${result.projectGallery?.visuals || 0}/10)`)
    }
    if (result.projectGallery?.geoCards !== 1) {
      failureList.push(`${label}: GEO project card count is ${result.projectGallery?.geoCards || 0}/1`)
    }
    if (!result.projectGallery?.allCardsAreLinks) {
      failureList.push(`${label}: at least one project card has no usable link`)
    }
    if (result.projectGallery?.markerBorderWidth !== '0px') {
      failureList.push(`${label}: obsolete square timeline marker is still visible (${result.projectGallery?.markerBorderWidth || 'unknown'})`)
    }
    if (result.viewport === 'desktop' && !result.cursor?.hasNativeImageCursor) {
      failureList.push(`${label}: native IMAGE2 cursor fallback is not active (${result.cursor?.bodyCursor || 'empty'})`)
    }
    if (result.viewport === 'desktop' && !result.cursor?.pointerProbeExists) {
      failureList.push(`${label}: IMAGE2 pointer probe element is missing`)
    }
    if (result.viewport === 'desktop' && result.cursor?.pointerProbeExists && result.cursor.pointerProbeWidth < 48) {
      failureList.push(`${label}: IMAGE2 pointer probe is too small (${result.cursor.pointerProbeWidth}px)`)
    }
    if (result.viewport === 'desktop' && result.cursor?.pointerProbeVisible) {
      failureList.push(`${label}: duplicate enhanced pointer sprite is visible while native IMAGE2 cursor is active`)
    }
    if (!result.clarity?.hasClarityMap) {
      failureList.push(`${label}: first-visit clarity map is missing`)
    }
    if ((result.clarity?.firstRunLinks || 0) < 3) {
      failureList.push(`${label}: first-visit clarity map has only ${result.clarity?.firstRunLinks || 0} links`)
    }
    if (result.viewport === 'desktop') {
      const requiredPointerModes = ['scan', 'terminal', 'index', 'launch']
      const missingModes = requiredPointerModes.filter((mode) => !result.cursor?.pointerModes?.includes(mode))
      if (missingModes.length > 0) {
        failureList.push(`${label}: pointer persona modes missing ${missingModes.join(', ')}`)
      }
      if ((result.cursor?.modeTargets || 0) < 12) {
        failureList.push(`${label}: pointer persona target coverage is low (${result.cursor?.modeTargets || 0})`)
      }
    }
  }
}

function collectInteractionFindings(result, failureList, warningList) {
  result.failures?.forEach((item) => failureList.push(`${result.name}: ${item}`))
  result.warnings?.forEach((item) => warningList.push(`${result.name}: ${item}`))
  const expectedContextLoss = result.name === 'reactor context loss fallback'
  const runtimeErrors = (result.runtimeEvents || []).filter((event) => {
    const isError = event.type?.includes('error') || event.type === 'exception' || event.type === 'navigation' || event.type === 'load-timeout'
    if (!isError) return false
    return !(expectedContextLoss && /context.{0,8}lost|webgl/i.test(event.text || ''))
  })
  const runtimeWarnings = (result.runtimeEvents || []).filter((event) => event.type?.includes('warning'))
  if (runtimeErrors.length > 0) {
    failureList.push(`${result.name}: runtime errors ${JSON.stringify(runtimeErrors)}`)
  }
  if (runtimeWarnings.length > 0) {
    warningList.push(`${result.name}: runtime warnings ${JSON.stringify(runtimeWarnings)}`)
  }
  if (result.name !== 'homepage visual controls') return

  const expected = ['风压', '风暴', '透视', '高能', '声场', '安静', '命令']
  const labels = result.after?.labels || []
  const missing = expected.filter((label) => !labels.includes(label))
  if (missing.length > 0) {
    failureList.push(`${result.name}: missing visual control labels ${missing.join(', ')}`)
  }
  if (!result.after?.commandOpen) {
    failureList.push(`${result.name}: command palette did not open`)
  }
  if (!result.after?.xrayExists) {
    failureList.push(`${result.name}: xray overlay was not mounted`)
  }
  if (result.after?.overflow > 2) {
    failureList.push(`${result.name}: overflow after interactions ${result.after.overflow}px`)
  }
}

function runMotionSourceContractCheck() {
  const failures = []
  const warnings = []
  const cssPath = join(siteRoot, 'src', 'project-gallery.css')

  if (!existsSync(cssPath)) {
    failures.push(`motion contract stylesheet is missing: ${cssPath}`)
    return { cssPath, failures, warnings }
  }

  const css = readFileSync(cssPath, 'utf8')
  const railBlock = css.match(/\.protocol-rail\s*\{([^}]+)\}/i)?.[1] || ''
  const dashValues = (railBlock.match(/stroke-dasharray:\s*([^;]+)/i)?.[1] || '')
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter(Number.isFinite)
  const keyframes = css.match(/@keyframes\s+protocol-rail-run\s*\{([\s\S]*?)\n\}/i)?.[1] || ''
  const terminalOffset = Number(keyframes.match(/stroke-dashoffset:\s*(-?[\d.]+)/i)?.[1])
  const dashPeriod = dashValues.reduce((total, value) => total + value, 0)
  const completePeriods = dashPeriod > 0 && Number.isFinite(terminalOffset)
    ? Math.abs(terminalOffset) / dashPeriod
    : Number.NaN
  const seamless = terminalOffset === -112 || (Number.isFinite(completePeriods) && Math.abs(completePeriods - Math.round(completePeriods)) < 0.0001)

  if (!/animation:\s*protocol-rail-run\b/i.test(railBlock)) {
    failures.push('protocol rail is not wired to protocol-rail-run')
  }
  if (dashValues.length < 2 || dashPeriod <= 0) {
    failures.push('protocol rail dash period could not be derived')
  }
  if (!Number.isFinite(terminalOffset)) {
    failures.push('protocol-rail-run terminal stroke-dashoffset is missing')
  } else if (!seamless) {
    failures.push(`protocol rail terminal ${terminalOffset} is not a complete ${dashPeriod}-unit dash period`)
  }

  return {
    cssPath,
    dashValues,
    dashPeriod,
    terminalOffset,
    completePeriods: Number.isFinite(completePeriods) ? completePeriods : null,
    seamless,
    failures,
    warnings,
  }
}

function runStaticLinkCheck(files) {
  const known = new Set(files.map((file) => `/${file}`))
  known.add('/')
  known.add('/index.html')
  const failures = []
  const warnings = []

  for (const file of files) {
    const text = readFileSync(join(distRoot, file), 'utf8')
    const hrefs = [...text.matchAll(/href=["']([^"']+)["']/g)].map((match) => match[1])
    for (const href of hrefs) {
      if (
        href.startsWith('http') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('#') ||
        href.startsWith('data:')
      ) {
        continue
      }
      const urlPath = href.split('#')[0].split('?')[0]
      if (!urlPath || urlPath === '/') continue
      if (urlPath.startsWith('/assets/') || urlPath === '/favicon.svg') continue
      if (!known.has(urlPath)) {
        failures.push(`${file}: broken internal href ${href}`)
      }
    }
  }

  return { checkedFiles: files.length, failures, warnings }
}

function runCriticalFallbackCheck() {
  const failures = []
  const warnings = []
  const indexPath = join(distRoot, 'index.html')

  if (!existsSync(indexPath)) {
    return { checked: false, failures: ['dist/index.html is missing'], warnings }
  }

  const html = readFileSync(indexPath, 'utf8')
  const criticalStyle = html.match(/<style[^>]*data-critical-reset[^>]*>([\s\S]*?)<\/style>/i)?.[1] || ''
  const normalizedCriticalStyle = criticalStyle.replace(/\s+/g, ' ')

  if (!criticalStyle) {
    failures.push('index.html is missing data-critical-reset fallback style')
  }
  if (!/\.page-shell\s*\{[^}]*visibility:\s*visible\b/i.test(criticalStyle)) {
    failures.push('critical fallback must keep .page-shell visible before JS/CSS assets load')
  }
  if (!/\.pointer-shell\s*\{[^}]*width:\s*0\b[^}]*height:\s*0\b[^}]*overflow:\s*hidden\b[^}]*opacity:\s*0\b/i.test(normalizedCriticalStyle)) {
    failures.push('critical fallback must hide pointer-shell chrome before enhanced CSS loads')
  }
  if (!/\.pointer-label\s*\{[^}]*opacity:\s*0\b/i.test(criticalStyle)) {
    failures.push('critical fallback must suppress pointer-label text before enhanced CSS loads')
  }
  if (!html.includes('把日常工作') || !html.includes('也更直观。')) {
    warnings.push('homepage critical fallback copy may no longer expose the expected hero content')
  }

  return {
    checked: true,
    criticalStyleBytes: Buffer.byteLength(criticalStyle, 'utf8'),
    failures,
    warnings,
  }
}

function runNoStaleAssetCheck() {
  const assetsRoot = join(distRoot, 'assets')
  const failures = []
  const warnings = []
  if (!existsSync(assetsRoot)) {
    return { checkedAssets: 0, maxAgeSpreadMinutes: 0, failures: ['dist/assets is missing'], warnings }
  }

  const assets = readdirSync(assetsRoot).filter((file) => /\.(css|js|svg|png|webp|jpg|jpeg|woff2?)$/i.test(file))
  const mtimes = assets.map((file) => statSync(join(assetsRoot, file)).mtimeMs)
  const newest = Math.max(...mtimes)
  const oldest = Math.min(...mtimes)
  const maxAgeSpreadMinutes = assets.length ? (newest - oldest) / 60_000 : 0
  const textFiles = collectTextFiles(distRoot)
  const text = textFiles.map((file) => readFileSync(file, 'utf8')).join('\n')
  const orphanAssets = assets.filter((file) => !text.includes(file))

  if (assets.length === 0) failures.push('dist/assets has no generated assets')
  if (assets.length > 64) failures.push(`too many generated assets (${assets.length}); stale hash files may be present`)
  if (maxAgeSpreadMinutes > 10) {
    failures.push(`asset mtime spread is ${maxAgeSpreadMinutes.toFixed(1)} minutes; clean dist before packaging`)
  }
  if (orphanAssets.length > 8) {
    warnings.push(`many assets are not referenced by dist text graph: ${orphanAssets.slice(0, 8).join(', ')}`)
  }

  return {
    checkedAssets: assets.length,
    maxAgeSpreadMinutes: Number(maxAgeSpreadMinutes.toFixed(3)),
    orphanAssets: orphanAssets.slice(0, 16),
    failures,
    warnings,
  }
}

function collectTextFiles(root) {
  const files = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectTextFiles(fullPath))
      continue
    }
    if (/\.(html|js|css|svg|json|txt)$/i.test(entry.name)) files.push(fullPath)
  }
  return files
}

async function saveScreenshot(filePath) {
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true })
  writeFileSync(filePath, Buffer.from(shot.data, 'base64'))
}

async function startStaticServer(root) {
  const server = createServer((request, response) => {
    try {
      const requestUrl = new URL(request.url || '/', 'http://127.0.0.1')
      let pathname = decodeURIComponent(requestUrl.pathname)
      if (pathname === '/') pathname = '/index.html'
      const absolute = resolve(root, `.${pathname}`)
      const normalizedRoot = `${normalize(root)}${sep}`
      if (!absolute.startsWith(normalizedRoot) && absolute !== normalize(root)) {
        response.writeHead(403)
        response.end('Forbidden')
        return
      }
      if (!existsSync(absolute) || !statSync(absolute).isFile()) {
        response.writeHead(404)
        response.end('Not found')
        return
      }
      response.writeHead(200, {
        'content-type': mimeType(absolute),
        'cache-control': 'no-store',
      })
      response.end(readFileSync(absolute))
    } catch (error) {
      response.writeHead(500)
      response.end(String(error))
    }
  })

  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))
  return {
    port: server.address().port,
    close: () => new Promise((resolveClose) => server.close(resolveClose)),
  }
}

function mimeType(file) {
  const ext = extname(file)
  return {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.json': 'application/json; charset=utf-8',
    '.woff2': 'font/woff2',
  }[ext] || 'application/octet-stream'
}

async function launchChrome() {
  const chromePath = findChrome()
  const userDataDir = join(runRoot, 'chrome-profile')
  mkdirSync(userDataDir, { recursive: true })
  const process = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-sync',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const activePortFile = join(userDataDir, 'DevToolsActivePort')
  const started = Date.now()
  while (!existsSync(activePortFile)) {
    if (Date.now() - started > 12_000) {
      process.kill()
      throw new Error('Chrome did not create DevToolsActivePort in time')
    }
    await delay(100)
  }
  const [portLine] = readFileSync(activePortFile, 'utf8').split(/\r?\n/)
  return { process, port: Number(portLine), userDataDir }
}

async function stopChrome(childProcess, userDataDir) {
  if (!childProcess?.pid) return
  if (globalThis.process.platform === 'win32') {
    await new Promise((resolveStop) => {
      const killer = spawn('taskkill', ['/PID', String(childProcess.pid), '/T', '/F'], {
        stdio: 'ignore',
      })
      killer.on('close', resolveStop)
      killer.on('error', resolveStop)
    })
    await new Promise((resolveStop) => {
      const command = [
        `$needle = @'`,
        userDataDir,
        `'@`,
        `Get-CimInstance Win32_Process -Filter "name='chrome.exe'" |`,
        `  Where-Object { $_.CommandLine -like "*$needle*" } |`,
        `  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
      ].join('\n')
      const cleaner = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], {
        stdio: 'ignore',
      })
      cleaner.on('close', resolveStop)
      cleaner.on('error', resolveStop)
    })
    return
  }
  childProcess.kill('SIGKILL')
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    `${process.env.LOCALAPPDATA || ''}/Google/Chrome/Application/chrome.exe`,
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ].filter(Boolean)
  const found = candidates.find((candidate) => existsSync(candidate))
  if (!found) throw new Error(`No Chrome/Edge executable found. Tried: ${candidates.join(', ')}`)
  return found
}

async function createPageSession(port) {
  let targetResponse = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`, {
    method: 'PUT',
  })
  if (!targetResponse.ok) {
    targetResponse = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`)
  }
  if (!targetResponse.ok) {
    throw new Error(`Unable to create Chrome target: ${targetResponse.status}`)
  }
  const target = await targetResponse.json()
  return new CdpSession(target.webSocketDebuggerUrl)
}

class CdpSession {
  constructor(webSocketUrl) {
    this.id = 0
    this.pending = new Map()
    this.listeners = new Map()
    this.socket = new WebSocket(webSocketUrl)
    this.ready = new Promise((resolveReady, rejectReady) => {
      this.socket.addEventListener('open', resolveReady, { once: true })
      this.socket.addEventListener('error', rejectReady, { once: true })
    })
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (message.id && this.pending.has(message.id)) {
        const { resolvePending, rejectPending, timer } = this.pending.get(message.id)
        this.pending.delete(message.id)
        clearTimeout(timer)
        if (message.error) rejectPending(new Error(message.error.message))
        else resolvePending(message.result)
        return
      }
      if (message.method) {
        const handlers = this.listeners.get(message.method) || []
        handlers.forEach((handler) => handler(message.params || {}))
      }
    })
  }

  async send(method, params = {}, options = {}) {
    await this.ready
    const timeout = options.timeout ?? cdpCommandTimeouts[method] ?? 12_000
    const retries = options.retries ?? (cdpRetryableMethods.has(method) ? 1 : 0)

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await this.sendOnce(method, params, timeout)
      } catch (error) {
        const isTimeout = error instanceof Error && error.message === `CDP command timed out: ${method}`
        if (!isTimeout || attempt >= retries) throw error
        await delay(220)
      }
    }

    throw new Error(`CDP command failed without result: ${method}`)
  }

  async sendOnce(method, params, timeout) {
    const id = ++this.id
    this.socket.send(JSON.stringify({ id, method, params }))
    return new Promise((resolvePending, rejectPending) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          rejectPending(new Error(`CDP command timed out: ${method}`))
        }
      }, timeout)
      this.pending.set(id, { resolvePending, rejectPending, timer })
    })
  }

  on(method, handler) {
    const handlers = this.listeners.get(method) || []
    handlers.push(handler)
    this.listeners.set(method, handlers)
  }

  waitForEvent(method, predicate = () => true, timeout = 10_000) {
    return new Promise((resolveEvent, rejectEvent) => {
      const timer = setTimeout(() => {
        rejectEvent(new Error(`Timed out waiting for ${method}`))
      }, timeout)
      const wrapped = (params) => {
        if (!predicate(params)) return
        clearTimeout(timer)
        const handlers = this.listeners.get(method) || []
        this.listeners.set(method, handlers.filter((handler) => handler !== wrapped))
        resolveEvent(params)
      }
      this.on(method, wrapped)
    })
  }

  close() {
    return new Promise((resolveClose) => {
      this.socket.addEventListener('close', resolveClose, { once: true })
      this.socket.close()
      setTimeout(resolveClose, 500)
    })
  }
}

async function evalValue(expression, options = {}) {
  let result
  try {
    result = await cdp.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    }, {
      timeout: options.timeout,
      retries: options.retries,
    })
  } catch (error) {
    const label = options.label || 'Runtime.evaluate'
    throw new Error(`${label}: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    })
  }
  if (result.exceptionDetails) {
    const label = options.label || 'Runtime.evaluate'
    throw new Error(`${label}: ${result.exceptionDetails.text || 'Runtime.evaluate failed'}`)
  }
  return result.result?.value
}

function renderMarkdownReport(report) {
  const lines = [
    `# Full Site QA Report`,
    ``,
    `- Status: **${report.status}**`,
    `- Generated: ${report.generatedAt}`,
    `- Base URL: ${report.baseUrl}`,
    `- Routes: ${report.routes}`,
    `- Browser checks: ${report.checks}`,
    `- No-stale asset check: ${report.noStaleAssetCheck.checkedAssets} assets; spread ${report.noStaleAssetCheck.maxAgeSpreadMinutes} min`,
    `- Critical fallback check: ${report.criticalFallbackCheck.checked ? 'checked' : 'missing'}; failures ${report.criticalFallbackCheck.failures.length}`,
    `- Warnings: ${report.warnings.length}`,
    `- Failures: ${report.failures.length}`,
    `- Desktop screenshot: ${report.screenshots.desktop}`,
    `- Mobile screenshot: ${report.screenshots.mobile}`,
    ``,
    `## Routes`,
    ``,
    `| route | viewport | status | overflow | chinese ratio | title | h1 |`,
    `| --- | --- | ---: | ---: | ---: | --- | --- |`,
    ...report.results.map((item) => `| ${item.route} | ${item.viewport} | ${item.documentStatus || 'n/a'} | ${item.horizontalOverflow}px | ${item.chineseRatio.toFixed(2)} | ${escapeMd(item.title)} | ${escapeMd(item.h1)} |`),
    ``,
    `## Interaction checks`,
    ``,
    '```json',
    JSON.stringify(report.interactionResults, null, 2),
    '```',
    ``,
    `## Asset freshness`,
    ``,
    '```json',
    JSON.stringify(report.noStaleAssetCheck, null, 2),
    '```',
    ``,
    `## Critical fallback`,
    ``,
    '```json',
    JSON.stringify(report.criticalFallbackCheck, null, 2),
    '```',
    ``,
    `## Failures`,
    ``,
    ...(report.failures.length ? report.failures.map((item) => `- ${item}`) : ['- None']),
    ``,
    `## Warnings`,
    ``,
    ...(report.warnings.length ? report.warnings.map((item) => `- ${item}`) : ['- None']),
  ]
  return `${lines.join('\n')}\n`
}

function escapeMd(value) {
  return String(value || '').replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 90)
}

function normalizeUrl(value) {
  return value.replace(/\/index\.html$/, '/')
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms))
}

await main()






