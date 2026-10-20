import Dexie, { type Table } from 'dexie'
import type {
  Item,
  Outfit,
  OutfitItem,
  SettingRow,
  StoredImage,
  WearLog,
} from './types'

export class WardrobeDB extends Dexie {
  items!: Table<Item, string>
  images!: Table<StoredImage, string>
  outfits!: Table<Outfit, string>
  outfitItems!: Table<OutfitItem, string>
  wearLogs!: Table<WearLog, string>
  settings!: Table<SettingRow, string>

  constructor(name = 'wardrobe') {
    super(name)
    this.version(1).stores({
      items: 'id, category, status, cleanState, createdAt, updatedAt, *tags, *seasons',
      images: 'id, itemId, kind',
      outfits: 'id, createdAt, updatedAt',
      outfitItems: 'id, outfitId, itemId, slot',
      wearLogs: 'id, date, outfitId',
      settings: 'key',
    })
  }
}

export const db = new WardrobeDB()
