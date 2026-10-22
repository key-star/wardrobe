import { describe, expect, it } from 'vitest'
import type { Item } from '@/db/types'
import {
  averageCostPerWear,
  buildStatsCsv,
  costPerWear,
  costPerWearRows,
  daysBetweenKeys,
  daysSinceWorn,
  idleReminderRows,
  itemDisplayName,
  longUnwornRows,
  statsSummary,
  wearCoverage,
} from '@/services/stats'
import { createEmptyItem } from '@/stores/wardrobe'

function makeItem(id: string, patch: Partial<Item> = {}): Item {
  return {
    ...createEmptyItem('top'),
    id,
    createdAt: '2026-01-01T10:00:00.000Z',
    ...patch,
  }
}

describe('cost per wear', () => {
  it('divides price by wears and uses one for never-worn items', () => {
    const never = makeItem('a', { price: 300, wearCount: 0 })
    const worn = makeItem('b', { price: 300, wearCount: 4 })
    expect(costPerWear(never)).toBe(300)
    expect(costPerWear(worn)).toBe(75)
    expect(costPerWear(makeItem('c'))).toBeNull()
  })

  it('sorts the least cost-effective items first', () => {
    const rows = costPerWearRows([
      makeItem('cheap', { name: '划算', price: 100, wearCount: 10 }),
      makeItem('pricey', { name: '不划算', price: 500, wearCount: 2 }),
      makeItem('no-price', { name: '无价格' }),
    ])
    expect(rows.map((row) => row.item.name)).toEqual(['不划算', '划算'])
    expect(rows.map((row) => row.cost)).toEqual([250, 10])
  })

  it('averages cost per wear across priced items', () => {
    const items = [
      makeItem('a', { price: 100, wearCount: 1 }),
      makeItem('b', { price: 300, wearCount: 3 }),
      makeItem('c', { wearCount: 5 }),
    ]
    expect(averageCostPerWear(items)).toBe(100)
    expect(averageCostPerWear([makeItem('d')])).toBeNull()
  })
})

describe('wear timing', () => {
  it('counts calendar days between local date keys', () => {
    expect(daysBetweenKeys('2026-10-22', '2026-10-22')).toBe(0)
    expect(daysBetweenKeys('2026-10-20', '2026-10-22')).toBe(2)
    expect(daysBetweenKeys('2025-12-31', '2026-01-01')).toBe(1)
  })

  it('falls back to creation time when the item was never worn', () => {
    const item = makeItem('a', { createdAt: '2026-07-22T10:00:00.000Z' })
    expect(daysSinceWorn(item, '2026-10-20')).toBe(90)
  })

  it('sorts long-unworn items oldest first', () => {
    const rows = longUnwornRows(
      [
        makeItem('recent', { name: '最近', lastWornAt: '2026-10-20' }),
        makeItem('old', { name: '很久', lastWornAt: '2026-09-01' }),
        makeItem('never', { name: '没穿过', createdAt: '2026-01-01T00:00:00.000Z' }),
      ],
      '2026-10-22',
    )
    expect(rows.map((row) => row.item.name)).toEqual(['没穿过', '很久', '最近'])
    expect(rows[0].neverWorn).toBe(true)
    expect(rows[1].days).toBe(51)
  })

  it('reminds about idle items or items unworn for 90 days', () => {
    const rows = idleReminderRows(
      [
        makeItem('idle', { status: 'idle', lastWornAt: '2026-10-21' }),
        makeItem('stale', { lastWornAt: '2026-07-20' }),
        makeItem('fresh', { lastWornAt: '2026-10-21' }),
      ],
      '2026-10-22',
    )
    expect(rows.map((row) => row.item.id)).toEqual(['stale', 'idle'])
  })
})

describe('wardrobe stats', () => {
  it('calculates coverage from worn items', () => {
    const cover = wearCoverage([
      makeItem('a', { wearCount: 2 }),
      makeItem('b'),
      makeItem('c', { wearCount: 1 }),
    ])
    expect(cover).toEqual({ worn: 2, total: 3, percent: (2 / 3) * 100 })
  })

  it('summarises the wardrobe', () => {
    const summary = statsSummary(
      [
        makeItem('a', { price: 200, wearCount: 2, lastWornAt: '2026-10-20' }),
        makeItem('b', { status: 'idle', createdAt: '2026-01-01T00:00:00.000Z' }),
      ],
      '2026-10-22',
    )
    expect(summary.total).toBe(2)
    expect(summary.worn).toBe(1)
    expect(summary.averageCostPerWear).toBe(100)
    expect(summary.reminderCount).toBe(1)
  })

  it('builds a CSV with names, costs and wear state', () => {
    const csv = buildStatsCsv(
      [
        makeItem('a', {
          name: '白衬衫',
          subcategory: '衬衫',
          price: 200,
          wearCount: 2,
          lastWornAt: '2026-10-20',
        }),
      ],
      '2026-10-22',
    )
    expect(csv.split('\r\n')).toHaveLength(2)
    expect(csv).toContain('白衬衫')
    expect(csv).toContain('100.00')
    expect(csv).toContain('已 2 天未穿')
  })

  it('prefers the name, then subcategory, then category label', () => {
    expect(itemDisplayName(makeItem('a', { name: '外套一' }))).toBe('外套一')
    expect(itemDisplayName(makeItem('b', { subcategory: '衬衫' }))).toBe('衬衫')
    expect(itemDisplayName(makeItem('c', { category: 'shoes' }))).toBe('鞋')
  })
})
