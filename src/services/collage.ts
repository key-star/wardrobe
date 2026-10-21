import { SEASONS, STYLES, categoryLabel } from '@/db/constants'
import { getImage } from '@/db/repo'
import type { Item, Outfit, SlotId } from '@/db/types'

export interface CollagePiece {
  item: Item
  slot: SlotId
  layer: number
}

export interface PieceLayout {
  cx: number
  cy: number
  w: number
  h: number
}

const SLOT_BOX: Record<SlotId, PieceLayout> = {
  outer: { cx: 0.5, cy: 0.4, w: 0.8, h: 0.56 },
  top: { cx: 0.5, cy: 0.41, w: 0.64, h: 0.46 },
  inner: { cx: 0.5, cy: 0.43, w: 0.5, h: 0.36 },
  bottom: { cx: 0.5, cy: 0.69, w: 0.58, h: 0.42 },
  shoes: { cx: 0.5, cy: 0.9, w: 0.34, h: 0.18 },
  bag: { cx: 0.82, cy: 0.7, w: 0.3, h: 0.3 },
  accessory: { cx: 0.18, cy: 0.76, w: 0.24, h: 0.24 },
}

export function pieceLayout(slot: SlotId, index: number, count: number): PieceLayout {
  if (slot !== 'accessory') return SLOT_BOX[slot]
  if (count <= 1) return SLOT_BOX.accessory
  if (count === 2) {
    return { cx: index === 0 ? 0.18 : 0.82, cy: 0.74, w: 0.24, h: 0.24 }
  }
  const step = 0.8 / (count - 1)
  return { cx: 0.1 + index * step, cy: 0.88, w: 0.18, h: 0.18 }
}

type Drawable = ImageBitmap | HTMLImageElement

interface Area {
  x: number
  y: number
  w: number
  h: number
}

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif"

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })
}

async function encode(canvas: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
  const webp = await canvasToBlob(canvas, 'image/webp', quality)
  if (webp && webp.type === 'image/webp') return webp
  const png = await canvasToBlob(canvas, 'image/png', 1)
  if (!png) throw new Error('图片编码失败')
  return png
}

async function decode(blob: Blob): Promise<Drawable> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' })
    } catch {
      return await createImageBitmap(blob)
    }
  }
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('图片解码失败'))
      img.src = url
    })
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

function drawableSize(src: Drawable): { w: number; h: number } {
  if (src instanceof HTMLImageElement) {
    return { w: src.naturalWidth || src.width, h: src.naturalHeight || src.height }
  }
  return { w: src.width, h: src.height }
}

async function loadDrawable(item: Item): Promise<Drawable | null> {
  const blob =
    (await getImage(item.id, 'cutout')) ??
    (await getImage(item.id, 'original')) ??
    item.thumb
  if (!blob) return null
  try {
    return await decode(blob)
  } catch {
    return null
  }
}

function paintBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const base = ctx.createLinearGradient(0, 0, 0, h)
  base.addColorStop(0, '#242833')
  base.addColorStop(0.55, '#1b1e27')
  base.addColorStop(1, '#14161c')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)

  const glow = ctx.createRadialGradient(
    w * 0.5,
    h * 0.34,
    0,
    w * 0.5,
    h * 0.34,
    Math.max(w, h) * 0.62,
  )
  glow.addColorStop(0, 'rgba(124, 143, 255, 0.18)')
  glow.addColorStop(1, 'rgba(124, 143, 255, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)
}

function drawPieces(
  ctx: CanvasRenderingContext2D,
  area: Area,
  pieces: CollagePiece[],
  sources: Map<string, Drawable>,
): void {
  const counts = new Map<SlotId, number>()
  const seen = new Map<SlotId, number>()
  for (const piece of pieces) counts.set(piece.slot, (counts.get(piece.slot) ?? 0) + 1)

  const ordered = [...pieces].sort((a, b) => a.layer - b.layer)
  for (const piece of ordered) {
    const src = sources.get(piece.item.id)
    if (!src) continue
    const index = seen.get(piece.slot) ?? 0
    seen.set(piece.slot, index + 1)
    const layout = pieceLayout(piece.slot, index, counts.get(piece.slot) ?? 1)

    const boxW = area.w * layout.w
    const boxH = area.h * layout.h
    const size = drawableSize(src)
    if (!size.w || !size.h) continue
    const scale = Math.min(boxW / size.w, boxH / size.h)
    const drawW = size.w * scale
    const drawH = size.h * scale
    const cx = area.x + area.w * layout.cx
    const cy = area.y + area.h * layout.cy

    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
    ctx.shadowBlur = 26
    ctx.shadowOffsetY = 14
    ctx.drawImage(
      src as CanvasImageSource,
      cx - drawW / 2,
      cy - drawH / 2,
      drawW,
      drawH,
    )
    ctx.restore()
  }
}

