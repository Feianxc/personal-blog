import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

type ProjectGalleryOptions = {
  reducedMotion: boolean
}

export function setupProjectGallery(options: ProjectGalleryOptions) {
  const root = document.querySelector<HTMLElement>('[data-project-gallery]')
  const cards = Array.from(
    root?.querySelectorAll<HTMLElement>('[data-project-card]') ?? [],
  )

  if (!root || cards.length === 0) {
    return { destroy() {} }
  }

  gsap.registerPlugin(ScrollTrigger)

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  const finePointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)')
  let reducedMotion = motionQuery.matches || options.reducedMotion
  let pageHidden = document.hidden
  let cardTriggers: ScrollTrigger[] = []
  let pausedCardTweens: gsap.core.Tween[] = []
  let refreshFrame = 0
  let visibilityFrame = 0
  let visibilityTimer = 0
  const cleanups: Array<() => void> = []
  const visuals = cards
    .map((card) =>
      card.querySelector<HTMLElement>('.project-visual, .project-shelf-visual'),
    )
    .filter((visual): visual is HTMLElement => Boolean(visual))

  const setCardMotionState = (card: HTMLElement, active: boolean) => {
    card.classList.toggle('is-in-view', active && !pageHidden)
  }

  const activateVisibleCards = () => {
    const viewportHeight = window.innerHeight

    cards.forEach((card) => {
      const rect = card.getBoundingClientRect()
      const visible = rect.bottom > viewportHeight * 0.08 && rect.top < viewportHeight * 0.92
      setCardMotionState(card, visible)
    })
  }

  const flushVisibleCardSync = () => {
    visibilityFrame = 0
    if (visibilityTimer) {
      window.clearTimeout(visibilityTimer)
      visibilityTimer = 0
    }
    if (reducedMotion || pageHidden) return
    activateVisibleCards()
  }

  const queueVisibleCardSync = () => {
    if (reducedMotion || pageHidden || visibilityFrame || visibilityTimer) return

    visibilityFrame = window.requestAnimationFrame(flushVisibleCardSync)
    /* Background/headless tabs can defer rAF. The bounded watchdog keeps the
       CSS animation lifecycle correct after large scroll jumps without
       turning normal scrolling into synchronous layout work. */
    visibilityTimer = window.setTimeout(() => {
      if (visibilityFrame) window.cancelAnimationFrame(visibilityFrame)
      flushVisibleCardSync()
    }, 96)
  }

  const clearPointerDepth = () => {
    gsap.killTweensOf(visuals)
    gsap.set(visuals, { clearProps: 'transform' })
  }

  const setupPointerDepth = (card: HTMLElement) => {
    const visual = card.querySelector<HTMLElement>('.project-visual, .project-shelf-visual')
    if (!visual) return

    const rotateXTo = gsap.quickTo(visual, 'rotationX', {
      duration: 0.62,
      ease: 'power3.out',
    })
    const rotateYTo = gsap.quickTo(visual, 'rotationY', {
      duration: 0.62,
      ease: 'power3.out',
    })
    const xTo = gsap.quickTo(visual, 'x', {
      duration: 0.72,
      ease: 'power3.out',
    })
    const yTo = gsap.quickTo(visual, 'y', {
      duration: 0.72,
      ease: 'power3.out',
    })

    const move = (event: PointerEvent) => {
      if (reducedMotion || !finePointerQuery.matches || event.pointerType === 'touch') return

      const rect = card.getBoundingClientRect()
      const x = (event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5
      const y = (event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5

      rotateXTo(y * -2.8)
      rotateYTo(x * 3.4)
      xTo(x * 5)
      yTo(y * 4)
    }

    const reset = () => {
      rotateXTo(0)
      rotateYTo(0)
      xTo(0)
      yTo(0)
    }

    card.addEventListener('pointermove', move, { passive: true })
    card.addEventListener('pointerleave', reset)
    card.addEventListener('pointercancel', reset)
    card.addEventListener('blur', reset, true)

    cleanups.push(() => {
      card.removeEventListener('pointermove', move)
      card.removeEventListener('pointerleave', reset)
      card.removeEventListener('pointercancel', reset)
      card.removeEventListener('blur', reset, true)
    })
  }

  const stopCardMotion = () => {
    if (refreshFrame) {
      window.cancelAnimationFrame(refreshFrame)
      refreshFrame = 0
    }
    if (visibilityFrame) {
      window.cancelAnimationFrame(visibilityFrame)
      visibilityFrame = 0
    }
    if (visibilityTimer) {
      window.clearTimeout(visibilityTimer)
      visibilityTimer = 0
    }

    cardTriggers.forEach((trigger) => trigger.kill())
    cardTriggers = []
    pausedCardTweens = []
    gsap.killTweensOf(cards)
    gsap.set(cards, { clearProps: 'opacity,transform,visibility' })
  }

  const pauseCardMotion = () => {
    cardTriggers.forEach((trigger) => trigger.disable(false, true))
    pausedCardTweens = gsap
      .getTweensOf(cards)
      .filter((tween) => !tween.paused())
    pausedCardTweens.forEach((tween) => tween.pause())
  }

  const resumeCardMotion = () => {
    cardTriggers.forEach((trigger) => trigger.enable(false, false))
    pausedCardTweens.forEach((tween) => tween.resume())
    pausedCardTweens = []
    activateVisibleCards()
  }

  const startCardMotion = () => {
    stopCardMotion()
    cards.forEach((card) => card.classList.remove('is-in-view'))
    gsap.set(cards, { autoAlpha: 0.58, y: 42, rotationX: 1.8 })

    cardTriggers = ScrollTrigger.batch(cards, {
      start: 'top 88%',
      end: 'bottom 8%',
      interval: 0.08,
      batchMax: 2,
      onEnter: (batch) => {
        gsap.to(batch, {
          autoAlpha: 1,
          y: 0,
          rotationX: 0,
          duration: 0.9,
          stagger: 0.09,
          ease: 'power4.out',
          overwrite: true,
        })
      },
      onEnterBack: (batch) => {
        gsap.to(batch, {
          autoAlpha: 1,
          y: 0,
          rotationX: 0,
          duration: 0.36,
          ease: 'power3.out',
          overwrite: true,
        })
      },
    })

    refreshFrame = window.requestAnimationFrame(() => {
      refreshFrame = 0
      ScrollTrigger.refresh()
      activateVisibleCards()
    })
  }

  cards.forEach(setupPointerDepth)
  window.addEventListener('scroll', queueVisibleCardSync, { passive: true })
  window.addEventListener('resize', queueVisibleCardSync, { passive: true })
  cleanups.push(() => {
    window.removeEventListener('scroll', queueVisibleCardSync)
    window.removeEventListener('resize', queueVisibleCardSync)
    if (visibilityFrame) {
      window.cancelAnimationFrame(visibilityFrame)
      visibilityFrame = 0
    }
    if (visibilityTimer) {
      window.clearTimeout(visibilityTimer)
      visibilityTimer = 0
    }
  })

  const handleVisibility = () => {
    pageHidden = document.hidden
    root.classList.toggle('is-page-hidden', pageHidden)

    if (pageHidden) {
      pauseCardMotion()
      clearPointerDepth()
      return
    }

    if (reducedMotion) {
      cards.forEach((card) => card.classList.add('is-in-view'))
      return
    }

    if (cardTriggers.length === 0) {
      startCardMotion()
      return
    }

    resumeCardMotion()
  }

  const applyMotionPreference = (nextReducedMotion: boolean) => {
    reducedMotion = nextReducedMotion
    root.classList.toggle('is-motion-reduced', reducedMotion)
    stopCardMotion()
    clearPointerDepth()

    if (reducedMotion) {
      cards.forEach((card) => {
        card.classList.toggle('is-in-view', !pageHidden)
      })
      return
    }

    if (!pageHidden) {
      startCardMotion()
    }
  }

  const handleMotionPreference = (event: MediaQueryListEvent) => {
    applyMotionPreference(event.matches)
  }

  document.addEventListener('visibilitychange', handleVisibility)
  motionQuery.addEventListener('change', handleMotionPreference)
  // The live query is authoritative; the option is only the caller's startup
  // snapshot and may already be stale when this module finishes wiring up.
  applyMotionPreference(motionQuery.matches)

  return {
    destroy() {
      stopCardMotion()
      clearPointerDepth()
      cleanups.forEach((cleanup) => cleanup())
      document.removeEventListener('visibilitychange', handleVisibility)
      motionQuery.removeEventListener('change', handleMotionPreference)
      root.classList.remove('is-page-hidden', 'is-motion-reduced')
      cards.forEach((card) => card.classList.remove('is-in-view'))
    },
  }
}
