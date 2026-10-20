import { describe, expect, it } from 'vitest'
import { nearestPaletteHex } from '@/services/image'
import { PALETTE } from '@/db/constants'

describe('nearestPaletteHex', () => {
  it('returns the exact palette entry when it matches', () => {
    expect(nearestPaletteHex(PALETTE[0].hex)).toBe(PALETTE[0].hex)
  })

  it('snaps an off-palette color to the closest entry', () => {
    expect(nearestPaletteHex('#000000')).toBe('#1c1c1e')
    expect(nearestPaletteHex('#fdfdfd')).toBe('#f7f7f5')
  })
})
