import { describe, expect, it } from 'vitest'
import type { Item, Outfit, OutfitItem } from '@/db/types'
import {
  dayLabel,
  effectiveSeasons,
  isOutfitEligible,
  localDateKey,
  rankOutfits,
  seasonsForTemperature,
  todayHeading,
  warmthRange,
} from '@/services/today'
import { createEmptyOutfit } from '@/stores/outfits'
import { createEmptyItem } from '@/stores/wardrobe'

function makeItem(id: string, patch: Partial<Item> = {}): Item {
  return { ...createEmptyItem('top'), id, ...patch }
}

function makePiece(id: string, itemId: string, slot: OutfitItem['slot'] = 'top'): OutfitItem {
  return { id, outfitId: 'outfit-1', itemId, slot, layer: 20 }
}

describe('today helpers', () => {
  it('uses local date keys', () => {
    expect(localDateKey(new Date(2026, 9, 22, 23, 30))).toBe('2026-10-22')
    expect(todayHeading(new Date(2026, 9, 22))).toBe('10月22日 周四')
  })

  it('maps temperature to seasons', () => {
    expect(seasonsForTemperature(30)).toEqual(['summer'])
    expect(seasonsForTemperature(26)).toEqual(['summer'])
    expect(seasonsForTemperature(22)).toEqual(['spring', 'autumn'])
    expect(seasonsForTemperature(18)).toEqual(['spring', 'autumn'])
    expect(seasonsForTemperature(12)).toEqual(['autumn', 'winter'])
    expect(seasonsForTemperature(8)).toEqual(['autumn', 'winter'])
    expect(seasonsForTemperature(5)).toEqual(['winter'])
    expect(seasonsForTemperature(null)).toHaveLength(1)
  })

  it('suggests warmth ranges', () => {
    expect(warmthRange(30)).toEqual([1, 2])
    expect(warmthRange(20)).toEqual([2, 3])
    expect(warmthRange(10)).toEqual([3, 4])
    expect(warmthRange(0)).toEqual([4, 5])
  })

  it('labels recent days', () => {
    expect(dayLabel('2026-10-22', '2026-10-22')).toBe('今天')
    expect(dayLabel('2026-10-21', '2026-10-22')).toBe('昨天')
    expect(dayLabel('2026-10-20', '2026-10-22')).toBe('10月20日')
    expect(dayLabel('2025-12-31', '2026-10-22')).toBe('2025年12月31日')
  })

  it('falls back to item seasons when the outfit has none', () => {
    const outfit = createEmptyOutfit()
    const pieces = [makePiece('p1', 'i1')]
    const items = new Map<string, Item>([
      ['i1', makeItem('i1', { seasons: ['spring'] })],
    ])
    expect(effectiveSeasons(outfit, pieces, items)).toEqual(['spring'])
  })

  it('only keeps clean, active outfits with all items present', () => {
    const outfit = createEmptyOutfit()
    const pieces = [makePiece('p1', 'i1')]
    const clean = new Map<string, Item>([
      ['i1', makeItem('i1', { seasons: ['autumn'], cleanState: 'clean' })],
    ])
    expect(isOutfitEligible(outfit, pieces, clean, ['autumn'])).toBe(true)

    const worn = new Map<string, Item>([
      ['i1', makeItem('i1', { seasons: ['autumn'], cleanState: 'worn' })],
    ])
    expect(isOutfitEligible(outfit, pieces, worn, ['autumn'])).toBe(false)

    const idle = new Map<string, Item>([
      ['i1', makeItem('i1', { seasons: ['autumn'], status: 'idle' })],
    ])
    expect(isOutfitEligible(outfit, pieces, idle, ['autumn'])).toBe(false)

    expect(isOutfitEligible(outfit, pieces, new Map(), ['autumn'])).toBe(false)
  })

  it('matches season and occasion filters', () => {
    const outfit = createEmptyOutfit()
    outfit.seasons = ['winter']
    outfit.occasions = ['commute']
    const pieces = [makePiece('p1', 'i1')]
    const items = new Map<string, Item>([['i1', makeItem('i1')]])

    expect(isOutfitEligible(outfit, pieces, items, ['summer'])).toBe(false)
    expect(isOutfitEligible(outfit, pieces, items, ['winter'])).toBe(true)
    expect(isOutfitEligible(outfit, pieces, items, ['winter'], 'date')).toBe(false)
    expect(isOutfitEligible(outfit, pieces, items, ['winter'], 'commute')).toBe(true)
    expect(isOutfitEligible(outfit, pieces, items, [])).toBe(false)
  })

  it('ranks favourites and ratings first', () => {
    const older = createEmptyOutfit()
    older.name = '普通'
    older.updatedAt = '2026-10-20T10:00:00.000Z'
    const favourite = createEmptyOutfit()
    favourite.name = '收藏'
    favourite.favorite = true
    const rated = createEmptyOutfit()
    rated.name = '高分'
    rated.rating = 5
    rated.updatedAt = '2026-10-21T10:00:00.000Z'

    const ranked = rankOutfits([older, rated, favourite])
    expect(ranked.map((outfit) => outfit.name)).toEqual(['收藏', '高分', '普通'])
  })
})

describe('outfit type guards', () => {
  it('treats an empty outfit as season agnostic', () => {
    const outfit: Outfit = createEmptyOutfit()
    const pieces: OutfitItem[] = [makePiece('p1', 'i1')]
    const items = new Map<string, Item>([['i1', makeItem('i1')]])
    expect(isOutfitEligible(outfit, pieces, items, ['summer'])).toBe(true)
  })
})
