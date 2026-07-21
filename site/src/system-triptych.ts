import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

type SystemTriptychOptions = {
  reducedMotion: boolean
}

type SystemKey = 'protocol' | 'mcgs' | 'busbar'

const systemKeys: SystemKey[] = ['protocol', 'mcgs', 'busbar']

export function setupSystemTriptych(options: SystemTriptychOptions) {
  const root = document.querySelector<HTMLElement>('[data-live-systems]')
  const scrollRoot = root?.querySelector<HTMLElement>('[data-systems-scroll]')
  const stage = root?.querySelector<HTMLElement>('[data-systems-stage]')
  const progress = root?.querySelector<HTMLElement>('[data-system-progress]')
  const stageIndex = root?.querySelector<HTMLElement>('[data-system-stage-index]')
  const buttons = Array.from(
    root?.querySelectorAll<HTMLButtonElement>('button[data-system-tab]') ?? [],
  )
  const panels = Array.from(
    root?.querySelectorAll<HTMLElement>('[data-system-panel]') ?? [],
  )

  if (!root || !scrollRoot || !stage || buttons.length !== systemKeys.length || panels.length !== systemKeys.length) {
    return { destroy() {} }
  }

  gsap.registerPlugin(ScrollTrigger)

  let activeIndex = 0
  let keyboardTimer = 0
  let scrollLockTimer = 0
  let scrollLockedIndex: number | null = null
  let pointerFrame = 0
  let pointerX = 0
  let pointerY = 0
  let pointerTargetX = 0
  let pointerTargetY = 0
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  let reducedMotion = options.reducedMotion
  const onMotionPreferenceChange = (event: MediaQueryListEvent) => {
    reducedMotion = event.matches
    if (reducedMotion) resetPointer()
  }
  const prefersReducedMotion = () => reducedMotion

  const publishPointer = () => {
    pointerX += (pointerTargetX - pointerX) * 0.085
    pointerY += (pointerTargetY - pointerY) * 0.085
    stage.style.setProperty('--system-pointer-x', pointerX.toFixed(4))
    stage.style.setProperty('--system-pointer-y', pointerY.toFixed(4))

    if (Math.abs(pointerTargetX - pointerX) > 0.0015 || Math.abs(pointerTargetY - pointerY) > 0.0015) {
      pointerFrame = window.requestAnimationFrame(publishPointer)
    } else {
      pointerFrame = 0
    }
  }

  const queuePointer = (event: PointerEvent) => {
    if (prefersReducedMotion() || event.pointerType === 'touch') return
    const rect = stage.getBoundingClientRect()
    pointerTargetX = ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2
    pointerTargetY = ((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2
    if (!pointerFrame) pointerFrame = window.requestAnimationFrame(publishPointer)
  }

  const resetPointer = () => {
    pointerTargetX = 0
    pointerTargetY = 0
    if (!pointerFrame) pointerFrame = window.requestAnimationFrame(publishPointer)
  }

  const markKeyboardSwitch = () => {
    root.classList.add('is-keyboard-switch')
    window.clearTimeout(keyboardTimer)
    keyboardTimer = window.setTimeout(() => root.classList.remove('is-keyboard-switch'), 80)
  }

  const activateSystem = (
    nextIndex: number,
    source: 'scroll' | 'pointer' | 'keyboard' | 'initial' = 'scroll',
  ) => {
    const index = Math.max(0, Math.min(systemKeys.length - 1, Math.round(nextIndex)))
    const key = systemKeys[index]

    if (source === 'keyboard') markKeyboardSwitch()
    activeIndex = index
    root.dataset.systemActive = key
    if (stageIndex) stageIndex.textContent = `${String(index + 1).padStart(2, '0')} / 03`

    buttons.forEach((button, buttonIndex) => {
      const selected = buttonIndex === index
      button.classList.toggle('is-active', selected)
      button.setAttribute('aria-selected', String(selected))
      button.tabIndex = selected ? 0 : -1
    })

    panels.forEach((panel, panelIndex) => {
      const selected = panelIndex === index
      panel.classList.toggle('is-active', selected)
      panel.setAttribute('aria-hidden', String(!selected))
      panel.inert = !selected
      panel.querySelectorAll<HTMLElement>('a, button, input, select, textarea, [tabindex]').forEach((item) => {
        if (selected) {
          if (item.dataset.systemOriginalTabindex !== undefined) {
            const original = item.dataset.systemOriginalTabindex
            if (original === '') item.removeAttribute('tabindex')
            else item.setAttribute('tabindex', original)
            delete item.dataset.systemOriginalTabindex
          }
          return
        }

        if (item.dataset.systemOriginalTabindex === undefined) {
          item.dataset.systemOriginalTabindex = item.getAttribute('tabindex') ?? ''
        }
        item.tabIndex = -1
      })
    })
  }

  const syncScrollToSystem = (index: number) => {
    if (window.matchMedia('(max-width: 920px)').matches || prefersReducedMotion()) return
    const rect = scrollRoot.getBoundingClientRect()
    const start = window.scrollY + rect.top
    const travel = Math.max(scrollRoot.offsetHeight - window.innerHeight, 1)
    const target = start + travel * ((index + 0.5) / systemKeys.length)
    scrollLockedIndex = index
    window.clearTimeout(scrollLockTimer)
    scrollLockTimer = window.setTimeout(() => {
      scrollLockedIndex = null
      activateSystem(index, 'scroll')
    }, 820)
    window.scrollTo({ top: target, behavior: 'smooth' })
  }

  buttons.forEach((button, index) => {
    button.addEventListener('click', (event) => {
      const source = event.detail === 0 ? 'keyboard' : 'pointer'
      activateSystem(index, source)
      if (source === 'pointer') syncScrollToSystem(index)
    })

    button.addEventListener('keydown', (event) => {
      if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return

      event.preventDefault()
      const lastIndex = buttons.length - 1
      const nextIndex =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? lastIndex
            : event.key === 'ArrowRight' || event.key === 'ArrowDown'
              ? (index + 1) % buttons.length
              : (index - 1 + buttons.length) % buttons.length

      activateSystem(nextIndex, 'keyboard')
      buttons[nextIndex]?.focus()
    })
  })

  stage.addEventListener('pointermove', queuePointer, { passive: true })
  stage.addEventListener('pointerleave', resetPointer)
  motionQuery.addEventListener('change', onMotionPreferenceChange)

  const media = gsap.matchMedia()
  media.add(
    {
      desktop: '(min-width: 921px)',
      motionOK: '(prefers-reduced-motion: no-preference)',
    },
    (context) => {
      const { desktop, motionOK } = context.conditions as {
        desktop: boolean
        motionOK: boolean
      }

      if (!desktop) return undefined

      const selector = ScrollTrigger.create({
        id: 'feian-live-systems-selector',
        trigger: scrollRoot,
        start: 'top 12%',
        end: 'bottom 88%',
        onUpdate: (self) => {
          const normalized = Math.max(0, Math.min(0.9999, self.progress))
          root.style.setProperty('--systems-progress', normalized.toFixed(4))
          if (progress) progress.style.transform = `scaleX(${normalized.toFixed(4)})`
          const nextIndex = Math.min(systemKeys.length - 1, Math.floor(normalized * systemKeys.length))
          if (scrollLockedIndex !== null) {
            if (activeIndex !== scrollLockedIndex) activateSystem(scrollLockedIndex, 'scroll')
            return
          }
          if (nextIndex !== activeIndex) activateSystem(nextIndex, 'scroll')
        },
        onLeaveBack: () => {
          root.style.setProperty('--systems-progress', '0')
          if (progress) progress.style.transform = 'scaleX(0)'
          activateSystem(0, 'scroll')
        },
      })

      const entrance = motionOK
        ? gsap.fromTo(
            stage,
            { autoAlpha: 0.55, y: 54, rotationX: 2.4, transformOrigin: '50% 100%' },
            {
              autoAlpha: 1,
              y: 0,
              rotationX: 0,
              duration: 1.05,
              ease: 'power4.out',
              scrollTrigger: {
                trigger: stage,
                start: 'top 88%',
                once: true,
              },
            },
          )
        : null

      return () => {
        selector.kill()
        entrance?.kill()
      }
    },
  )

  activateSystem(0, 'initial')

  return {
    destroy() {
      media.revert()
      stage.removeEventListener('pointermove', queuePointer)
      stage.removeEventListener('pointerleave', resetPointer)
      motionQuery.removeEventListener('change', onMotionPreferenceChange)
      if (pointerFrame) window.cancelAnimationFrame(pointerFrame)
      window.clearTimeout(keyboardTimer)
      window.clearTimeout(scrollLockTimer)
      root.classList.remove('is-keyboard-switch')
    },
  }
}
