// List database operations
import { db } from './connection'
import { randomBytes } from 'crypto'
import type { List, ListItem, ListShare, ProfileSharedList, ProfileListShare, Profile } from './types'

export const listDb = {
  create: (profileId: number, name: string, isDefault: boolean = false): List => {
    // If this is the first list or marked as default, set is_default
    const existingLists = listDb.getAll(profileId)
    const shouldBeDefault = isDefault || existingLists.length === 0
    
    const stmt = db.prepare("INSERT INTO lists (profile_id, name, is_default) VALUES (?, ?, ?)")
    const res = stmt.run(profileId, name, shouldBeDefault ? 1 : 0)
    return listDb.getById(res.lastInsertRowid as number)!
  },

  getById: (id: number): List | undefined => {
    return db.prepare("SELECT * FROM lists WHERE id = ? AND deleted_at IS NULL").get(id) as List | undefined
  },

  getAll: (profileId: number): List[] => {
    return db.prepare("SELECT * FROM lists WHERE profile_id = ? AND deleted_at IS NULL ORDER BY is_default DESC, created_at ASC").all(profileId) as List[]
  },

  getDefault: (profileId: number): List | undefined => {
    // Try to get the default list; if none exists, get the first list
    let list = db.prepare("SELECT * FROM lists WHERE profile_id = ? AND is_default = TRUE AND deleted_at IS NULL").get(profileId) as List | undefined
    if (!list) {
      list = db.prepare("SELECT * FROM lists WHERE profile_id = ? AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1").get(profileId) as List | undefined
    }
    return list
  },

  setDefault: (profileId: number, listId: number): void => {
    // Unset current default
    db.prepare("UPDATE lists SET is_default = FALSE WHERE profile_id = ?").run(profileId)
    // Set new default
    db.prepare("UPDATE lists SET is_default = TRUE, dirty = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(listId)
  },

  delete: (id: number): void => {
    db.prepare("UPDATE lists SET deleted_at = CURRENT_TIMESTAMP, dirty = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id)
  },

  addItem: (data: { list_id: number, meta_id: string, type: string, title?: string, poster?: string, imdb_rating?: number }): void => {
    const stmt = db.prepare(`
      INSERT INTO list_items (list_id, meta_id, type, title, poster, imdb_rating, dirty)
      VALUES (?, ?, ?, ?, ?, ?, TRUE)
      ON CONFLICT(list_id, meta_id) DO UPDATE SET
        title = COALESCE(excluded.title, list_items.title),
        poster = COALESCE(excluded.poster, list_items.poster),
        imdb_rating = COALESCE(excluded.imdb_rating, list_items.imdb_rating),
        dirty = TRUE,
        deleted_at = NULL,
        updated_at = CURRENT_TIMESTAMP
    `)
    stmt.run(data.list_id, data.meta_id, data.type, data.title || null, data.poster || null, data.imdb_rating ? parseFloat(data.imdb_rating as any) : null)
  },

  removeItem: (listId: number, metaId: string): void => {
    db.prepare("UPDATE list_items SET deleted_at = CURRENT_TIMESTAMP, dirty = TRUE, updated_at = CURRENT_TIMESTAMP WHERE list_id = ? AND meta_id = ?").run(listId, metaId)
  },

  getItems: (listId: number): ListItem[] => {
    return db.prepare("SELECT * FROM list_items WHERE list_id = ? AND deleted_at IS NULL ORDER BY created_at DESC").all(listId) as ListItem[]
  },

  // Check if item is in ANY list for a profile
  isInAnyList: (profileId: number, metaId: string): boolean => {
    const stmt = db.prepare(`
      SELECT 1 FROM list_items li
      JOIN lists l ON li.list_id = l.id
      WHERE l.profile_id = ? AND li.meta_id = ? AND li.deleted_at IS NULL AND l.deleted_at IS NULL
      LIMIT 1
    `)
    return !!stmt.get(profileId, metaId)
  },

  // Get all lists containing the item
  getListsForItem: (profileId: number, metaId: string): number[] => {
    const stmt = db.prepare(`
      SELECT l.id FROM lists l
      JOIN list_items li ON l.id = li.list_id
      WHERE l.profile_id = ? AND li.meta_id = ? AND li.deleted_at IS NULL AND l.deleted_at IS NULL
    `)
    return (stmt.all(profileId, metaId) as any[]).map(r => r.id)
  },

  // ===== SHARING FUNCTIONS =====

  createShare: (listId: number, sharedByUserId: string, sharedToEmail: string, permission: 'read' | 'add' | 'full' = 'read'): ListShare => {
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30) // 30 day expiry

    const stmt = db.prepare(`
      INSERT INTO list_shares (list_id, shared_by_user_id, shared_to_email, share_token, permission, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    const res = stmt.run(listId, sharedByUserId, sharedToEmail.toLowerCase(), token, permission, expiresAt.toISOString())
    return listDb.getShareById(res.lastInsertRowid as number)!
  },

  getShareById: (id: number): ListShare | undefined => {
    return db.prepare("SELECT * FROM list_shares WHERE id = ?").get(id) as ListShare | undefined
  },

  getShareByToken: (token: string): ListShare | undefined => {
    return db.prepare("SELECT * FROM list_shares WHERE share_token = ?").get(token) as ListShare | undefined
  },

  acceptShare: (token: string, userId: string, profileId?: number): boolean => {
    const share = listDb.getShareByToken(token)
    if (!share || share.status !== 'pending') return false
    if (share.expires_at && new Date(share.expires_at) < new Date()) return false

    db.prepare(`
      UPDATE list_shares SET 
        status = 'accepted', 
        shared_to_user_id = ?, 
        accepted_at = CURRENT_TIMESTAMP 
      WHERE share_token = ?
    `).run(userId, token)

    // If profileId provided, also link the share to that profile
    if (profileId) {
      const updatedShare = listDb.getShareByToken(token)
      if (updatedShare) {
        listDb.linkShareToProfile(updatedShare.id, profileId)
      }
    }

    return true
  },

  declineShare: (token: string): boolean => {
    const share = listDb.getShareByToken(token)
    if (!share || share.status !== 'pending') return false

    db.prepare("UPDATE list_shares SET status = 'declined' WHERE share_token = ?").run(token)
    return true
  },

  leaveShare: (shareId: number, userId: string): boolean => {
    // Only the recipient can leave
    const share = listDb.getShareById(shareId)
    if (!share || share.shared_to_user_id !== userId) return false

    db.prepare("DELETE FROM list_shares WHERE id = ?").run(shareId)
    return true
  },

  revokeShare: (shareId: number, ownerUserId: string): boolean => {
    // Only the owner can revoke
    const share = listDb.getShareById(shareId)
    if (!share || share.shared_by_user_id !== ownerUserId) return false

    db.prepare("DELETE FROM list_shares WHERE id = ?").run(shareId)
    return true
  },

  getSharesForList: (listId: number): ListShare[] => {
    return db.prepare("SELECT * FROM list_shares WHERE list_id = ? ORDER BY created_at DESC").all(listId) as ListShare[]
  },

  getSharedWithUser: (userId: string): (List & { share: ListShare, sharedByName?: string })[] => {
    const shares = db.prepare(`
      SELECT ls.*, l.*, u.name as sharedByName
      FROM list_shares ls
      JOIN lists l ON ls.list_id = l.id
      LEFT JOIN user u ON ls.shared_by_user_id = u.id
      WHERE ls.shared_to_user_id = ? AND ls.status = 'accepted' AND l.deleted_at IS NULL
      ORDER BY ls.accepted_at DESC
    `).all(userId) as any[]

    return shares.map(row => ({
      id: row.list_id,
      profile_id: row.profile_id,
      name: row.name,
      is_default: row.is_default,
      created_at: row.created_at,
      share: {
        id: row.id,
        list_id: row.list_id,
        shared_by_user_id: row.shared_by_user_id,
        shared_to_email: row.shared_to_email,
        shared_to_user_id: row.shared_to_user_id,
        share_token: row.share_token,
        status: row.status,
        permission: row.permission,
        created_at: row.created_at,
        expires_at: row.expires_at,
        accepted_at: row.accepted_at
      },
      sharedByName: row.sharedByName
    }))
  },

  getPendingSharesForEmail: (email: string): (ListShare & { listName: string, sharedByName?: string })[] => {
    return db.prepare(`
      SELECT ls.*, l.name as listName, u.name as sharedByName
      FROM list_shares ls
      JOIN lists l ON ls.list_id = l.id
      LEFT JOIN user u ON ls.shared_by_user_id = u.id
      WHERE LOWER(ls.shared_to_email) = LOWER(?) AND ls.status = 'pending' AND l.deleted_at IS NULL
      ORDER BY ls.created_at DESC
    `).all(email) as (ListShare & { listName: string, sharedByName?: string })[]
  },

  // Check if user has permission to modify a list
  canModifyList: (listId: number, userId: string, profileId?: number): { canAdd: boolean, canRemove: boolean, isOwner: boolean } => {
    // Check if owner (via profile)
    if (profileId) {
      const list = listDb.getById(listId)
      if (list) {
        const profile = db.prepare("SELECT user_id FROM profiles WHERE id = ?").get(list.profile_id) as { user_id: string } | undefined
        if (profile && profile.user_id === userId) {
          return { canAdd: true, canRemove: true, isOwner: true }
        }
      }
    }

    // Check shares
    const share = db.prepare(`
      SELECT permission FROM list_shares 
      WHERE list_id = ? AND shared_to_user_id = ? AND status = 'accepted'
    `).get(listId, userId) as { permission: string } | undefined

    if (!share) return { canAdd: false, canRemove: false, isOwner: false }

    return {
      canAdd: share.permission === 'add' || share.permission === 'full',
      canRemove: share.permission === 'full',
      isOwner: false
    }
  },

  // ===== PROFILE-LEVEL SHARE ACCESS =====

  linkShareToProfile: (shareId: number, profileId: number): boolean => {
    try {
      db.prepare(`
        INSERT OR IGNORE INTO profile_shared_lists (profile_id, list_share_id)
        VALUES (?, ?)
      `).run(profileId, shareId)
      return true
    } catch (e) {
      console.error('Failed to link share to profile:', e)
      return false
    }
  },

  unlinkShareFromProfile: (shareId: number, profileId: number): boolean => {
    const result = db.prepare(`
      DELETE FROM profile_shared_lists WHERE list_share_id = ? AND profile_id = ?
    `).run(shareId, profileId)
    return result.changes > 0
  },

  getProfilesWithShareAccess: (shareId: number): number[] => {
    const rows = db.prepare(`
      SELECT profile_id FROM profile_shared_lists WHERE list_share_id = ?
    `).all(shareId) as { profile_id: number }[]
    return rows.map(r => r.profile_id)
  },

  isShareLinkedToProfile: (shareId: number, profileId: number): boolean => {
    const row = db.prepare(`
      SELECT 1 FROM profile_shared_lists WHERE list_share_id = ? AND profile_id = ? LIMIT 1
    `).get(shareId, profileId)
    return !!row
  },

  getSharedListsForProfile: (profileId: number, userId: string): (List & { share: ListShare, sharedByName?: string, isLinkedToThisProfile: boolean })[] => {
    // Get all shares that the user has accepted
    const allShares = db.prepare(`
      SELECT ls.*, l.*, u.name as sharedByName,
             psl.id as profile_link_id
      FROM list_shares ls
      JOIN lists l ON ls.list_id = l.id
      LEFT JOIN user u ON ls.shared_by_user_id = u.id
      LEFT JOIN profile_shared_lists psl ON ls.id = psl.list_share_id AND psl.profile_id = ?
      WHERE ls.shared_to_user_id = ? AND ls.status = 'accepted' AND l.deleted_at IS NULL
      ORDER BY ls.accepted_at DESC
    `).all(profileId, userId) as any[]

    return allShares.map(row => ({
      id: row.list_id,
      profile_id: row.profile_id,
      name: row.name,
      is_default: row.is_default,
      created_at: row.created_at,
      share: {
        id: row.id,
        list_id: row.list_id,
        shared_by_user_id: row.shared_by_user_id,
        shared_to_email: row.shared_to_email,
        shared_to_user_id: row.shared_to_user_id,
        share_token: row.share_token,
        status: row.status,
        permission: row.permission,
        created_at: row.created_at,
        expires_at: row.expires_at,
        accepted_at: row.accepted_at
      },
      sharedByName: row.sharedByName,
      isLinkedToThisProfile: !!row.profile_link_id
    }))
  },

  getAvailableSharedListsFromOtherProfiles: (profileId: number, userId: string): (List & { share: ListShare, sharedByName?: string, linkedProfiles: number[] })[] => {
    // Get shares that are linked to OTHER profiles of this user but NOT this profile
    const shares = db.prepare(`
      SELECT ls.*, l.*, u.name as sharedByName
      FROM list_shares ls
      JOIN lists l ON ls.list_id = l.id
      LEFT JOIN user u ON ls.shared_by_user_id = u.id
      WHERE ls.shared_to_user_id = ? 
        AND ls.status = 'accepted' 
        AND l.deleted_at IS NULL
        AND ls.id NOT IN (SELECT list_share_id FROM profile_shared_lists WHERE profile_id = ?)
        AND ls.id IN (SELECT list_share_id FROM profile_shared_lists)
      ORDER BY ls.accepted_at DESC
    `).all(userId, profileId) as any[]

    return shares.map(row => ({
      id: row.list_id,
      profile_id: row.profile_id,
      name: row.name,
      is_default: row.is_default,
      created_at: row.created_at,
      share: {
        id: row.id,
        list_id: row.list_id,
        shared_by_user_id: row.shared_by_user_id,
        shared_to_email: row.shared_to_email,
        shared_to_user_id: row.shared_to_user_id,
        share_token: row.share_token,
        status: row.status,
        permission: row.permission,
        created_at: row.created_at,
        expires_at: row.expires_at,
        accepted_at: row.accepted_at
      },
      sharedByName: row.sharedByName,
      linkedProfiles: listDb.getProfilesWithShareAccess(row.id)
    }))
  },

  // ===== PROFILE LIST SHARES (same account, different profiles) =====
  
  createProfileShare: (listId: number, ownerProfileId: number, targetProfileId: number, permission: 'read' | 'add' | 'full' = 'read'): ProfileListShare => {
    const stmt = db.prepare(`
      INSERT INTO profile_list_shares (list_id, owner_profile_id, shared_to_profile_id, permission)
      VALUES (?, ?, ?, ?)
    `)
    const result = stmt.run(listId, ownerProfileId, targetProfileId, permission)
    return {
      id: result.lastInsertRowid as number,
      list_id: listId,
      owner_profile_id: ownerProfileId,
      shared_to_profile_id: targetProfileId,
      permission,
      created_at: new Date().toISOString()
    }
  },

  getProfileSharesForList: (listId: number): (ProfileListShare & { profile?: Profile })[] => {
    const rows = db.prepare(`
      SELECT pls.*, p.name as profile_name, p.avatar as profile_avatar, p.avatar_type
      FROM profile_list_shares pls
      JOIN profiles p ON pls.shared_to_profile_id = p.id
      WHERE pls.list_id = ?
      ORDER BY pls.created_at DESC
    `).all(listId) as any[]
    
    return rows.map(row => ({
      id: row.id,
      list_id: row.list_id,
      owner_profile_id: row.owner_profile_id,
      shared_to_profile_id: row.shared_to_profile_id,
      permission: row.permission,
      created_at: row.created_at,
      profile: {
        id: row.shared_to_profile_id,
        user_id: '',
        name: row.profile_name,
        avatar: row.profile_avatar,
        avatar_type: row.avatar_type,
        avatar_style: '',
        is_default: false,
        created_at: ''
      }
    }))
  },

  getProfileSharedListsForProfile: (profileId: number): (List & { profileShare: ProfileListShare, ownerName?: string })[] => {
    const rows = db.prepare(`
      SELECT l.*, pls.*, p.name as owner_name
      FROM profile_list_shares pls
      JOIN lists l ON pls.list_id = l.id
      JOIN profiles p ON pls.owner_profile_id = p.id
      WHERE pls.shared_to_profile_id = ? AND l.deleted_at IS NULL
      ORDER BY pls.created_at DESC
    `).all(profileId) as any[]
    
    return rows.map(row => ({
      id: row.list_id,
      profile_id: row.owner_profile_id,
      name: row.name,
      is_default: row.is_default,
      created_at: row.created_at,
      profileShare: {
        id: row.id,
        list_id: row.list_id,
        owner_profile_id: row.owner_profile_id,
        shared_to_profile_id: row.shared_to_profile_id,
        permission: row.permission,
        created_at: row.created_at
      },
      ownerName: row.owner_name
    }))
  },

  deleteProfileShare: (shareId: number): boolean => {
    const result = db.prepare(`DELETE FROM profile_list_shares WHERE id = ?`).run(shareId)
    return result.changes > 0
  },

  getProfileShareById: (shareId: number): ProfileListShare | undefined => {
    return db.prepare(`SELECT * FROM profile_list_shares WHERE id = ?`).get(shareId) as ProfileListShare | undefined
  },

  // Allow a profile to leave a share that was given to them
  leaveProfileShare: (shareId: number, profileId: number): boolean => {
    const share = listDb.getProfileShareById(shareId)
    // Only the recipient can leave
    if (!share || share.shared_to_profile_id !== profileId) return false
    
    const result = db.prepare(`DELETE FROM profile_list_shares WHERE id = ?`).run(shareId)
    return result.changes > 0
  }
}
