import { describe, expect, it } from 'vitest'
import type { Item, OutfitItem, WearLog } from '@/db/types'
import {
  buildWearHistory,
  colorHarmonyScore,
  compareScored,
  formalityScore,
  freshnessScore,
  historyScore,
  recommendCombinations,
  scoreOutfit,
  warmthScore,
} from '@/services/recommend'
import { createEmptyOutfit } from '@/stores/outfits'
import { createEmptyItem } from '@/stores/wardrobe'

function makeItem(
  id: string,
  category: Item['category'] = 'top',
  patch: Partial<Item> = {},
): Item {
  return { ...createEmptyItem(category), id, ...patch }
}

function makeWearLog(
  id: string,
  date: string,
  itemIds: string[],
  rating?: number,
): WearLog {
  return { id, date, itemIds, rating, createdAt: `${date}T10:00:00.000Z` }
}

describe('rule scoring', () => {
  it('scores neutral and colourful combinations', () => {
    const neutral = makeItem('a', 'top', { colorPrimary: '#1c1c1e' })
    const red = makeItem('b', 'bottom', { colorPrimary: '#c0392b' })
    const blue = makeItem('c', 'shoes', { colorPrimary: '#5aa9e6' })
    expect(colorHarmonyScore([neutral])).toBe(30)
    expect(colorHarmonyScore([neutral, red])).toBe(25)
    expect(colorHarmonyScore([neutral, red, blue])).toBe(10)
    expect(
      colorHarmonyScore([
        neutral,
        red,
        blue,
        makeItem('d', 'bag', { colorPrimary: '#3f7d52' }),
      ]),
    ).toBe(0)
  })

  it('penalises formal wear mixed with casual wear', () => {
    expect(formalityScore([makeItem('a'), makeItem('b')])).toBe(20)
    expect(
      formalityScore([
        makeItem('a', 'top', { formality: 3 }),
        makeItem('b', 'bottom', { formality: 3 }),
      ]),
    ).toBe(20)
    expect(
      formalityScore([
        makeItem('a', 'top', { formality: 2 }),
        makeItem('b', 'bottom', { formality: 3 }),
      ]),
    ).toBe(10)
    expect(
      formalityScore([
        makeItem('a', 'top', { formality: 1 }),
        makeItem('b', 'bottom', { formality: 5 }),
      ]),
    ).toBe(0)
  })

  it('matches warmth against the target level', () => {
    expect(warmthScore([makeItem('a', 'top', { warmth: 3 })], 3)).toBe(20)
    expect(warmthScore([makeItem('a', 'top', { warmth: 3 })], 4)).toBe(14)
    expect(warmthScore([makeItem('a')], 4)).toBe(20)
  })

  it('discounts recently worn pieces and rewards never-worn ones', () => {
    const history = buildWearHistory([])
    const today = '2026-10-22'
    expect(
      freshnessScore(
        [makeItem('a', 'top', { lastWornAt: '2026-10-22' })],
        history,
        today,
      ),
    ).toBe(0)
    expect(
      freshnessScore(
        [makeItem('a', 'top', { lastWornAt: '2026-10-07' })],
        history,
        today,
      ),
    ).toBe(7.5)
    expect(freshnessScore([makeItem('a')], history, today)).toBe(15)
  })

  it('uses wear-log ratings for preference', () => {
    const item = makeItem('a')
    const history = buildWearHistory([makeWearLog('log-1', '2026-10-20', ['a'], 5)])
    expect(historyScore([item], history)).toBe(15)
    expect(historyScore([item], buildWearHistory([]))).toBe(7.5)
    expect(historyScore([item], buildWearHistory([]), 1)).toBe(0)
  })

  it('scores a saved outfit with its rating as a fallback', () => {
    const outfit = createEmptyOutfit()
    outfit.rating = 5
    const item = makeItem('a')
    const piece: OutfitItem = {
      id: 'p1',
      outfitId: outfit.id,
      itemId: item.id,
      slot: 'top',
      layer: 20,
    }
    const scored = scoreOutfit(outfit, [piece], new Map([[item.id, item]]))
    expect(scored).not.toBeNull()
    expect(scored?.breakdown.history).toBe(15)
    expect(scored?.outfit.id).toBe(outfit.id)
  })

  it('breaks ties with the older piece', () => {
    const scored = (score: number, freshDays: number) => ({
      score,
      freshDays,
      breakdown: { color: 0, formality: 0, warmth: 0, freshness: 0, history: 0 },
    })
    expect(compareScored(scored(90, 2), scored(80, 20))).toBeLessThan(0)
    expect(compareScored(scored(90, 20), scored(90, 2))).toBeLessThan(0)
    expect(compareScored(scored(90, 2), scored(90, 2))).toBe(0)
  })
})