function closeSources(sources: Map<string, Drawable>): void {
  for (const src of sources.values()) {
    if (typeof ImageBitmap !== 'undefined' && src instanceof ImageBitmap) src.close()
  }
}

async function prepareSources(
  pieces: CollagePiece[],
): Promise<Map<string, Drawable>> {
  const unique = new Map<string, Item>()
  for (const piece of pieces) unique.set(piece.item.id, piece.item)
  const entries = await Promise.all(
    [...unique.values()].map(async (item) => {
      const drawable = await loadDrawable(item)
      return [item.id, drawable] as const
    }),
  )
  const map = new Map<string, Drawable>()
  for (const [id, drawable] of entries) {
    if (drawable) map.set(id, drawable)
  }
  return map
}

export async function renderOutfitCover(
  pieces: CollagePiece[],
  width = 1080,
  height = 1440,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')
  paintBackground(ctx, width, height)

  const sources = await prepareSources(pieces)
  try {
    drawPieces(ctx, { x: 0, y: 0, w: width, h: height }, pieces, sources)
  } finally {
    closeSources(sources)
  }
  return encode(canvas)
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let result = text
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1)
  }
  return `${result}…`
}

function slotLabel(id: SlotId): string {
  return categoryLabel(id)
}

export async function buildOutfitShareImage(
  outfit: Outfit,
  pieces: CollagePiece[],
): Promise<Blob> {
  const width = 1080
  const height = 1620
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')
  paintBackground(ctx, width, height)

  const sources = await prepareSources(pieces)
  try {
    drawPieces(ctx, { x: 0, y: 0, w: width, h: 1180 }, pieces, sources)
  } finally {
    closeSources(sources)
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.fillRect(96, 1196, width - 192, 1)

  ctx.fillStyle = '#f4f6fb'
  ctx.font = `650 46px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const title = fitText(ctx, outfit.name?.trim() || '未命名搭配', width - 192)
  ctx.fillText(title, width / 2, 1256)

  const tags = [
    ...outfit.occasions.map((id) => STYLES.find((s) => s.id === id)?.label ?? id),
    ...outfit.seasons.map((id) => SEASONS.find((s) => s.id === id)?.label ?? id),
  ].filter(Boolean)
  if (tags.length) {
    ctx.fillStyle = '#9aaaff'
    ctx.font = `500 24px ${FONT}`
    ctx.fillText(fitText(ctx, tags.join(' · '), width - 240), width / 2, 1308)
  }

  const lines: string[] = []
  const grouped = new Map<SlotId, string[]>()
  for (const piece of [...pieces].sort((a, b) => a.layer - b.layer)) {
    const name =
      piece.item.name?.trim() || piece.item.subcategory || categoryLabel(piece.item.category)
    const list = grouped.get(piece.slot) ?? []
    list.push(name)
    grouped.set(piece.slot, list)
  }
  for (const [slot, names] of grouped) {
    lines.push(`${slotLabel(slot)} · ${names.join(' / ')}`)
  }

  ctx.fillStyle = '#b6bdcd'
  ctx.font = `400 24px ${FONT}`
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(fitText(ctx, lines[i], width - 240), width / 2, 1352 + i * 32)
  }

  ctx.fillStyle = '#8d95a8'
  ctx.font = `400 22px ${FONT}`
  ctx.textAlign = 'left'
  ctx.fillText('衣橱 · Wardrobe', 96, 1578)
  ctx.textAlign = 'right'
  ctx.fillText(new Date().toISOString().slice(0, 10), width - 96, 1578)

  return encode(canvas)
}

function safeName(value: string): string {
  return value.replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 40) || 'outfit'
}

export function shareFileName(outfit: Outfit): string {
  return `outfit-${safeName(outfit.name?.trim() || '未命名')}.png`
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export type ShareResult = 'shared' | 'downloaded' | 'cancelled'

export async function shareOutfitImage(
  blob: Blob,
  fileName: string,
  title: string,
): Promise<ShareResult> {
  if (typeof File !== 'undefined' && navigator.canShare) {
    const file = new File([blob], fileName, { type: blob.type || 'image/png' })
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title })
        return 'shared'
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      }
    }
  }
  download(blob, fileName)
  return 'downloaded'
}
