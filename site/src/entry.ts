import {
  setGlobalReducedMotionPreference,
  setupCodeConsoleInteractions,
  setupGlobalEffects,
} from './global-effects'

const entryPage = document.body

if (entryPage.classList.contains('entry-page')) {
  const destroyProjectCaseMotion = setupProjectCaseMotion()
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  let prefersReducedMotion = reducedMotionQuery.matches
  document.documentElement.classList.toggle('motion-reduce', prefersReducedMotion)
  reducedMotionQuery.addEventListener('change', (event) => {
    prefersReducedMotion = event.matches
    document.documentElement.classList.toggle('motion-reduce', event.matches)
    setGlobalReducedMotionPreference(event.matches)
  })
  window.addEventListener('beforeunload', destroyProjectCaseMotion, { once: true })
  const activeRevealTargets = new WeakSet<HTMLElement>()
  const revealPulseTimers = new WeakMap<HTMLElement, number>()
  const entryStrikeTimers = new WeakMap<HTMLElement, number>()
  const topbar = document.querySelector<HTMLElement>('.entry-topbar')
  const header = document.querySelector<HTMLElement>('.entry-header')
  const main = document.querySelector<HTMLElement>('.entry-main')
  const sections = Array.from(
    document.querySelectorAll<HTMLElement>('.entry-main .entry-section'),
  )

  setupGlobalEffects({
    context: 'entry',
    reducedMotion: prefersReducedMotion,
  })

  if (header && main && sections.length > 0) {
    document.documentElement.classList.add('js-entry')
    entryPage.classList.add('entry-page--enhanced')
    setupCodeConsoleInteractions()

    const sectionMeta = sections.map((section, index) => {
      if (!section.id) {
        section.id = `entry-section-${index + 1}`
      }

      const heading = section.querySelector<HTMLHeadingElement>('h2')
      const title = heading?.textContent?.trim() ?? `section ${index + 1}`

      return {
        section,
        id: section.id,
        title,
        label: pickShortLabel(title, index),
        number: index + 1,
      }
    })

    const readingBar = buildReadingBar(sectionMeta)
    const currentLabel = readingBar.querySelector<HTMLElement>(
      '[data-reading-current]',
    )
    const currentCount = readingBar.querySelector<HTMLElement>(
      '[data-reading-count]',
    )
    const progressValue = readingBar.querySelector<HTMLElement>(
      '[data-reading-progress]',
    )
    const progressMeter = readingBar.querySelector<HTMLElement>(
      '[data-reading-progress-meter]',
    )
    const navLinks = Array.from(
      readingBar.querySelectorAll<HTMLAnchorElement>('[data-reading-link]'),
    )

    header.insertAdjacentElement('afterend', readingBar)

    const sectionById = new Map(
      sectionMeta.map((meta) => [meta.id, meta.section] as const),
    )

    const revealTargets = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.entry-filebar, .entry-filecard, .entry-quicklook-card, .proof-card, .proof-note, .proof-table, .proof-pre, .timeline-item, .about-card, .about-link, .lab-card, .lab-link, .archive-lineup-card',
      ),
    )

    revealTargets.forEach((element, index) => {
      element.style.setProperty('--entry-reveal-delay', `${(index % 6) * 42}ms`)
    })

    const queueEntryObserverStart = (callback: () => void) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(callback)
      })
    }

    if (prefersReducedMotion) {
      revealTargets.forEach((element) => element.classList.add('is-live'))
    } else {
      const revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const element = entry.target as HTMLElement
            const isLive = entry.isIntersecting && entry.intersectionRatio >= 0.16

            if (isLive) {
              if (activeRevealTargets.has(element)) return

              activeRevealTargets.add(element)
              element.classList.add('is-live')
              pulseTransientState(element, 'is-revealing', 760, revealPulseTimers)
              return
            }

            if (!activeRevealTargets.has(element)) return

            activeRevealTargets.delete(element)
            clearTransientState(element, 'is-revealing', revealPulseTimers)
          })
        },
        {
          rootMargin: '0px 0px -10% 0px',
          threshold: [0, 0.16, 0.32],
        },
      )

      queueEntryObserverStart(() => {
        revealTargets.forEach((element) => revealObserver.observe(element))
      })
    }

    const entryInteractiveTargets = Array.from(
      new Set<HTMLElement>([
        ...revealTargets,
        ...navLinks,
        ...Array.from(
          document.querySelectorAll<HTMLElement>(
            '.entry-nav a, .entry-topbar a, .entry-footer a, .entry-anchor-nav a, .entry-relation-card',
          ),
        ),
      ]),
    )

    entryInteractiveTargets.forEach((element) => {
      const wakeTarget = (event?: FocusEvent | PointerEvent) => {
        const pointerEvent = event instanceof PointerEvent ? event : undefined
        const rect = rememberEntryTargetRect(element)
        writeEntryPointerPosition(element, pointerEvent, rect)
        element.classList.add('is-hot')

        if (!prefersReducedMotion) {
          pulseTransientState(element, 'is-revealing', 560, revealPulseTimers)
        }
      }

      const moveTarget = (event: PointerEvent) => {
        queueEntryPointerPosition(element, event)
      }

      const clearTarget = () => {
        element.classList.remove('is-hot')
        clearEntryTargetRect(element)
        clearEntryPointerPosition(element)
      }

      const strikeTarget = (event: PointerEvent) => {
        if (event.button !== 0 || prefersReducedMotion) return

        const rect = rememberEntryTargetRect(element)
        writeEntryPointerPosition(element, event, rect)
        pulseTransientState(element, 'is-struck', 640, entryStrikeTimers)
      }

      element.addEventListener('pointerenter', wakeTarget)
      element.addEventListener('pointermove', moveTarget)
      element.addEventListener('focus', wakeTarget)
      element.addEventListener('pointerleave', clearTarget)
      element.addEventListener('pointercancel', clearTarget)
      element.addEventListener('blur', clearTarget)
      element.addEventListener('pointerdown', strikeTarget)
    })

    let activeSectionId = ''
    let activeSectionIndex = -1
    const sectionRatios = new Map<string, number>()
    const sectionDistances = new Map<string, number>()
    let cachedScrollY = window.scrollY
    let cachedViewportHeight = window.innerHeight
    let cachedViewportAnchor = cachedViewportHeight * 0.28

    const refreshEntryViewportMetrics = () => {
      cachedScrollY = window.scrollY
      cachedViewportHeight = window.innerHeight
      cachedViewportAnchor = cachedViewportHeight * 0.28
    }

    const setActiveSection = (id: string) => {
      if (!id || activeSectionId === id) return

      const activeIndex = sectionMeta.findIndex((item) => item.id === id)
      const activeMeta = sectionMeta[activeIndex]

      if (!activeMeta) return

      const previousIndex = activeSectionIndex
      activeSectionId = id
      activeSectionIndex = activeIndex

      if (entryPage.dataset.currentSection !== id) {
        entryPage.dataset.currentSection = id
      }

      setText(currentLabel, activeMeta.label)
      setText(
        currentCount,
        `${pad(activeMeta.number)} / ${pad(sectionMeta.length)}`,
      )

      const firstAffectedIndex =
        previousIndex < 0 ? 0 : Math.min(previousIndex, activeIndex)
      const lastAffectedIndex =
        previousIndex < 0 ? activeIndex : Math.max(previousIndex, activeIndex)

      for (let index = firstAffectedIndex; index <= lastAffectedIndex; index += 1) {
        const link = navLinks[index]
        const meta = sectionMeta[index]

        if (!link || !meta) continue

        const isActive = link.dataset.readingLink === id
        const isPast = index < activeIndex

        link.classList.toggle('is-active', isActive)
        link.classList.toggle('is-past', isPast)

        if (isActive) {
          link.setAttribute('aria-current', 'location')
        } else {
          link.removeAttribute('aria-current')
        }

        const sectionIsActive = meta.id === id
        const sectionIsPast = index < activeIndex

        meta.section.classList.toggle('is-current', sectionIsActive)
        meta.section.classList.toggle('is-past', sectionIsPast)
        meta.section.dataset.readState = sectionIsActive
          ? 'current'
          : sectionIsPast
            ? 'past'
            : 'upcoming'
      }
    }

    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = (entry.target as HTMLElement).id
          sectionRatios.set(id, entry.isIntersecting ? entry.intersectionRatio : 0)
          sectionDistances.set(
            id,
            Math.abs(entry.boundingClientRect.top - cachedViewportAnchor),
          )
        })

        const visible = sectionMeta
          .map((meta) => ({
            ...meta,
            ratio: sectionRatios.get(meta.id) ?? 0,
            distance: sectionDistances.get(meta.id) ?? Number.POSITIVE_INFINITY,
          }))
          .filter((meta) => meta.ratio > 0)
          .sort((a, b) => {
            if (b.ratio !== a.ratio) {
              return b.ratio - a.ratio
            }

            return a.distance - b.distance
          })

        if (visible[0]) {
          setActiveSection(visible[0].id)
        }
      },
      {
        rootMargin: '-16% 0px -52% 0px',
        threshold: [0.12, 0.24, 0.38, 0.52, 0.7],
      },
    )

    queueEntryObserverStart(() => {
      sectionMeta.forEach((meta) => sectionObserver.observe(meta.section))
    })

    let topbarHeightRaf = 0
    let lastTopbarHeight = -1
    let topbarResizeObserver: ResizeObserver | null = null
    let mainResizeObserver: ResizeObserver | null = null

    const getResizeBlockSize = (
      entry: ResizeObserverEntry | undefined,
      fallback: number,
    ) => {
      const borderBox = Array.isArray(entry?.borderBoxSize)
        ? entry?.borderBoxSize[0]
        : entry?.borderBoxSize

      return borderBox?.blockSize ?? entry?.contentRect.height ?? fallback
    }

    const applyTopbarHeight = (height: number) => {
      const nextHeight = Math.round(height || 72)
      if (nextHeight === lastTopbarHeight) return

      lastTopbarHeight = nextHeight
      setRootCssProperty('--entry-topbar-height', `${nextHeight}px`)
    }

    const measureTopbarHeight = () => {
      topbarHeightRaf = 0
      applyTopbarHeight(topbar?.getBoundingClientRect().height ?? 72)
    }

    const queueTopbarHeight = () => {
      if (topbarHeightRaf) return

      topbarHeightRaf = window.requestAnimationFrame(measureTopbarHeight)
    }

    let progressRaf = 0
    let progressMetricsRaf = 0
    let progressStart = 0
    let progressEnd = 1
    let mainBlockSize = cachedViewportHeight * Math.max(1, sections.length * 0.82)
    let lastProgressValue = ''
    let lastProgressPercent = -1

    const applyProgressBounds = (blockSize = mainBlockSize) => {
      mainBlockSize = Math.max(blockSize, cachedViewportHeight)
      progressStart = 0
      progressEnd = Math.max(1, mainBlockSize - cachedViewportHeight * 0.62)
      queueProgress()
    }

    const measureProgressBounds = () => {
      progressMetricsRaf = 0

      const mainRect = main.getBoundingClientRect()

      progressStart = cachedScrollY + mainRect.top - cachedViewportHeight * 0.16
      progressEnd = cachedScrollY + mainRect.bottom - cachedViewportHeight * 0.78
      queueProgress()
    }

    const queueProgressBounds = () => {
      if (progressMetricsRaf) return

      progressMetricsRaf = window.requestAnimationFrame(measureProgressBounds)
    }

    const updateProgress = () => {
      progressRaf = 0

      const progress =
        progressEnd > progressStart
          ? clamp((cachedScrollY - progressStart) / (progressEnd - progressStart), 0, 1)
          : 0
      const progressPercent = Math.round(progress * 100)
      const progressValueText = `${progressPercent}%`
      const progressStyleValue = progress.toFixed(4)

      if (progressStyleValue !== lastProgressValue) {
        setRootCssProperty('--entry-read-progress', progressStyleValue)
        lastProgressValue = progressStyleValue
      }

      if (progressPercent !== lastProgressPercent) {
        progressMeter?.setAttribute('aria-valuenow', String(progressPercent))
        progressMeter?.setAttribute('aria-valuetext', progressValueText)
        setText(progressValue, progressValueText)
        lastProgressPercent = progressPercent
      }

    }

    const queueProgress = () => {
      if (progressRaf) return

      progressRaf = window.requestAnimationFrame(updateProgress)
    }

    navLinks.forEach((link) => {
      link.addEventListener('mouseenter', () => {
        const targetId = link.dataset.readingLink
        const targetSection = targetId ? sectionById.get(targetId) : null

        targetSection?.classList.add('is-targeted')
      })

      link.addEventListener('mouseleave', () => {
        const targetId = link.dataset.readingLink
        const targetSection = targetId ? sectionById.get(targetId) : null

        targetSection?.classList.remove('is-targeted')
      })

      link.addEventListener('focus', () => {
        const targetId = link.dataset.readingLink
        const targetSection = targetId ? sectionById.get(targetId) : null

        targetSection?.classList.add('is-targeted')
      })

      link.addEventListener('blur', () => {
        const targetId = link.dataset.readingLink
        const targetSection = targetId ? sectionById.get(targetId) : null

        targetSection?.classList.remove('is-targeted')
      })
    })

    if (topbar && 'ResizeObserver' in window) {
      topbarResizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0]
        applyTopbarHeight(getResizeBlockSize(entry, 72))
      })
      topbarResizeObserver.observe(topbar)
    } else {
      queueTopbarHeight()
    }

    if ('ResizeObserver' in window) {
      mainResizeObserver = new ResizeObserver((entries) => {
        applyProgressBounds(getResizeBlockSize(entries[0], mainBlockSize))
      })
      mainResizeObserver.observe(main)
      applyProgressBounds()
    } else {
      queueProgressBounds()
    }

    if ('fonts' in document) {
      void document.fonts.ready.then(() => {
        refreshEntryViewportMetrics()
        if (mainResizeObserver) {
          applyProgressBounds()
        } else {
          queueProgressBounds()
        }
      })
    }

    window.addEventListener('resize', () => {
      refreshEntryViewportMetrics()
      clearEntryTargetRects()

      if (!topbarResizeObserver) {
        queueTopbarHeight()
      }

      if (mainResizeObserver) {
        applyProgressBounds()
      } else {
        queueProgressBounds()
      }
    })
    window.addEventListener(
      'scroll',
      () => {
        cachedScrollY = window.scrollY
        queueProgress()
      },
      { passive: true },
    )
    window.addEventListener('beforeunload', () => {
      if (progressRaf) {
        window.cancelAnimationFrame(progressRaf)
      }

      if (progressMetricsRaf) {
        window.cancelAnimationFrame(progressMetricsRaf)
      }

      if (topbarHeightRaf) {
        window.cancelAnimationFrame(topbarHeightRaf)
      }

      if (entryPointerRaf) {
        window.cancelAnimationFrame(entryPointerRaf)
      }

      topbarResizeObserver?.disconnect()
      mainResizeObserver?.disconnect()
    })
  }
}

