import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

type ImpactOptions = {
  reducedMotion: boolean
}

export function setupImpactChoreography(options: ImpactOptions) {
  const root = document.documentElement
  const cover = document.querySelector<HTMLElement>('.cover')
  const stage = document.querySelector<HTMLElement>('.cover-object-sheet')
  const introLayer = document.querySelector<HTMLElement>('.impact-reactor-intro')
  const scrollLayer = document.querySelector<HTMLElement>('.impact-reactor-scroll')

  root.classList.add('impact-edition')

  const quickActions = document.querySelector<HTMLElement>('.signal-quick-actions')
  const compactControls = window.matchMedia('(max-width: 820px)')
  const orientation = document.querySelector<HTMLElement>('.cover-orientation')

  const placeQuickActions = () => {
    if (quickActions && compactControls.matches && orientation) {
      orientation.insertAdjacentElement('afterend', quickActions)
    } else if (quickActions && stage && quickActions.parentElement !== stage) {
      stage.append(quickActions)
    }
  }

  placeQuickActions()
  compactControls.addEventListener('change', placeQuickActions)

  if (!cover || !stage || !introLayer || !scrollLayer) {
    return {
      destroy: () => {
        compactControls.removeEventListener('change', placeQuickActions)
        root.classList.remove('impact-edition')
      },
    }
  }

  let pointerFrame = 0
  let pointerX = 0
  let pointerY = 0
  let targetPointerX = 0
  let targetPointerY = 0

  const renderPointerDepth = () => {
    pointerX += (targetPointerX - pointerX) * 0.085
    pointerY += (targetPointerY - pointerY) * 0.085
    cover.style.setProperty('--impact-pointer-x', pointerX.toFixed(4))
    cover.style.setProperty('--impact-pointer-y', pointerY.toFixed(4))

    if (Math.abs(targetPointerX - pointerX) > 0.002 || Math.abs(targetPointerY - pointerY) > 0.002) {
      pointerFrame = window.requestAnimationFrame(renderPointerDepth)
    } else {
      pointerFrame = 0
    }
  }

  const queuePointerDepth = (event: PointerEvent) => {
    if (options.reducedMotion || event.pointerType === 'touch') return

    const rect = cover.getBoundingClientRect()
    targetPointerX = ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2
    targetPointerY = ((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2

    if (!pointerFrame) {
      pointerFrame = window.requestAnimationFrame(renderPointerDepth)
    }
  }

  const resetPointerDepth = () => {
    targetPointerX = 0
    targetPointerY = 0
    if (!pointerFrame) pointerFrame = window.requestAnimationFrame(renderPointerDepth)
  }

  cover.addEventListener('pointermove', queuePointerDepth, { passive: true })
  cover.addEventListener('pointerleave', resetPointerDepth)

  if (options.reducedMotion) {
    root.classList.add('impact-static')
    cover.style.setProperty('--impact-scroll', '0')
    cover.style.setProperty('--impact-beam', '1')

    return {
      destroy() {
        cover.removeEventListener('pointermove', queuePointerDepth)
        cover.removeEventListener('pointerleave', resetPointerDepth)
        if (pointerFrame) window.cancelAnimationFrame(pointerFrame)
        compactControls.removeEventListener('change', placeQuickActions)
        root.classList.remove('impact-edition', 'impact-static')
      },
    }
  }

  gsap.registerPlugin(ScrollTrigger)
  const media = gsap.matchMedia()

  media.add(
    {
      desktop: '(min-width: 821px)',
      compact: '(max-width: 820px)',
      motionOK: '(prefers-reduced-motion: no-preference)',
    },
    (context) => {
      const { desktop, motionOK } = context.conditions as {
        desktop: boolean
        compact: boolean
        motionOK: boolean
      }

      if (!motionOK) return undefined

      const titleLines = gsap.utils.toArray<HTMLElement>('.cover-title > span')
      const introItems = gsap.utils.toArray<HTMLElement>(
        '.cover-kicker, .cover-subline, .cover-lede, .cover-actions, .cover-orientation, .cover-diagnostics',
      )

      const intro = gsap.timeline({ defaults: { ease: 'power4.out' } })
      intro
        .fromTo(
          '.cover-kicker',
          { autoAlpha: 0, x: -24 },
          { autoAlpha: 1, x: 0, duration: 0.72 },
          0.08,
        )
        .fromTo(
          titleLines,
          {
            autoAlpha: 0,
            y: desktop ? 38 : 24,
            rotateZ: desktop ? 1.2 : 0.4,
            clipPath: 'inset(0 0 100% 0)',
          },
          {
            autoAlpha: 1,
            y: 0,
            rotateZ: 0,
            clipPath: 'inset(0 0 0% 0)',
            duration: desktop ? 1.08 : 0.82,
            stagger: 0.065,
          },
          0.12,
        )
        .fromTo(
          introLayer,
          {
            autoAlpha: 0,
            scale: desktop ? 0.96 : 0.98,
            rotationY: desktop ? -4 : 0,
            filter: 'blur(4px)',
          },
          {
            autoAlpha: 1,
            scale: 1,
            rotationY: 0,
            filter: 'blur(0px)',
            duration: desktop ? 0.95 : 0.78,
            ease: 'power3.out',
          },
          0.16,
        )
        .fromTo(
          cover,
          { '--impact-beam': 0 },
          { '--impact-beam': 1, duration: desktop ? 1.18 : 0.86, ease: 'power3.out' },
          0.28,
        )
        .fromTo(
          introItems.filter((item) => !item.classList.contains('cover-kicker')),
          { autoAlpha: 0, y: 18 },
          { autoAlpha: 1, y: 0, duration: 0.68, stagger: 0.055, ease: 'power3.out' },
          0.62,
        )

      if (desktop) {
        const visualScroll = gsap.timeline({
          scrollTrigger: {
            trigger: cover,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.8,
          },
        })

        visualScroll
          .to(
            '.cover-panel',
            {
              yPercent: -8,
              autoAlpha: 0.18,
              duration: 1,
              ease: 'none',
            },
            0,
          )
          .to(
            scrollLayer,
            {
              xPercent: -4,
              yPercent: 2,
              scale: 1.06,
              rotationY: -4,
              rotationZ: 0.5,
              transformOrigin: '54% 50%',
              duration: 0.52,
              ease: 'none',
            },
            0,
          )
          .to(
            scrollLayer,
            {
              xPercent: -18,
              yPercent: 18,
              scale: 0.72,
              rotationY: 10,
              rotationZ: -2.4,
              autoAlpha: 0.08,
              duration: 0.48,
              ease: 'none',
            },
            0.52,
          )
      }

      ScrollTrigger.create({
        trigger: cover,
        start: 'top top',
        end: 'bottom top',
        onUpdate: (self) => {
          cover.style.setProperty('--impact-scroll', self.progress.toFixed(4))
        },
        onLeaveBack: () => cover.style.setProperty('--impact-scroll', '0'),
      })

      return () => {
        intro.kill()
        cover.style.setProperty('--impact-scroll', '0')
        cover.style.setProperty('--impact-beam', '1')
      }
    },
  )

  return {
    destroy() {
      media.revert()
      cover.removeEventListener('pointermove', queuePointerDepth)
      cover.removeEventListener('pointerleave', resetPointerDepth)
      if (pointerFrame) window.cancelAnimationFrame(pointerFrame)
      compactControls.removeEventListener('change', placeQuickActions)
      root.classList.remove('impact-edition', 'impact-static')
    },
  }
}
