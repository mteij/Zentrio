import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type FocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import { createLogger } from '../../utils/client-logger'

const log = createLogger('TvFocus')
import { getPlatformCapabilities } from '../../lib/platform-capabilities'
import styles from './TvFocus.module.css'

type Direction = 'up' | 'down' | 'left' | 'right'
type ZoneOrientation = 'horizontal' | 'vertical' | 'grid'
type TvRemoteKey = Direction | 'activate' | 'back'

interface ZoneConfig {
  id: string
  orientation: ZoneOrientation
  rememberLastFocused?: boolean
  initialItemId?: string
  nextUp?: string
  nextDown?: string
  nextLeft?: string
  nextRight?: string
  columns?: number
  disabled?: boolean
  elementRef?: MutableRefObject<HTMLDivElement | null>
}

interface ScopeConfig {
  id: string
  initialZoneId?: string
  onBack?: () => void
}

interface ItemConfig {
  id: string
  zoneId: string
  ref: MutableRefObject<HTMLElement | null>
  disabled?: boolean
  order?: number
}

interface FocusStore {
  enabled: boolean
  activeItemId: string | null
  registerScope: (scope: ScopeConfig) => () => void
  registerZone: (zone: ZoneConfig) => () => void
  registerItem: (item: ItemConfig) => () => void
  focusItem: (itemId: string | null) => boolean
  focusZone: (zoneId: string | undefined) => boolean
  setActiveItemId: (itemId: string | null) => void
  getZoneItems: (zoneId: string) => string[]
}

const TvFocusContext = createContext<FocusStore | null>(null)
const TvScopeContext = createContext<string | null>(null)
export const TvZoneContext = createContext<string | null>(null)
const TV_REMOTE_EVENT_NAME = 'zentrio:tv-remote'
const TV_ZONE_PREFETCH_EVENT_NAME = 'zentrio:tv-zone-prefetch'
const FALLBACK_FOCUSABLE_SELECTORS = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]',
].join(', ')

function getItemElement(item: ItemConfig): HTMLElement | null {
  if (item.ref.current) return item.ref.current
  if (typeof document === 'undefined') return null

  const element = document.getElementById(item.id)
  return element instanceof HTMLElement ? element : null
}

function getZoneElement(zone: ZoneConfig): HTMLDivElement | null {
  return zone.elementRef?.current ?? null
}

function getClosestZoneId(element: HTMLElement | null): string | null {
  const zoneElement = element?.closest<HTMLElement>('[data-tv-zone-id]')
  return zoneElement?.dataset.tvZoneId || null
}

function isFocusableElementVisible(element: HTMLElement): boolean {
  if (element.matches('[disabled], [aria-disabled="true"]')) return false
  if (element.getAttribute('aria-hidden') === 'true') return false

  const style = window.getComputedStyle(element)
  if (style.display === 'none' || style.visibility === 'hidden') return false

  return true
}

function sortedItemIds(items: Map<string, ItemConfig>, zoneId: string): string[] {
  return Array.from(items.values())
    .filter((item) => item.zoneId === zoneId && !item.disabled && !!getItemElement(item))
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
    .map((item) => item.id)
}

function getDirectionalZoneTarget(zone: ZoneConfig, direction: Direction): string | undefined {
  switch (direction) {
    case 'up':
      return zone.nextUp
    case 'down':
      return zone.nextDown
    case 'left':
      return zone.nextLeft
    case 'right':
      return zone.nextRight
  }
}

