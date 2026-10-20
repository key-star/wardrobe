import { PALETTE } from '@/db/constants'

const ORIGINAL_MAX_EDGE = 1600
const THUMB_MAX_EDGE = 420
const SAMPLE_MAX_EDGE = 96
const QUALITY = 0.85

export interface ProcessedPhoto {
  original: Blob
  thumb: Blob
  colorHex?: string
}

type Decoded = ImageBitmap | HTMLImageElement

let webpSupport: boolean | null = null

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })
}

async function supportsWebp(): Promise<boolean> {
  if (webpSupport !== null) return webpSupport
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 2
    canvas.height = 2
    const blob = await canvasToBlob(canvas, 'image/webp', 0.8)
    webpSupport = !!blob && blob.type === 'image/webp'
  } catch {
    webpSupport = false
  }
  return webpSupport
}

async function encode(
  canvas: HTMLCanvasElement,
  quality = QUALITY,
): Promise<Blob> {
  if (await supportsWebp()) {
    const webp = await canvasToBlob(canvas, 'image/webp', quality)
    if (webp) return webp
  }
  const jpeg = await canvasToBlob(canvas, 'image/jpeg', quality)
  if (!jpeg) throw new Error('图片编码失败')
  return jpeg
}

async function decode(blob: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' })
    } catch {
      try {
        return await createImageBitmap(blob)
      } catch {
        /* fall through to <img> */
      }
    }
  }
  const url = URL.createObjectURL(blob)
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('图片解码失败'))
    img.src = url
  })
  URL.revokeObjectURL(url)
  return img
}

function dimensions(src: Decoded): { w: number; h: number } {
  if (src instanceof HTMLImageElement) {
    return { w: src.naturalWidth || src.width, h: src.naturalHeight || src.height }
  }
  return { w: src.width, h: src.height }
}

function renderToCanvas(src: Decoded, maxEdge: number): HTMLCanvasElement {
  const { w, h } = dimensions(src)
  if (!w || !h) throw new Error('图片尺寸无效')
  const scale = Math.min(1, maxEdge / Math.max(w, h))
  const cw = Math.max(1, Math.round(w * scale))
  const ch = Math.max(1, Math.round(h * scale))
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src as CanvasImageSource, 0, 0, cw, ch)
  return canvas
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace('#', '')
  const full = v.length === 3 ? v.split('').map((c) => c + c).join('') : v
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ]
}

export function nearestPaletteHex(hex: string): string {
  const [r, g, b] = hexToRgb(hex)
  let best = PALETTE[0].hex
  let bestDist = Number.POSITIVE_INFINITY
  for (const color of PALETTE) {
    const [pr, pg, pb] = hexToRgb(color.hex)
    const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2
    if (dist < bestDist) {
      bestDist = dist
      best = color.hex
    }
  }
  return best
}

function dominantColorHex(canvas: HTMLCanvasElement): string | undefined {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return undefined
  const { width: w, height: h } = canvas
  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(0, 0, w, h).data
  } catch {
    return undefined
  }

  const corners = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ].map(([x, y]) => {
    const i = (y * w + x) * 4
    return [data[i], data[i + 1], data[i + 2]] as [number, number, number]
  })

  const isBackground = (r: number, g: number, b: number) =>
    corners.some(
      ([cr, cg, cb]) =>
        Math.abs(r - cr) < 42 && Math.abs(g - cg) < 42 && Math.abs(b - cb) < 42,
    )

  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>()
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]
      if (a < 200) continue
      if (isBackground(r, g, b)) continue
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
      const entry = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
      entry.n++
      entry.r += r
      entry.g += g
      entry.b += b
      buckets.set(key, entry)
    }
  }

  let best: { n: number; r: number; g: number; b: number } | undefined
  for (const entry of buckets.values()) {
    if (!best || entry.n > best.n) best = entry
  }
  if (!best || best.n === 0) return undefined
  return rgbToHex(best.r / best.n, best.g / best.n, best.b / best.n)
}

export async function processPhoto(file: Blob): Promise<ProcessedPhoto> {
  const src = await decode(file)
  try {
    const original = await encode(renderToCanvas(src, ORIGINAL_MAX_EDGE))
    const thumb = await encode(renderToCanvas(src, THUMB_MAX_EDGE))
    let colorHex: string | undefined
    try {
      const sampled = dominantColorHex(renderToCanvas(src, SAMPLE_MAX_EDGE))
      if (sampled) colorHex = nearestPaletteHex(sampled)
    } catch {
      colorHex = undefined
    }
    return { original, thumb, colorHex }
  } finally {
    if (typeof ImageBitmap !== 'undefined' && src instanceof ImageBitmap) src.close()
  }
}
