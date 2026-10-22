import { SEASONS, STYLES } from '@/db/constants'
import type { Item } from '@/db/types'

const STYLE_LABELS = new Map(STYLES.map((style) => [style.id, style.label]))
const SEASON_LABELS = new Map(SEASONS.map((season) => [season.id, season.label]))

export function itemSearchText(item: Item): string {
  const styleLabels = item.styles
    .map((style) => STYLE_LABELS.get(style))
    .filter((label): label is string => Boolean(label))
  const seasonLabels = item.seasons
    .map((season) => SEASON_LABELS.get(season))
    .filter((label): label is string => Boolean(label))
  return [
    item.name,
    item.brand,
    item.subcategory,
    item.location,
    item.material,
    ...item.tags,
    ...item.styles,
    ...styleLabels,
    ...item.seasons,
    ...seasonLabels,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function matchesItemQuery(item: Item, query: string): boolean {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return itemSearchText(item).includes(normalized)
}
