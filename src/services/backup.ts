import { strFromU8, strToU8, unzipSync, zip } from 'fflate'
import { db } from '@/db/db'
import { imageKey } from '@/db/repo'
import type { ImageKind, Item, Outfit, OutfitItem, SettingRow } from '@/db/types'

export const BACKUP_FORMAT = 'wardrobe-backup'
export const BACKUP_VERSION = 1

export interface BackupManifest {
  format: string
  version: number
  exportedAt: string
  counts: {
    items: number
    images: number
    outfits?: number
    outfitItems?: number
  }
}

interface BackupItem extends Omit<Item, 'thumb'> {
  thumbFile?: string
}

interface BackupOutfit extends Omit<Outfit, 'cover'> {
  coverFile?: string
}

async function blobToU8(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

export function backupFileName(d = new Date()): string {
  return `wardrobe-${stamp(d)}.wardrobe`
}

export async function buildBackup(): Promise<Blob> {
  const items = await db.items.toArray()
  const images = await db.images.toArray()
  const outfits = await db.outfits.toArray()
  const outfitItems = await db.outfitItems.toArray()
  const settings = await db.settings.toArray()

  const files: Record<string, Uint8Array> = {}
  const manifestItems: BackupItem[] = []
  const manifestOutfits: BackupOutfit[] = []

  for (const item of items) {
    const { thumb, ...rest } = item
    const record: BackupItem = { ...rest }
    if (thumb) {
      const path = `thumbs/${item.id}.webp`
      files[path] = await blobToU8(thumb)
      record.thumbFile = path
    }
    manifestItems.push(record)
  }

  for (const image of images) {
    files[`images/${image.itemId}.${image.kind}.webp`] = await blobToU8(image.blob)
  }

  for (const outfit of outfits) {
    const { cover, ...rest } = outfit
    const record: BackupOutfit = { ...rest }
    if (cover) {
      const path = `covers/${outfit.id}.webp`
      files[path] = await blobToU8(cover)
      record.coverFile = path
    }
    manifestOutfits.push(record)
  }

  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    counts: {
      items: items.length,
      images: images.length,
      outfits: outfits.length,
      outfitItems: outfitItems.length,
    },
  }

  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2))
  files['items.json'] = strToU8(JSON.stringify(manifestItems))
  files['outfits.json'] = strToU8(JSON.stringify(manifestOutfits))
  files['outfitItems.json'] = strToU8(JSON.stringify(outfitItems))
  files['settings.json'] = strToU8(JSON.stringify(settings))
  files['README.txt'] = strToU8(
    '这是「衣橱」的备份文件。请勿解压修改。在新设备上用「导入备份」即可恢复。\n',
  )

  return new Promise<Blob>((resolve, reject) => {
    zip(files, { level: 6 }, (err, data) => {
      if (err) reject(err)
      else resolve(new Blob([data as BlobPart], { type: 'application/zip' }))
    })
  })
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export type ImportMode = 'replace' | 'merge'

export interface ImportResult {
  items: number
  images: number
  outfits: number
  outfitItems: number
  mode: ImportMode
}

function parseJson<T>(files: Record<string, Uint8Array>, name: string): T {
  const raw = files[name]
  if (!raw) throw new Error(`备份缺少 ${name}`)
  return JSON.parse(strFromU8(raw)) as T
}

const IMAGE_KINDS: ImageKind[] = ['original', 'cutout']

