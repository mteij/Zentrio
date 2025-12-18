import { Stream, Manifest, MetaDetail } from './types'

export interface FilterOptions {
  required?: string[]
  excluded?: string[]
  included?: string[]
  preferred?: string[]
}

export interface StreamConfig {
  filters: {
    cache: {
      cached: boolean
      uncached: boolean
      applyMode: 'OR' | 'AND'
    }
    resolution: FilterOptions
    encode: FilterOptions
    streamType: FilterOptions
    visualTag: FilterOptions
    audioTag: FilterOptions
    audioChannel: FilterOptions
    language: FilterOptions
    seeders: {
      required?: [number, number][]
      excluded?: [number, number][]
      included?: [number, number][]
      applyTo?: string[]
    }
    matching: {
      title: {
        enabled: boolean
        mode: 'Exact' | 'Partial'
        tmdbToken?: string
      }
      seasonEpisode: {
        enabled: boolean
      }
    }
    keyword: FilterOptions
    regex: FilterOptions
    size: {
      movies?: { min: number, max: number }
      series?: { min: number, max: number }
      resolutionSpecific?: Record<string, { min: number, max: number }>
    }
  }
  limits: {
    maxResults?: number
    perService?: number
    perAddon?: number
    perResolution?: number
  }
  deduplication: {
    mode: 'Single Result' | 'Per Service' | 'Per Addon'
    detection: {
      filename: boolean
      infoHash: boolean
      smartDetect: boolean
    }
  }
  sorting: {
    global?: string[]
    movies?: string[]
    series?: string[]
    anime?: string[]
    cached?: string[]
    uncached?: string[]
  }
  // Extended sorting config with direction support
  sortingConfig?: {
    items: {
      id: string
      enabled: boolean
      direction: 'asc' | 'desc'
    }[]
  }
}


export interface ParsedStream {
  original: Stream
  addon: Manifest
  parsed: {
    resolution?: string
    encode?: string[]
    visualTags?: string[]
    audioTags?: string[]
    audioChannels?: string[]
    languages?: string[]
    size?: number // in bytes
    seeders?: number
    isCached?: boolean
    streamType?: string // p2p, debrid, http, usenet
    filename?: string
    infoHash?: string
    title?: string
    year?: number
    season?: number
    episode?: number
    group?: string
  }
  score: number
}

export class StreamProcessor {
  private config: StreamConfig
  private platform?: string

  constructor(config: StreamConfig, platform?: string) {
    this.config = config
    this.platform = platform
  }

  public process(streams: { stream: Stream, addon: Manifest }[], meta: MetaDetail): ParsedStream[] {
    // 1. Parse streams
    let parsedStreams = streams.map(s => this.parseStream(s.stream, s.addon))

    // 2. Filter streams
    parsedStreams = this.filterStreams(parsedStreams, meta)

    // 3. Sort streams
    parsedStreams = this.sortStreams(parsedStreams, meta)

    // 4. Deduplicate streams
    parsedStreams = this.deduplicateStreams(parsedStreams)

    // 5. Apply limits
    parsedStreams = this.applyLimits(parsedStreams)

    return parsedStreams
  }

