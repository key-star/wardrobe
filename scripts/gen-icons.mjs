import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = fileURLToPath(new URL('..', import.meta.url))
const svg = readFileSync(`${root}public/favicon.svg`)
const bg = '#5b6fe0'

const targets = [
  { file: 'public/pwa-192.png', size: 192 },
  { file: 'public/pwa-512.png', size: 512 },
  { file: 'public/apple-touch-icon.png', size: 180 },
]

for (const { file, size } of targets) {
  await sharp(svg, { density: 512 }).resize(size, size).png().toFile(`${root}${file}`)
  console.log(`wrote ${file}`)
}

const maskable = await sharp(svg, { density: 512 })
  .resize(380, 380)
  .extend({ top: 66, bottom: 66, left: 66, right: 66, background: bg })
  .png()
  .toFile(`${root}public/pwa-maskable-512.png`)
console.log(`wrote public/pwa-maskable-512.png (${maskable.width}x${maskable.height})`)
