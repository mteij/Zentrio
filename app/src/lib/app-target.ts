import { useEffect, useState } from 'react'
import { isTauriRuntime } from './runtime-env'

export type AppTargetKind = 'web' | 'desktop' | 'mobile' | 'tv'
export type PrimaryInput = 'mouse' | 'touch' | 'remote'
export type TargetOs = 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'unknown'

interface MatchMediaLike {
  matches: boolean
}

interface TargetDetectionEnv {
  userAgent: string
  platform: string
  maxTouchPoints: number
  innerWidth: number
  hasTouchEvent: boolean
  hasTauri: boolean
  hoverMedia: MatchMediaLike | null
  coarsePointerMedia: MatchMediaLike | null
  nativeTv: boolean | null
}

export interface AppTarget {
  kind: AppTargetKind
  os: TargetOs
  isTauri: boolean
  isDesktop: boolean
  isMobile: boolean
  isTv: boolean
  hasTouch: boolean
  supportsHover: boolean
  supportsOrientationLock: boolean
  primaryInput: PrimaryInput
}

const TV_USER_AGENT_RE =
  /(android tv|googletv|google tv|aft[a-z0-9]+|bravia|smarttv|smart-tv|hbbtv|shield android tv|mi box|chromecast)/i

const IOS_USER_AGENT_RE = /(iphone|ipad|ipod)/i
let cachedNativeTvOverride: boolean | null = null
let nativeTargetHydrated = false

function readTargetEnv(): TargetDetectionEnv {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      userAgent: '',
      platform: '',
      maxTouchPoints: 0,
      innerWidth: 0,
      hasTouchEvent: false,
      hasTauri: false,
      hoverMedia: null,
      coarsePointerMedia: null,
      nativeTv: cachedNativeTvOverride,
    }
  }

  return {
    userAgent: navigator.userAgent || '',
    platform: navigator.platform || '',
    maxTouchPoints: navigator.maxTouchPoints || 0,
    innerWidth: window.innerWidth || 0,
    hasTouchEvent: 'ontouchstart' in window,
    hasTauri: isTauriRuntime(),
    hoverMedia: typeof window.matchMedia === 'function' ? window.matchMedia('(hover: hover) and (pointer: fine)') : null,
    coarsePointerMedia: typeof window.matchMedia === 'function' ? window.matchMedia('(pointer: coarse)') : null,
    nativeTv: cachedNativeTvOverride,
  }
}

function detectOs(env: TargetDetectionEnv): TargetOs {
  const userAgent = env.userAgent.toLowerCase()
  const platform = env.platform.toLowerCase()

  if (userAgent.includes('android')) return 'android'
  if (IOS_USER_AGENT_RE.test(userAgent) || platform.includes('iphone') || platform.includes('ipad') || platform.includes('ipod')) {
    return 'ios'
  }
  if (platform.includes('mac')) return 'macos'
  if (platform.includes('win')) return 'windows'
  if (platform.includes('linux')) return 'linux'

  return 'unknown'
}

export function detectAppTarget(env: Partial<TargetDetectionEnv> = {}): AppTarget {
  const resolvedEnv = {
    ...readTargetEnv(),
    ...env,
  }

  const os = detectOs(resolvedEnv)
  const coarsePointer = !!resolvedEnv.coarsePointerMedia?.matches
  const supportsHover = !!resolvedEnv.hoverMedia?.matches
  const touchDetected = resolvedEnv.hasTouchEvent || resolvedEnv.maxTouchPoints > 0 || coarsePointer
  const looksLikeAndroidTvShell =
    resolvedEnv.hasTauri &&
    os === 'android' &&
    !supportsHover &&
    resolvedEnv.innerWidth >= 900
  const isNativeAndroidTv = resolvedEnv.hasTauri && os === 'android' && typeof resolvedEnv.nativeTv === 'boolean'
  const isTv = isNativeAndroidTv
    ? !!resolvedEnv.nativeTv
    : TV_USER_AGENT_RE.test(resolvedEnv.userAgent) || looksLikeAndroidTvShell

  let kind: AppTargetKind = 'web'
  if (isTv) {
    kind = 'tv'
  } else if (os === 'android' || os === 'ios') {
    kind = 'mobile'
  } else if (resolvedEnv.hasTauri) {
    kind = 'desktop'
  }

  const primaryInput: PrimaryInput = isTv ? 'remote' : touchDetected && !supportsHover ? 'touch' : 'mouse'

  return {
    kind,
    os,
    isTauri: resolvedEnv.hasTauri,
    isDesktop: kind === 'desktop',
    isMobile: kind === 'mobile',
    isTv,
    hasTouch: isTv ? false : touchDetected,
    supportsHover: isTv ? false : supportsHover,
    supportsOrientationLock: kind === 'mobile',
    primaryInput,
  }
}

export function getAppTarget(): AppTarget {
  return detectAppTarget()
}

export async function hydrateNativeAppTarget(): Promise<void> {
  if (nativeTargetHydrated) {
    return
  }

  nativeTargetHydrated = true

  if (!isTauriRuntime()) {
    return
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const environment = await invoke<{ isTv?: boolean }>('tv_launcher_get_environment')
    cachedNativeTvOverride = typeof environment?.isTv === 'boolean' ? environment.isTv : null
  } catch (_error) {
    cachedNativeTvOverride = null
  }
}

export function applyAppTargetAttributes(target: AppTarget = getAppTarget()) {
  if (typeof document === 'undefined') return target

  document.documentElement.dataset.appTarget = target.kind
  document.body.dataset.appTarget = target.kind
  document.body.dataset.primaryInput = target.primaryInput

  document.body.classList.toggle('is-mobile', target.isMobile)
  document.body.classList.toggle('is-tv', target.isTv)
  document.body.classList.toggle('has-touch', target.hasTouch)
  document.body.classList.toggle('uses-remote', target.primaryInput === 'remote')

  return target
}

export function useAppTarget(): AppTarget {
  const [target, setTarget] = useState<AppTarget>(() => getAppTarget())

  useEffect(() => {
    const syncTarget = () => {
      const nextTarget = applyAppTargetAttributes()
      setTarget(nextTarget)
    }

    syncTarget()
    window.addEventListener('resize', syncTarget)

    return () => {
      window.removeEventListener('resize', syncTarget)
    }
  }, [])

  return target
}
