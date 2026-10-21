const MODEL_MAX_EDGE = 1024
const CUTOUT_MAX_EDGE = 1024
const THUMB_MAX_EDGE = 420
const PADDING = 4
const ALPHA_THRESHOLD = 12
const IDLE_TIMEOUT = 60_000

export interface CutoutResult {
  cutout: Blob
  thumb: Blob
}

export type CutoutProgress = (label: string, current: number, total: number) => void

export interface CutoutProgressState {
  text: string
  percent: number | null
}

export class CutoutAbortError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CutoutAbortError'
  }
}

const STAGE_LABELS: Record<string, string> = {
  'compute:decode': '正在解析照片',
  'compute:inference': '正在识别衣服主体',
  'compute:mask': '正在生成透明蒙版',
  'compute:encode': '正在编码透明图',
}

export function describeCutoutProgress(
  label: string,
  current: number,
  total: number,
): CutoutProgressState {
  if (label.startsWith('fetch:')) {
    const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : null
    return {
      text: percent == null ? '正在下载抠图模型' : `正在下载抠图模型 ${percent}%`,
      percent,
    }
  }
  return { text: STAGE_LABELS[label] ?? '正在生成透明底图', percent: null }
}

type RemoveBackground = typeof import('@imgly/background-removal')['removeBackground']
type Decoded = ImageBitmap | HTMLImageElement | HTMLCanvasElement

let webpAlpha: boolean | null = null

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })
}

async function supportsWebpAlpha(): Promise<boolean> {
  if (webpAlpha !== null) return webpAlpha
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 2
    canvas.height = 2
    const blob = await canvasToBlob(canvas, 'image/webp', 0.8)
    webpAlpha = !!blob && blob.type === 'image/webp'
  } catch {
    webpAlpha = false
  }
  return webpAlpha
}

async function encodeAlpha(canvas: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
  if (await supportsWebpAlpha()) {
    const webp = await canvasToBlob(canvas, 'image/webp', quality)
    if (webp && webp.type === 'image/webp') return webp
  }
  const png = await canvasToBlob(canvas, 'image/png', 1)
  if (!png) throw new Error('透明图片编码失败')
  return png
}

async function decode(blob: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' })
    } catch {
      try {
        return await createImageBitmap(blob)
      } catch {
        /* fall through */
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

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('无法创建画布')
  return ctx
}

function drawScaled(src: Decoded, maxEdge: number): HTMLCanvasElement {
  const { w, h } = dimensions(src)
  if (!w || !h) throw new Error('图片尺寸无效')
  const scale = Math.min(1, maxEdge / Math.max(w, h))
  const cw = Math.max(1, Math.round(w * scale))
  const ch = Math.max(1, Math.round(h * scale))
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = context2d(canvas)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src as CanvasImageSource, 0, 0, cw, ch)
  return canvas
}

async function prepareInput(source: Blob): Promise<Blob> {
  const src = await decode(source)
  try {
    const { w, h } = dimensions(src)
    if (Math.max(w, h) <= MODEL_MAX_EDGE) return source
    return await encodeAlpha(drawScaled(src, MODEL_MAX_EDGE), 0.95)
  } finally {
    if (typeof ImageBitmap !== 'undefined' && src instanceof ImageBitmap) src.close()
  }
}

interface Bounds {
  x: number
  y: number
  w: number
  h: number
}

function alphaBounds(data: Uint8ClampedArray, width: number, height: number): Bounds | null {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3]
      if (alpha < ALPHA_THRESHOLD) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (maxX < minX || maxY < minY) return null
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

async function trimAndPad(blob: Blob): Promise<HTMLCanvasElement> {
  const src = await decode(blob)
  try {
    const { w, h } = dimensions(src)
    if (!w || !h) throw new Error('抠图结果无效')
    const full = document.createElement('canvas')
    full.width = w
    full.height = h
    const fullCtx = context2d(full)
    fullCtx.drawImage(src as CanvasImageSource, 0, 0)
    const bounds = alphaBounds(fullCtx.getImageData(0, 0, w, h).data, w, h)
    if (!bounds) throw new Error('没有识别到主体')

    const paddedW = bounds.w + PADDING * 2
    const paddedH = bounds.h + PADDING * 2
    const scale = Math.min(1, CUTOUT_MAX_EDGE / Math.max(paddedW, paddedH))
    const out = document.createElement('canvas')
    out.width = Math.max(1, Math.round(paddedW * scale))
    out.height = Math.max(1, Math.round(paddedH * scale))
    const ctx = context2d(out)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(
      src as CanvasImageSource,
      bounds.x,
      bounds.y,
      bounds.w,
      bounds.h,
      PADDING * scale,
      PADDING * scale,
      bounds.w * scale,
      bounds.h * scale,
    )
    return out
  } finally {
    if (typeof ImageBitmap !== 'undefined' && src instanceof ImageBitmap) src.close()
  }
}

async function runRemoval(
  removeBackground: RemoveBackground,
  input: Blob,
  config: Parameters<RemoveBackground>[1],
  onProgress?: CutoutProgress,
  externalSignal?: AbortSignal,
): Promise<Blob> {
  if (externalSignal?.aborted) throw new CutoutAbortError('已取消抠图')

  const controller = new AbortController()
  const abort = () => controller.abort()
  externalSignal?.addEventListener('abort', abort, { once: true })

  let timedOut = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const arm = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, IDLE_TIMEOUT)
  }
  arm()

  try {
    return await removeBackground(input, {
      ...config,
      fetchArgs: { signal: controller.signal },
      progress: (label, current, total) => {
        arm()
        onProgress?.(label, current, total)
      },
    })
  } catch (error) {
    if (timedOut) throw new CutoutAbortError('抠图超时，请检查网络后重试')
    if (externalSignal?.aborted) throw new CutoutAbortError('已取消抠图')
    throw error
  } finally {
    if (timer) clearTimeout(timer)
    externalSignal?.removeEventListener('abort', abort)
  }
}

export async function createCutout(
  source: Blob,
  onProgress?: CutoutProgress,
  signal?: AbortSignal,
): Promise<CutoutResult> {
  const { removeBackground } = await import('@imgly/background-removal')
  const input = await prepareInput(source)
  const base = {
    model: 'isnet_fp16' as const,
    output: { format: 'image/png' as const, quality: 1 },
  }

  let removed: Blob | undefined
  const gpuAvailable =
    typeof navigator !== 'undefined' && 'gpu' in navigator && Boolean(navigator.gpu)
  if (gpuAvailable) {
    try {
      removed = await runRemoval(
        removeBackground,
        input,
        { ...base, device: 'gpu' },
        onProgress,
        signal,
      )
    } catch (error) {
      if (error instanceof CutoutAbortError) throw error
      removed = undefined
    }
  }
  if (!removed) {
    removed = await runRemoval(
      removeBackground,
      input,
      { ...base, device: 'cpu' },
      onProgress,
      signal,
    )
  }
  if (!removed || removed.size === 0) throw new Error('抠图结果为空')

  const canvas = await trimAndPad(removed)
  const cutout = await encodeAlpha(canvas)

  const thumbCanvas = drawScaled(canvas, THUMB_MAX_EDGE)
  const thumb = await encodeAlpha(thumbCanvas, 0.86)
  return { cutout, thumb }
}