  private parseStream(stream: Stream, addon: Manifest): ParsedStream {
    const title = stream.title || stream.name || ''
    const description = stream.description || ''
    const combined = `${title} ${description}`.toLowerCase()

    const parsed: ParsedStream['parsed'] = {
      encode: [],
      visualTags: [],
      audioTags: [],
      audioChannels: [],
      languages: []
    }

    // Resolution
    if (combined.includes('4k') || combined.includes('2160p') || combined.includes('uhd')) parsed.resolution = '4k'
    else if (combined.includes('1080p') || combined.includes('fhd')) parsed.resolution = '1080p'
    else if (combined.includes('720p') || combined.includes('hd')) parsed.resolution = '720p'
    else if (combined.includes('480p') || combined.includes('sd')) parsed.resolution = '480p'
    else parsed.resolution = 'unknown'

    // Encode
    if (combined.includes('hevc') || combined.includes('x265') || combined.includes('h265')) parsed.encode?.push('hevc')
    if (combined.includes('avc') || combined.includes('x264') || combined.includes('h264')) parsed.encode?.push('avc')
    if (combined.includes('av1')) parsed.encode?.push('av1')

    // Visual Tags
    if (combined.includes('hdr')) parsed.visualTags?.push('hdr')
    if (combined.includes('dv') || combined.includes('dolby vision')) parsed.visualTags?.push('dv')
    if (combined.includes('10bit')) parsed.visualTags?.push('10bit')

    // Audio Tags
    const audioPatterns = {
        atmos: /\b(atmos)\b/i,
        dts: /\b(dts(-?hd)?)(?:$|[^\w]|\d|_)/i,
        truehd: /\b(truehd)\b/i,
        eac3: /\b(ddp|eac-?3|dd\+)(?:$|[^\w]|\d|_)/i,
        ac3: /\b(ac-?3|dd[\s\.]?5\.?1)(?:$|[^\w]|\d|_)/i,
        aac: /\b(aac)(?:$|[^\w]|\d|_)/i,
        mp3: /\b(mp3)(?:$|[^\w]|\d|_)/i,
        opus: /\b(opus)(?:$|[^\w]|\d|_)/i,
        flac: /\b(flac)(?:$|[^\w]|\d|_)/i
    }

    if (audioPatterns.atmos.test(combined)) parsed.audioTags?.push('atmos')
    if (audioPatterns.dts.test(combined)) parsed.audioTags?.push('dts')
    if (audioPatterns.truehd.test(combined)) parsed.audioTags?.push('truehd')
    if (audioPatterns.eac3.test(combined)) parsed.audioTags?.push('eac3')
    if (audioPatterns.ac3.test(combined)) parsed.audioTags?.push('ac3')
    
    if (audioPatterns.aac.test(combined)) parsed.audioTags?.push('aac')
    if (audioPatterns.mp3.test(combined)) parsed.audioTags?.push('mp3')
    if (audioPatterns.opus.test(combined)) parsed.audioTags?.push('opus')
    if (audioPatterns.flac.test(combined)) parsed.audioTags?.push('flac')
    
    if (combined.includes('multi') || combined.includes('dual') || combined.match(/[a-z]{3}-[a-z]{3}/i)) parsed.audioTags?.push('multi')

    // Audio Channels
    if (combined.match(/\b7\.1(?!\.?\d)\b/) || combined.match(/(?:dd|ddp|truehd|dts|dtshd|flac)7\.1/i)) parsed.audioChannels?.push('7.1')
    if (combined.match(/\b5\.1(?!\.?\d)\b/) || combined.match(/(?:dd|ddp|truehd|dts|dtshd|flac)5\.1/i)) parsed.audioChannels?.push('5.1')
    if (combined.match(/\b2\.0(?!\.?\d)\b/) || combined.match(/(?:aac|mp3|flac|dd|ddp)2\.0/i)) parsed.audioChannels?.push('2.0')

    // Size (Regex for size like 1.5GB, 1000MB)
    const sizeMatch = combined.match(/(\d+(?:\.\d+)?)\s*(gb|mb|kb)/i)
    if (sizeMatch) {
      const val = parseFloat(sizeMatch[1])
      const unit = sizeMatch[2].toLowerCase()
      if (unit === 'gb') parsed.size = val * 1024 * 1024 * 1024
      if (unit === 'mb') parsed.size = val * 1024 * 1024
      if (unit === 'kb') parsed.size = val * 1024
    }

    // Seeders (Regex for seeders like 👤 123 or S: 123)
    const seedersMatch = combined.match(/(?:👤|s:|seeders:?)\s*(\d+)/i)
    if (seedersMatch) {
      parsed.seeders = parseInt(seedersMatch[1])
    }

    // Stream Type & Cache Status
    // This is heuristic. Addons usually indicate cached status in title or description.
    // e.g. "[RD+]" or "Cached"
    if (combined.includes('cached') || title.includes('+')) {
      parsed.isCached = true
    } else {
      parsed.isCached = false
    }

    // Determine stream type based on addon or content
    if (stream.url?.startsWith('magnet:') || stream.infoHash) {
      parsed.streamType = 'p2p'
    } else if (stream.url?.startsWith('http')) {
      parsed.streamType = 'http'
    } else {
      parsed.streamType = 'unknown'
    }
    
    // If it's a debrid addon (usually http url but from debrid service), we might need more info.
    // For now, assume if it's cached, it's likely debrid or similar if not p2p.
    if (parsed.isCached && parsed.streamType === 'http') {
        parsed.streamType = 'debrid'
    }

    parsed.title = title
    parsed.infoHash = stream.infoHash

    return {
      original: stream,
      addon,
      parsed,
      score: 0
    }
  }

