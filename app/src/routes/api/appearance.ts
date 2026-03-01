import { appearanceDb, profileDb, userDb, type User } from '../../services/database'
import { optionalSessionMiddleware } from '../../middleware/session'
import { ok, err } from '../../utils/api'
import { createTaggedOpenAPIApp } from './openapi-route'

const appearance = createTaggedOpenAPIApp<{
  Variables: {
    user: User | null
    guestMode: boolean
    session: any
  }
}>('Appearance')

appearance.get('/settings', optionalSessionMiddleware, async (c) => {
  try {
    const { profileId, settingsProfileId: querySettingsProfileId } = c.req.query()
    const user = c.get('user')
    const isGuestMode = c.get('guestMode') as boolean

    // Resolve effective user for guest mode
    const effectiveUser = isGuestMode ? userDb.getOrCreateGuestUser() : user
    if (!effectiveUser) return err(c, 401, 'UNAUTHORIZED', 'Authentication required')

    let settingsProfileId: number;

    if (querySettingsProfileId) {
        settingsProfileId = parseInt(querySettingsProfileId);
    } else {
        let pId: number;
        if (profileId && profileId !== 'guest') {
            pId = parseInt(profileId)
        } else if (isGuestMode || profileId === 'guest') {
            const guestDefaultProfile = await userDb.ensureGuestDefaultProfile()
            pId = guestDefaultProfile.id
        } else {
            // Fallback to default profile
            let profile = profileDb.getDefault(effectiveUser.id)
            if (!profile) {
                const profiles = profileDb.findByUserId(effectiveUser.id)
                if (profiles && profiles.length > 0) {
                    profile = profiles[0]
                }
            }
            if (!profile) return err(c, 404, 'PROFILE_NOT_FOUND', 'No profile found')
            pId = profile.id
        }
        
        const resolved = profileDb.getSettingsProfileId(pId);
        if (!resolved) return err(c, 404, 'SETTINGS_PROFILE_NOT_FOUND', 'Settings profile not found')
        settingsProfileId = resolved;
    }

    const settings = appearanceDb.getSettings(settingsProfileId)
    return c.json({ data: settings })
  } catch (e) {
    console.error('Failed to get appearance settings', e)
    return err(c, 500, 'SERVER_ERROR', 'Unexpected error')
  }
})

appearance.put('/settings', optionalSessionMiddleware, async (c) => {
  try {
    const { profileId, settingsProfileId: querySettingsProfileId } = c.req.query()
    const user = c.get('user')
    const isGuestMode = c.get('guestMode') as boolean

    // Resolve effective user for guest mode
    const effectiveUser = isGuestMode ? userDb.getOrCreateGuestUser() : user
    if (!effectiveUser) return err(c, 401, 'UNAUTHORIZED', 'Authentication required')

    let settingsProfileId: number;

    if (querySettingsProfileId) {
        settingsProfileId = parseInt(querySettingsProfileId);
        if (isNaN(settingsProfileId)) {
            return err(c, 400, 'INVALID_ID', 'Invalid settings profile ID');
        }
    } else {
        let pId: number;
        if (profileId && profileId !== 'guest') {
            pId = parseInt(profileId)
        } else if (isGuestMode || profileId === 'guest') {
            const guestDefaultProfile = await userDb.ensureGuestDefaultProfile()
            pId = guestDefaultProfile.id
        } else {
            // Fallback to default profile
            let profile = profileDb.getDefault(effectiveUser.id)
            if (!profile) {
                const profiles = profileDb.findByUserId(effectiveUser.id)
                if (profiles && profiles.length > 0) {
                    profile = profiles[0]
                }
            }
            if (!profile) return err(c, 404, 'PROFILE_NOT_FOUND', 'No profile found')
            pId = profile.id
        }
        
        const resolved = profileDb.getSettingsProfileId(pId);
        if (!resolved) return err(c, 404, 'SETTINGS_PROFILE_NOT_FOUND', 'Settings profile not found')
        settingsProfileId = resolved;
    }

    const settings = await c.req.json()
    appearanceDb.saveSettings(settingsProfileId, settings)
    return c.json({ success: true })
  } catch (e) {
    console.error('Failed to save appearance settings', e)
    return err(c, 500, 'SERVER_ERROR', 'Unexpected error')
  }
})

export default appearance
