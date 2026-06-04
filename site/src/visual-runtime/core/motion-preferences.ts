export type MotionPreferences = {
  reducedMotion: boolean
  finePointer: boolean
  coarsePointer: boolean
  saveData: boolean
  effectiveType: string
  deviceMemory: number
  viewportWidth: number
  viewportHeight: number
}

type NavigatorWithHints = Navigator & {
  deviceMemory?: number
  connection?: {
    saveData?: boolean
    effectiveType?: string
  }
}

export function readMotionPreferences(): MotionPreferences {
  const nav = navigator as NavigatorWithHints
  const connection = nav.connection

  return {
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    finePointer: window.matchMedia('(pointer: fine)').matches,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    saveData: Boolean(connection?.saveData),
    effectiveType: connection?.effectiveType || 'unknown',
    deviceMemory: nav.deviceMemory || 4,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  }
}
