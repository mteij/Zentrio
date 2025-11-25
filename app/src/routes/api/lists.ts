import { Hono } from 'hono'
import { listDb } from '../../services/database'

const lists = new Hono()

// Get all lists for a profile
lists.get('/', async (c) => {
  const { profileId } = c.req.query()
  const allLists = listDb.getAll(parseInt(profileId))
  return c.json({ lists: allLists })
})

// Create a new list
lists.post('/', async (c) => {
  const { profileId, name } = await c.req.json()
  try {
    const newList = listDb.create(parseInt(profileId), name)
    return c.json({ list: newList })
  } catch (e) {
    return c.json({ error: 'Failed to create list' }, 500)
  }
})

// Delete a list
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
  const items = listDb.getItems(id)
  return c.json({ items })
})

// Add item to list
lists.post('/:id/items', async (c) => {
  const listId = parseInt(c.req.param('id'))
  const { metaId, type, title, poster } = await c.req.json()
  try {
    listDb.addItem({ list_id: listId, meta_id: metaId, type, title, poster })
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

export default lists