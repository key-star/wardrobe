import { isNeutralHex } from '@/db/constants'
import type { Item, Outfit, OutfitItem, Season, WearLog } from '@/db/types'
import { daysBetweenKeys } from '@/services/stats'
import { localDateKey } from '@/services/today'

export const RECOMMEND_SLOTS = ['top', 'bottom', 'shoes'] as const

export interface ScoreBreakdown {
  color: number
  formality: number
  warmth: number
  freshness: number
  history: number
}

export interface ScoredPieces {
  score: number
  breakdown: ScoreBreakdown
  freshDays: number
}

export interface WearHistory {
  lastWorn: Map<string, string>
  ratings: Map<string, number[]>
}

export interface ScoreOptions {
  today?: string
  targetWarmth?: number
  history?: WearHistory
  fallbackRating?: number
}

export interface ScoredOutfit extends ScoredPieces {
  outfit: Outfit
  items: Item[]
}

export interface Recommendation extends ScoredPieces {
  items: Item[]
  slots: readonly Item['category'][]
}

export interface RecommendOptions {
  today?: string
  seasons?: Season[]
  occasion?: string
  targetWarmth?: number
  sampleSize?: number
  limit?: number
}

const FRESHNESS_DAYS = 30

export function buildWearHistory(logs: WearLog[]): WearHistory {
  const lastWorn = new Map<string, string>()
  const ratings = new Map<string, number[]>()
  for (const log of logs) {
    for (const itemId of log.itemIds) {
      const previous = lastWorn.get(itemId)
      if (!previous || log.date > previous) lastWorn.set(itemId, log.date)
      if (log.rating != null && log.rating >= 1 && log.rating <= 5) {
        const list = ratings.get(itemId) ?? []
        list.push(log.rating)
        ratings.set(itemId, list)
      }
    }
  }
  return { lastWorn, ratings }
}

export function colorHarmonyScore(items: Item[]): number {
  const colorful = items.filter(
    (item) => item.colorPrimary && !isNeutralHex(item.colorPrimary),
  ).length
  if (colorful === 0) return 30
  if (colorful === 1) return 25
  if (colorful === 2) return 10
  return 0
}

export function formalityScore(items: Item[]): number {
  const values = items
    .map((item) => item.formality)
    .filter((value): value is number => value != null && value >= 1 && value <= 5)
  if (values.length < 2) return 20
  const spread = Math.max(...values) - Math.min(...values)
  return Math.max(0, 20 - 10 * spread)
}

export function warmthScore(items: Item[], targetWarmth = 3): number {
  const values = items
    .map((item) => item.warmth)
    .filter((value): value is number => value != null && value >= 1 && value <= 5)
  if (!values.length) return 20
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  return Math.max(0, 20 - 6 * Math.abs(average - targetWarmth))
}

export function freshnessScore(items: Item[], history: WearHistory, today: string): number {
  if (!items.length) return 0
  const days = items.map((item) => {
    const key = item.lastWornAt ?? history.lastWorn.get(item.id)
    return key ? Math.min(FRESHNESS_DAYS, daysBetweenKeys(key, today)) : FRESHNESS_DAYS
  })
  return (Math.min(...days) / FRESHNESS_DAYS) * 15
}

export function historyScore(
  items: Item[],
  history: WearHistory,
  fallbackRating?: number,
): number {
  const ratings: number[] = []
  for (const item of items) {
    const list = history.ratings.get(item.id)
    if (list) ratings.push(...list)
  }
  const rating = ratings.length
    ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length
    : fallbackRating ?? 3
  const clamped = Math.max(1, Math.min(5, rating))
  return Math.max(0, Math.min(15, ((clamped - 3) / 2) * 15 + 7.5))
}

export function scoreItems(items: Item[], options: ScoreOptions = {}): ScoredPieces {
  const today = options.today ?? localDateKey()
  const history = options.history ?? buildWearHistory([])
  const breakdown: ScoreBreakdown = {
    color: colorHarmonyScore(items),
    formality: formalityScore(items),
    warmth: warmthScore(items, options.targetWarmth ?? 3),
    freshness: freshnessScore(items, history, today),
    history: historyScore(items, history, options.fallbackRating),
  }
  const total =
    breakdown.color +
    breakdown.formality +
    breakdown.warmth +
    breakdown.freshness +
    breakdown.history
  const oldest = items.map((item) => {
    const key = item.lastWornAt ?? history.lastWorn.get(item.id)
    return key ? Math.min(FRESHNESS_DAYS, daysBetweenKeys(key, today)) : FRESHNESS_DAYS
  })
  return {
    score: Math.round(total * 10) / 10,
    breakdown,
    freshDays: oldest.length ? Math.min(...oldest) : FRESHNESS_DAYS,
  }
}