export function normalizeTvRemoteKey(event: Pick<KeyboardEvent, 'key' | 'code'> & Partial<Pick<KeyboardEvent, 'keyCode' | 'which'>>): TvRemoteKey | null {
  const key = event.key || ''
  const code = event.code || ''
  const keyCode = typeof event.keyCode === 'number' ? event.keyCode : event.which

  if (
    key === 'ArrowLeft' ||
    key === 'Left' ||
    key === 'left' ||
    key === 'DPAD_LEFT' ||
    key === 'DPadLeft' ||
    key === 'NavigatePrevious' ||
    code === 'ArrowLeft' ||
    code === 'Numpad4' ||
    keyCode === 21 ||
    keyCode === 268 ||
    keyCode === 282 ||
    keyCode === 37
  ) return 'left'

  if (
    key === 'ArrowRight' ||
    key === 'Right' ||
    key === 'right' ||
    key === 'DPAD_RIGHT' ||
    key === 'DPadRight' ||
    key === 'NavigateNext' ||
    code === 'ArrowRight' ||
    code === 'Numpad6' ||
    keyCode === 22 ||
    keyCode === 269 ||
    keyCode === 283 ||
    keyCode === 39
  ) return 'right'

  if (
    key === 'ArrowUp' ||
    key === 'Up' ||
    key === 'up' ||
    key === 'DPAD_UP' ||
    key === 'DPadUp' ||
    code === 'ArrowUp' ||
    code === 'Numpad8' ||
    keyCode === 19 ||
    keyCode === 280 ||
    keyCode === 38
  ) return 'up'

  if (
    key === 'ArrowDown' ||
    key === 'Down' ||
    key === 'down' ||
    key === 'DPAD_DOWN' ||
    key === 'DPadDown' ||
    code === 'ArrowDown' ||
    code === 'Numpad2' ||
    keyCode === 20 ||
    keyCode === 281 ||
    keyCode === 40
  ) return 'down'

  if (
    key === 'Enter' ||
    key === 'NumpadEnter' ||
    key === 'OK' ||
    key === 'Ok' ||
    key === 'Select' ||
    key === 'Center' ||
    key === 'DPAD_CENTER' ||
    key === 'DPadCenter' ||
    key === ' ' ||
    key === 'Spacebar' ||
    code === 'Enter' ||
    code === 'NumpadEnter' ||
    keyCode === 23 ||
    keyCode === 66 ||
    keyCode === 96 ||
    keyCode === 13 ||
    keyCode === 32
  ) return 'activate'

  if (
    key === 'Escape' ||
    key === 'Esc' ||
    key === 'Backspace' ||
    key === 'BrowserBack' ||
    key === 'GoBack' ||
    key === 'Back' ||
    key === 'AndroidBack' ||
    key === 'NavigateBack' ||
    code === 'Escape' ||
    keyCode === 4 ||
    keyCode === 8 ||
    keyCode === 27
  ) return 'back'

  return null
}

export function resolveNextItemId(
  itemIds: string[],
  currentId: string,
  zone: Pick<ZoneConfig, 'orientation' | 'columns'>,
  direction: Direction,
): string | null {
  const currentIndex = itemIds.indexOf(currentId)
  if (currentIndex === -1) return itemIds[0] ?? null

  if (zone.orientation === 'horizontal') {
    if (direction === 'left') return itemIds[currentIndex - 1] ?? null
    if (direction === 'right') return itemIds[currentIndex + 1] ?? null
    return null
  }

  if (zone.orientation === 'vertical') {
    if (direction === 'up') return itemIds[currentIndex - 1] ?? null
    if (direction === 'down') return itemIds[currentIndex + 1] ?? null
    return null
  }

  const columns = Math.max(1, zone.columns ?? 1)
  const rowIndex = Math.floor(currentIndex / columns)
  const columnIndex = currentIndex % columns

  if (direction === 'left') {
    if (columnIndex === 0) return null
    return itemIds[currentIndex - 1] ?? null
  }

  if (direction === 'right') {
    if (columnIndex >= columns - 1) return null
    return itemIds[currentIndex + 1] ?? null
  }

  if (direction === 'up') {
    if (rowIndex === 0) return null
    return itemIds[currentIndex - columns] ?? null
  }

  const nextIndex = currentIndex + columns
  return itemIds[nextIndex] ?? null
}

export function resolveFallbackFocusIndex(itemCount: number, currentIndex: number, direction: Direction): number {
  if (itemCount <= 0) return -1

  const step = direction === 'left' || direction === 'up' ? -1 : 1
  if (currentIndex === -1) {
    return step > 0 ? 0 : itemCount - 1
  }

  const nextIndex = currentIndex + step
  if (nextIndex < 0 || nextIndex >= itemCount) {
    return currentIndex
  }

  return nextIndex
}

