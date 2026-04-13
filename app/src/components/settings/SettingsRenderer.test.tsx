import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsRenderer } from './SettingsRenderer'
import type { SettingsSectionDefinition } from './settingsSchema'

vi.mock('../../lib/haptics', () => ({
  hapticTick: vi.fn(),
}))

function mount(element: React.ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  act(() => {
    root.render(element)
  })

  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
    rerender: (nextElement: React.ReactElement) => {
      act(() => {
        root.render(nextElement)
      })
    },
  }
}

function click(element: Element | null) {
  if (!element) return
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

beforeEach(() => {
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
})

afterEach(() => {
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = false
  document.body.innerHTML = ''
})

describe('SettingsRenderer', () => {
  it('renders mixed item kinds and invokes handlers', () => {
    const onAction = vi.fn()
    const onToggle = vi.fn()

    const sections: SettingsSectionDefinition[] = [
      {
        id: 'main',
        title: 'Main Section',
        items: [
          {
            id: 'notice',
            kind: 'notice',
            content: 'Notice copy',
          },
          {
            id: 'action',
            kind: 'action',
            label: 'Action Label',
            actionLabel: 'Run Action',
            onActivate: onAction,
          },
          {
            id: 'toggle',
            kind: 'toggle',
            label: 'Toggle Label',
            checked: false,
            onChange: onToggle,
          },
          {
            id: 'custom',
            kind: 'custom',
            render: (platform) => <div>{`Custom ${platform}`}</div>,
          },
        ],
      },
    ]

    const view = mount(<SettingsRenderer platform="tv" sections={sections} />)

    expect(view.container.textContent).toContain('Main Section')
    expect(view.container.textContent).toContain('Notice copy')
    expect(view.container.textContent).toContain('Custom tv')

    click(Array.from(view.container.querySelectorAll('button')).find((button) => button.textContent === 'Run Action') ?? null)
    expect(onAction).toHaveBeenCalledTimes(1)

    click(view.container.querySelector('[role="switch"]'))
    expect(onToggle).toHaveBeenCalledWith(true)

    view.unmount()
  })

  it('hides platform-gated items on unsupported platforms', () => {
    const sections: SettingsSectionDefinition[] = [
      {
        id: 'gated',
        title: 'Gated',
        items: [
          {
            id: 'tv-only',
            kind: 'notice',
            content: 'TV only',
            platforms: ['tv'],
          },
          {
            id: 'common',
            kind: 'notice',
            content: 'All platforms',
          },
        ],
      },
    ]

    const view = mount(<SettingsRenderer platform="standard" sections={sections} />)
    expect(view.container.textContent).not.toContain('TV only')
    expect(view.container.textContent).toContain('All platforms')
    view.unmount()
  })
})