  private filterStreams(streams: ParsedStream[], meta: MetaDetail): ParsedStream[] {
    const { filters } = this.config
    
    if (!filters) return streams;

    return streams.filter(s => {
      // Cache Filter
      if (filters.cache) {
        if (s.parsed.isCached && !filters.cache.cached) return false
        if (!s.parsed.isCached && !filters.cache.uncached) return false
      }

      // Resolution Filter
      if (!this.checkFilter(filters.resolution, [s.parsed.resolution || ''])) return false

      // Encode Filter
      if (!this.checkFilter(filters.encode, s.parsed.encode)) return false

      // Visual Tag Filter
      if (!this.checkFilter(filters.visualTag, s.parsed.visualTags)) return false

      // Audio Tag Filter
      if (!this.checkFilter(filters.audioTag, s.parsed.audioTags)) return false

      // Mark unsupported audio for web
      if (this.platform === 'web') {
          // List of audio codecs not natively supported by browsers (generally)
          // AC3 (Dolby Digital), EAC3 (DD+), DTS, TrueHD
          const unsupportedCodecs = ['ac3', 'eac3', 'dts', 'truehd'];
          
          let isUnsupported = false;
          
          // Check if any detected tag is unsupported
          if (s.parsed.audioTags && s.parsed.audioTags.some(tag => unsupportedCodecs.includes(tag))) {
              isUnsupported = true;
          }
          
          if (isUnsupported) {
               if (!s.original.behaviorHints) {
                   s.original.behaviorHints = {};
               }
               s.original.behaviorHints.notWebReady = true;
          }
      }

      // Size Filter
      if (filters.size && s.parsed.size) {
        const sizeGB = s.parsed.size / (1024 * 1024 * 1024)
        const type = meta.type === 'movie' ? 'movies' : 'series'
        const limits = filters.size[type]
        if (limits) {
          if (sizeGB < limits.min || sizeGB > limits.max) return false
        }
        
        // Resolution specific
        if (filters.size.resolutionSpecific && s.parsed.resolution) {
            const resLimits = filters.size.resolutionSpecific[s.parsed.resolution]
            if (resLimits) {
                if (sizeGB < resLimits.min || sizeGB > resLimits.max) return false
            }
        }
      }

      // Seeders Filter
      if (filters.seeders && s.parsed.seeders !== undefined) {
        // Check if seeders filter applies to this stream type
        if (!filters.seeders.applyTo || (s.parsed.streamType && filters.seeders.applyTo.includes(s.parsed.streamType))) {
            if (filters.seeders.required) {
                const inRange = filters.seeders.required.some(([min, max]) => s.parsed.seeders! >= min && s.parsed.seeders! <= max)
                if (!inRange) return false
            }
            if (filters.seeders.excluded) {
                const inRange = filters.seeders.excluded.some(([min, max]) => s.parsed.seeders! >= min && s.parsed.seeders! <= max)
                if (inRange) return false
            }
        }
      }
      
      // Keyword Filter
      if (filters.keyword) {
          const title = s.parsed.title?.toLowerCase() || ''
          if (filters.keyword.required && !filters.keyword.required.some(k => title.includes(k.toLowerCase()))) return false
          if (filters.keyword.excluded && filters.keyword.excluded.some(k => title.includes(k.toLowerCase()))) return false
      }

      return true
    })
  }

  private checkFilter(options: FilterOptions | undefined, values: string[] | undefined): boolean {
    if (!options || !values) return true

    // Included: Prevents streams from being filtered out by other filters (Not implemented fully here as it requires complex logic, 
    // but usually it means if it matches included, we skip other checks? 
    // The prompt says: "Prevents streams that have at least one of the selected attributes from being filtered out by all other exclude/required filters."
    // This implies 'Included' overrides 'Excluded' and 'Required' failures?
    // For simplicity, let's check Required and Excluded first.
    
    const hasIncluded = options.included && values.some(v => options.included!.includes(v))
    if (hasIncluded) return true

    if (options.required && options.required.length > 0) {
      const hasRequired = values.some(v => options.required!.includes(v))
      if (!hasRequired) return false
    }

    if (options.excluded && options.excluded.length > 0) {
      const hasExcluded = values.some(v => options.excluded!.includes(v))
      if (hasExcluded) return false
    }

    return true
  }

