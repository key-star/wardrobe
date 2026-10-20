import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/db'
import {
  deleteItem,
  getImage,
  getItem,
  listItems,
  putImage,
  putItem,
} from '@/db/repo'
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
