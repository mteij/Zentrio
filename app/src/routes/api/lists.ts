import { listDb, userDb, profileDb, watchHistoryDb, type User, type ListShare } from '../../services/database'
import { sessionMiddleware } from '../../middleware/session'
import { emailService } from '../../services/email'
import { getConfig } from '../../services/envParser'
import { createTaggedOpenAPIApp } from './openapi-route'

const lists = createTaggedOpenAPIApp<{
  Variables: {
    user: User
  }
}>('Lists')

// Get all lists for a profile
lists.get('/', async (c) => {
  const { profileId } = c.req.query()
  const allLists = listDb.getAll(parseInt(profileId))
  return c.json({ lists: allLists })
})

// Get default list for profile
lists.get('/default', async (c) => {
  const { profileId } = c.req.query()
  const list = listDb.getDefault(parseInt(profileId))
  return c.json({ list })
})

// Create a new list
lists.post('/', async (c) => {
  const { profileId, name, isDefault } = await c.req.json()
  try {
    const newList = listDb.create(parseInt(profileId), name, isDefault)
    return c.json({ list: newList })
  } catch (e) {
    return c.json({ error: 'Failed to create list' }, 500)
  }
})

// Set default list
lists.put('/:id/default', async (c) => {
  const listId = parseInt(c.req.param('id'))
  const { profileId } = await c.req.json()
  try {
    listDb.setDefault(parseInt(profileId), listId)
    return c.json({ success: true })
  } catch (e) {
    return c.json({ error: 'Failed to set default list' }, 500)
  }
})

// Delete a list (owner only)
lists.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  try {
    listDb.delete(id)
    return c.json({ success: true })
  } catch (e) {
    return c.json({ error: 'Failed to delete list' }, 500)
  }
})

// Get items in a list
lists.get('/:id/items', async (c) => {
  const id = parseInt(c.req.param('id'))
  const { profileId } = c.req.query()
  const items = listDb.getItems(id)

  if (profileId) {
    // Enrich with watch status
    const distinctIds = new Set<string>()
    items.forEach(i => {
        distinctIds.add(i.meta_id)
        if (i.meta_id.startsWith('tmdb:')) {
            distinctIds.add(i.meta_id.replace('tmdb:', ''))
        }
    })
    
    // @ts-ignore
    const ids = Array.from(distinctIds)
    const statusMap = watchHistoryDb.getBatchStatus(parseInt(profileId), ids)
    
    const enrichedItems = items.map(item => {
      let status = statusMap[item.meta_id]
      if (!status && item.meta_id.startsWith('tmdb:')) {
          status = statusMap[item.meta_id.replace('tmdb:', '')]
      }
      
      if (status) {
        return { 
          ...item, 
          is_watched: status.isWatched, 
          progress_percent: status.progress 
        }
      }
      return item
    })
    return c.json({ items: enrichedItems })
  }

  return c.json({ items })
})

// Add item to list
lists.post('/:id/items', async (c) => {
  const listId = parseInt(c.req.param('id'))
  const { metaId, type, title, poster, imdbRating } = await c.req.json()
  try {
    listDb.addItem({ list_id: listId, meta_id: metaId, type, title, poster, imdb_rating: imdbRating })
    return c.json({ success: true })
  } catch (e) {
    return c.json({ error: 'Failed to add item' }, 500)
  }
})

// Remove item from list
lists.delete('/:id/items/:metaId', async (c) => {
  const listId = parseInt(c.req.param('id'))
  const metaId = c.req.param('metaId')
  try {
    listDb.removeItem(listId, metaId)
    return c.json({ success: true })
  } catch (e) {
    return c.json({ error: 'Failed to remove item' }, 500)
  }
})

// Check which lists an item is in
lists.get('/check/:metaId', async (c) => {
  const metaId = c.req.param('metaId')
  const { profileId } = c.req.query()
  const listIds = listDb.getListsForItem(parseInt(profileId), metaId)
  return c.json({ listIds })
})

// ===== SHARING ENDPOINTS =====

// Get share details by token (public - for viewing invitation)
lists.get('/share/:token', async (c) => {
  const token = c.req.param('token')
  const share = listDb.getShareByToken(token)
  
  if (!share) {
    return c.json({ error: 'Share not found or expired' }, 404)
  }

  // Check expiry
  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return c.json({ error: 'Share invitation has expired' }, 410)
  }

  const list = listDb.getById(share.list_id)
  const sharedBy = userDb.findById(share.shared_by_user_id)
  const itemCount = listDb.getItems(share.list_id).length

  return c.json({
    share: {
      id: share.id,
      status: share.status,
      permission: share.permission,
      created_at: share.created_at,
      expires_at: share.expires_at
    },
    list: list ? { id: list.id, name: list.name } : null,
    itemCount,
    sharedBy: sharedBy ? { name: sharedBy.name } : null
  })
})

