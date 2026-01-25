// Settings Profile database operations
import { db } from './connection'
import type { SettingsProfile } from './types'

// Forward declaration for addonDb to avoid circular imports
let addonDb: any
export function setAddonDb(adb: any) { addonDb = adb }

export const settingsProfileDb = {
    create: (userId: string, name: string, isDefault: boolean = false): SettingsProfile => {
        const stmt = db.prepare("INSERT INTO settings_profiles (user_id, name, is_default) VALUES (?, ?, ?)");
        const res = stmt.run(userId, name, isDefault ? 1 : 0);
        const id = res.lastInsertRowid as number;

        // Auto-enable Zentrio addon
        try {
            const zentrioAddon = db.prepare("SELECT id FROM addons WHERE manifest_url = 'zentrio://tmdb-addon'").get() as any;
            if (zentrioAddon && addonDb) {
                addonDb.enableForProfile(id, zentrioAddon.id);
            }
        } catch (e) {
            console.error("Failed to auto-enable Zentrio addon for new profile", e);
        }

        return settingsProfileDb.findById(id)!;
    },
    findById: (id: number): SettingsProfile | undefined => {
        return db.prepare("SELECT * FROM settings_profiles WHERE id = ?").get(id) as SettingsProfile | undefined;
    },
    listByUserId: (userId: string): SettingsProfile[] => {
        return db.prepare("SELECT * FROM settings_profiles WHERE user_id = ? ORDER BY is_default DESC, name ASC").all(userId) as SettingsProfile[];
    },
    update: (id: number, name: string): void => {
        db.prepare("UPDATE settings_profiles SET name = ?, dirty = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(name, id);
    },
    delete: (id: number): void => {
        db.prepare("UPDATE settings_profiles SET deleted_at = CURRENT_TIMESTAMP, dirty = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
    },
    isUsed: (id: number): boolean => {
        const count = db.prepare("SELECT COUNT(*) as count FROM profiles WHERE settings_profile_id = ?").get(id) as any;
        return count.count > 0;
    }
}
