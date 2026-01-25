// Stream settings database operations
import { db } from './connection'
import type { StreamSettings } from './types'

export const streamDb = {
  getSettings: (settingsProfileId: number): StreamSettings => {
    // We now use settings_profile_id
    const stmt = db.prepare('SELECT * FROM stream_settings WHERE settings_profile_id = ?');
    const row = stmt.get(settingsProfileId) as any;
    
    if (row && row.config) {
      try {
        return JSON.parse(row.config);
      } catch (e) {
        console.error('Failed to parse stream settings', e);
      }
    }
    // Default settings
    return {
      filters: {
        cache: { cached: true, uncached: true, applyMode: 'OR' },
        resolution: { preferred: ['4k', '1080p', '720p'], required: [], excluded: [] },
        encode: { preferred: [], required: [], excluded: [] },
        streamType: { preferred: [], required: [], excluded: [] },
        visualTag: { preferred: [], required: [], excluded: [] },
        audioTag: { preferred: [], required: [], excluded: [] },
        audioChannel: { preferred: [], required: [], excluded: [] },
        language: { preferred: [], required: [], excluded: [] },
        seeders: {},
        matching: { title: { enabled: true, mode: 'Partial' }, seasonEpisode: { enabled: true } },
        keyword: { preferred: [], required: [], excluded: [] },
        regex: { preferred: [], required: [], excluded: [] },
        size: {}
      },
      limits: { maxResults: 20 },
      deduplication: { mode: 'Per Addon', detection: { filename: true, infoHash: true, smartDetect: true } },
      sorting: { global: ['cached', 'resolution', 'quality', 'seeders', 'size'] },
      sortingConfig: {
        items: [
          { id: 'cached', enabled: true, direction: 'desc' },
          { id: 'resolution', enabled: true, direction: 'desc' },
          { id: 'quality', enabled: true, direction: 'desc' },
          { id: 'seeders', enabled: true, direction: 'desc' },
          { id: 'size', enabled: true, direction: 'desc' },
          { id: 'language', enabled: false, direction: 'desc' }
        ]
      }
    } as StreamSettings;
  },


  saveSettings: (settingsProfileId: number, settings: StreamSettings): void => {
    const existing = db.prepare("SELECT id FROM stream_settings WHERE settings_profile_id = ?").get(settingsProfileId) as any;
    
    if (existing) {
        const stmt = db.prepare("UPDATE stream_settings SET config = ?, dirty = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        stmt.run(JSON.stringify(settings), existing.id);
    } else {
        const stmt = db.prepare("INSERT INTO stream_settings (profile_id, settings_profile_id, config, dirty) VALUES (NULL, ?, ?, TRUE)");
        stmt.run(settingsProfileId, JSON.stringify(settings));
    }
  }
};