function setupProjectCaseMotion() {
  const instruments = Array.from(
    document.querySelectorAll<HTMLElement>(
      '.project-case-instrument, .story-visual',
    ),
  )

  if (instruments.length === 0) {
    return () => {}
  }

  const visibility = new WeakMap<HTMLElement, boolean>()
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  let observer: IntersectionObserver | null = null

  const isInsideViewport = (instrument: HTMLElement) => {
    const rect = instrument.getBoundingClientRect()
    return rect.bottom > 0 && rect.top < window.innerHeight
  }

  const syncInstrument = (instrument: HTMLElement, visible: boolean) => {
    const pageHidden = document.hidden
    const motionActive = visible && !pageHidden && !motionQuery.matches
    instrument.classList.toggle('is-page-hidden', pageHidden)
    instrument.classList.toggle('is-in-view', visible && !pageHidden)
    instrument.querySelectorAll<SVGSVGElement>('svg').forEach((svg) => {
      if (motionActive) svg.unpauseAnimations?.()
      else svg.pauseAnimations?.()
    })
  }

  const measureInstruments = () => {
    instruments.forEach((instrument) => {
      const visible = isInsideViewport(instrument)
      visibility.set(instrument, visible)
      syncInstrument(instrument, visible)
    })
  }

  const handlePageVisibility = () => {
    if (document.hidden) {
      instruments.forEach((instrument) => syncInstrument(instrument, false))
      return
    }

    measureInstruments()
  }

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const instrument = entry.target as HTMLElement
        const visible = entry.isIntersecting && entry.intersectionRatio > 0
        visibility.set(instrument, visible)
        syncInstrument(instrument, visible)
      })
    },
    { threshold: [0, 0.01, 0.16] },
  )

  instruments.forEach((instrument) => observer?.observe(instrument))

  measureInstruments()
  /* IntersectionObserver is the primary gate; the one-instrument scroll
     fallback also covers large scripted jumps and throttled background tabs. */
  window.addEventListener('scroll', measureInstruments, { passive: true })
  window.addEventListener('resize', measureInstruments)
  document.addEventListener('visibilitychange', handlePageVisibility)
  motionQuery.addEventListener('change', measureInstruments)

  return () => {
    observer?.disconnect()
    document.removeEventListener('visibilitychange', handlePageVisibility)
    motionQuery.removeEventListener('change', measureInstruments)
    window.removeEventListener('scroll', measureInstruments)
    window.removeEventListener('resize', measureInstruments)
    instruments.forEach((instrument) => {
      instrument.classList.remove('is-in-view', 'is-page-hidden')
      visibility.delete(instrument)
    })
  }
}