// Accept share (requires auth)
lists.post('/share/:token/accept', sessionMiddleware, async (c) => {
  const token = c.req.param('token')
  const user = c.get('user')
  const body = await c.req.json().catch(() => ({}))
  const profileId = body.profileId ? parseInt(body.profileId) : undefined

  const share = listDb.getShareByToken(token)
  if (!share) {
    return c.json({ error: 'Share not found' }, 404)
  }

  if (share.status !== 'pending') {
    return c.json({ error: 'Share already processed' }, 400)
  }

  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return c.json({ error: 'Share invitation has expired' }, 410)
  }

  // Verify that the logged-in user is the intended recipient
  if (share.shared_to_email.toLowerCase() !== user.email.toLowerCase()) {
    return c.json({ error: 'This invitation was sent to a different email address' }, 403)
  }

  // Prevent owner from accepting their own share
  if (share.shared_by_user_id === user.id) {
    return c.json({ error: 'You cannot accept your own share invitation' }, 400)
  }

  const success = listDb.acceptShare(token, user.id, profileId)
  if (!success) {
    return c.json({ error: 'Failed to accept share' }, 500)
  }

  return c.json({ success: true })
})

// Decline share (public - can be done without auth)
lists.post('/share/:token/decline', async (c) => {
  const token = c.req.param('token')

  const success = listDb.declineShare(token)
  if (!success) {
    return c.json({ error: 'Failed to decline share or already processed' }, 400)
  }

  return c.json({ success: true })
})

// Share a list (requires auth)
lists.post('/:id/share', sessionMiddleware, async (c) => {
  const listId = parseInt(c.req.param('id'))
  const user = c.get('user')
  const { email, permission = 'read' } = await c.req.json()

  if (!email) {
    return c.json({ error: 'Email is required' }, 400)
  }

  // Validate permission
  if (!['read', 'add', 'full'].includes(permission)) {
    return c.json({ error: 'Invalid permission' }, 400)
  }

  // Verify user owns this list
  const list = listDb.getById(listId)
  if (!list) {
    return c.json({ error: 'List not found' }, 404)
  }

  const profile = profileDb.findById(list.profile_id)
  if (!profile || profile.user_id !== user.id) {
    return c.json({ error: 'You do not own this list' }, 403)
  }

  // Can't share with yourself
  if (email.toLowerCase() === user.email.toLowerCase()) {
    return c.json({ error: 'Cannot share with yourself' }, 400)
  }

  try {
    const share = listDb.createShare(listId, user.id, email, permission)

    // Send email invitation
    const cfg = getConfig()
    const baseUrl = cfg.APP_URL || 'http://localhost:3000'
    const acceptUrl = `${baseUrl}/share/${share.share_token}`

    let emailSent = false
    try {
      emailSent = await emailService.sendListShareInvitation(
        email,
        user.name || user.email,
        list.name,
        acceptUrl
      )
    } catch (e) {
      console.error('Failed to send share email:', e)
    }

    return c.json({ share, emailSent })
  } catch (e) {
    console.error('Failed to create share:', e)
    return c.json({ error: 'Failed to create share' }, 500)
  }
})

// Get shares for a list (requires auth, owner only)
lists.get('/:id/shares', sessionMiddleware, async (c) => {
  const listId = parseInt(c.req.param('id'))
  const user = c.get('user')

  // Verify user owns this list
  const list = listDb.getById(listId)
  if (!list) {
    return c.json({ error: 'List not found' }, 404)
  }

  const profile = profileDb.findById(list.profile_id)
  if (!profile || profile.user_id !== user.id) {
    return c.json({ error: 'You do not own this list' }, 403)
  }

  const shares = listDb.getSharesForList(listId)
  return c.json({ shares })
})

// Revoke a share (requires auth, owner only)
lists.delete('/:id/shares/:shareId', sessionMiddleware, async (c) => {
  const listId = parseInt(c.req.param('id'))
  const shareId = parseInt(c.req.param('shareId'))
  const user = c.get('user')

  // Verify user owns this list
  const list = listDb.getById(listId)
  if (!list) {
    return c.json({ error: 'List not found' }, 404)
  }

  const profile = profileDb.findById(list.profile_id)
  if (!profile || profile.user_id !== user.id) {
    return c.json({ error: 'You do not own this list' }, 403)
  }

  const success = listDb.revokeShare(shareId, user.id)
  if (!success) {
    return c.json({ error: 'Failed to revoke share' }, 400)
  }

  return c.json({ success: true })
})

