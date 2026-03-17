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

function sortedItemIds(items: Map<string, ItemConfig>, zoneId: string): string[] {
  return Array.from(items.values())
    .filter((item) => item.zoneId === zoneId && !item.disabled && !!item.ref.current)
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
  const lastRemoteActionAtRef = useRef<Record<TvRemoteKey, number>>({
    up: 0,
    down: 0,
    left: 0,
    right: 0,
    activate: 0,
    back: 0,
  })
  const [activeItemId, setActiveItemId] = useState<string | null>(null)

  const focusItem = useCallback((itemId: string | null) => {
    if (!enabled || !itemId) return false

    const item = itemsRef.current.get(itemId)
    if (!item || item.disabled || !item.ref.current) return false

    item.ref.current.focus({ preventScroll: true })
    item.ref.current.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    })
    setActiveItemId(itemId)
    lastFocusedByZoneRef.current.set(item.zoneId, itemId)
    return true
  }, [enabled])

  const getZoneItems = useCallback((zoneId: string) => {
    return sortedItemIds(itemsRef.current, zoneId)
  }, [])

  const focusZone = useCallback((zoneId: string | undefined) => {
    if (!enabled || !zoneId) return false

    const zone = zonesRef.current.get(zoneId)
    if (!zone || zone.disabled) return false

    const zoneItems = getZoneItems(zoneId)
    if (zoneItems.length === 0) return false

    const remembered = zone.rememberLastFocused !== false
      ? lastFocusedByZoneRef.current.get(zoneId)
      : null
    const targetItemId =
      (remembered && zoneItems.includes(remembered) ? remembered : null) ||
      (zone.initialItemId && zoneItems.includes(zone.initialItemId) ? zone.initialItemId : null) ||
      zoneItems[0]

    return focusItem(targetItemId)
  }, [enabled, focusItem, getZoneItems])

  const activateFocusedItem = useCallback(() => {
    if (!activeItemId) return
    const item = itemsRef.current.get(activeItemId)
    item?.ref.current?.click()
  }, [activeItemId])

  const registerScope = useCallback((scope: ScopeConfig) => {
    scopesRef.current.set(scope.id, scope)
    activeScopeIdRef.current = scope.id
    return () => {
      scopesRef.current.delete(scope.id)
      if (activeScopeIdRef.current === scope.id) {
        const scopeIds = Array.from(scopesRef.current.keys())
        activeScopeIdRef.current = scopeIds.length > 0 ? scopeIds[scopeIds.length - 1] : null
      }
    }
  }, [])

  const registerZone = useCallback((zone: ZoneConfig) => {
    zonesRef.current.set(zone.id, zone)
    return () => {
      zonesRef.current.delete(zone.id)
      lastFocusedByZoneRef.current.delete(zone.id)
    }
  }, [])

  const registerItem = useCallback((item: ItemConfig) => {
    itemsRef.current.set(item.id, item)
    return () => {
      itemsRef.current.delete(item.id)
      if (lastFocusedByZoneRef.current.get(item.zoneId) === item.id) {
        lastFocusedByZoneRef.current.delete(item.zoneId)
      }
      setActiveItemId((current) => current === item.id ? null : current)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    const moveFocus = (direction: Direction) => {
      const currentId = activeItemId
      if (!currentId) {
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
      if (!activeScopeIdRef.current) return
      if (event.defaultPrevented) return
      const remoteKey = normalizeTvRemoteKey(event)
      const target = event.target
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]')) {
        if (remoteKey !== 'back') {
          return
        }
      }

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
      handleRemoteAction(remoteKey)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener(TV_REMOTE_EVENT_NAME, handleNativeRemoteEvent as EventListener)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener(TV_REMOTE_EVENT_NAME, handleNativeRemoteEvent as EventListener)
    }
  }, [activateFocusedItem, activeItemId, enabled, focusItem, focusZone, getZoneItems])

  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return

    let frameId = 0
    const repeatDelayMs = 140

    const triggerIfReady = (action: TvRemoteKey) => {
      const now = performance.now()
      const lastAt = lastRemoteActionAtRef.current[action] || 0
      if (now - lastAt < repeatDelayMs) return

      lastRemoteActionAtRef.current[action] = now

      if (action === 'activate') {
        activateFocusedItem()
        return
      }

      if (action === 'back') {
        const scope = activeScopeIdRef.current ? scopesRef.current.get(activeScopeIdRef.current) : null
        scope?.onBack?.()
        return
      }

      const currentId = activeItemId
      if (!currentId) {
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
  }, [activeItemId, activateFocusedItem, enabled, focusItem, focusZone, getZoneItems])

  const value = useMemo<FocusStore>(() => ({
    enabled,
    activeItemId,
    registerScope,
    registerZone,
    registerItem,
    focusItem,
    focusZone,
    setActiveItemId,
    getZoneItems,
  }), [activeItemId, enabled, focusItem, focusZone, getZoneItems, registerItem, registerScope, registerZone])

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

  useEffect(() => {
    if (!focus.enabled) return
    return focus.registerScope({
      id: scopeId,
      initialZoneId,
      onBack,
    })
  }, [focus, initialZoneId, onBack, scopeId])

  useEffect(() => {
    if (!focus.enabled || !initialZoneId) return
    const frame = window.requestAnimationFrame(() => {
      focus.focusZone(initialZoneId)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [focus, initialZoneId])

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

  useEffect(() => {
    if (!focus.enabled) return
    return focus.registerZone({
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
    })
  }, [columns, disabled, focus, id, initialItemId, nextDown, nextLeft, nextRight, nextUp, orientation, rememberLastFocused])

  return (
    <TvZoneContext.Provider value={id}>
      <div className={className}>{children}</div>
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

  useEffect(() => {
    if (!focus.enabled || !resolvedZoneId) return
    return focus.registerItem({
      id,
      zoneId: resolvedZoneId,
      ref,
      disabled,
      order: index,
    })
  }, [disabled, focus, id, index, resolvedZoneId])

  const handleFocus = (event: FocusEvent<HTMLButtonElement>) => {
    focus.setActiveItemId(id)
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
