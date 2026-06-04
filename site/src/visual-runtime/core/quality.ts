import { readMotionPreferences, type MotionPreferences } from './motion-preferences'

export type VisualQuality = 'calm' | 'lite' | 'high' | 'ultra'

export type VisualRuntimeProfile = {
  quality: VisualQuality
  particleCount: number
  glow: number
  fps: number
  shaderLike: boolean
}

export function resolveVisualRuntimeProfile(
  preferences: MotionPreferences = readMotionPreferences(),
): VisualRuntimeProfile {
  if (preferences.reducedMotion || preferences.saveData) {
    return {
      quality: 'calm',
      particleCount: 0,
      glow: 0.42,
      fps: 12,
      shaderLike: false,
    }
  }

  if (preferences.viewportWidth < 720 || preferences.coarsePointer || preferences.deviceMemory < 4) {
    return {
      quality: 'lite',
      particleCount: 42,
      glow: 0.72,
      fps: 30,
      shaderLike: false,
    }
  }

  if (preferences.viewportWidth >= 1280 && preferences.deviceMemory >= 8 && preferences.finePointer) {
    return {
      quality: 'ultra',
      particleCount: 128,
      glow: 1,
      fps: 60,
      shaderLike: true,
    }
  }

  return {
    quality: 'high',
    particleCount: 86,
    glow: 0.9,
    fps: 45,
    shaderLike: true,
  }
}

export function publishVisualQuality(profile: VisualRuntimeProfile) {
  document.documentElement.dataset.visualQuality = profile.quality
  document.documentElement.style.setProperty('--visual-runtime-glow', profile.glow.toString())
}
