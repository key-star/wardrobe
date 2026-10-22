import { ITEM_STATUSES, categoryLabel } from '@/db/constants'
import type { Item } from '@/db/types'

export interface CostPerWearRow {
  item: Item
  cost: number
}

export interface UnwornRow {
  item: Item
  days: number
  neverWorn: boolean
}

export interface Coverage {
  worn: number
  total: number
  percent: number
}

export interface StatsSummary {
  total: number
  worn: number
  coverage: Coverage
  averageCostPerWear: number | null
  reminderCount: number
}

function keyToUtc(value: string): number {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return Number.NaN
  return Date.UTC(year, month - 1, day)
}

export function daysBetweenKeys(from: string, to: string): number {
  const start = keyToUtc(from)
  const end = keyToUtc(to)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  return Math.max(0, Math.round((end - start) / 86_400_000))
}

export function daysSinceWorn(item: Item, today: string): number {
  return daysBetweenKeys(item.lastWornAt ?? item.createdAt, today)
}

export function costPerWear(item: Item): number | null {
  if (item.price == null || item.price < 0) return null
  return item.price / Math.max(item.wearCount, 1)
}

export function costPerWearRows(items: Item[]): CostPerWearRow[] {
  return items
    .map((item) => {
      const cost = costPerWear(item)
      return cost == null ? null : { item, cost }
    })
    .filter((row): row is CostPerWearRow => row !== null)
    .sort(
      (a, b) =>
        b.cost - a.cost ||
        (a.item.name ?? '').localeCompare(b.item.name ?? '') ||
        a.item.id.localeCompare(b.item.id),
    )
}

export function longUnwornRows(items: Item[], today: string): UnwornRow[] {
  return items
    .map((item) => ({
      item,
      days: daysSinceWorn(item, today),
      neverWorn: !item.lastWornAt,
    }))
    .sort(
      (a, b) =>
        b.days - a.days ||
        (a.item.name ?? '').localeCompare(b.item.name ?? '') ||
        a.item.id.localeCompare(b.item.id),
    )
}

export function idleReminderRows(
  items: Item[],
  today: string,
  thresholdDays = 90,
): UnwornRow[] {
  return longUnwornRows(items, today).filter(
    (row) => row.item.status === 'idle' || row.days >= thresholdDays,
  )
}

export function wearCoverage(items: Item[]): Coverage {
  const total = items.length
  const worn = items.filter((item) => item.wearCount > 0).length
  return {
    worn,
    total,
    percent: total ? (worn / total) * 100 : 0,
  }
}

export function averageCostPerWear(items: Item[]): number | null {
  const priced = items.filter((item) => item.price != null && item.price > 0)
  if (!priced.length) return null
  const price = priced.reduce((sum, item) => sum + (item.price ?? 0), 0)
  const wears = priced.reduce((sum, item) => sum + Math.max(item.wearCount, 1), 0)
  return wears ? price / wears : null
}

export function statsSummary(items: Item[], today: string): StatsSummary {
  const coverage = wearCoverage(items)
  return {
    total: items.length,
    worn: coverage.worn,
    coverage,
    averageCostPerWear: averageCostPerWear(items),
    reminderCount: idleReminderRows(items, today).length,
  }
}

export function itemDisplayName(item: Item): string {
  return item.name?.trim() || item.subcategory || categoryLabel(item.category)
}

function csvCell(value: string | number | null | undefined): string {
  const text = value == null ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function buildStatsCsv(items: Item[], today: string): string {
  const header = [
    '名称',
    '分类',
    '价格',
    '穿着次数',
    '每次成本',
    '最后穿着',
    '状态',
    '穿着情况',
  ]
  const rows = longUnwornRows(items, today).map(({ item, days, neverWorn }) => {
    const cost = costPerWear(item)
    return [
      itemDisplayName(item),
      categoryLabel(item.category),
      item.price ?? '',
      item.wearCount,
      cost == null ? '' : cost.toFixed(2),
      item.lastWornAt ?? '',
      ITEM_STATUSES.find((status) => status.id === item.status)?.label ?? item.status,
      neverWorn ? `入库 ${days} 天未穿` : `已 ${days} 天未穿`,
    ]
  })
  return [...[header], ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}