describe('combination recommendations', () => {
  function makeWardrobe(patch: Partial<Item> = {}): Item[] {
    return [
      makeItem('top-1', 'top', { seasons: ['autumn'], ...patch }),
      makeItem('bottom-1', 'bottom', { seasons: ['autumn'], ...patch }),
      makeItem('shoes-1', 'shoes', { seasons: ['autumn'], ...patch }),
    ]
  }

  it('recommends an all-clean seasonal combination', () => {
    const recommendations = recommendCombinations(makeWardrobe(), [], {
      today: '2026-10-22',
      seasons: ['autumn'],
    })
    expect(recommendations).toHaveLength(1)
    expect(recommendations[0].items.map((item) => item.id)).toEqual([
      'top-1',
      'bottom-1',
      'shoes-1',
    ])
    expect(recommendations[0].score).toBeGreaterThan(0)
  })

  it('excludes dirty, idle and out-of-season items', () => {
    expect(
      recommendCombinations(
        makeWardrobe({ cleanState: 'worn' }),
        [],
        { seasons: ['autumn'] },
      ),
    ).toHaveLength(0)
    expect(
      recommendCombinations(
        makeWardrobe({ status: 'idle' }),
        [],
        { seasons: ['autumn'] },
      ),
    ).toHaveLength(0)
    expect(
      recommendCombinations(
        makeWardrobe({ seasons: ['summer'] }),
        [],
        { seasons: ['autumn'] },
      ),
    ).toHaveLength(0)
  })

  it('respects the selected occasion when items declare a style', () => {
    const items = makeWardrobe()
    items[0].styles = ['formal']
    expect(
      recommendCombinations(items, [], {
        seasons: ['autumn'],
        occasion: 'sport',
      }),
    ).toHaveLength(0)
    expect(
      recommendCombinations(items, [], {
        seasons: ['autumn'],
        occasion: 'formal',
      }),
    ).toHaveLength(1)
  })

  it('is deterministic for the same day and stays within the limit', () => {
    const items: Item[] = []
    for (let i = 0; i < 8; i += 1) {
      items.push(makeItem(`top-${i}`, 'top', { seasons: ['autumn'] }))
      items.push(makeItem(`bottom-${i}`, 'bottom', { seasons: ['autumn'] }))
      items.push(makeItem(`shoes-${i}`, 'shoes', { seasons: ['autumn'] }))
    }
    const options = {
      today: '2026-10-22',
      seasons: ['autumn'] as const,
      sampleSize: 20,
      limit: 5,
    }
    const first = recommendCombinations(items, [], { ...options, seasons: ['autumn'] })
    const second = recommendCombinations(items, [], { ...options, seasons: ['autumn'] })
    expect(first).toHaveLength(5)
    expect(first.map((row) => row.items.map((item) => item.id).join('|'))).toEqual(
      second.map((row) => row.items.map((item) => item.id).join('|')),
    )
  })

  it('returns nothing when a required slot is missing', () => {
    const items = makeWardrobe().filter((item) => item.category !== 'shoes')
    expect(recommendCombinations(items, [], { seasons: ['autumn'] })).toHaveLength(0)
  })

  it('uses the latest wear-log date and ratings', () => {
    const history = buildWearHistory([
      makeWearLog('old', '2026-09-01', ['top-1'], 3),
      makeWearLog('new', '2026-10-20', ['top-1'], 5),
    ])
    expect(history.lastWorn.get('top-1')).toBe('2026-10-20')
    expect(history.ratings.get('top-1')).toEqual([3, 5])
  })
})
