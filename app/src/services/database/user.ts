// User database operations
import { db } from './connection'
import type { User, Profile, ProfileProxySettings } from './types'

// Forward declarations to avoid circular imports - these will be resolved at runtime
let profileDb: any
let settingsProfileDb: any
let profileProxySettingsDb: any

export function setProfileDb(pdb: any) { profileDb = pdb }
export function setSettingsProfileDb(spdb: any) { settingsProfileDb = spdb }
export function setProfileProxySettingsDb(ppsdb: any) { profileProxySettingsDb = ppsdb }

export const userDb = {
  findByEmail: (email: string): User | undefined => {
    const stmt = db.prepare('SELECT * FROM user WHERE email = ?')
    return stmt.get(email) as User | undefined
  },

  findAccountsByUserId: (userId: string): any[] => {
    const stmt = db.prepare('SELECT * FROM account WHERE userId = ?')
    return stmt.all(userId) as any[]
  },

  hasPassword: (userId: string): boolean => {
    const stmt = db.prepare(
      "SELECT 1 FROM account WHERE userId = ? AND providerId = 'credential' AND password IS NOT NULL LIMIT 1"
    )
    return !!stmt.get(userId)
  },

  findById: (id: string): User | undefined => {
    const stmt = db.prepare('SELECT * FROM user WHERE id = ?')
    return stmt.get(id) as User | undefined
  },

  exists: (email: string): boolean => {
    const stmt = db.prepare('SELECT 1 FROM user WHERE email = ? LIMIT 1')
    return !!stmt.get(email)
  },

  list: (): User[] => {
    const stmt = db.prepare('SELECT * FROM user')
    return stmt.all() as User[]
  },

  update: async (id: string, updates: Partial<User>): Promise<User | undefined> => {
    const fields: string[] = []
    const values: any[] = []

    if (updates.username !== undefined) {
        fields.push('username = ?')
        values.push(updates.username)
    }
    if (updates.firstName !== undefined) {
        fields.push('firstName = ?')
        values.push(updates.firstName)
    }
    if (updates.lastName !== undefined) {
        fields.push('lastName = ?')
        values.push(updates.lastName)
    }
    if (updates.addonManagerEnabled !== undefined) {
        fields.push('addonManagerEnabled = ?')
        values.push(updates.addonManagerEnabled)
    }
    if (updates.hideCalendarButton !== undefined) {
        fields.push('hideCalendarButton = ?')
        values.push(updates.hideCalendarButton)
    }
    if (updates.hideAddonsButton !== undefined) {
        fields.push('hideAddonsButton = ?')
        values.push(updates.hideAddonsButton)
    }
    if (updates.hideCinemetaContent !== undefined) {
        fields.push('hideCinemetaContent = ?')
        values.push(updates.hideCinemetaContent)
    }
    if (updates.heroBannerEnabled !== undefined) {
        fields.push('heroBannerEnabled = ?')
        values.push(updates.heroBannerEnabled)
    }
    if (updates.tmdbApiKey !== undefined) {
        fields.push('tmdbApiKey = ?')
        values.push(updates.tmdbApiKey)
    }
    
    if (fields.length === 0) return userDb.findById(id)

    fields.push('updatedAt = CURRENT_TIMESTAMP')
    values.push(id)

    const stmt = db.prepare(`UPDATE user SET ${fields.join(', ')} WHERE id = ?`)
    const result = stmt.run(...values)

    return result.changes > 0 ? userDb.findById(id) : undefined
  },

  /**
   * Guest User Constants
   * Used for local-only guest mode - all features work without cloud sync
   */
  GUEST_USER_ID: 'guest-local-user',
  GUEST_USER_EMAIL: 'guest@local.zentrio',

  /**
   * Get or create the special guest user for local-only mode.
   * This user is never synced to remote servers and enables all local features.
   */
  getOrCreateGuestUser: (): User => {
    const existingUser = userDb.findById(userDb.GUEST_USER_ID)
    if (existingUser) return existingUser

    // Create the guest user
    const now = new Date().toISOString()
    const stmt = db.prepare(`
      INSERT INTO user (id, email, name, emailVerified, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      userDb.GUEST_USER_ID,
      userDb.GUEST_USER_EMAIL,
      'Guest',
      true,
      now,
      now
    )

    return userDb.findById(userDb.GUEST_USER_ID)!
  },

  /**
   * Ensure a default profile exists for the guest user.
   * Creates one if none exists.
   * Returns the default profile.
   */
  ensureGuestDefaultProfile: async (): Promise<Profile> => {
    const guestUser = userDb.getOrCreateGuestUser()
    const profiles = profileDb.findByUserId(guestUser.id)
    
    if (profiles.length > 0) {
      // Return the default profile, or the first one
      const defaultProfile = profiles.find((p: Profile) => p.is_default) || profiles[0]
      return defaultProfile
    }

    // Create a default settings profile for the guest
    const settingsProfile = settingsProfileDb.create(guestUser.id, 'Default', true)

    // Create a default profile for the guest
    const profile = await profileDb.create({
      user_id: guestUser.id,
      name: 'Guest',
      avatar: 'Guest',
      avatar_type: 'initials',
      avatar_style: 'bottts-neutral',
      is_default: true,
      settings_profile_id: settingsProfile.id
    })

    // Create proxy settings for the profile
    profileProxySettingsDb.create({
      profile_id: profile.id,
      nsfw_filter_enabled: false,
      nsfw_age_rating: 0,
      hide_calendar_button: false,
      hide_addons_button: false,
      hero_banner_enabled: true
    })

    return profile
  }
}
