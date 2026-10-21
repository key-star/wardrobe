import type { Item, Outfit, OutfitItem, Season } from '@/db/types'

export function localDateKey(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

export function todayHeading(date = new Date()): string {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${date.getMonth() + 1}月${date.getDate()}日 ${weekdays[date.getDay()]}`
}

export function dayLabel(dateKey: string, today = localDateKey()): string {
  if (dateKey === today) return '今天'
  const todayDate = new Date(`${today}T00:00:00`)
  const target = new Date(`${dateKey}T00:00:00`)
  const diff = Math.round((todayDate.getTime() - target.getTime()) / 86_400_000)
  if (diff === 1) return '昨天'
  if (target.getFullYear() === todayDate.getFullYear()) {
    return `${target.getMonth() + 1}月${target.getDate()}日`
  }
  return `${target.getFullYear()}年${target.getMonth() + 1}月${target.getDate()}日`
}

export function seasonForDate(date = new Date()): Season {
  const month = date.getMonth() + 1
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

export function seasonsForTemperature(temperature?: number | null): Season[] {
  if (temperature == null || Number.isNaN(temperature)) return [seasonForDate()]
  if (temperature >= 26) return ['summer']
  if (temperature >= 18) return ['spring', 'autumn']
  if (temperature >= 8) return ['autumn', 'winter']
  return ['winter']
}

export function warmthRange(temperature: number): [number, number] {
  if (temperature >= 26) return [1, 2]
  if (temperature >= 18) return [2, 3]
  if (temperature >= 8) return [3, 4]
  return [4, 5]
}

export function warmthHint(temperature: number): string {
  if (temperature >= 26) return '轻薄透气，注意防晒'
  if (temperature >= 18) return '早晚微凉，薄外套刚好'
  if (temperature >= 8) return '需要外套或针织'
  return '注意保暖，厚外套更稳妥'
}

export function effectiveSeasons(
  outfit: Outfit,
  pieces: OutfitItem[],
  items: Map<string, Item>,
): Season[] {
  if (outfit.seasons.length) return outfit.seasons
  const seasons = new Set<Season>()
  for (const piece of pieces) {
    const item = items.get(piece.itemId)
    for (const season of item?.seasons ?? []) seasons.add(season)
  }
  return [...seasons]
}

export function isOutfitEligible(
  outfit: Outfit,
  pieces: OutfitItem[],
  items: Map<string, Item>,
  targetSeasons: Season[],
  occasion?: string,
): boolean {
  if (!pieces.length) return false
  for (const piece of pieces) {
    const item = items.get(piece.itemId)
    if (!item) return false
    if (item.status !== 'active') return false
    if (item.cleanState !== 'clean') return false
  }

  if (occasion && !outfit.occasions.includes(occasion)) return false

  const seasons = effectiveSeasons(outfit, pieces, items)
  if (!seasons.length) return true
  return seasons.some((season) => targetSeasons.includes(season))
}

export function rankOutfits(outfits: Outfit[]): Outfit[] {
  return [...outfits].sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1
    const rating = (b.rating ?? 0) - (a.rating ?? 0)
    if (rating) return rating
    return b.updatedAt.localeCompare(a.updatedAt)
  })
}
