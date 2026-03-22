const loadedImages = new Set<string>()
const pendingImages = new Map<string, Promise<void>>()

export function preloadImage(src?: string | null): Promise<void> {
  if (!src) return Promise.resolve()
  if (loadedImages.has(src)) return Promise.resolve()

  const pending = pendingImages.get(src)
  if (pending) return pending

  const request = new Promise<void>((resolve) => {
    const img = new Image()
    let finished = false

    const finish = () => {
      if (finished) return
      finished = true
      loadedImages.add(src)
      pendingImages.delete(src)
      resolve()
    }

    img.decoding = 'async'
    img.onload = () => {
      if (typeof img.decode === 'function') {
        void img.decode().catch(() => undefined).finally(finish)
        return
      }

      finish()
    }
    img.onerror = () => {
      pendingImages.delete(src)
      resolve()
    }
    img.src = src

    if (img.complete) {
      if (typeof img.decode === 'function') {
        void img.decode().catch(() => undefined).finally(finish)
        return
      }

      finish()
    }
  })

  pendingImages.set(src, request)
  return request
}

export function preloadImages(sources: Array<string | null | undefined>, limit = sources.length) {
  const nextSources = sources.filter((source): source is string => Boolean(source)).slice(0, limit)
  for (const source of nextSources) {
    void preloadImage(source)
  }
}
