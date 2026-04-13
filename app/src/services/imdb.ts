import { Database } from 'bun:sqlite'
import { createReadStream, createWriteStream, existsSync, mkdirSync, unlinkSync } from 'fs'
import { dirname, join } from 'path'
import { createInterface } from 'readline'
import { createGunzip } from 'zlib'
import { getConfig } from './envParser'
import { logger } from './logger'

// Configuration
const DB_PATH = join(process.cwd(), 'data', 'imdb', 'ratings.db')
const DATASET_URL = 'https://datasets.imdbws.com/title.ratings.tsv.gz'
const TEMP_DOWNLOAD_PATH = join(process.cwd(), 'data', 'imdb', 'title.ratings.tsv.gz')

let db: Database | null = null

// Initialize database connection
function getDb(): Database {
  if (db) return db

  // Ensure directory exists
  const dir = dirname(DB_PATH)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  db = new Database(DB_PATH)

  // WAL mode for better concurrency
  db.exec('PRAGMA journal_mode = WAL')

  // Create tables if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS ratings (
      tconst TEXT PRIMARY KEY,
      averageRating REAL,
      numVotes INTEGER
    )
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  return db
}

function getLastRefreshed(): Date | null {
  try {
    const database = getDb()
    const row = database.prepare('SELECT value FROM meta WHERE key = ?').get('last_refreshed') as
      | { value: string }
      | undefined
    return row ? new Date(row.value) : null
  } catch {
    return null
  }
}

function setLastRefreshed(date: Date): void {
  getDb()
    .prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)')
    .run('last_refreshed', date.toISOString())
}

export function getRating(imdbId: string): { averageRating: number; numVotes: number } | null {
  try {
    const database = getDb()
    const stmt = database.prepare('SELECT averageRating, numVotes FROM ratings WHERE tconst = ?')
    const result = stmt.get(imdbId) as { averageRating: number; numVotes: number } | undefined

    if (result) {
      return {
        averageRating: result.averageRating,
        numVotes: result.numVotes,
      }
    }
    return null
  } catch (error) {
    logger.error(`Failed to get IMDb rating for ${imdbId}:`, error)
    return null
  }
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.statusText}`)
  }

  if (!response.body) {
    throw new Error('Response body is empty')
  }

  const fileStream = createWriteStream(destPath)
  const reader = response.body.getReader()

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      fileStream.write(value)
    }
  } catch (error) {
    fileStream.destroy()
    await reader.cancel()
    throw error
  }

  fileStream.end()

  return new Promise((resolve, reject) => {
    fileStream.on('finish', resolve)
    fileStream.on('error', reject)
  })
}

export async function downloadAndProcessRatings() {
  if (isDownloading) {
    logger.warn('IMDb ratings update already in progress, skipping.')
    return
  }
  isDownloading = true
  logger.info('Starting IMDb ratings update...')
  const startTime = Date.now()
  let fileStream: any = null

  try {
    // Ensure directory exists
    const dir = dirname(TEMP_DOWNLOAD_PATH)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    // 1. Download
    logger.info(`Downloading ${DATASET_URL}...`)
    await downloadFile(DATASET_URL, TEMP_DOWNLOAD_PATH)
    logger.info('Download complete.')

    // 2. Process
    logger.info('Processing TSV file...')
    const database = getDb()

    // Prepare statement
    const insertStmt = database.prepare(`
      INSERT OR REPLACE INTO ratings (tconst, averageRating, numVotes)
      VALUES (?, ?, ?)
    `)

    const transaction = database.transaction((rows: any[]) => {
      for (const row of rows) {
        insertStmt.run(row.tconst, row.averageRating, row.numVotes)
      }
    })

    let processedCount = 0
    let batch: any[] = []
    const BATCH_SIZE = 10000

    fileStream = createReadStream(TEMP_DOWNLOAD_PATH)
    const gunzip = createGunzip()
    const stream = fileStream.pipe(gunzip)

    const rl = createInterface({
      input: stream,
      crlfDelay: Infinity,
    })

    let isHeader = true
    for await (const line of rl) {
      if (isHeader) {
        isHeader = false
        continue
      }

      const [tconst, averageRating, numVotes] = line.split('\t')

      if (tconst && averageRating && numVotes) {
        batch.push({
          tconst,
          averageRating: parseFloat(averageRating),
          numVotes: parseInt(numVotes, 10),
        })

        if (batch.length >= BATCH_SIZE) {
          transaction(batch)
          processedCount += batch.length
          batch = []
          if (processedCount % 100000 === 0) {
            logger.info(`Processed ${processedCount} ratings...`)
          }
        }
      }
    }

    // Insert remaining
    if (batch.length > 0) {
      transaction(batch)
      processedCount += batch.length
    }

    setLastRefreshed(new Date())
    logger.success(
      `IMDb ratings update complete. Processed ${processedCount} records in ${((Date.now() - startTime) / 1000).toFixed(1)}s`
    )
  } catch (error) {
    logger.error('Failed to update IMDb ratings:', error)
  } finally {
    // Cleanup
    try {
      if (fileStream) {
        fileStream.destroy()
      }
      if (existsSync(TEMP_DOWNLOAD_PATH)) {
        unlinkSync(TEMP_DOWNLOAD_PATH)
      }
    } catch (e) {
      logger.warn('Failed to delete temporary file:', e)
    } finally {
      isDownloading = false
    }
  }
}

let schedulerInterval: Timer | null = null
let isDownloading = false

export function initImdbService() {
  const config = getConfig()
  const updateIntervalHours = config.IMDB_UPDATE_INTERVAL_HOURS
  const intervalMs = updateIntervalHours * 60 * 60 * 1000

  logger.info(`Initializing IMDb service (Update interval: ${updateIntervalHours}h)`)

  const database = getDb()
  const count = database.prepare('SELECT COUNT(*) as count FROM ratings').get() as { count: number }
  const lastRefreshed = getLastRefreshed()

  let msUntilFirstRefresh: number

  if (count.count === 0 || !lastRefreshed) {
    logger.info('IMDb database is empty or has never been refreshed, starting initial download...')
    msUntilFirstRefresh = 5000
  } else {
    const msSinceLastRefresh = Date.now() - lastRefreshed.getTime()
    const msRemaining = intervalMs - msSinceLastRefresh

    if (msRemaining <= 0) {
      logger.info(
        `IMDb database overdue for refresh (last: ${lastRefreshed.toISOString()}), refreshing now...`
      )
      msUntilFirstRefresh = 5000
    } else {
      const hoursRemaining = (msRemaining / 1000 / 60 / 60).toFixed(1)
      logger.info(
        `IMDb database loaded (${count.count} ratings, last refreshed: ${lastRefreshed.toISOString()}). Next refresh in ${hoursRemaining}h`
      )
      msUntilFirstRefresh = msRemaining
    }
  }

  if (schedulerInterval) clearInterval(schedulerInterval)

  // Fire the first refresh at the right time, then repeat on the full interval
  setTimeout(() => {
    downloadAndProcessRatings()
    schedulerInterval = setInterval(() => {
      downloadAndProcessRatings()
    }, intervalMs)
  }, msUntilFirstRefresh)
}
