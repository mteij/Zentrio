// Appearance settings database operations
import { db } from './connection'
import type { AppearanceSettings } from './types'

export const appearanceDb = {
  getSettings: (settingsProfileId: number): AppearanceSettings => {
    const stmt = db.prepare('SELECT * FROM appearance_settings WHERE settings_profile_id = ?');
    const row = stmt.get(settingsProfileId) as any;
    
    if (row) {
      return {
        id: row.id,
        settings_profile_id: row.settings_profile_id,
        show_imdb_ratings: !!row.show_imdb_ratings,
        show_age_ratings: row.show_age_ratings !== null ? !!row.show_age_ratings : true,
        background_style: row.background_style
      };
    }
    
    // Default settings
    return {
      show_imdb_ratings: true,
      show_age_ratings: true,
      background_style: 'vanta'
    };
  },

  saveSettings: (settingsProfileId: number, settings: Partial<AppearanceSettings>): void => {
    const existing = db.prepare("SELECT id FROM appearance_settings WHERE settings_profile_id = ?").get(settingsProfileId) as any;
    
    if (existing) {
        const fields: string[] = [];
        const values: any[] = [];
        
        if (settings.show_imdb_ratings !== undefined) { fields.push("show_imdb_ratings = ?"); values.push(settings.show_imdb_ratings ? 1 : 0); }
        if (settings.show_age_ratings !== undefined) { fields.push("show_age_ratings = ?"); values.push(settings.show_age_ratings ? 1 : 0); }
        if (settings.background_style !== undefined) { fields.push("background_style = ?"); values.push(settings.background_style); }
        
        if (fields.length > 0) {
            fields.push('dirty = TRUE');
            fields.push('updated_at = CURRENT_TIMESTAMP');
            values.push(existing.id);
            const stmt = db.prepare(`UPDATE appearance_settings SET ${fields.join(', ')} WHERE id = ?`);
            stmt.run(...values);
        }
    } else {
        const stmt = db.prepare(`
            INSERT INTO appearance_settings (settings_profile_id, show_imdb_ratings, show_age_ratings, background_style, dirty)
            VALUES (?, ?, ?, ?, TRUE)
        `);
        stmt.run(
            settingsProfileId,
            settings.show_imdb_ratings !== undefined ? (settings.show_imdb_ratings ? 1 : 0) : 1,
            settings.show_age_ratings !== undefined ? (settings.show_age_ratings ? 1 : 0) : 1,
            settings.background_style || 'vanta'
        );
    }
  }
};
