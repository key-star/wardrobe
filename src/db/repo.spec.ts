import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/db'
import {
  deleteItem,
  deleteOutfit,
  deleteSetting,
  getImage,
  getItem,
  getOutfit,
  getSetting,
  listItems,
  listOutfitItems,
  listOutfits,
  listWearLogs,
  putImage,
  putItem,
  putOutfit,
  recordOutfitWear,
  replaceOutfitItems,
  setSetting,
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

describe('wear log repository', () => {
  async function seedOutfit() {
    const outfit = createEmptyOutfit()
    await putOutfit(outfit)
    const top = createEmptyItem('top')
    const bottom = createEmptyItem('bottom')
    await putItem(top)
    await putItem(bottom)
    await replaceOutfitItems(outfit.id, [
      { id: 'p1', outfitId: outfit.id, itemId: top.id, slot: 'top', layer: 20 },
      { id: 'p2', outfitId: outfit.id, itemId: bottom.id, slot: 'bottom', layer: 40 },
    ])
    return { outfit, top, bottom }
  }

  it('records a wear log and marks its items worn', async () => {
    const { outfit, top, bottom } = await seedOutfit()

    const result = await recordOutfitWear({
      date: '2026-10-22',
      outfitId: outfit.id,
      itemIds: [top.id, bottom.id],
      occasion: 'commute',
      weather: '22° 晴',
    })

    expect(result.created).toBe(true)
    expect(result.log).toMatchObject({
      date: '2026-10-22',
      outfitId: outfit.id,
      occasion: 'commute',
      weather: '22° 晴',
    })

    const updatedTop = await getItem(top.id)
    const updatedBottom = await getItem(bottom.id)
    expect(updatedTop).toMatchObject({
      wearCount: 1,
      lastWornAt: '2026-10-22',
      cleanState: 'worn',
    })
    expect(updatedBottom?.wearCount).toBe(1)
  })

  it('updates the same outfit record instead of logging twice', async () => {
    const { outfit, top, bottom } = await seedOutfit()

    await recordOutfitWear({
      date: '2026-10-22',
      outfitId: outfit.id,
      itemIds: [top.id, bottom.id],
      occasion: 'commute',
    })
    const second = await recordOutfitWear({
      date: '2026-10-22',
      outfitId: outfit.id,
      itemIds: [top.id, bottom.id],
      occasion: 'date',
    })

    expect(second.created).toBe(false)
    expect(await listWearLogs()).toHaveLength(1)
    expect(second.log.occasion).toBe('date')
    expect((await getItem(top.id))?.wearCount).toBe(1)
  })

  it('keeps multiple outfits on the same day and sorts by date', async () => {
    const { outfit, top, bottom } = await seedOutfit()
    const other = createEmptyOutfit()
    await putOutfit(other)

    await recordOutfitWear({
      date: '2026-10-22',
      outfitId: outfit.id,
      itemIds: [top.id, bottom.id],
    })
    await recordOutfitWear({
      date: '2026-10-22',
      outfitId: other.id,
      itemIds: [top.id],
    })
    await recordOutfitWear({
      date: '2026-10-21',
      outfitId: outfit.id,
      itemIds: [top.id],
    })

    const logs = await listWearLogs()
    expect(logs).toHaveLength(3)
    expect(logs.map((log) => log.date)).toEqual(['2026-10-22', '2026-10-22', '2026-10-21'])
  })
})

describe('settings repository', () => {
  it('stores and deletes settings', async () => {
    await setSetting('weatherLocation', { name: '杭州' })
    expect(await getSetting('weatherLocation')).toEqual({ name: '杭州' })

    await deleteSetting('weatherLocation')
    expect(await getSetting('weatherLocation')).toBeUndefined()
  })
})