export async function importBackup(
  file: Blob,
  mode: ImportMode = 'merge',
): Promise<ImportResult> {
  const buffer = new Uint8Array(await file.arrayBuffer())
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(buffer)
  } catch {
    throw new Error('无法解压，文件可能已损坏')
  }

  const manifest = parseJson<BackupManifest>(files, 'manifest.json')
  if (manifest.format !== BACKUP_FORMAT) throw new Error('不是有效的衣橱备份文件')
  if (manifest.version > BACKUP_VERSION) {
    throw new Error('备份来自更新的版本，请先升级应用')
  }

  const rawItems = parseJson<BackupItem[]>(files, 'items.json')
  const rawOutfits = files['outfits.json']
    ? parseJson<BackupOutfit[]>(files, 'outfits.json')
    : []
  const rawOutfitItems = files['outfitItems.json']
    ? parseJson<OutfitItem[]>(files, 'outfitItems.json')
    : []
  const settings = files['settings.json']
    ? parseJson<SettingRow[]>(files, 'settings.json')
    : []

  const items: Item[] = []
  const images: { id: string; itemId: string; kind: ImageKind; blob: Blob }[] = []
  const outfits: Outfit[] = []
  const outfitItems: OutfitItem[] = []

  for (const raw of rawItems) {
    if (!raw || typeof raw.id !== 'string' || typeof raw.category !== 'string') continue
    const { thumbFile, ...rest } = raw
    const item: Item = {
      ...(rest as Item),
      seasons: rest.seasons ?? [],
      styles: rest.styles ?? [],
      tags: rest.tags ?? [],
      attrs: rest.attrs ?? {},
      wearCount: rest.wearCount ?? 0,
      status: rest.status ?? 'active',
      cleanState: rest.cleanState ?? 'clean',
      hasOriginal: rest.hasOriginal ?? false,
      hasCutout: rest.hasCutout ?? false,
      createdAt: rest.createdAt ?? new Date().toISOString(),
      updatedAt: rest.updatedAt ?? new Date().toISOString(),
    }
    if (thumbFile && files[thumbFile]) {
      item.thumb = new Blob([files[thumbFile] as BlobPart], { type: 'image/webp' })
    }
    items.push(item)

    for (const kind of IMAGE_KINDS) {
      const path = `images/${raw.id}.${kind}.webp`
      if (files[path]) {
        images.push({
          id: imageKey(raw.id, kind),
          itemId: raw.id,
          kind,
          blob: new Blob([files[path] as BlobPart], { type: 'image/webp' }),
        })
      }
    }
  }

  for (const raw of rawOutfits) {
    if (!raw || typeof raw.id !== 'string') continue
    const { coverFile, ...rest } = raw
    const outfit: Outfit = {
      ...(rest as Outfit),
      occasions: rest.occasions ?? [],
      seasons: rest.seasons ?? [],
      favorite: rest.favorite ?? false,
      createdAt: rest.createdAt ?? new Date().toISOString(),
      updatedAt: rest.updatedAt ?? new Date().toISOString(),
    }
    if (coverFile && files[coverFile]) {
      outfit.cover = new Blob([files[coverFile] as BlobPart], { type: 'image/webp' })
    }
    outfits.push(outfit)
  }

  for (const raw of rawOutfitItems) {
    if (
      !raw ||
      typeof raw.id !== 'string' ||
      typeof raw.outfitId !== 'string' ||
      typeof raw.itemId !== 'string' ||
      typeof raw.slot !== 'string'
    ) {
      continue
    }
    outfitItems.push({
      id: raw.id,
      outfitId: raw.outfitId,
      itemId: raw.itemId,
      slot: raw.slot,
      layer: raw.layer ?? 0,
    })
  }

  const hasOutfitData = Boolean(files['outfits.json'])

  await db.transaction(
    'rw',
    db.items,
    db.images,
    db.outfits,
    db.outfitItems,
    db.settings,
    async () => {
      if (mode === 'replace') {
        await db.items.clear()
        await db.images.clear()
        if (hasOutfitData) {
          await db.outfits.clear()
          await db.outfitItems.clear()
        }
      }
      await db.items.bulkPut(items)
      await db.images.bulkPut(images)
      if (outfits.length) await db.outfits.bulkPut(outfits)
      if (outfitItems.length) await db.outfitItems.bulkPut(outfitItems)
      if (settings.length) await db.settings.bulkPut(settings)
    },
  )

  return {
    items: items.length,
    images: images.length,
    outfits: outfits.length,
    outfitItems: outfitItems.length,
    mode,
  }
}