// Leave a shared list (requires auth)
lists.post('/shares/:shareId/leave', sessionMiddleware, async (c) => {
  const shareId = parseInt(c.req.param('shareId'))
  const user = c.get('user')

  const success = listDb.leaveShare(shareId, user.id)
  if (!success) {
    return c.json({ error: 'Failed to leave list' }, 400)
  }

  return c.json({ success: true })
})

// Get lists shared with current user (requires auth)
lists.get('/shared-with-me', sessionMiddleware, async (c) => {
  const user = c.get('user')
  const lists = listDb.getSharedWithUser(user.id)
  return c.json({ lists })
})

// Get pending share invitations for current user (requires auth)
lists.get('/pending-invites', sessionMiddleware, async (c) => {
  const user = c.get('user')
  const invites = listDb.getPendingSharesForEmail(user.email)
  return c.json({ invites })
})

// ===== PROFILE-LEVEL SHARE ACCESS ENDPOINTS =====

// Get shared lists for a specific profile (requires auth)
lists.get('/shared-for-profile/:profileId', sessionMiddleware, async (c) => {
  const profileId = parseInt(c.req.param('profileId'))
  const user = c.get('user')

  // Verify user owns this profile
  const profile = profileDb.findById(profileId)
  if (!profile || profile.user_id !== user.id) {
    return c.json({ error: 'Profile not found' }, 404)
  }

  const sharedLists = listDb.getSharedListsForProfile(profileId, user.id)
  return c.json({ lists: sharedLists })
})

// Get shared lists available from other profiles (requires auth)
lists.get('/available-from-other-profiles/:profileId', sessionMiddleware, async (c) => {
  const profileId = parseInt(c.req.param('profileId'))
  const user = c.get('user')

  // Verify user owns this profile
  const profile = profileDb.findById(profileId)
  if (!profile || profile.user_id !== user.id) {
    return c.json({ error: 'Profile not found' }, 404)
  }

  const availableLists = listDb.getAvailableSharedListsFromOtherProfiles(profileId, user.id)
  return c.json({ lists: availableLists })
})

// Link a shared list to a profile (requires auth)
lists.post('/shares/:shareId/link/:profileId', sessionMiddleware, async (c) => {
  const shareId = parseInt(c.req.param('shareId'))
  const profileId = parseInt(c.req.param('profileId'))
  const user = c.get('user')

  // Verify user owns this profile
  const profile = profileDb.findById(profileId)
  if (!profile || profile.user_id !== user.id) {
    return c.json({ error: 'Profile not found' }, 404)
  }

  // Verify user has access to this share
  const share = listDb.getShareById(shareId)
  if (!share || share.shared_to_user_id !== user.id) {
    return c.json({ error: 'Share not found or not accessible' }, 404)
  }

  const success = listDb.linkShareToProfile(shareId, profileId)
  if (!success) {
    return c.json({ error: 'Failed to link share to profile' }, 500)
  }

  return c.json({ success: true })
})

// Unlink a shared list from a profile (requires auth)
lists.delete('/shares/:shareId/link/:profileId', sessionMiddleware, async (c) => {
  const shareId = parseInt(c.req.param('shareId'))
  const profileId = parseInt(c.req.param('profileId'))
  const user = c.get('user')

  // Verify user owns this profile
  const profile = profileDb.findById(profileId)
  if (!profile || profile.user_id !== user.id) {
    return c.json({ error: 'Profile not found' }, 404)
  }

  // Verify user has access to this share
  const share = listDb.getShareById(shareId)
  if (!share || share.shared_to_user_id !== user.id) {
    return c.json({ error: 'Share not found or not accessible' }, 404)
  }

  const success = listDb.unlinkShareFromProfile(shareId, profileId)
  if (!success) {
    return c.json({ error: 'Failed to unlink share from profile' }, 500)
  }

  return c.json({ success: true })
})


// ===== PROFILE-TO-PROFILE SHARING (within same account) =====

