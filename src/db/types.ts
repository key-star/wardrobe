export type CategoryId =
  | 'outer'
  | 'top'
  | 'inner'
  | 'bottom'
  | 'shoes'
  | 'bag'
  | 'accessory'

export type SlotId = CategoryId

export type CleanState = 'clean' | 'worn' | 'to_wash' | 'washing'

export type ItemStatus = 'active' | 'idle' | 'pending'

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export type Style =
  | 'commute'
  | 'casual'
  | 'sport'
  | 'formal'
  | 'home'
  | 'date'

export type Pattern =
  | 'solid'
  | 'stripe'
  | 'check'
  | 'floral'
  | 'dot'
  | 'print'
  | 'other'

export type ImageKind = 'original' | 'cutout' | 'thumb'

export interface Item {
  id: string
  name?: string
  category: CategoryId
  subcategory?: string
  colorPrimary?: string
  colorSecondary?: string[]
  pattern?: Pattern
  material?: string
  seasons: Season[]
  styles: Style[]
  formality?: number
  warmth?: number
  brand?: string
  size?: string
  price?: number
  purchaseDate?: string
  location?: string
  status: ItemStatus
  cleanState: CleanState
  wearCount: number
  lastWornAt?: string
  attrs: Record<string, string | number>
  tags: string[]
  notes?: string
  hasOriginal: boolean
  hasCutout: boolean
  thumb?: Blob
  createdAt: string
  updatedAt: string
}

export interface StoredImage {
  id: string
  itemId: string
  kind: ImageKind
  blob: Blob
}

export interface Outfit {
  id: string
  name?: string
  cover?: Blob
  occasions: string[]
  seasons: Season[]
  rating?: number
  favorite: boolean
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface OutfitItem {
  id: string
  outfitId: string
  itemId: string
  slot: SlotId
  layer: number
}

export interface WearLog {
  id: string
  date: string
  outfitId?: string
  itemIds: string[]
  occasion?: string
  weather?: string
  rating?: number
  createdAt: string
}

export interface SettingRow {
  key: string
  value: unknown
}
