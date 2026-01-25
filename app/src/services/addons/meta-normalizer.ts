// Meta Video Normalizer
// Utility for normalizing meta video arrays (episodes, etc.)

/**
 * Stremio can show addon-provided duplicates, but the list should still be ordered S1..SX, E1..EX.
 * This normalizer:
 * - keeps duplicates (no dedupe),
 * - sanitizes stream/release blobs that some addons wrongly embed into meta videos,
 * - applies a stable sort by (season, episode), pushing unknowns (0/NaN) to the end.
 */
export function normalizeMetaVideos(videos: any[]): any[] {
    if (!Array.isArray(videos) || videos.length === 0) return []

    const looksLikeStreamText = (text: unknown): boolean => {
        if (typeof text !== 'string') return false
        const t = text.toLowerCase()
        if (t.includes('full title:')) return true
        if (t.includes('size:')) return true
        if (/\b\d+(?:\.\d+)?\s*(gb|mb)\b/i.test(text)) return true
        if (t.includes('seeders') || t.includes('magnet:') || t.includes('infohash') || t.includes('hash:')) return true
        return false
    }

    const getSeason = (v: any) => {
        const n = Number(v?.season ?? 0)
        return Number.isFinite(n) ? n : 0
    }

    const getEpisode = (v: any) => {
        const n = Number(v?.episode ?? v?.number ?? 0)
        return Number.isFinite(n) ? n : 0
    }

    const sanitized = videos.map((v: any, idx: number) => {
        const out: any = { ...(v || {}) }

        // Remove stream-like text from title/name
        if (looksLikeStreamText(out.title)) {
            out.title = `Episode ${getEpisode(v) || idx + 1}`
        }
        if (looksLikeStreamText(out.name)) {
            out.name = undefined
        }
        if (looksLikeStreamText(out.overview)) {
            out.overview = undefined
        }

        // Remove stream arrays that shouldn't be in meta videos
        if (Array.isArray(out.streams)) {
            delete out.streams
        }

        return out
    })

    // Stable sort by (season, episode)
    return sanitized.sort((a, b) => {
        const sA = getSeason(a)
        const sB = getSeason(b)
        const eA = getEpisode(a)
        const eB = getEpisode(b)

        // Push unknowns (season=0 or episode=0) to the end
        const aUnknown = sA === 0 && eA === 0
        const bUnknown = sB === 0 && eB === 0
        
        if (aUnknown && !bUnknown) return 1
        if (!aUnknown && bUnknown) return -1

        // Sort by season first, then episode
        if (sA !== sB) return sA - sB
        return eA - eB
    })
}