let entryTargetRects = new WeakMap<HTMLElement, DOMRectReadOnly>()
let entryPointerRaf = 0
let queuedEntryPointerElement: HTMLElement | null = null
let queuedEntryPointerEvent: PointerEvent | null = null

type SectionMeta = {
  id: string
  label: string
  number: number
  section: HTMLElement
  title: string
}

function buildReadingBar(sectionMeta: SectionMeta[]) {
  const readingBar = document.createElement('aside')
  readingBar.className = 'entry-readingbar'
  readingBar.setAttribute('aria-label', '阅读状态')

  const meta = document.createElement('div')
  meta.className = 'entry-readingbar-meta'

  const metaLabel = document.createElement('span')
  metaLabel.className = 'entry-readingbar-label'
  metaLabel.textContent = 'reading state'

  const metaCurrent = document.createElement('strong')
  metaCurrent.className = 'entry-readingbar-current'
  metaCurrent.dataset.readingCurrent = 'true'
  metaCurrent.textContent = sectionMeta[0]?.label ?? '总览'

  const metaCount = document.createElement('span')
  metaCount.className = 'entry-readingbar-count'
  metaCount.dataset.readingCount = 'true'
  metaCount.textContent = `${pad(1)} / ${pad(sectionMeta.length)}`

  const progress = document.createElement('div')
  progress.className = 'entry-readingbar-progress'
  progress.dataset.readingProgressMeter = 'true'
  progress.setAttribute('role', 'progressbar')
  progress.setAttribute('aria-label', '正文阅读进度')
  progress.setAttribute('aria-valuemin', '0')
  progress.setAttribute('aria-valuemax', '100')
  progress.setAttribute('aria-valuenow', '0')
  progress.setAttribute('aria-valuetext', '0%')

  const progressTrack = document.createElement('span')
  progressTrack.className = 'entry-readingbar-progress-track'
  progressTrack.setAttribute('aria-hidden', 'true')

  const progressFill = document.createElement('span')
  progressFill.className = 'entry-readingbar-progress-fill'

  const progressValue = document.createElement('span')
  progressValue.className = 'entry-readingbar-progress-value'
  progressValue.dataset.readingProgress = 'true'
  progressValue.textContent = '0%'

  progressTrack.append(progressFill)
  progress.append(progressTrack, progressValue)
  meta.append(metaLabel, metaCurrent, metaCount, progress)

  const nav = document.createElement('nav')
  nav.className = 'entry-readingnav'
  nav.setAttribute('aria-label', '正文索引')

  const list = document.createElement('ol')

  sectionMeta.forEach((metaItem) => {
    const item = document.createElement('li')
    const link = document.createElement('a')
    const index = document.createElement('span')
    const label = document.createElement('strong')

    link.className = 'entry-readinglink'
    link.href = `#${metaItem.id}`
    link.dataset.readingLink = metaItem.id

    index.className = 'entry-readinglink-index'
    index.textContent = pad(metaItem.number)

    label.className = 'entry-readinglink-label'
    label.textContent = metaItem.label

    link.append(index, label)
    item.append(link)
    list.append(item)
  })

  nav.append(list)
  readingBar.append(meta, nav)

  return readingBar
}

