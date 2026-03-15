import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Manifest, Stream } from '../services/addons/types'

const { apiFetchJsonMock, getAddonClientMock } = vi.hoisted(() => ({
  apiFetchJsonMock: vi.fn(),
  getAddonClientMock: vi.fn(),
}))

vi.mock('./apiFetch', () => ({
  apiFetchJson: apiFetchJsonMock,
}))

vi.mock('./addon-client', () => ({
  getAddonClient: getAddonClientMock,
}))

vi.mock('./auth-client', () => ({
  isTauri: () => false,
}))

vi.mock('../utils/client-logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

import { resolveStreamsProgressive } from './stream-resolver'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function createManifest(id: string, name: string): Manifest {
  return {
    id,
    name,
    version: '1.0.0',
    description: `${name} test manifest`,
    resources: ['stream'],
    types: ['movie'],
    catalogs: [],
  }
}

describe('resolveStreamsProgressive', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('loads addon streams in parallel while preserving final addon order', async () => {
    const slowStreams = deferred<Stream[]>()
    const fastStreams = deferred<Stream[]>()

    apiFetchJsonMock.mockImplementation(async (url: string) => {
      if (url.startsWith('/api/addons/profile/')) {
        return [
          { id: 1, manifest_url: 'https://addon-a.example/manifest.json', name: 'Addon A' },
          { id: 2, manifest_url: 'https://addon-b.example/manifest.json', name: 'Addon B' },
        ]
      }

      if (url.startsWith('/api/streaming/settings')) {
        return { data: undefined }
      }

      if (url.startsWith('/api/streaming/details/')) {
        return {
          meta: {
            id: 'tt1234567',
            type: 'movie',
            name: 'Parallel Test Movie',
          },
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    getAddonClientMock.mockImplementation((manifestUrl: string) => {
      if (manifestUrl.includes('addon-a')) {
        return {
          init: vi.fn().mockResolvedValue(createManifest('addon-a', 'Addon A')),
          getStreams: vi.fn(() => slowStreams.promise),
          getMeta: vi.fn(),
        }
      }

      if (manifestUrl.includes('addon-b')) {
        return {
          init: vi.fn().mockResolvedValue(createManifest('addon-b', 'Addon B')),
          getStreams: vi.fn(() => fastStreams.promise),
          getMeta: vi.fn(),
        }
      }

      throw new Error(`Unexpected addon client: ${manifestUrl}`)
    })

    const addonResultOrder: string[] = []
    const handle = resolveStreamsProgressive(
      {
        type: 'movie',
        id: 'tt1234567',
        profileId: '42',
      },
      {
        onAddonResult: ({ addon }) => {
          addonResultOrder.push(addon.id)
        },
      }
    )

    await flushPromises()

    fastStreams.resolve([{ name: 'Fast stream' }])
    await flushPromises()

    expect(addonResultOrder).toEqual(['addon-b'])

    slowStreams.resolve([{ name: 'Slow stream' }])
    const payload = await handle.done

    expect(addonResultOrder).toEqual(['addon-b', 'addon-a'])
    expect(payload).not.toBeNull()
    expect(payload?.allStreams.map((item) => item.addon.id)).toEqual(['addon-a', 'addon-b'])
  })
})