export function compareScored(a: ScoredPieces, b: ScoredPieces): number {
  if (b.score !== a.score) return b.score - a.score
  if (b.freshDays !== a.freshDays) return b.freshDays - a.freshDays
  return 0
}

export function scoreOutfit(
  outfit: Outfit,
  pieces: OutfitItem[],
  items: Map<string, Item>,
  options: ScoreOptions = {},
): ScoredOutfit | null {
  const resolved: Item[] = []
  const seen = new Set<string>()
  for (const piece of pieces) {
    const item = items.get(piece.itemId)
    if (!item || seen.has(item.id)) continue
    seen.add(item.id)
    resolved.push(item)
  }
  if (!resolved.length) return null
  return {
    outfit,
    items: resolved,
    ...scoreItems(resolved, {
      ...options,
      fallbackRating: options.fallbackRating ?? outfit.rating,
    }),
  }
}

function hashString(value: string): number {
  let hash = 2_166_136_261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

function isRecommendable(item: Item, seasons: Season[], occasion?: string): boolean {
  if (item.status !== 'active') return false
  if (item.cleanState !== 'clean') return false
  if (
    seasons.length &&
    item.seasons.length &&
    !item.seasons.some((season) => seasons.includes(season))
  ) {
    return false
  }
  if (occasion && item.styles.length && !item.styles.some((style) => style === occasion)) {
    return false
  }
  return true
}

function sampleCombinations(pools: Item[][], sampleSize: number, seed: number): Item[][] {
  const [topPool, bottomPool, shoesPool] = pools
  const total = topPool.length * bottomPool.length * shoesPool.length
  if (total <= sampleSize) {
    const combos: Item[][] = []
    for (const top of topPool) {
      for (const bottom of bottomPool) {
        for (const shoes of shoesPool) combos.push([top, bottom, shoes])
      }
    }
    return combos
  }

  const random = mulberry32(seed)
  const pick = (pool: Item[]) => pool[Math.floor(random() * pool.length)]
  const seen = new Set<string>()
  const combos: Item[][] = []
  let guard = sampleSize * 40
  while (combos.length < sampleSize && guard > 0) {
    guard -= 1
    const combo = [pick(topPool), pick(bottomPool), pick(shoesPool)]
    const key = combo.map((item) => item.id).join('|')
    if (seen.has(key)) continue
    seen.add(key)
    combos.push(combo)
  }
  return combos
}

export function recommendCombinations(
  items: Item[],
  logs: WearLog[],
  options: RecommendOptions = {},
): Recommendation[] {
  const seasons = options.seasons ?? []
  const occasion = options.occasion
  const today = options.today ?? localDateKey()
  const sampleSize = Math.max(1, options.sampleSize ?? 200)
  const limit = Math.max(0, options.limit ?? 3)

  const pools = RECOMMEND_SLOTS.map((slot) =>
    items.filter(
      (item) => item.category === slot && isRecommendable(item, seasons, occasion),
    ),
  )
  if (pools.some((pool) => !pool.length)) return []

  const seed = hashString(`${today}|${occasion ?? ''}|${seasons.join(',')}`)
  const combos = sampleCombinations(pools, sampleSize, seed)
  const history = buildWearHistory(logs)

  const scored: Recommendation[] = combos.map((combo) => ({
    items: combo,
    slots: RECOMMEND_SLOTS,
    ...scoreItems(combo, {
      today,
      targetWarmth: options.targetWarmth,
      history,
    }),
  }))

  scored.sort(
    (a, b) =>
      compareScored(a, b) ||
      a.items
        .map((item) => item.id)
        .join('|')
        .localeCompare(b.items.map((item) => item.id).join('|')),
  )

  return scored.slice(0, limit)
}
