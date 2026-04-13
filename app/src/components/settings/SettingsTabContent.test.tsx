import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SettingsScreenModel } from '../../pages/SettingsPage.model'

vi.mock('../../lib/apiFetch', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('./SettingsRenderer', () => ({
  SettingsRenderer: ({ platform, sections }: { platform: string; sections: Array<{ id: string; title?: string }> }) => (
    <div data-testid={`renderer-${platform}`}>
      {sections.map((section) => (
        <div key={section.id}>{section.title ?? section.id}</div>
      ))}
    </div>
  ),
  settingsRendererStyles: {
    rowLabel: 'rowLabel',
    rowDescription: 'rowDescription',
    controlButton: 'controlButton',
    controlButtonTv: 'controlButtonTv',
    controlButtonDanger: 'controlButtonDanger',
    controlSelect: 'controlSelect',
    notice: 'notice',
  },
}))

vi.mock('../ui/InputDialog', () => ({
  InputDialog: () => null,
}))

vi.mock('../../stores/authStore', () => ({
  useAuthStore: () => ({
    refreshSession: vi.fn(),
    logout: vi.fn(),
  }),
}))

import { SettingsTabContent } from './SettingsTabContent'
import { apiFetch } from '../../lib/apiFetch'

const apiFetchMock = vi.mocked(apiFetch)

function createModel(overrides: Partial<SettingsScreenModel> = {}): SettingsScreenModel {
  return {
    activeTab: 'streaming',
    effectiveTab: 'streaming',
    currentProfileId: 'profile-1',
    currentProfileName: 'Profile 1',
    isGuestMode: false,
    tabItems: [],
    navigation: {
      goBack: vi.fn(),
    },
    actions: {
      setActiveTab: vi.fn(),
      handleProfileChange: vi.fn(),
      handleProfilesLoaded: vi.fn(),
    },
    ...overrides,
  }
}

function mount(element: React.ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  act(() => {
    root.render(element)
  })

  return {
    container,
    rerender: (nextElement: React.ReactElement) => {
      act(() => {
        root.render(nextElement)
      })
    },
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

beforeEach(() => {
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
  apiFetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ data: {} }),
  })
})

afterEach(() => {
  vi.clearAllMocks()
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = false
  document.body.innerHTML = ''
})

describe('SettingsTabContent (streaming tab)', () => {
  it('renders shared streaming settings sections for standard platform', () => {
    const view = mount(
      <SettingsTabContent
        model={createModel()}
        platform="standard"
      />,
    )

    expect(view.container.textContent).toContain('Playback')
    expect(view.container.textContent).toContain('Stream Display')
    expect(view.container.textContent).toContain('Sorting and Filtering')
    view.unmount()
  })

  it('renders TV settings sections for tv platform', () => {
    const view = mount(
      <SettingsTabContent
        model={createModel()}
        platform="tv"
      />,
    )

    expect(view.container.textContent).toContain('Playback')
    expect(view.container.textContent).toContain('Stream Display')
    expect(view.container.textContent).toContain('Sorting and Filtering')
    view.unmount()
  })

  it('can switch between standard and tv platforms without hook-order crashes', () => {
    const model = createModel()
    const view = mount(<SettingsTabContent model={model} platform="standard" />)
    expect(view.container.textContent).toContain('Playback')

    view.rerender(<SettingsTabContent model={model} platform="tv" />)
    expect(view.container.textContent).toContain('Playback')

    view.rerender(<SettingsTabContent model={model} platform="standard" />)
    expect(view.container.textContent).toContain('Playback')

    view.unmount()
  })
})
