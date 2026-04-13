import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { authClientMock, toastMock } = vi.hoisted(() => ({
  authClientMock: {
    getSession: vi.fn(),
    twoFactor: {
      enable: vi.fn(),
      verifyTotp: vi.fn(),
      disable: vi.fn(),
    },
  },
  toastMock: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../../lib/auth-client', () => ({
  authClient: authClientMock,
}))

vi.mock('sonner', () => ({
  toast: toastMock,
}))

vi.mock('../ui/Modal', () => ({
  Modal: ({ isOpen, title, children }: { isOpen: boolean; title?: string; children: React.ReactNode }) => (
    isOpen ? (
      <div>
        {title ? <h2>{title}</h2> : null}
        {children}
      </div>
    ) : null
  ),
}))

import { TwoFactorSetupModal } from './TwoFactorSetupModal'

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
  }
}

function clickByText(container: HTMLElement, text: string) {
  const button = Array.from(container.querySelectorAll('button')).find((entry) => entry.textContent?.includes(text))
  if (!button) throw new Error(`Button not found: ${text}`)

  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

function changeInputByPlaceholder(container: HTMLElement, placeholder: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`input[placeholder="${placeholder}"]`)
  if (!input) throw new Error(`Input not found: ${placeholder}`)

  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  if (!valueSetter) throw new Error('Missing input value setter')

  act(() => {
    valueSetter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve()
  })
}

beforeEach(() => {
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
  authClientMock.getSession.mockResolvedValue({ data: { user: { twoFactorEnabled: false } } })
  authClientMock.twoFactor.enable.mockResolvedValue({ data: { totpURI: 'otpauth://test', backupCodes: ['ABCD-EFGH'] }, error: null })
  authClientMock.twoFactor.verifyTotp.mockResolvedValue({ data: { ok: true }, error: null })
  authClientMock.twoFactor.disable.mockResolvedValue({ error: null })
})

afterEach(() => {
  vi.clearAllMocks()
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = false
  document.body.innerHTML = ''
})

describe('TwoFactorSetupModal', () => {
  it('shows password-required message when account has no password', () => {
    const view = mount(
      <TwoFactorSetupModal
        hasPassword={false}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    )

    expect(view.container.textContent).toContain('Password Required')
    expect(view.container.textContent).toContain('Set Password first')
    view.unmount()
  })

  it('completes enable and verify flow, then calls onSuccess', async () => {
    const onSuccess = vi.fn()
    const view = mount(
      <TwoFactorSetupModal
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />,
    )

    await flushPromises()

    changeInputByPlaceholder(view.container, 'Enter your account password', 'secret')
    clickByText(view.container, 'Continue')
    await flushPromises()

    expect(authClientMock.twoFactor.enable).toHaveBeenCalledWith({ password: 'secret' })
    expect(view.container.textContent).toContain('Scan this QR code')

    changeInputByPlaceholder(view.container, '000000', '123456')
    clickByText(view.container, 'Verify & Activate')
    await flushPromises()

    expect(authClientMock.twoFactor.verifyTotp).toHaveBeenCalledWith({ code: '123456' })
    expect(view.container.textContent).toContain('2FA Enabled Successfully')

    clickByText(view.container, 'Done')
    expect(onSuccess).toHaveBeenCalledTimes(1)
    view.unmount()
  })

  it('disables existing 2FA when already enabled', async () => {
    authClientMock.getSession.mockResolvedValue({ data: { user: { twoFactorEnabled: true } } })
    const onSuccess = vi.fn()

    const view = mount(
      <TwoFactorSetupModal
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />,
    )

    await flushPromises()
    expect(view.container.textContent).toContain('2FA Enabled')

    changeInputByPlaceholder(view.container, 'Your account password', 'secret')
    clickByText(view.container, 'Disable 2FA')
    await flushPromises()

    expect(authClientMock.twoFactor.disable).toHaveBeenCalledWith({ password: 'secret' })
    expect(onSuccess).toHaveBeenCalledTimes(1)
    view.unmount()
  })
})