// Get lists shared to a profile from other profiles in the same account
lists.get('/profile-shared/:profileId', sessionMiddleware, async (c) => {
  const profileId = parseInt(c.req.param('profileId'))
  const user = c.get('user')

  // Verify user owns this profile
  const profile = profileDb.findById(profileId)
  if (!profile || profile.user_id !== user.id) {
    return c.json({ error: 'Profile not found' }, 404)
  }

  const sharedLists = listDb.getProfileSharedListsForProfile(profileId)
  return c.json({ lists: sharedLists })
})

// Share a list with another profile in the same account
lists.post('/:id/share-with-profile', sessionMiddleware, async (c) => {
  const listId = parseInt(c.req.param('id'))
  const user = c.get('user')
  const { targetProfileId, permission = 'read' } = await c.req.json()

  if (!targetProfileId) {
    return c.json({ error: 'Target profile ID is required' }, 400)
  }

  // Validate permission
  if (!['read', 'add', 'full'].includes(permission)) {
    return c.json({ error: 'Invalid permission' }, 400)
  }

  // Verify user owns this list
  const list = listDb.getById(listId)
  if (!list) {
    return c.json({ error: 'List not found' }, 404)
  }

  const ownerProfile = profileDb.findById(list.profile_id)
  if (!ownerProfile || ownerProfile.user_id !== user.id) {
    return c.json({ error: 'You do not own this list' }, 403)
  }

  // Verify target profile belongs to same user
  const targetProfile = profileDb.findById(targetProfileId)
  if (!targetProfile || targetProfile.user_id !== user.id) {
    return c.json({ error: 'Target profile not found' }, 404)
  }

  // Can't share with the same profile that owns the list
  if (targetProfileId === list.profile_id) {
    return c.json({ error: 'Cannot share with the list owner profile' }, 400)
  }

  try {
    const share = listDb.createProfileShare(listId, list.profile_id, targetProfileId, permission)
    return c.json({ share })
  } catch (e: any) {
    if (e.message?.includes('UNIQUE constraint')) {
      return c.json({ error: 'Already shared with this profile' }, 400)
    }
    console.error('Failed to create profile share:', e)
    return c.json({ error: 'Failed to share list' }, 500)
  }
})

// Get profile shares for a list (owner only)
lists.get('/:id/profile-shares', sessionMiddleware, async (c) => {
  const listId = parseInt(c.req.param('id'))
  const user = c.get('user')

  // Verify user owns this list
  const list = listDb.getById(listId)
  if (!list) {
    return c.json({ error: 'List not found' }, 404)
  }

  const ownerProfile = profileDb.findById(list.profile_id)
  if (!ownerProfile || ownerProfile.user_id !== user.id) {
    return c.json({ error: 'You do not own this list' }, 403)
  }

  const shares = listDb.getProfileSharesForList(listId)
  return c.json({ shares })
})

// Remove profile share (owner only)
lists.delete('/:id/profile-shares/:shareId', sessionMiddleware, async (c) => {
  const listId = parseInt(c.req.param('id'))
  const shareId = parseInt(c.req.param('shareId'))
  const user = c.get('user')

  // Verify user owns this list
  const list = listDb.getById(listId)
  if (!list) {
    return c.json({ error: 'List not found' }, 404)
  }

  const ownerProfile = profileDb.findById(list.profile_id)
  if (!ownerProfile || ownerProfile.user_id !== user.id) {
    return c.json({ error: 'You do not own this list' }, 403)
  }

  // Verify share exists for this list
  const share = listDb.getProfileShareById(shareId)
  if (!share || share.list_id !== listId) {
    return c.json({ error: 'Share not found' }, 404)
  }

  const success = listDb.deleteProfileShare(shareId)
  if (!success) {
    return c.json({ error: 'Failed to remove share' }, 500)
  }

  return c.json({ success: true })
})

// Leave a profile share (recipient can leave)
lists.post('/profile-shares/:shareId/leave/:profileId', sessionMiddleware, async (c) => {
  const shareId = parseInt(c.req.param('shareId'))
  const profileId = parseInt(c.req.param('profileId'))
  const user = c.get('user')

  // Verify user owns this profile
  const profile = profileDb.findById(profileId)
  if (!profile || profile.user_id !== user.id) {
    return c.json({ error: 'Profile not found' }, 404)
  }

  // Verify share exists and is for this profile
  const share = listDb.getProfileShareById(shareId)
  if (!share || share.shared_to_profile_id !== profileId) {
    return c.json({ error: 'Share not found' }, 404)
  }

  const success = listDb.leaveProfileShare(shareId, profileId)
  if (!success) {
    return c.json({ error: 'Failed to leave list' }, 500)
  }

  return c.json({ success: true })
})

export default lists