function getFocusableElements(root: ParentNode | null | undefined): HTMLElement[] {
  if (!root) return []
  return Array.from(root.querySelectorAll<HTMLElement>(FALLBACK_FOCUSABLE_SELECTORS)).filter(isFocusableElementVisible)
}

function getFallbackFocusableElements(): HTMLElement[] {
  if (typeof document === 'undefined') return []
  return getFocusableElements(document)
}

function mergeClassName(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(' ')
}

export function TvFocusProvider({ children }: { children: ReactNode }) {
  const enabled = getPlatformCapabilities().canUseRemoteNavigation
  const scopesRef = useRef(new Map<string, ScopeConfig>())
  const zonesRef = useRef(new Map<string, ZoneConfig>())
  const itemsRef = useRef(new Map<string, ItemConfig>())
  const lastFocusedByZoneRef = useRef(new Map<string, string>())
  const activeScopeIdRef = useRef<string | null>(null)
  const activeItemIdRef = useRef<string | null>(null)
  const pendingZoneFocusIdRef = useRef<string | null>(null)
  const engagedNativeControlRef = useRef<HTMLElement | null>(null)
  const lastRemoteActionAtRef = useRef<Record<TvRemoteKey, number>>({
    up: 0,
    down: 0,
    left: 0,
    right: 0,
    activate: 0,
    back: 0,
  })
  const [activeItemId, setActiveItemId] = useState<string | null>(null)

  const syncActiveItemId = useCallback((itemId: string | null) => {
    activeItemIdRef.current = itemId
    setActiveItemId(itemId)
  }, [])

  const pushDebugState = useCallback((lastRemoteAction?: Record<string, unknown>) => {
    if (typeof window === 'undefined') return

    const activeElement = document.activeElement instanceof HTMLElement
      ? {
          tag: document.activeElement.tagName,
          id: document.activeElement.id,
          className: document.activeElement.className,
        }
      : null

    ;(window as Window & {
      __ZENTRIO_TV_DEBUG__?: Record<string, unknown>
    }).__ZENTRIO_TV_DEBUG__ = {
      enabled,
      activeItemId,
      activeItemIdRef: activeItemIdRef.current,
      activeScopeId: activeScopeIdRef.current,
      scopeCount: scopesRef.current.size,
      zoneCount: zonesRef.current.size,
      itemCount: itemsRef.current.size,
      zones: Array.from(zonesRef.current.keys()).reduce<Record<string, string[]>>((acc, zoneId) => {
        acc[zoneId] = sortedItemIds(itemsRef.current, zoneId)
        return acc
      }, {}),
      activeElement,
      lastRemoteAction: lastRemoteAction ?? null,
    }
  }, [activeItemId, enabled])

  useEffect(() => {
    if (typeof window === 'undefined') return

    ;(window as Window & {
      __ZENTRIO_TV_FOCUS_READY__?: boolean
      __ZENTRIO_TV_FOCUS_ENABLED__?: boolean
    }).__ZENTRIO_TV_FOCUS_READY__ = true
    ;(window as Window & {
      __ZENTRIO_TV_FOCUS_READY__?: boolean
      __ZENTRIO_TV_FOCUS_ENABLED__?: boolean
    }).__ZENTRIO_TV_FOCUS_ENABLED__ = enabled

    log.debug('provider mounted', {
      enabled,
      appTarget: document.body?.dataset.appTarget,
      primaryInput: document.body?.dataset.primaryInput,
    })
    pushDebugState()
  }, [enabled, pushDebugState])

  const focusItem = useCallback((itemId: string | null) => {
    if (!enabled || !itemId) return false

    const item = itemsRef.current.get(itemId)
    if (!item || item.disabled) return false

    const element = getItemElement(item)
    if (!element) return false

    syncActiveItemId(itemId)
    element.focus({ preventScroll: true })
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    })
    lastFocusedByZoneRef.current.set(item.zoneId, itemId)
    if (pendingZoneFocusIdRef.current === item.zoneId) {
      pendingZoneFocusIdRef.current = null
    }
    return true
  }, [enabled, syncActiveItemId])

  const focusNativeElement = useCallback((element: HTMLElement | null, zoneId?: string | null) => {
    if (!enabled || !element) return false

    syncActiveItemId(null)
    element.focus({ preventScroll: true })
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    })

    if (zoneId && pendingZoneFocusIdRef.current === zoneId) {
      pendingZoneFocusIdRef.current = null
    }

    return true
  }, [enabled, syncActiveItemId])

  const getZoneItems = useCallback((zoneId: string) => {
    return sortedItemIds(itemsRef.current, zoneId)
  }, [])

  const focusZone = useCallback((zoneId: string | undefined) => {
    if (!enabled || !zoneId) return false

    const zone = zonesRef.current.get(zoneId)
    if (!zone || zone.disabled) {
      pendingZoneFocusIdRef.current = zoneId
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(TV_ZONE_PREFETCH_EVENT_NAME, {
          detail: { zoneId },
        }))
      }
      return false
    }

    const zoneItems = getZoneItems(zoneId)
    if (zoneItems.length === 0) {
      const nativeFocusable = getFocusableElements(getZoneElement(zone))
        .filter((element) => !element.id || !itemsRef.current.has(element.id))

      if (focusNativeElement(nativeFocusable[0] ?? null, zoneId)) {
        return true
      }

      pendingZoneFocusIdRef.current = zoneId
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(TV_ZONE_PREFETCH_EVENT_NAME, {
          detail: { zoneId },
        }))
      }
      return false
    }

    const remembered = zone.rememberLastFocused !== false
      ? lastFocusedByZoneRef.current.get(zoneId)
      : null
    const targetItemId =
      (remembered && zoneItems.includes(remembered) ? remembered : null) ||
      (zone.initialItemId && zoneItems.includes(zone.initialItemId) ? zone.initialItemId : null) ||
      zoneItems[0]

    const didFocus = focusItem(targetItemId)
    if (didFocus && pendingZoneFocusIdRef.current === zoneId) {
      pendingZoneFocusIdRef.current = null
    }
    return didFocus
  }, [enabled, focusItem, focusNativeElement, getZoneItems])

  const resolveCurrentItemId = useCallback(() => {
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusedItemId = activeElement?.id
    if (focusedItemId) {
      const focusedItem = itemsRef.current.get(focusedItemId)
      if (focusedItem) {
        syncActiveItemId(focusedItemId)
        lastFocusedByZoneRef.current.set(focusedItem.zoneId, focusedItemId)
        return focusedItemId
      }
    }

    if (activeItemIdRef.current && itemsRef.current.has(activeItemIdRef.current)) {
      return activeItemIdRef.current
    }

    return null
  }, [syncActiveItemId])

  const activateFocusedItem = useCallback(() => {
    const currentItemId = resolveCurrentItemId()
    if (!currentItemId) {
      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
      if (activeElement instanceof HTMLSelectElement) {
        engagedNativeControlRef.current = activeElement
      }
      activeElement?.click()
      return
    }
    const item = itemsRef.current.get(currentItemId)
    item?.ref.current?.click()
  }, [resolveCurrentItemId])

  const registerScope = useCallback((scope: ScopeConfig) => {
    scopesRef.current.set(scope.id, scope)
    activeScopeIdRef.current = scope.id
    pushDebugState()
    return () => {
      scopesRef.current.delete(scope.id)
      if (activeScopeIdRef.current === scope.id) {
        const scopeIds = Array.from(scopesRef.current.keys())
        activeScopeIdRef.current = scopeIds.length > 0 ? scopeIds[scopeIds.length - 1] : null
      }
      pushDebugState()
    }
  }, [pushDebugState])

  const registerZone = useCallback((zone: ZoneConfig) => {
    zonesRef.current.set(zone.id, zone)
    if (pendingZoneFocusIdRef.current === zone.id) {
      window.requestAnimationFrame(() => {
        if (pendingZoneFocusIdRef.current === zone.id) {
          focusZone(zone.id)
        }
      })
    }
    pushDebugState()
    return () => {
      zonesRef.current.delete(zone.id)
      lastFocusedByZoneRef.current.delete(zone.id)
      pushDebugState()
    }
  }, [focusZone, pushDebugState])

  const registerItem = useCallback((item: ItemConfig) => {
    itemsRef.current.set(item.id, item)
    if (pendingZoneFocusIdRef.current === item.zoneId) {
      window.requestAnimationFrame(() => {
        if (pendingZoneFocusIdRef.current === item.zoneId) {
          focusZone(item.zoneId)
        }
      })
    }
    pushDebugState()
    return () => {
      itemsRef.current.delete(item.id)
      if (lastFocusedByZoneRef.current.get(item.zoneId) === item.id) {
        lastFocusedByZoneRef.current.delete(item.zoneId)
      }
      if (activeItemIdRef.current === item.id) {
        syncActiveItemId(null)
      }
      pushDebugState()
    }
  }, [focusZone, pushDebugState, syncActiveItemId])

  const moveNativeFocus = useCallback((direction: Direction) => {
    if (typeof document === 'undefined') return false

    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!activeElement) return false

    const zoneId = getClosestZoneId(activeElement)
    if (!zoneId) return false

    const zone = zonesRef.current.get(zoneId)
    if (!zone) return false

    const focusableElements = getFocusableElements(getZoneElement(zone))
      .filter((element) => !element.id || !itemsRef.current.has(element.id))

    const currentIndex = focusableElements.indexOf(activeElement)
    let nextIndex = -1

    if (zone.orientation === 'vertical' && (direction === 'up' || direction === 'down')) {
      nextIndex = resolveFallbackFocusIndex(focusableElements.length, currentIndex, direction)
    } else if (zone.orientation === 'horizontal' && (direction === 'left' || direction === 'right')) {
      nextIndex = resolveFallbackFocusIndex(focusableElements.length, currentIndex, direction)
    } else if (zone.orientation === 'grid') {
      nextIndex = resolveFallbackFocusIndex(focusableElements.length, currentIndex, direction)
    }

    const nextElement = nextIndex >= 0 ? focusableElements[nextIndex] ?? null : null
    if (nextElement && nextElement !== activeElement) {
      return focusNativeElement(nextElement, zoneId)
    }

    const nextZoneId = getDirectionalZoneTarget(zone, direction)
    if (nextZoneId) {
      return focusZone(nextZoneId)
    }

    return false
  }, [focusNativeElement, focusZone])

  const shouldDeferToNativeControl = useCallback((target: EventTarget | null, remoteKey: TvRemoteKey | null) => {
    if (!(target instanceof HTMLElement) || !remoteKey) return false

    if (target.matches('textarea, [contenteditable="true"], input:not([type]), input[type="text"], input[type="password"], input[type="email"], input[type="search"], input[type="url"], input[type="tel"], input[type="number"]')) {
      return remoteKey !== 'back'
    }

    if (target instanceof HTMLSelectElement) {
      return engagedNativeControlRef.current === target
    }

    if (target instanceof HTMLInputElement && target.type === 'range') {
      return remoteKey === 'left' || remoteKey === 'right'
    }

    return false
  }, [])

  useEffect(() => {
    if (!enabled) return

    const handleFocusIn = (event: Event) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return

      const focusedItemId = target.id
      if (!focusedItemId) {
        if (getClosestZoneId(target)) {
          syncActiveItemId(null)
          pushDebugState({
            stage: 'focusin-native',
            tag: target.tagName,
          })
        }
        return
      }

      const focusedItem = itemsRef.current.get(focusedItemId)
      if (!focusedItem) {
        if (getClosestZoneId(target)) {
          syncActiveItemId(null)
        }
        return
      }

      syncActiveItemId(focusedItemId)
      lastFocusedByZoneRef.current.set(focusedItem.zoneId, focusedItemId)
      pushDebugState({
        stage: 'focusin',
        activeItemId: focusedItemId,
      })
    }

    const handleFocusOut = (event: Event) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      if (engagedNativeControlRef.current === target) {
        engagedNativeControlRef.current = null
      }
    }

    const handleChange = (event: Event) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      if (engagedNativeControlRef.current === target) {
        engagedNativeControlRef.current = null
      }
    }

    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut, true)
    document.addEventListener('change', handleChange, true)
    return () => {
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut, true)
      document.removeEventListener('change', handleChange, true)
    }
  }, [enabled, pushDebugState, syncActiveItemId])

  const handleFallbackRemoteAction = useCallback((action: TvRemoteKey) => {
    if (!enabled || activeScopeIdRef.current) return false

    if (action === 'back') {
      return false
    }

    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null

    if (action === 'activate') {
      activeElement?.click()
      return !!activeElement
    }

    const focusableElements = getFallbackFocusableElements()
    const currentIndex = activeElement ? focusableElements.indexOf(activeElement) : -1
    const nextIndex = resolveFallbackFocusIndex(focusableElements.length, currentIndex, action)
    const nextElement = nextIndex >= 0 ? focusableElements[nextIndex] : null

    if (!nextElement) return false

    nextElement.focus({ preventScroll: true })
    nextElement.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    })

    return true
  }, [enabled])

  useEffect(() => {
    if (!enabled) return

    const moveFocus = (direction: Direction) => {
      const currentId = resolveCurrentItemId()
      if (!currentId) {
        if (moveNativeFocus(direction)) {
          return
        }

        const activeScope = activeScopeIdRef.current ? scopesRef.current.get(activeScopeIdRef.current) : null
        if (activeScope?.initialZoneId) {
          focusZone(activeScope.initialZoneId)
        }
        return
      }

      const item = itemsRef.current.get(currentId)
      if (!item) return

      const zone = zonesRef.current.get(item.zoneId)
      if (!zone) return

      const zoneItems = getZoneItems(zone.id)
      const nextItemId = resolveNextItemId(zoneItems, currentId, zone, direction)
      if (nextItemId && focusItem(nextItemId)) {
        return
      }

      const nextZoneId = getDirectionalZoneTarget(zone, direction)
      if (nextZoneId) {
        focusZone(nextZoneId)
      }
    }

    const handleBack = () => {
      const scope = activeScopeIdRef.current ? scopesRef.current.get(activeScopeIdRef.current) : null
      scope?.onBack?.()
    }

    const handleRemoteAction = (action: TvRemoteKey) => {
      switch (action) {
        case 'left':
        case 'right':
        case 'up':
        case 'down':
          moveFocus(action)
          break
        case 'activate':
          activateFocusedItem()
          break
        case 'back':
          handleBack()
          break
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      const remoteKey = normalizeTvRemoteKey(event)
      const target = event.target
      if (shouldDeferToNativeControl(target, remoteKey)) {
        return
      }

      if (!activeScopeIdRef.current && remoteKey && handleFallbackRemoteAction(remoteKey)) {
        event.preventDefault()
        return
      }

      if (!activeScopeIdRef.current) return

      switch (remoteKey) {
        case 'left':
        case 'right':
        case 'up':
        case 'down':
        case 'activate':
        case 'back':
          event.preventDefault()
          handleRemoteAction(remoteKey)
          break
        default:
          break
      }
    }

    const handleNativeRemoteEvent = (event: Event) => {
      const remoteEvent = event as CustomEvent<{ action?: TvRemoteKey }>
      const remoteKey = remoteEvent.detail?.action
      if (!remoteKey) return

      log.debug('native remote event', {
        action: remoteKey,
        activeScope: activeScopeIdRef.current,
        activeItemId,
        activeElement: document.activeElement instanceof HTMLElement
          ? {
              tag: document.activeElement.tagName,
              id: document.activeElement.id,
              className: document.activeElement.className,
            }
          : null,
      })
      pushDebugState({
        action: remoteKey,
        stage: 'before-handle',
        activeScopeId: activeScopeIdRef.current,
        activeItemId,
      })

      if (!activeScopeIdRef.current && handleFallbackRemoteAction(remoteKey)) {
        pushDebugState({
          action: remoteKey,
          stage: 'after-fallback',
          activeScopeId: activeScopeIdRef.current,
          activeItemId,
        })
        return
      }

      handleRemoteAction(remoteKey)
      pushDebugState({
        action: remoteKey,
        stage: 'after-handle',
        activeScopeId: activeScopeIdRef.current,
        activeItemId,
      })
    }

    window.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener(TV_REMOTE_EVENT_NAME, handleNativeRemoteEvent as EventListener)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener(TV_REMOTE_EVENT_NAME, handleNativeRemoteEvent as EventListener)
    }
  }, [activateFocusedItem, activeItemId, enabled, focusItem, focusZone, getZoneItems, handleFallbackRemoteAction, moveNativeFocus, pushDebugState, resolveCurrentItemId, shouldDeferToNativeControl])

  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return

    let frameId = 0
    const repeatDelayMs = 140

    const triggerIfReady = (action: TvRemoteKey) => {
      const now = performance.now()
      const lastAt = lastRemoteActionAtRef.current[action] || 0
      if (now - lastAt < repeatDelayMs) return

      lastRemoteActionAtRef.current[action] = now

      if (!activeScopeIdRef.current && handleFallbackRemoteAction(action)) {
        return
      }

      if (action === 'activate') {
        activateFocusedItem()
        return
      }

      if (action === 'back') {
        const scope = activeScopeIdRef.current ? scopesRef.current.get(activeScopeIdRef.current) : null
        scope?.onBack?.()
        return
      }

      const currentId = resolveCurrentItemId()
      if (!currentId) {
        if (moveNativeFocus(action)) {
          return
        }

        const activeScope = activeScopeIdRef.current ? scopesRef.current.get(activeScopeIdRef.current) : null
        if (activeScope?.initialZoneId) {
          focusZone(activeScope.initialZoneId)
        }
        return
      }

      const item = itemsRef.current.get(currentId)
      if (!item) return

      const zone = zonesRef.current.get(item.zoneId)
      if (!zone) return

      const zoneItems = getZoneItems(zone.id)
      const nextItemId = resolveNextItemId(zoneItems, currentId, zone, action)
      if (nextItemId && focusItem(nextItemId)) {
        return
      }

      const nextZoneId = getDirectionalZoneTarget(zone, action)
      if (nextZoneId) {
        focusZone(nextZoneId)
      }
    }

    const pollGamepads = () => {
      const gamepads = navigator.getGamepads()
      for (const gamepad of gamepads) {
        if (!gamepad) continue

        const leftPressed = Boolean(gamepad.buttons[14]?.pressed) || (gamepad.axes[0] ?? 0) <= -0.5
        const rightPressed = Boolean(gamepad.buttons[15]?.pressed) || (gamepad.axes[0] ?? 0) >= 0.5
        const upPressed = Boolean(gamepad.buttons[12]?.pressed) || (gamepad.axes[1] ?? 0) <= -0.5
        const downPressed = Boolean(gamepad.buttons[13]?.pressed) || (gamepad.axes[1] ?? 0) >= 0.5
        const activatePressed = Boolean(gamepad.buttons[0]?.pressed) || Boolean(gamepad.buttons[9]?.pressed)
        const backPressed = Boolean(gamepad.buttons[1]?.pressed) || Boolean(gamepad.buttons[8]?.pressed)

        if (leftPressed) triggerIfReady('left')
        if (rightPressed) triggerIfReady('right')
        if (upPressed) triggerIfReady('up')
        if (downPressed) triggerIfReady('down')
        if (activatePressed) triggerIfReady('activate')
        if (backPressed) triggerIfReady('back')
      }

      frameId = window.requestAnimationFrame(pollGamepads)
    }

    frameId = window.requestAnimationFrame(pollGamepads)
    return () => window.cancelAnimationFrame(frameId)
  }, [activateFocusedItem, enabled, focusItem, focusZone, getZoneItems, handleFallbackRemoteAction, moveNativeFocus, resolveCurrentItemId])

  const value = useMemo<FocusStore>(() => ({
    enabled,
    activeItemId,
    registerScope,
    registerZone,
    registerItem,
    focusItem,
    focusZone,
    setActiveItemId: syncActiveItemId,
    getZoneItems,
  }), [activeItemId, enabled, focusItem, focusZone, getZoneItems, registerItem, registerScope, registerZone, syncActiveItemId])

  useEffect(() => {
    pushDebugState()
  }, [activeItemId, pushDebugState])

  return (
    <TvFocusContext.Provider value={value}>
      {children}
    </TvFocusContext.Provider>
  )
}

