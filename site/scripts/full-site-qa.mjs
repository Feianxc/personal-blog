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
  { name: 'mobile360', width: 360, height: 740, deviceScaleFactor: 2 },
]

const requiredHomePhrases = [
  '个人操作系统',
  '个人数字实验室',
  '构建物',
  '持续运行',
  '工作流',
  '现场',
  '项目实验',
]

const forbiddenPublicCopy = [
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
  'Runtime.evaluate',
  'Emulation.setDeviceMetricsOverride',
  'Emulation.setEmulatedMedia',
  'Page.captureScreenshot',
])

async function main() {
  const staticCheck = runStaticLinkCheck(htmlFiles)
  const assetCheck = runNoStaleAssetCheck()
  const server = await startStaticServer(distRoot)
  baseUrl = `http://127.0.0.1:${server.port}`
  const chrome = await launchChrome()
  cdp = await createPageSession(chrome.port)

  cdp.on('Runtime.exceptionThrown', (event) => {
    runtimeEvents.push({
      type: 'exception',
      text: event.exceptionDetails?.text || event.exceptionDetails?.exception?.description || 'Runtime exception',
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
    interactionResults.push(await auditSignalDashboardTabs())
    interactionResults.push(await auditCommandPaletteKeyboard())
    interactionResults.push(await auditRouteTransitionSmoke())
    interactionResults.push(await auditReducedMotion())
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
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor,
    mobile: viewport.name === 'mobile',
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
    signalDashboard: page.signalDashboard,
    reactor: page.reactor,
    orbitCards: page.orbitCards,
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

async function auditSignalDashboardTabs() {
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

  const before = await evalValue(`(() => ({
    axisCount: document.querySelectorAll('button[data-signal-axis]').length,
    activeAxis: document.querySelector('[data-signal-map]')?.dataset.activeAxis || '',
    selectedCount: document.querySelectorAll('button[data-signal-axis][aria-selected="true"]').length,
    hasDashboard: Boolean(document.querySelector('[data-signal-dashboard]')),
    metrics: Array.from(document.querySelectorAll('.signal-metrics b')).map((item) => item.textContent?.trim()),
  }))()`)
  const states = []

  for (const axis of ['field', 'tool', 'agent']) {
    await evalValue(`(() => document.querySelector('button[data-signal-axis="${axis}"]')?.click())()`)
    await delay(180)
    states.push(await evalValue(`(() => ({
      expected: '${axis}',
      activeAxis: document.querySelector('[data-signal-map]')?.dataset.activeAxis || '',
      selectedCount: document.querySelectorAll('button[data-signal-axis][aria-selected="true"]').length,
      title: document.querySelector('[data-signal-detail-title]')?.textContent?.trim() || '',
      dashboard: document.querySelector('[data-signal-dashboard-title]')?.textContent?.trim() || '',
      metrics: Array.from(document.querySelectorAll('.signal-metrics b')).map((item) => item.textContent?.trim()),
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
    }))()`))
  }

  const failures = []
  if (before.axisCount !== 3) failures.push(`expected 3 signal axes, got ${before.axisCount}`)
  if (!before.hasDashboard) failures.push('signal dashboard panel is missing')
  if (before.selectedCount !== 1) failures.push(`initial selected axis count is ${before.selectedCount}`)

  states.forEach((state) => {
    if (state.activeAxis !== state.expected) failures.push(`axis switch ${state.expected} landed on ${state.activeAxis || 'empty'}`)
    if (state.selectedCount !== 1) failures.push(`axis switch ${state.expected} selected count is ${state.selectedCount}`)
    if (!state.title || !state.dashboard) failures.push(`axis switch ${state.expected} did not update visible title`)
    if (!state.metrics || state.metrics.length < 3) failures.push(`axis switch ${state.expected} metrics are incomplete`)
    if (state.overflow > 2) failures.push(`axis switch ${state.expected} overflow ${state.overflow}px`)
  })

  return {
    name: 'signal dashboard tabs',
    before,
    states,
    failures,
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
    const pixiResourceLoaded = performance.getEntriesByType('resource').some((item) => /signal-canvas-layer|pixi/i.test(item.name))
    const motionReduce = document.documentElement.classList.contains('motion-reduce')
    const rainHidden = !rain || rainStyle.display === 'none' || Number(rainStyle.opacity) === 0
    const heavyCanvasReady = hyperRoot?.dataset.canvasReady === 'true' || hyperRoot?.dataset.canvasLoading === 'true'
    const reactorReduced = reactor?.dataset.reactorReady === 'static' || reactor?.dataset.reactorQuality === 'calm'
    if (!motionReduce) failures.push('html.motion-reduce was not set under reduced motion')
    if (!rainHidden) failures.push('rain canvas remained visible under reduced motion')
    if (heavyCanvasReady) failures.push('hyper canvas loaded under reduced motion')
    if (pixiResourceLoaded) failures.push('Pixi/signal canvas chunk loaded under reduced motion')
    if (!reactorReduced) failures.push('Signal Reactor did not downgrade under reduced motion')
    return {
      motionReduce,
      rainHidden,
      heavyCanvasReady,
      pixiResourceLoaded,
      reactorReduced,
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
    const signalMap = document.querySelector('[data-signal-map]')
    const signalDashboard = document.querySelector('[data-signal-dashboard]')
    const signalDashboardRect = signalDashboard?.getBoundingClientRect()
    const signalAxes = Array.from(document.querySelectorAll('button[data-signal-axis]'))
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
      signalDashboard: {
        axes: signalAxes.length,
        activeAxis: signalMap?.dataset.activeAxis || '',
        selectedTabs: signalAxes.filter((axis) => axis.getAttribute('aria-selected') === 'true').length,
        exists: Boolean(signalDashboard),
        width: Math.round(signalDashboardRect?.width || 0),
        height: Math.round(signalDashboardRect?.height || 0),
        metrics: Array.from(document.querySelectorAll('.signal-metrics b')).map((item) => item.textContent?.trim()),
      },
      reactor: {
        exists: Boolean(reactor),
        ready: reactor?.dataset.reactorReady || '',
        quality: reactor?.dataset.reactorQuality || document.documentElement.dataset.visualQuality || '',
        width: Math.round(reactorRect?.width || 0),
        height: Math.round(reactorRect?.height || 0),
        canvasVisible: Boolean(reactorCanvasRect && reactorCanvasRect.width > 0 && reactorCanvasRect.height > 0),
      },
      orbitCards: Array.from(document.querySelectorAll('[data-orbit-card]')).length,
      forbiddenCopyHits: forbiddenPublicCopy.filter((term) => text.includes(term)),
      navLinks: Array.from(document.querySelectorAll('a[href]')).length,
      navDurationMs: nav?.duration || 0,
      transferKb,
    }
  })()`)
}

function collectFindings(result, failureList, warningList) {
  const label = `${result.route} [${result.viewport}]`
  if (result.documentStatus && result.documentStatus !== 200) {
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
  const errors = result.runtimeEvents.filter((event) => event.type.includes('error') || event.type === 'exception' || event.type === 'navigation')
  if (errors.length > 0) {
    failureList.push(`${label}: runtime errors ${JSON.stringify(errors)}`)
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
    if (result.orbitCards < 4) {
      failureList.push(`${label}: feed orbit cards not wired (${result.orbitCards}/4)`)
    }
    if (result.signalDashboard?.axes !== 3) {
      failureList.push(`${label}: signal axes not wired (${result.signalDashboard?.axes || 0}/3)`)
    }
    if (!result.signalDashboard?.exists) {
      failureList.push(`${label}: signal dashboard is missing`)
    }
    if (result.signalDashboard?.selectedTabs !== 1) {
      failureList.push(`${label}: signal dashboard selected tab count is ${result.signalDashboard?.selectedTabs || 0}`)
    }
    if (result.viewport === 'desktop' && result.signalDashboard?.height < 220) {
      failureList.push(`${label}: signal dashboard is too small (${result.signalDashboard.height}px)`)
    }
  }
}

function collectInteractionFindings(result, failureList, warningList) {
  result.failures?.forEach((item) => failureList.push(`${result.name}: ${item}`))
  result.warnings?.forEach((item) => warningList.push(`${result.name}: ${item}`))
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
  if (result.runtimeEvents?.length) {
    warningList.push(`${result.name}: runtime events ${JSON.stringify(result.runtimeEvents)}`)
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

async function evalValue(expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Runtime.evaluate failed')
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






