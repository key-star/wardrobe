import { defineStore } from 'pinia'
import { computed, ref, toRaw } from 'vue'
import { CATEGORIES } from '@/db/constants'
import type { CategoryId, CleanState, Item } from '@/db/types'
import {
  deleteItem as dbDeleteItem,
  listItems,
  newId,
  nowIso,
  putImage,
  putItem,
} from '@/db/repo'

export function createEmptyItem(category: CategoryId = 'top'): Item {
  const ts = nowIso()
  return {
    id: newId(),
    name: '',
    category,
    subcategory: undefined,
    colorPrimary: undefined,
    colorSecondary: [],
    pattern: undefined,
    material: undefined,
    seasons: [],
    styles: [],
    formality: undefined,
    warmth: undefined,
    brand: undefined,
    size: undefined,
    price: undefined,
    purchaseDate: undefined,
    location: undefined,
    status: 'active',
    cleanState: 'clean',
    wearCount: 0,
    lastWornAt: undefined,
    attrs: {},
    tags: [],
    notes: undefined,
    hasOriginal: false,
    hasCutout: false,
    thumb: undefined,
    createdAt: ts,
    updatedAt: ts,
  }
}

export interface ItemDraft {
  item: Item
  original?: Blob | null
  cutout?: Blob | null
}

// Vue reactive proxies cannot be structured-cloned into IndexedDB,
// so unwrap to plain arrays/objects before persisting.
function toPersistable(item: Item): Item {
  const raw = toRaw(item)
  return {
    ...raw,
    seasons: [...raw.seasons],
    styles: [...raw.styles],
    tags: [...raw.tags],
    colorSecondary: raw.colorSecondary ? [...raw.colorSecondary] : [],
    attrs: { ...raw.attrs },
  }
}

export const useWardrobeStore = defineStore('wardrobe', () => {
  const items = ref<Item[]>([])
  const loaded = ref(false)
  const loading = ref(false)
  const search = ref('')
  const category = ref<CategoryId | 'all'>('all')
  const clean = ref<CleanState | 'all'>('all')

  const total = computed(() => items.value.length)

  const filtered = computed(() => {
    const q = search.value.trim().toLowerCase()
    return items.value.filter((item) => {
      if (category.value !== 'all' && item.category !== category.value) return false
      if (clean.value !== 'all' && item.cleanState !== clean.value) return false
      if (!q) return true
      const haystack = [
        item.name,
        item.brand,
        item.subcategory,
        item.location,
        item.material,
        ...item.tags,
        ...item.seasons,
        ...item.styles,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  })

  const countByCategory = computed(() => {
    const map = new Map<CategoryId, number>()
    for (const item of items.value) {
      map.set(item.category, (map.get(item.category) ?? 0) + 1)
    }
    return map
  })

  const totalValue = computed(() =>
    items.value.reduce((sum, item) => sum + (item.price ?? 0), 0),
  )

  const wearCountTotal = computed(() =>
    items.value.reduce((sum, item) => sum + item.wearCount, 0),
  )

  function byId(id: string): Item | undefined {
    return items.value.find((item) => item.id === id)
  }

  async function load(force = false): Promise<void> {
    if (loaded.value && !force) return
    loading.value = true
    try {
      items.value = await listItems()
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function saveItem(draft: ItemDraft): Promise<Item> {
    const { item, original, cutout } = draft
    if (original) {
      await putImage(item.id, 'original', original)
      item.hasOriginal = true
    }
    if (cutout) {
      await putImage(item.id, 'cutout', cutout)
      item.hasCutout = true
    }
    item.updatedAt = nowIso()
    if (!item.createdAt) item.createdAt = item.updatedAt
    const plain = toPersistable(item)
    await putItem(plain)

    const index = items.value.findIndex((existing) => existing.id === item.id)
    if (index >= 0) items.value[index] = plain
    else items.value.unshift(plain)
    return plain
  }

  async function removeItem(id: string): Promise<void> {
    await dbDeleteItem(id)
    items.value = items.value.filter((item) => item.id !== id)
  }

  async function markWorn(id: string, date = new Date()): Promise<void> {
    const item = byId(id)
    if (!item) return
    item.wearCount += 1
    item.lastWornAt = date.toISOString().slice(0, 10)
    if (item.cleanState === 'clean') item.cleanState = 'worn'
    item.updatedAt = nowIso()
    await putItem(toPersistable(item))
  }

  async function setCleanState(id: string, state: CleanState): Promise<void> {
    const item = byId(id)
    if (!item) return
    item.cleanState = state
    item.updatedAt = nowIso()
    await putItem(toPersistable(item))
  }

  const categoryStats = computed(() =>
    CATEGORIES.map((def) => ({
      ...def,
      count: countByCategory.value.get(def.id) ?? 0,
    })),
  )

  return {
    items,
    loaded,
    loading,
    search,
    category,
    clean,
    total,
    filtered,
    countByCategory,
    categoryStats,
    totalValue,
    wearCountTotal,
    byId,
    load,
    saveItem,
    removeItem,
    markWorn,
    setCleanState,
  }
})