export interface TvFocusScopeProps {
  children: ReactNode
  className?: string
  initialZoneId?: string
  onBack?: () => void
}

export function TvFocusScope({ children, className, initialZoneId, onBack }: TvFocusScopeProps) {
  const focus = useTvFocus()
  const scopeId = useId()
  const { enabled, registerScope, focusZone } = focus

  useEffect(() => {
    if (!enabled) return
    return registerScope({
      id: scopeId,
      initialZoneId,
      onBack,
    })
  }, [enabled, initialZoneId, onBack, registerScope, scopeId])

  useEffect(() => {
    if (!enabled || !initialZoneId) return
    const frame = window.requestAnimationFrame(() => {
      focusZone(initialZoneId)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [enabled, focusZone, initialZoneId])

  return (
    <TvScopeContext.Provider value={scopeId}>
      <div className={mergeClassName(styles.scope, className)}>{children}</div>
    </TvScopeContext.Provider>
  )
}

export interface TvFocusZoneProps extends Omit<ZoneConfig, 'id'> {
  id: string
  children: ReactNode
  className?: string
}

export function TvFocusZone({
  id,
  children,
  className,
  orientation,
  rememberLastFocused = true,
  initialItemId,
  nextUp,
  nextDown,
  nextLeft,
  nextRight,
  columns,
  disabled,
}: TvFocusZoneProps) {
  const focus = useTvFocus()
  const { enabled, registerZone } = focus
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!enabled) return
    return registerZone({
      id,
      orientation,
      rememberLastFocused,
      initialItemId,
      nextUp,
      nextDown,
      nextLeft,
      nextRight,
      columns,
      disabled,
      elementRef: ref,
    })
  }, [columns, disabled, enabled, id, initialItemId, nextDown, nextLeft, nextRight, nextUp, orientation, registerZone, rememberLastFocused])

  return (
    <TvZoneContext.Provider value={id}>
      <div ref={ref} className={className} data-tv-zone-id={id}>{children}</div>
    </TvZoneContext.Provider>
  )
}

