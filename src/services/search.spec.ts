import { describe, expect, it } from 'vitest'
import { createEmptyItem } from '@/stores/wardrobe'
import { itemSearchText, matchesItemQuery } from './search'

function sample() {
  return {
    ...createEmptyItem('top'),
    name: '黑色针织衫',
    brand: 'Uniqlo',
    styles: ['commute' as const],
    seasons: ['autumn' as const],
    tags: ['百搭'],
  }
}

describe('item search', () => {
  it('matches names, brands, tags and raw ids', () => {
    const item = sample()
    expect(matchesItemQuery(item, '针织')).toBe(true)
    expect(matchesItemQuery(item, 'uniqlo')).toBe(true)
    expect(matchesItemQuery(item, '百搭')).toBe(true)
    expect(matchesItemQuery(item, 'commute')).toBe(true)
    expect(matchesItemQuery(item, 'autumn')).toBe(true)
  })

  it('matches Chinese style and season labels', () => {
    const item = sample()
    expect(itemSearchText(item)).toContain('通勤')
    expect(itemSearchText(item)).toContain('秋')
    expect(matchesItemQuery(item, '通勤')).toBe(true)
    expect(matchesItemQuery(item, '秋')).toBe(true)
    expect(matchesItemQuery(item, '休闲')).toBe(false)
  })

  it('treats a blank query as matching everything', () => {
    expect(matchesItemQuery(sample(), '   ')).toBe(true)
  })
})
