import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  navigateMock,
  searchParams,
  setSearchParamsMock,
  apiFetchJsonMock,
  apiFetchMock,
  signInEmailMock,
  signInMagicLinkMock,
  signInEmailOtpMock,
  signUpEmailMock,
  sendVerificationOtpMock,
  socialMock,
  oauth2Mock,
  loginMock,
  getRedirectPathMock,
  setDurationMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  searchParams: new URLSearchParams(),
  setSearchParamsMock: vi.fn(),
  apiFetchJsonMock: vi.fn(),
  apiFetchMock: vi.fn(),
  signInEmailMock: vi.fn(),
  signInMagicLinkMock: vi.fn(),
  signInEmailOtpMock: vi.fn(),
  signUpEmailMock: vi.fn(),
  sendVerificationOtpMock: vi.fn(),
  socialMock: vi.fn(),
  oauth2Mock: vi.fn(),
  loginMock: vi.fn(),
  getRedirectPathMock: vi.fn(),
  setDurationMock: vi.fn(),
}))

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useSearchParams: () => [searchParams, setSearchParamsMock],
}))

vi.mock('../../lib/apiFetch', () => ({
  apiFetch: apiFetchMock,
  apiFetchJson: apiFetchJsonMock,
}))

vi.mock('../../lib/app-mode', () => ({
  appMode: {
    set: vi.fn(),
  },
}))

vi.mock('../../lib/auth-client', () => ({
  authClient: {
    signIn: {
      email: signInEmailMock,
      magicLink: signInMagicLinkMock,
      emailOtp: signInEmailOtpMock,
      social: socialMock,
      oauth2: oauth2Mock,
    },
    signUp: {
      email: signUpEmailMock,
    },
    emailOtp: {
      sendVerificationOtp: sendVerificationOtpMock,
    },
  },
  getClientUrl: () => 'http://localhost:5173',
  getServerUrl: () => 'http://localhost:3000',
  isTauri: () => false,
}))

vi.mock('../../hooks/useLoginBehavior', () => ({
  useLoginBehavior: () => ({
    getRedirectPath: getRedirectPathMock,
  }),
  getLoginBehaviorRedirectPath: () => '/profiles',
}))

vi.mock('../../hooks/useSessionDuration', () => ({
  useSessionDuration: () => ({
    duration: 'session',
    setDuration: setDurationMock,
  }),
}))

vi.mock('../../stores/authStore', () => {
  const useAuthStore: any = () => ({})
  useAuthStore.getState = () => ({ login: loginMock })
  return { useAuthStore }
})

vi.mock('../legal/HostedServiceLegalNotice', () => ({
  HostedServiceLegalNotice: () => null,
}))

vi.mock('./EmailVerificationModal', () => ({
  EmailVerificationModal: () => <div>EmailVerificationModal</div>,
}))

import { AuthForms } from './AuthForms'

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

function findButton(container: HTMLElement, text: string) {
  const button = Array.from(container.querySelectorAll('button')).find((entry) => entry.textContent?.includes(text))
  if (!button) throw new Error(`Button not found: ${text}`)
  return button
}

function click(container: HTMLElement, text: string) {
  const button = findButton(container, text)
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

function setInput(container: HTMLElement, selector: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(selector)
  if (!input) throw new Error(`Input not found: ${selector}`)

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
  searchParams.forEach((_, key) => searchParams.delete(key))
  apiFetchJsonMock.mockResolvedValue({
    google: false,
    github: false,
    discord: false,
    oidcProviders: [],
  })
  apiFetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })

  signInEmailMock.mockResolvedValue({ data: {}, error: null })
  signInMagicLinkMock.mockResolvedValue({ error: null })
  signInEmailOtpMock.mockResolvedValue({ data: {}, error: null })
  signUpEmailMock.mockResolvedValue({ error: null })
  sendVerificationOtpMock.mockResolvedValue({ error: null })

  getRedirectPathMock.mockReturnValue('/profiles')
})

afterEach(() => {
  vi.clearAllMocks()
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = false
  document.body.innerHTML = ''
})

describe('AuthForms', () => {
  it('submits email+password signin flow', async () => {
    const view = mount(<AuthForms mode="signin" />)
    await flushPromises()

    click(view.container, 'Continue with Email')
    setInput(view.container, '#email', 'user@example.com')
    setInput(view.container, '#password', 'topsecret')
    click(view.container, 'Sign In')
    await flushPromises()

    expect(signInEmailMock).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'topsecret',
      callbackURL: 'http://localhost:5173/profiles',
    })
    expect(navigateMock).toHaveBeenCalledWith('/profiles')

    view.unmount()
  })

  it('handles OTP signin in two steps', async () => {
    const view = mount(<AuthForms mode="signin" />)
    await flushPromises()

    click(view.container, 'Continue with Email')
    click(view.container, 'Code')
    setInput(view.container, '#email', 'otp@example.com')
    click(view.container, 'Send Code')
    await flushPromises()

    expect(sendVerificationOtpMock).toHaveBeenCalledWith({
      email: 'otp@example.com',
      type: 'sign-in',
    })

    setInput(view.container, '#otp', '123456')
    click(view.container, 'Sign In')
    await flushPromises()

    expect(signInEmailOtpMock).toHaveBeenCalledWith({
      email: 'otp@example.com',
      otp: '123456',
    })

    view.unmount()
  })

  it('submits signup flow and opens verification modal', async () => {
    const view = mount(<AuthForms mode="signup" />)
    await flushPromises()

    click(view.container, 'Continue with Email')
    setInput(view.container, '#username', 'john')
    setInput(view.container, '#email', 'john@example.com')
    setInput(view.container, '#password', 'password123')
    click(view.container, 'Create Account')
    await flushPromises()

    expect(signUpEmailMock).toHaveBeenCalledWith({
      email: 'john@example.com',
      password: 'password123',
      name: 'john',
      username: 'john',
      callbackURL: 'http://localhost:5173/profiles',
    })

    expect(sendVerificationOtpMock).toHaveBeenCalledWith({
      email: 'john@example.com',
      type: 'email-verification',
    })
    expect(view.container.textContent).toContain('EmailVerificationModal')

    view.unmount()
  })
})
