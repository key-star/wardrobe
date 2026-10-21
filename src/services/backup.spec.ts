import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/db'
import {
  getImage,
  getItem,
  getOutfit,
  listOutfitItems,
  putImage,
  putItem,
  putOutfit,
  replaceOutfitItems,
} from '@/db/repo'
import type { OutfitItem } from '@/db/types'
import { createEmptyOutfit } from '@/stores/outfits'
import { createEmptyItem } from '@/stores/wardrobe'
import { buildBackup, importBackup } from '@/services/backup'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

async function seed() {
  const item = createEmptyItem('top')
  item.name = '白衬衫'
  item.seasons = ['spring', 'autumn']
  item.tags = ['基础款']
  item.thumb = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' })
  await putItem(item)
  await putImage(
    item.id,
    'original',
    new Blob([new Uint8Array([4, 5, 6])], { type: 'image/webp' }),
  )
  return item
}

describe('backup', () => {
  it('round-trips items, thumbnails and images', async () => {
    const item = await seed()
    const backup = await buildBackup()
    expect(backup.size).toBeGreaterThan(0)

    await db.delete()
    await db.open()

    const result = await importBackup(backup, 'replace')
    expect(result.items).toBe(1)

    const restored = await getItem(item.id)
    expect(restored?.name).toBe('白衬衫')
    expect(restored?.seasons).toEqual(['spring', 'autumn'])
    expect(restored?.tags).toEqual(['基础款'])
    expect(restored?.thumb).toBeInstanceOf(Blob)

    const original = await getImage(item.id, 'original')
    expect(new Uint8Array(await original!.arrayBuffer())).toEqual(
      new Uint8Array([4, 5, 6]),
    )
  })

  it('merge mode keeps existing rows and upserts by id', async () => {
    const item = await seed()
    const backup = await buildBackup()

    await importBackup(backup, 'merge')
    await importBackup(backup, 'merge')

    expect((await db.items.toArray()).filter((i) => i.id === item.id)).toHaveLength(1)
    expect(await db.items.count()).toBe(1)
  })

  it('round-trips outfits, pieces and covers', async () => {
    const item = await seed()
    const outfit = createEmptyOutfit()
    outfit.name = '通勤周一'
    outfit.seasons = ['spring']
    outfit.occasions = ['commute']
    outfit.favorite = true
    outfit.cover = new Blob([new Uint8Array([7, 8, 9])], { type: 'image/webp' })
    await putOutfit(outfit)

    const piece: OutfitItem = {
      id: 'piece-1',
      outfitId: outfit.id,
      itemId: item.id,
      slot: 'top',
      layer: 20,
    }
    await replaceOutfitItems(outfit.id, [piece])

    const backup = await buildBackup()
    await db.delete()
    await db.open()

    const result = await importBackup(backup, 'replace')
    expect(result.outfits).toBe(1)
    expect(result.outfitItems).toBe(1)

    const restored = await getOutfit(outfit.id)
    expect(restored?.name).toBe('通勤周一')
    expect(restored?.seasons).toEqual(['spring'])
    expect(restored?.occasions).toEqual(['commute'])
    expect(restored?.favorite).toBe(true)
    expect(new Uint8Array(await restored!.cover!.arrayBuffer())).toEqual(
      new Uint8Array([7, 8, 9]),
    )

    const pieces = await listOutfitItems(outfit.id)
    expect(pieces).toHaveLength(1)
    expect(pieces[0]).toMatchObject({ itemId: item.id, slot: 'top', layer: 20 })
  })

  it('replace mode clears existing outfits when the backup has them', async () => {
    await seed()
    const outfit = createEmptyOutfit()
    outfit.name = '备份里的搭配'
    await putOutfit(outfit)
    const backup = await buildBackup()

    const extra = createEmptyOutfit()
    extra.name = '多余搭配'
    await putOutfit(extra)

    await importBackup(backup, 'replace')

    expect(await db.outfits.count()).toBe(1)
    expect((await db.outfits.toArray())[0].name).toBe('备份里的搭配')
  })

  it('rejects files that are not wardrobe backups', async () => {
    await expect(
      importBackup(new Blob(['not-a-zip']), 'merge'),
    ).rejects.toThrow()
  })
})
