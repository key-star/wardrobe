import { db } from './db'
import type {
  ImageKind,
  Item,
  Outfit,
  OutfitItem,
  SettingRow,
  StoredImage,
} from './types'

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function imageKey(itemId: string, kind: ImageKind): string {
  return `${itemId}:${kind}`
}

export async function listItems(): Promise<Item[]> {
  const rows = await db.items.toArray()
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getItem(id: string): Promise<Item | undefined> {
  return db.items.get(id)
}

export async function putItem(item: Item): Promise<void> {
  await db.items.put(item)
}

export async function putImage(
  itemId: string,
  kind: ImageKind,
  blob: Blob,
): Promise<void> {
  const row: StoredImage = { id: imageKey(itemId, kind), itemId, kind, blob }
  await db.images.put(row)
}

export async function getImage(
  itemId: string,
  kind: ImageKind,
): Promise<Blob | undefined> {
  const row = await db.images.get(imageKey(itemId, kind))
  return row?.blob
}

export async function deleteImage(itemId: string, kind: ImageKind): Promise<void> {
  await db.images.delete(imageKey(itemId, kind))
}

export async function listImages(): Promise<StoredImage[]> {
  return db.images.toArray()
}

export async function deleteItem(id: string): Promise<void> {
  await db.transaction('rw', db.items, db.images, db.outfitItems, async () => {
    await db.images.where('itemId').equals(id).delete()
    await db.outfitItems.where('itemId').equals(id).delete()
    await db.items.delete(id)
  })
}

export async function listOutfits(): Promise<Outfit[]> {
  const rows = await db.outfits.toArray()
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getOutfit(id: string): Promise<Outfit | undefined> {
  return db.outfits.get(id)
}

export async function putOutfit(outfit: Outfit): Promise<void> {
  await db.outfits.put(outfit)
}

export async function listOutfitItems(outfitId?: string): Promise<OutfitItem[]> {
  if (outfitId) {
    return db.outfitItems.where('outfitId').equals(outfitId).toArray()
  }
  return db.outfitItems.toArray()
}

export async function replaceOutfitItems(
  outfitId: string,
  items: OutfitItem[],
): Promise<void> {
  await db.transaction('rw', db.outfitItems, async () => {
    await db.outfitItems.where('outfitId').equals(outfitId).delete()
    if (items.length) await db.outfitItems.bulkPut(items)
  })
}

export async function deleteOutfit(id: string): Promise<void> {
  await db.transaction('rw', db.outfits, db.outfitItems, async () => {
    await db.outfitItems.where('outfitId').equals(id).delete()
    await db.outfits.delete(id)
  })
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const row = await db.settings.get(key)
  return row?.value as T | undefined
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const row: SettingRow = { key, value }
  await db.settings.put(row)
}

export async function countItems(): Promise<number> {
  return db.items.count()
}
