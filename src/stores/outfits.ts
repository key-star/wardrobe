import { defineStore } from 'pinia'
import { computed, ref, toRaw } from 'vue'
import { SLOTS } from '@/db/constants'
import type { Outfit, OutfitItem, SlotId } from '@/db/types'
import {
  deleteOutfit as dbDeleteOutfit,
  listOutfitItems,
  listOutfits,
  newId,
  nowIso,
  putOutfit,
  replaceOutfitItems,
} from '@/db/repo'

export function createEmptyOutfit(): Outfit {
  const ts = nowIso()
  return {
    id: newId(),
    name: '',
    cover: undefined,
    occasions: [],
    seasons: [],
    rating: undefined,
    favorite: false,
    notes: undefined,
    createdAt: ts,
    updatedAt: ts,
  }
}

export function layerFor(slot: SlotId, index = 0): number {
  return (SLOTS.indexOf(slot) + 1) * 10 + (slot === 'accessory' ? index : 0)
}

export interface OutfitDraft {
  outfit: Outfit
  items: OutfitItem[]
}

// Vue reactive proxies cannot be structured-cloned into IndexedDB.
function toPersistableOutfit(outfit: Outfit): Outfit {
  const raw = toRaw(outfit)
  return {
    ...raw,
    occasions: [...raw.occasions],
    seasons: [...raw.seasons],
  }
}

function toPersistableItem(item: OutfitItem): OutfitItem {
  const raw = toRaw(item)
  return { ...raw }
}

export const useOutfitsStore = defineStore('outfits', () => {
  const outfits = ref<Outfit[]>([])
  const pieces = ref<OutfitItem[]>([])
  const loaded = ref(false)
  const loading = ref(false)

  const total = computed(() => outfits.value.length)

  function byId(id: string): Outfit | undefined {
    return outfits.value.find((outfit) => outfit.id === id)
  }

  function piecesFor(outfitId: string): OutfitItem[] {
    return pieces.value
      .filter((piece) => piece.outfitId === outfitId)
      .sort((a, b) => a.layer - b.layer || a.id.localeCompare(b.id))
  }

  function countFor(outfitId: string): number {
    return pieces.value.filter((piece) => piece.outfitId === outfitId).length
  }

  async function load(force = false): Promise<void> {
    if (loaded.value && !force) return
    loading.value = true
    try {
      const [rows, allPieces] = await Promise.all([listOutfits(), listOutfitItems()])
      outfits.value = rows
      pieces.value = allPieces
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function saveOutfit(draft: OutfitDraft): Promise<Outfit> {
    const outfit = toPersistableOutfit(draft.outfit)
    outfit.updatedAt = nowIso()
    if (!outfit.createdAt) outfit.createdAt = outfit.updatedAt
    const items = draft.items.map((item) =>
      toPersistableItem({ ...item, outfitId: outfit.id }),
    )

    await putOutfit(outfit)
    await replaceOutfitItems(outfit.id, items)

    const index = outfits.value.findIndex((row) => row.id === outfit.id)
    if (index >= 0) outfits.value[index] = outfit
    else outfits.value.unshift(outfit)
    outfits.value.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

    pieces.value = pieces.value
      .filter((piece) => piece.outfitId !== outfit.id)
      .concat(items)
    return outfit
  }

  async function setCover(id: string, cover: Blob): Promise<void> {
    const outfit = byId(id)
    if (!outfit) return
    outfit.cover = cover
    outfit.updatedAt = nowIso()
    await putOutfit(toPersistableOutfit(outfit))
  }

  async function setFavorite(id: string, favorite: boolean): Promise<void> {
    const outfit = byId(id)
    if (!outfit) return
    outfit.favorite = favorite
    outfit.updatedAt = nowIso()
    await putOutfit(toPersistableOutfit(outfit))
  }

  async function removeOutfit(id: string): Promise<void> {
    await dbDeleteOutfit(id)
    outfits.value = outfits.value.filter((outfit) => outfit.id !== id)
    pieces.value = pieces.value.filter((piece) => piece.outfitId !== id)
  }

  return {
    outfits,
    pieces,
    loaded,
    loading,
    total,
    byId,
    piecesFor,
    countFor,
    load,
    saveOutfit,
    setCover,
    setFavorite,
    removeOutfit,
  }
})
