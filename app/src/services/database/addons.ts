// Addon database operations
import { db } from './connection'
import type { Addon, ProfileAddon } from './types'

export const addonDb = {
  create: (data: {
    manifest_url: string
    name: string
    version?: string
    description?: string
    logo?: string
    logo_url?: string
    behavior_hints?: any
  }): Addon => {
    const stmt = db.prepare(`
      INSERT INTO addons (manifest_url, name, version, description, logo, logo_url, behavior_hints)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(manifest_url) DO UPDATE SET
        name = excluded.name,
        version = excluded.version,
        description = excluded.description,
        logo = excluded.logo,
        logo_url = excluded.logo_url,
        behavior_hints = excluded.behavior_hints
    `)
    const result = stmt.run(
      data.manifest_url,
      data.name,
      data.version || null,
      data.description || null,
      data.logo || null,
      data.logo_url || null,
      data.behavior_hints ? JSON.stringify(data.behavior_hints) : null
    )
    // Safer to fetch by URL
    return addonDb.findByUrl(data.manifest_url)!
  },

  findByUrl: (url: string): Addon | undefined => {
    const stmt = db.prepare('SELECT * FROM addons WHERE manifest_url = ?')
    return stmt.get(url) as Addon | undefined
  },

  findById: (id: number): Addon | undefined => {
    const stmt = db.prepare('SELECT * FROM addons WHERE id = ?')
    return stmt.get(id) as Addon | undefined
  },

  list: (): Addon[] => {
    const stmt = db.prepare('SELECT * FROM addons ORDER BY name ASC')
    return stmt.all() as Addon[]
  },

  delete: (id: number): void => {
    const addon = addonDb.findById(id);
    if (addon && addon.manifest_url === 'zentrio://tmdb-addon') {
        return;
    }
    const stmt = db.prepare('DELETE FROM addons WHERE id = ?')
    stmt.run(id)
  },

  // Profile Addon operations
  enableForProfile: (settingsProfileId: number, addonId: number): void => {
    // We use settings_profile_id now. profile_id is nullable.
    const stmt = db.prepare(`
      INSERT INTO profile_addons (profile_id, settings_profile_id, addon_id, enabled, priority, dirty)
      VALUES (NULL, ?, ?, TRUE, (SELECT COALESCE(MAX(priority), 0) + 1 FROM profile_addons WHERE settings_profile_id = ?), TRUE)
      ON CONFLICT(settings_profile_id, addon_id) DO UPDATE SET enabled = TRUE, deleted_at = NULL, dirty = TRUE, updated_at = CURRENT_TIMESTAMP
    `)
    stmt.run(settingsProfileId, addonId, settingsProfileId)
  },

  disableForProfile: (settingsProfileId: number, addonId: number): void => {
    const stmt = db.prepare(`
      INSERT INTO profile_addons (profile_id, settings_profile_id, addon_id, enabled, priority, dirty)
      VALUES (NULL, ?, ?, FALSE, (SELECT COALESCE(MAX(priority), 0) + 1 FROM profile_addons WHERE settings_profile_id = ?), TRUE)
      ON CONFLICT(settings_profile_id, addon_id) DO UPDATE SET enabled = FALSE, deleted_at = NULL, dirty = TRUE, updated_at = CURRENT_TIMESTAMP
    `)
    stmt.run(settingsProfileId, addonId, settingsProfileId)
  },

  getForProfile: (settingsProfileId: number): ProfileAddon[] => {
    const stmt = db.prepare(`
      SELECT pa.*, a.manifest_url, a.name, a.version, a.description, a.logo, a.logo_url
      FROM profile_addons pa
      JOIN addons a ON pa.addon_id = a.id
      WHERE pa.settings_profile_id = ? AND pa.deleted_at IS NULL
      ORDER BY pa.priority ASC, pa.id ASC
    `)
    const rows = stmt.all(settingsProfileId) as any[]
    return rows.map(row => ({
      id: row.id,
      profile_id: row.profile_id,
      settings_profile_id: row.settings_profile_id,
      addon_id: row.addon_id,
      enabled: !!row.enabled,
      created_at: row.created_at,
      addon: {
        id: row.addon_id,
        manifest_url: row.manifest_url,
        name: row.name,
        version: row.version,
        description: row.description,
        logo: row.logo,
        logo_url: row.logo_url,
        created_at: row.created_at
      }
    }));
  },

  getAllWithStatusForProfile: (settingsProfileId: number): (Addon & { enabled: boolean, priority: number, is_protected: boolean })[] => {
    const stmt = db.prepare(`
      SELECT a.*,
             pa.enabled,
             pa.priority
      FROM addons a
      JOIN profile_addons pa ON a.id = pa.addon_id
      WHERE pa.settings_profile_id = ? AND pa.deleted_at IS NULL
      ORDER BY pa.priority ASC, a.id ASC
    `)
    const rows = stmt.all(settingsProfileId) as any[]
    return rows.map(row => {
        let behaviorHints = null
        if (row.behavior_hints) {
            try {
                behaviorHints = JSON.parse(row.behavior_hints)
            } catch (e) {}
        }
        return {
            ...row,
            behavior_hints: behaviorHints,
            enabled: !!row.enabled,
            is_protected: row.manifest_url === 'zentrio://tmdb-addon'
        }
    })
  },

  updateProfileAddonOrder: (settingsProfileId: number, addonIds: number[]): void => {
    const transaction = db.transaction((ids: number[]) => {
      let priority = 0;
      for (const addonId of ids) {
        const stmt = db.prepare(`
          INSERT INTO profile_addons (profile_id, settings_profile_id, addon_id, enabled, priority, dirty)
          VALUES (NULL, ?, ?, TRUE, ?, TRUE)
          ON CONFLICT(settings_profile_id, addon_id) DO UPDATE SET priority = ?, dirty = TRUE, updated_at = CURRENT_TIMESTAMP
        `)
        stmt.run(settingsProfileId, addonId, priority, priority)
        priority++;
      }
    })
    transaction(addonIds)
  },

  getEnabledForProfile: (settingsProfileId: number): Addon[] => {
    const stmt = db.prepare(`
      SELECT a.*
      FROM addons a
      JOIN profile_addons pa ON a.id = pa.addon_id
      WHERE pa.settings_profile_id = ? AND pa.enabled = 1 AND pa.deleted_at IS NULL
      ORDER BY pa.priority ASC, a.id ASC
    `)
    return stmt.all(settingsProfileId) as Addon[]
  },

  removeFromProfile: (settingsProfileId: number, addonId: number): void => {
    // Ensure we have valid numbers to prevent accidental mass deletion
    if (!settingsProfileId || !addonId || isNaN(settingsProfileId) || isNaN(addonId)) {
        console.error(`[Database] Invalid parameters for removeFromProfile: settingsProfileId=${settingsProfileId}, addonId=${addonId}`);
        return;
    }

    // Prevent removing native addon
    const addon = addonDb.findById(addonId);
    if (addon && addon.manifest_url === 'zentrio://tmdb-addon') {
        return;
    }

    const stmt = db.prepare('UPDATE profile_addons SET deleted_at = CURRENT_TIMESTAMP, dirty = TRUE, updated_at = CURRENT_TIMESTAMP WHERE settings_profile_id = ? AND addon_id = ?')
    stmt.run(settingsProfileId, addonId)
  }
}
