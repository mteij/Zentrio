import { Hono } from 'hono'
import { syncService } from '../../services/sync'
import { auth } from '../../services/auth'
import { db, profileDb, settingsProfileDb, addonDb, streamDb, appearanceDb, watchHistoryDb, listDb } from '../../services/database'

const app = new Hono()

app.get('/status', async (c) => {
  try {
    const state = await syncService.getSyncState();
    return c.json(state);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.post('/configure', async (c) => {
  try {
    const { serverUrl, mode } = await c.req.json();
    
    // Store the configuration in the database
    if (mode === 'cloud' && serverUrl) {
      // Store server URL for later use
      await syncService.setSyncState({
        remote_url: serverUrl,
        auth_token: '', // Will be set during authentication
        remote_user_id: '',
        is_syncing: false,
        last_sync_at: null
      });
    } else {
      throw new Error('Invalid configuration mode');
    }
    
    return c.json({ success: true });
  } catch (e: any) {
    console.error('Sync configuration error:', e);
    return c.json({ success: false, error: e.message }, 500);
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
    return c.json({ error: e.message }, 500);
  }
});

app.post('/connect', async (c) => {
  try {
    const { remoteUrl, token, userId } = await c.req.json();
    await syncService.connect(remoteUrl, token, userId);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

app.post('/disconnect', async (c) => {
  try {
    await syncService.disconnect();
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

app.post('/sync', async (c) => {
  try {
    await syncService.sync();
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// Legacy endpoint for backward compatibility
app.post('/trigger', async (c) => {
  try {
    await syncService.sync();
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// Server-side sync endpoints for remote synchronization
// These endpoints handle push/pull operations from Tauri clients

// [POST /token] Generate a sync token for Tauri clients
app.post('/token', async (c) => {
  try {
    // Validate the session using Better Auth
    const session = await auth.api.getSession({
      headers: c.req.raw.headers
    })
    
    if (!session || !session.user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Generate a sync token (in production, use JWT or proper token system)
    // For now, we'll use a simple approach with base64 encoding
    const tokenData = {
      userId: session.user.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    }
    
    // In a real implementation, you'd store this securely or use a signed JWT
    const encodedToken = Buffer.from(JSON.stringify(tokenData)).toString('base64')
    
    return c.json({
      syncToken: encodedToken,
      userId: session.user.id,
      expiresAt: tokenData.expiresAt
    })
  } catch (e: any) {
    console.error('Sync token generation error:', e)
    return c.json({ error: e.message }, 500)
  }
})

// Helper function to validate sync token
function validateSyncToken(token: string): { userId: string } | null {
  try {
    // Decode the token (in production, use proper JWT validation)
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString())
    
    // Check if token has expired
    if (new Date(decoded.expiresAt) < new Date()) {
      return null
    }
    
    return { userId: decoded.userId }
  } catch (error) {
    console.error('Token validation error:', error)
    return null
  }
}

// [POST /push] Accept sync data from Tauri client
app.post('/push', async (c) => {
  try {
    // Try to get session from cookies first (for web requests)
    let session = await auth.api.getSession({
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
    console.error('Sync push error:', e)
    return c.json({ error: e.message }, 500)
  }
})

// [GET /pull] Return changes since last sync
app.get('/pull', async (c) => {
  try {
    // Try to get session from cookies first (for web requests)
    let session = await auth.api.getSession({
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
    console.error('Sync pull error:', e)
    return c.json({ error: e.message }, 500)
  }
})

// Helper function to process sync payload from Tauri client
async function processSyncPayload(payload: any, userId: string) {
  const mappings: any = {}
  
  // Process each entity type
  for (const [entityType, records] of Object.entries(payload)) {
    if (!Array.isArray(records) || records.length === 0) continue
    
    mappings[entityType] = []
    
    for (const record of records) {
      try {
        // Check if record already exists (by remote_id)
        const existing = db.prepare(`SELECT * FROM ${entityType} WHERE remote_id = ?`).get(record.remote_id)
        
        if (existing) {
          // Update existing record if remote is newer
          const remoteDate = new Date(record.updated_at).getTime()
          const localDate = new Date((existing as any).updated_at).getTime()
          
          if (remoteDate > localDate) {
            const fields = Object.keys(record).filter(k => k !== 'id' && k !== 'remote_id')
            const sets = fields.map(k => `${k} = ?`).join(', ')
            const values = fields.map(k => record[k])
            values.push(record.remote_id)
            
            db.prepare(`UPDATE ${entityType} SET ${sets} WHERE remote_id = ?`).run(...values)
          }
        } else {
          // Insert new record
          const fields = Object.keys(record).filter(k => k !== 'id')
          const cols = fields.join(', ')
          const placeholders = fields.map(() => '?').join(', ')
          const values = fields.map(k => record[k])
          
          const result = db.prepare(`INSERT INTO ${entityType} (${cols}) VALUES (${placeholders})`).run(...values)
          
          // Map local ID to remote ID for response
          mappings[entityType].push({
            id: record.id, // This is the client's local ID
            remote_id: result.lastInsertRowid.toString() // This is the server's ID
          })
        }
      } catch (error) {
        console.error(`Error processing ${entityType} record:`, error)
      }
    }
  }
  
  return mappings
}

// Helper function to get changes since last sync
async function getChangesSince(since: string | undefined, userId: string) {
  const sinceDate = since ? new Date(since) : new Date(0)
  
  // Get all changes for the user since the specified date
  const changes: any = {}
  
  const entities = [
    'profiles', 'settings_profiles', 'profile_addons',
    'stream_settings', 'appearance_settings',
    'watch_history', 'lists', 'list_items'
  ]
  
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
      console.error(`Error fetching ${entity} changes:`, error)
      changes[entity] = []
    }
  }
  
  return changes
}

export default app