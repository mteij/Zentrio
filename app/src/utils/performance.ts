export type PerfEventName =
  | 'api_request'
  | 'api_request_error'
  | 'streams_seed_applied'
  | 'streams_first_playable'
  | 'streams_complete'
  | 'streams_server_timing'

export interface PerfEvent {
  name: PerfEventName
  at: string
  data?: Record<string, unknown>
}

const MAX_EVENTS = 300

const getBuffer = (): PerfEvent[] => {
  if (typeof window === 'undefined') return []
  const win = window as Window & { __ZENTRIO_PERF__?: PerfEvent[] }
  if (!win.__ZENTRIO_PERF__) win.__ZENTRIO_PERF__ = []
  return win.__ZENTRIO_PERF__
}

export const recordPerfEvent = (name: PerfEventName, data?: Record<string, unknown>) => {
  if (typeof window === 'undefined') return

  const buffer = getBuffer()
  buffer.push({
    name,
    at: new Date().toISOString(),
    data
  })

  if (buffer.length > MAX_EVENTS) {
    buffer.splice(0, buffer.length - MAX_EVENTS)
  }
}

export const getPerfEvents = (): PerfEvent[] => {
  return [...getBuffer()]
}

export const clearPerfEvents = () => {
  if (typeof window === 'undefined') return
  const win = window as Window & { __ZENTRIO_PERF__?: PerfEvent[] }
  win.__ZENTRIO_PERF__ = []
}