export interface TvFocusItemProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'id'> {
  id: string
  zoneId?: string
  index?: number
  onActivate?: () => void
  disabled?: boolean
}

export function TvFocusItem({
  id,
  zoneId,
  index,
  className,
  onActivate,
  onFocus,
  onKeyDown,
  disabled,
  children,
  type = 'button',
  ...props
}: TvFocusItemProps) {
  const focus = useTvFocus()
  const inheritedZoneId = useContext(TvZoneContext)
  const resolvedZoneId = zoneId ?? inheritedZoneId
  const ref = useRef<HTMLButtonElement | null>(null)
  const isActive = focus.activeItemId === id
  const { enabled, registerItem, setActiveItemId } = focus

  useEffect(() => {
    if (!enabled || !resolvedZoneId) return
    return registerItem({
      id,
      zoneId: resolvedZoneId,
      ref,
      disabled,
      order: index,
    })
  }, [disabled, enabled, id, index, registerItem, resolvedZoneId])

  const handleFocus = (event: FocusEvent<HTMLButtonElement>) => {
    setActiveItemId(id)
    event.currentTarget.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    })
    onFocus?.(event)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (normalizeTvRemoteKey(event.nativeEvent) === 'activate' && onActivate) {
      event.preventDefault()
      onActivate()
      return
    }
    onKeyDown?.(event)
  }

  return (
    <button
      {...props}
      ref={ref}
      id={id}
      type={type}
      className={mergeClassName(styles.item, className)}
      data-tv-active={isActive ? 'true' : 'false'}
      data-tv-disabled={disabled ? 'true' : 'false'}
      disabled={disabled}
      onClick={onActivate}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
    >
      {children}
    </button>
  )
}

export function useTvFocus() {
  const context = useContext(TvFocusContext)
  if (!context) {
    throw new Error('useTvFocus must be used within a TvFocusProvider')
  }
  return context
}

export function useTvFocusScopeId() {
  return useContext(TvScopeContext)
}
