import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useScrollRow } from './useScrollRow'

interface HarnessProps {
  api: {
    handlers: ReturnType<typeof useScrollRow>['handlers'] | null
    scroll: ReturnType<typeof useScrollRow>['scroll'] | null
    isDragging: ReturnType<typeof useScrollRow>['isDragging'] | null
    isDown: boolean
    container: HTMLDivElement | null
  }
}

function HookHarness({ api }: HarnessProps) {
  const hook = useScrollRow({ items: ['a', 'b'], multiplier: 1, friction: 0.9 })

  api.handlers = hook.handlers
  api.scroll = hook.scroll
  api.isDragging = hook.isDragging
  api.isDown = hook.isDown

  return (
    <div
      ref={(element) => {
        hook.containerRef.current = element
        api.container = element
        if (!element) return

        Object.defineProperty(element, 'scrollWidth', { configurable: true, value: 1200 })
        Object.defineProperty(element, 'clientWidth', { configurable: true, value: 300 })
        Object.defineProperty(element, 'offsetLeft', { configurable: true, value: 0 })
        element.scrollLeft = 0
        element.scrollBy = ((optionsOrX?: ScrollToOptions | number) => {
          if (typeof optionsOrX === 'number') {
            element.scrollLeft += optionsOrX
            return
          }

          element.scrollLeft += optionsOrX?.left ?? 0
        }) as HTMLDivElement['scrollBy']
      }}
    >
      row
    </div>
  )
}

function mountHarness() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const api: HarnessProps['api'] = {
    handlers: null,
    scroll: null,
    isDragging: null,
    isDown: false,
    container: null,
  }

  const render = () => {
    act(() => {
      root.render(<HookHarness api={api} />)
    })
  }

  render()

  return {
    api,
    rerender: render,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

function dispatchMouseMoveWithPageX(pageX: number) {
  const event = new MouseEvent('mousemove', { bubbles: true })
  Object.defineProperty(event, 'pageX', { configurable: true, value: pageX })
  document.dispatchEvent(event)
}

beforeEach(() => {
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers()
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = false
  document.body.innerHTML = ''
})

describe('useScrollRow', () => {
  it('scrolls by direction when scroll() is called', () => {
    const { api, unmount } = mountHarness()

    expect(api.container?.scrollLeft).toBe(0)
    act(() => {
      api.scroll?.('right')
    })
    expect(api.container?.scrollLeft).toBeGreaterThan(0)

    act(() => {
      api.scroll?.('left')
    })
    expect(api.container?.scrollLeft).toBe(0)

    unmount()
  })

  it('tracks drag lifecycle from mousedown to mouseup', () => {
    const { api, rerender, unmount } = mountHarness()

    act(() => {
      api.handlers?.onMouseDown({ pageX: 120 } as React.MouseEvent)
    })
    rerender()
    expect(api.isDown).toBe(true)

    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 20 }))
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      vi.runAllTimers()
    })

    rerender()
    expect(api.isDown).toBe(false)
    expect(api.isDragging?.()).toBe(false)

    unmount()
  })

  it('cancels momentum when a new drag starts', () => {
    const cancelAnimationFrameMock = vi.fn()
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrameMock)

    const { api, unmount } = mountHarness()

    act(() => {
      api.handlers?.onMouseDown({ pageX: 200 } as React.MouseEvent)
      vi.advanceTimersByTime(8)
      dispatchMouseMoveWithPageX(100)
      vi.advanceTimersByTime(8)
      dispatchMouseMoveWithPageX(80)
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      api.handlers?.onMouseDown({ pageX: 180 } as React.MouseEvent)
    })

    expect(cancelAnimationFrameMock).toHaveBeenCalled()
    unmount()
  })
})
