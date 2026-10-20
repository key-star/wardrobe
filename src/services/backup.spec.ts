import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/db'
import { getImage, getItem, putImage, putItem } from '@/db/repo'
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

  it('rejects files that are not wardrobe backups', async () => {
    await expect(
      importBackup(new Blob(['not-a-zip']), 'merge'),
    ).rejects.toThrow()
  })
})
