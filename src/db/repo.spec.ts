import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/db'
import {
  deleteItem,
  deleteOutfit,
  getImage,
  getItem,
  getOutfit,
  listItems,
  listOutfitItems,
  listOutfits,
  putImage,
  putItem,
  putOutfit,
  replaceOutfitItems,
} from '@/db/repo'
import type { OutfitItem } from '@/db/types'
import { createEmptyOutfit } from '@/stores/outfits'
import { createEmptyItem } from '@/stores/wardrobe'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('item repository', () => {
  it('stores and reads an item', async () => {
    const item = createEmptyItem('top')
    item.name = '白色亚麻衬衫'
    await putItem(item)

    const found = await getItem(item.id)
    expect(found?.name).toBe('白色亚麻衬衫')
    expect(await listItems()).toHaveLength(1)
  })

  it('stores images separately from the item row', async () => {
    const item = createEmptyItem('shoes')
    await putItem(item)
    await putImage(item.id, 'original', new Blob(['abc'], { type: 'image/webp' }))

    const blob = await getImage(item.id, 'original')
    expect(blob).toBeInstanceOf(Blob)
    expect(await blob!.text()).toBe('abc')
  })

  it('removes images together with the item', async () => {
    const item = createEmptyItem('bag')
    await putItem(item)
    await putImage(item.id, 'original', new Blob(['x']))
    await putImage(item.id, 'cutout', new Blob(['y']))

    await deleteItem(item.id)

    expect(await getItem(item.id)).toBeUndefined()
    expect(await getImage(item.id, 'original')).toBeUndefined()
    expect(await getImage(item.id, 'cutout')).toBeUndefined()
  })
})

describe('outfit repository', () => {
  it('stores an outfit with its pieces', async () => {
    const outfit = createEmptyOutfit()
    outfit.name = '通勤周一'
    await putOutfit(outfit)

    const piece: OutfitItem = {
      id: 'piece-1',
      outfitId: outfit.id,
      itemId: 'item-1',
      slot: 'top',
      layer: 20,
    }
    await replaceOutfitItems(outfit.id, [piece])

    expect(await listOutfits()).toHaveLength(1)
    expect(await getOutfit(outfit.id)).toMatchObject({ name: '通勤周一' })
    expect(await listOutfitItems(outfit.id)).toHaveLength(1)
  })

  it('replaces all pieces of one outfit', async () => {
    const outfit = createEmptyOutfit()
    await putOutfit(outfit)
    await replaceOutfitItems(outfit.id, [
      { id: 'a', outfitId: outfit.id, itemId: 'item-1', slot: 'top', layer: 20 },
      { id: 'b', outfitId: outfit.id, itemId: 'item-2', slot: 'bottom', layer: 40 },
    ])
    await replaceOutfitItems(outfit.id, [
      { id: 'c', outfitId: outfit.id, itemId: 'item-3', slot: 'shoes', layer: 50 },
    ])

    const rows = await listOutfitItems(outfit.id)
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('c')
  })

  it('removes outfit pieces when the item is deleted', async () => {
    const item = createEmptyItem('top')
    await putItem(item)
    const outfit = createEmptyOutfit()
    await putOutfit(outfit)
    await replaceOutfitItems(outfit.id, [
      { id: 'piece-1', outfitId: outfit.id, itemId: item.id, slot: 'top', layer: 20 },
    ])

    await deleteItem(item.id)

    expect(await listOutfitItems(outfit.id)).toHaveLength(0)
    expect(await getOutfit(outfit.id)).toBeDefined()
  })

  it('deletes the outfit together with its pieces', async () => {
    const outfit = createEmptyOutfit()
    await putOutfit(outfit)
    await replaceOutfitItems(outfit.id, [
      { id: 'piece-1', outfitId: outfit.id, itemId: 'item-1', slot: 'top', layer: 20 },
    ])

    await deleteOutfit(outfit.id)

    expect(await getOutfit(outfit.id)).toBeUndefined()
    expect(await listOutfitItems(outfit.id)).toHaveLength(0)
  })
})