function pickShortLabel(title: string, index: number) {
  const directMap: Array<[string, string]> = [
    ['run ledger', '总览'],
    ['incident header', '总览'],
    ['chain', '链路'],
    ['source slices', '回执'],
    ['decision delta', '判断'],
    ['next run', '下轮'],
    ['对象与约束', '对象'],
    ['现场物证', '物证'],
    ['假设排除树', '排除树'],
    ['交接和残留风险', '交接'],
  ]

  const mapped = directMap.find(([needle]) => title.includes(needle))

  if (mapped) {
    return mapped[1]
  }

  if (index === 0) {
    return '总览'
  }

  const afterSlash = title.includes('/')
    ? title.split('/').slice(-1)[0]?.trim() ?? title
    : title
  const beforePunctuation = afterSlash
    .split(/[：:，。,.、]/)[0]
    ?.trim() ?? afterSlash
  const chineseOnly = beforePunctuation.replace(/[^\u4e00-\u9fa5]/g, '')

  if (chineseOnly.length >= 2) {
    return chineseOnly.slice(0, Math.min(4, chineseOnly.length))
  }

  const compact = beforePunctuation.replace(/\s+/g, ' ').trim()
  return compact.slice(0, 10)
}

function pad(value: number) {
  return String(value).padStart(2, '0')
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

function rememberEntryTargetRect(element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  entryTargetRects.set(element, rect)

  return rect
}

function getEntryTargetRect(element: HTMLElement) {
  return entryTargetRects.get(element) ?? rememberEntryTargetRect(element)
}

function clearEntryTargetRect(element: HTMLElement) {
  entryTargetRects.delete(element)
}

function clearEntryTargetRects() {
  entryTargetRects = new WeakMap<HTMLElement, DOMRectReadOnly>()
}

function queueEntryPointerPosition(element: HTMLElement, event: PointerEvent) {
  queuedEntryPointerElement = element
  queuedEntryPointerEvent = event

  if (entryPointerRaf) return

  entryPointerRaf = window.requestAnimationFrame(() => {
    entryPointerRaf = 0

    if (!queuedEntryPointerElement || !queuedEntryPointerEvent) return

    writeEntryPointerPosition(
      queuedEntryPointerElement,
      queuedEntryPointerEvent,
      getEntryTargetRect(queuedEntryPointerElement),
    )
    queuedEntryPointerElement = null
    queuedEntryPointerEvent = null
  })
}

function writeEntryPointerPosition(
  element: HTMLElement,
  event?: PointerEvent,
  rect = getEntryTargetRect(element),
) {
  const x = event ? event.clientX - rect.left : rect.width * 0.5
  const y = event ? event.clientY - rect.top : rect.height * 0.5

  element.style.setProperty('--entry-pointer-x', `${clamp(x, 0, rect.width)}px`)
  element.style.setProperty('--entry-pointer-y', `${clamp(y, 0, rect.height)}px`)
}

function clearEntryPointerPosition(element: HTMLElement) {
  element.style.removeProperty('--entry-pointer-x')
  element.style.removeProperty('--entry-pointer-y')
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function setRootCssProperty(name: string, value: string) {
  if (document.documentElement.style.getPropertyValue(name) === value) return

  document.documentElement.style.setProperty(name, value)
}

function setText(element: HTMLElement | null | undefined, value: string) {
  if (!element || element.textContent === value) return

  element.replaceChildren(document.createTextNode(value))
}