  private sortStreams(streams: ParsedStream[], meta: MetaDetail): ParsedStream[] {
    // Get sorting configuration
    const sortingItems = this.config.sortingConfig?.items?.filter(i => i.enabled) || []
    
    console.log(`[StreamProcessor] Sorting with ${sortingItems.length} criteria:`, sortingItems.map(i => `${i.id}(${i.direction})`).join(', '))
    
    // If no sorting config, fall back to score-based sorting
    if (sortingItems.length === 0) {

      // Calculate scores based on preferred options (legacy behavior)
      streams.forEach(s => {
        s.score = 0
        const { filters } = this.config
        
        if (!filters) return;

        // Preferred Resolution
        if (filters.resolution?.preferred && s.parsed.resolution) {
            const idx = filters.resolution.preferred.indexOf(s.parsed.resolution)
            if (idx !== -1) {
                s.score += (filters.resolution.preferred.length - idx) * 10
            }
        }
        
        // Preferred Keywords
        if (filters.keyword?.preferred && s.parsed.title) {
            filters.keyword.preferred.forEach((k, i) => {
                if (s.parsed.title!.toLowerCase().includes(k.toLowerCase())) {
                    s.score += (filters.keyword!.preferred!.length - i) * 5
                }
            })
        }
        
        // Seeders (more is better)
        if (s.parsed.seeders) {
            s.score += Math.min(s.parsed.seeders, 100) / 10
        }
        
        // Size (larger is usually better quality, up to a point)
        if (s.parsed.size) {
            s.score += Math.min(s.parsed.size / (1024*1024*1024), 50)
        }
      })

      return streams.sort((a, b) => b.score - a.score)
    }

    // Resolution priority map (higher = better)
    const resolutionPriority: Record<string, number> = {
      '4k': 100, '2160p': 100,
      '1440p': 80,
      '1080p': 60, 'fhd': 60,
      '720p': 40, 'hd': 40,
      '480p': 20, 'sd': 20,
      'unknown': 0
    }

    // Sort using configured criteria in priority order
    return streams.sort((a, b) => {
      for (const sortItem of sortingItems) {
        let comparison = 0
        const multiplier = sortItem.direction === 'desc' ? 1 : -1

        switch (sortItem.id) {
          case 'cached':
            // Cached streams should sort higher (or lower if asc)
            const aCached = a.parsed.isCached ? 1 : 0
            const bCached = b.parsed.isCached ? 1 : 0
            comparison = (bCached - aCached) * multiplier
            break

          case 'resolution':
            const aRes = resolutionPriority[a.parsed.resolution?.toLowerCase() || 'unknown'] || 0
            const bRes = resolutionPriority[b.parsed.resolution?.toLowerCase() || 'unknown'] || 0
            comparison = (bRes - aRes) * multiplier
            break

          case 'size':
            const aSize = a.parsed.size || 0
            const bSize = b.parsed.size || 0
            comparison = (bSize - aSize) * multiplier
            break

          case 'seeders':
            const aSeeders = a.parsed.seeders || 0
            const bSeeders = b.parsed.seeders || 0
            comparison = (bSeeders - aSeeders) * multiplier
            break

          case 'quality':
            // Quality based on encode and visual tags
            const aQuality = (a.parsed.visualTags?.length || 0) + (a.parsed.encode?.includes('hevc') ? 2 : 0) + (a.parsed.encode?.includes('av1') ? 3 : 0)
            const bQuality = (b.parsed.visualTags?.length || 0) + (b.parsed.encode?.includes('hevc') ? 2 : 0) + (b.parsed.encode?.includes('av1') ? 3 : 0)
            comparison = (bQuality - aQuality) * multiplier
            break

          case 'language':
            // Language preference - check if any preferred languages match
            const preferredLangs = this.config.filters?.language?.preferred || []
            const aHasPreferred = a.parsed.languages?.some(l => preferredLangs.includes(l)) ? 1 : 0
            const bHasPreferred = b.parsed.languages?.some(l => preferredLangs.includes(l)) ? 1 : 0
            comparison = (bHasPreferred - aHasPreferred) * multiplier
            break

          default:
            break
        }

        if (comparison !== 0) return comparison
      }
      return 0
    })
  }


  private deduplicateStreams(streams: ParsedStream[]): ParsedStream[] {
    const { deduplication } = this.config
    if (!deduplication) return streams

    const uniqueMap = new Map<string, ParsedStream>()

    streams.forEach(s => {
      let key = ''
      if (deduplication.detection.infoHash && s.parsed.infoHash) {
        key = s.parsed.infoHash
      } else if (deduplication.detection.filename && s.parsed.title) {
        // Simple fuzzy match key (remove special chars, lowercase)
        key = s.parsed.title.toLowerCase().replace(/[^a-z0-9]/g, '')
      } else {
        // Fallback to unique ID if available or skip
        key = s.original.url || Math.random().toString()
      }

      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, s)
      } else {
        // If duplicate found, keep the one with higher score or based on mode
        const existing = uniqueMap.get(key)!
        
        // Logic for Single Result / Per Service / Per Addon
        // For now, just keep the one with higher score
        if (s.score > existing.score) {
            uniqueMap.set(key, s)
        }
      }
    })

    return Array.from(uniqueMap.values())
  }

  private applyLimits(streams: ParsedStream[]): ParsedStream[] {
    const { limits } = this.config
    if (!limits) return streams

    let result = streams

    if (limits.maxResults) {
      result = result.slice(0, limits.maxResults)
    }

    // Per Service/Addon limits would require grouping and slicing
    if (limits.perAddon) {
        const addonCounts = new Map<string, number>()
        result = result.filter(s => {
            const count = addonCounts.get(s.addon.id) || 0
            if (count < limits.perAddon!) {
                addonCounts.set(s.addon.id, count + 1)
                return true
            }
            return false
        })
    }

    return result
  }
}