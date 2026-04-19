import { createHmac, timingSafeEqual } from 'crypto'
import { syncService } from '../../services/sync'
import { auth } from '../../services/auth'
import { db } from '../../services/database'
import { getConfig } from '../../services/envParser'
import { createTaggedOpenAPIApp } from './openapi-route'
import { logger } from '../../services/logger'
import { sessionMiddleware } from '../../middleware/session'

const log = logger.scope('API:Sync')

const app = createTaggedOpenAPIApp('Sync')

app.use('*', sessionMiddleware)

const SYNC_ENTITY_TABLES = new Set([
  'profiles',
  'settings_profiles',
  'profile_addons',
  'stream_settings',
  'appearance_settings',
  'watch_history',
  'lists',
  'list_items'
])

const SAFE_SQL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/

const isSafeSqlIdentifier = (value: string) => SAFE_SQL_IDENTIFIER.test(value)

app.get('/status', async (c) => {
  try {
    const state = await syncService.getSyncState();
    return c.json(state);
} catch (e: any) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.get('/config', async (c) => {
  try {
    const syncState = await syncService.getSyncState();
    
    let mode = 'unconfigured';
    let serverUrl = 'https://zentrio.eu';
    
    if (syncState && syncState.remote_url) {
      mode = 'cloud';
      serverUrl = syncState.remote_url;
    }
    
    return c.json({
      mode,
      serverUrl,
      isConnected: !!syncState?.auth_token,
      syncState
    });
  } catch (e: any) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.post('/connect', async (c) => {
  try {
    const { remoteUrl, token, userId } = await c.req.json();

    const PRIVATE_HOST_RE = /^(localhost$|127\.|0\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|::1$|fc[0-9a-f]{2}:|fe[89ab][0-9a-f]:|::ffff:(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.))/i
    try {
      const parsed = new URL(remoteUrl)
      if (!['https:', 'http:'].includes(parsed.protocol)) {
        return c.json({ success: false, error: 'Only HTTP(S) URLs are allowed' }, 400)
      }
      if (PRIVATE_HOST_RE.test(parsed.hostname) || /^\d+$/.test(parsed.hostname)) {
        return c.json({ success: false, error: 'Private/internal URLs are not allowed' }, 403)
      }
    } catch {
      return c.json({ success: false, error: 'Invalid remote URL' }, 400)
    }

    await syncService.connect(remoteUrl, token, userId);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

app.post('/disconnect', async (c) => {
  try {
    await syncService.disconnect();
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

app.post('/sync', async (c) => {
  try {
    await syncService.sync();
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// Server-side sync endpoints for remote synchronization
// These endpoints handle push/pull operations from Tauri clients

// [POST /token] Generate a sync token for Tauri clients
app.post('/token', async (c) => {
  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers
    })
    
    if (!session || !session.user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const syncToken = generateSyncToken(session.user.id)
    
    return c.json({
      syncToken,
      userId: session.user.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    })
  } catch (e: any) {
    log.error('Sync token generation error:', e)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

const SYNC_TOKEN_VERSION = 1

function generateSyncToken(userId: string): string {
  const { AUTH_SECRET } = getConfig()
  const payload = JSON.stringify({ v: SYNC_TOKEN_VERSION, uid: userId, ts: Date.now() })
  const hmac = createHmac('sha256', AUTH_SECRET).update(payload).digest('hex')
  const token = Buffer.from(JSON.stringify({ p: payload, s: hmac })).toString('base64url')
  return token
}

function validateSyncToken(token: string): { userId: string } | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString())
    if (!decoded.p || !decoded.s) return null
    const { AUTH_SECRET } = getConfig()
    const expectedHmac = createHmac('sha256', AUTH_SECRET).update(decoded.p).digest('hex')
    if (!timingSafeEqual(Buffer.from(decoded.s), Buffer.from(expectedHmac))) return null
    const payload = JSON.parse(decoded.p)
    if (payload.v !== SYNC_TOKEN_VERSION) return null
    const expiresAt = payload.ts + 30 * 24 * 60 * 60 * 1000
    if (Date.now() > expiresAt) return null
    return { userId: payload.uid }
  } catch {
    return null
  }
}

// [POST /push] Accept sync data from Tauri client
app.post('/push', async (c) => {
  try {
    // Try to get session from cookies first (for web requests)
    const session = await auth.api.getSession({
      headers: c.req.raw.headers
    })
    
    let userId: string
    
    if (session && session.user) {
      // Web request with cookie session
      userId = session.user.id
    } else {
      // Tauri request with Bearer token
      const authHeader = c.req.header('Authorization')
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized - No valid token provided' }, 401)
      }
      
      const token = authHeader.substring(7)
      
      // Validate the sync token
      const tokenData = validateSyncToken(token)
      if (!tokenData) {
        return c.json({ error: 'Invalid or expired sync token - please re-authenticate' }, 401)
      }
      
      userId = tokenData.userId
    }

    const payload = await c.req.json()
    
    // Process the sync payload
    const result = await processSyncPayload(payload, userId)
    
    return c.json({ success: true, mappings: result })
  } catch (e: any) {
    log.error('Sync push error:', e)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// [GET /pull] Return changes since last sync
app.get('/pull', async (c) => {
  try {
    // Try to get session from cookies first (for web requests)
    const session = await auth.api.getSession({
      headers: c.req.raw.headers
    })
    
    let userId: string
    
    if (session && session.user) {
      // Web request with cookie session
      userId = session.user.id
    } else {
      // Tauri request with Bearer token
      const authHeader = c.req.header('Authorization')
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized - No valid token provided' }, 401)
      }
      
      const token = authHeader.substring(7)
      
      // Validate the sync token
      const tokenData = validateSyncToken(token)
      if (!tokenData) {
        return c.json({ error: 'Invalid or expired sync token - please re-authenticate' }, 401)
      }
      
      userId = tokenData.userId
    }

    const since = c.req.query('since')
    
    // Get changes since the last sync
    const changes = await getChangesSince(since, userId)
    
    return c.json(changes)
  } catch (e: any) {
    log.error('Sync pull error:', e)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Helper function to process sync payload from Tauri client
async function processSyncPayload(payload: any, _userId: string) {
  const mappings: any = {}
  
  // Process each entity type
  for (const [entityType, records] of Object.entries(payload)) {
    if (!SYNC_ENTITY_TABLES.has(entityType)) continue
    if (!Array.isArray(records) || records.length === 0) continue
    
    mappings[entityType] = []

    db.transaction(() => {
      for (const record of records) {
        if (!record || typeof record !== 'object' || Array.isArray(record)) continue

        try {
          // Check if record already exists (by remote_id)
          const existing = db.prepare(`SELECT * FROM ${entityType} WHERE remote_id = ?`).get((record as any).remote_id)

          if (existing) {
            // Update existing record if remote is newer
            const remoteDate = new Date((record as any).updated_at).getTime()
            const localDate = new Date((existing as any).updated_at).getTime()

            if (remoteDate > localDate) {
              const fields = Object.keys(record).filter(k => k !== 'id' && k !== 'remote_id' && isSafeSqlIdentifier(k))
              if (fields.length === 0) continue

              const sets = fields.map(k => `${k} = ?`).join(', ')
              const values = fields.map(k => (record as any)[k])
              values.push((record as any).remote_id)

              db.prepare(`UPDATE ${entityType} SET ${sets} WHERE remote_id = ?`).run(...values)
            }
          } else {
            // Insert new record
            const fields = Object.keys(record).filter(k => k !== 'id' && isSafeSqlIdentifier(k))
            if (fields.length === 0) continue

            const cols = fields.join(', ')
            const placeholders = fields.map(() => '?').join(', ')
            const values = fields.map(k => (record as any)[k])

            const result = db.prepare(`INSERT INTO ${entityType} (${cols}) VALUES (${placeholders})`).run(...values)

            // Map local ID to remote ID for response
            mappings[entityType].push({
              id: (record as any).id, // This is the client's local ID
              remote_id: result.lastInsertRowid.toString() // This is the server's ID
            })
          }
        } catch (error) {
          log.error(`Error processing ${entityType} record:`, error)
        }
      }
    })()
  }
  
  return mappings
}

// Helper function to get changes since last sync
async function getChangesSince(since: string | undefined, userId: string) {
  const sinceDate = since ? new Date(since) : new Date(0)
  
  // Get all changes for the user since the specified date
  const changes: any = {}
  
  const entities = Array.from(SYNC_ENTITY_TABLES)
  
  for (const entity of entities) {
    try {
      const records = db.prepare(`
        SELECT * FROM ${entity}
        WHERE updated_at > ?
        AND (user_id = ? OR user_id IS NULL)
        ORDER BY updated_at ASC
      `).all(sinceDate.toISOString(), userId)
      
      changes[entity] = records
    } catch (error) {
      log.error(`Error fetching ${entity} changes:`, error)
      changes[entity] = []
    }
  }
  
  return changes
}

export default app
