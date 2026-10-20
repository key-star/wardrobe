import type {
  CategoryId,
  CleanState,
  ItemStatus,
  Pattern,
  Season,
  SlotId,
  Style,
} from './types'

export interface CategoryDef {
  id: CategoryId
  label: string
  emoji: string
  subcategories: string[]
}

export const CATEGORIES: CategoryDef[] = [
  {
    id: 'outer',
    label: '外套',
    emoji: '🧥',
    subcategories: ['大衣', '风衣', '夹克', '羽绒服', '棉服', '西服', '马甲'],
  },
  {
    id: 'top',
    label: '上装',
    emoji: '👕',
    subcategories: ['T恤', '衬衫', 'Polo', '针织衫', '卫衣', '毛衣', '背心'],
  },
  {
    id: 'inner',
    label: '内搭',
    emoji: '🎽',
    subcategories: ['打底衫', '吊带', '秋衣', '内衣', '保暖内衣'],
  },
  {
    id: 'bottom',
    label: '下装',
    emoji: '👖',
    subcategories: ['牛仔裤', '休闲裤', '西裤', '短裤', '半身裙', '连衣裙', '运动裤'],
  },
  {
    id: 'shoes',
    label: '鞋',
    emoji: '👟',
    subcategories: ['运动鞋', '板鞋', '皮鞋', '靴子', '凉鞋', '拖鞋', '帆布鞋'],
  },
  {
    id: 'bag',
    label: '包',
    emoji: '👜',
    subcategories: ['双肩包', '单肩包', '斜挎包', '手提包', '钱包', '行李箱'],
  },
  {
    id: 'accessory',
    label: '配饰',
    emoji: '🧣',
    subcategories: ['帽子', '围巾', '腰带', '眼镜', '手套', '袜子', '首饰'],
  },
]

export const SLOTS: SlotId[] = [
  'outer',
  'top',
  'inner',
  'bottom',
  'shoes',
  'bag',
  'accessory',
]

const CATEGORY_MAP = new Map(CATEGORIES.map((c) => [c.id, c]))

export function categoryDef(id: CategoryId): CategoryDef {
  return CATEGORY_MAP.get(id) ?? CATEGORIES[1]
}

export function categoryLabel(id: CategoryId): string {
  return categoryDef(id).label
}

export const SEASONS: { id: Season; label: string; emoji: string }[] = [
  { id: 'spring', label: '春', emoji: '🌱' },
  { id: 'summer', label: '夏', emoji: '☀️' },
  { id: 'autumn', label: '秋', emoji: '🍂' },
  { id: 'winter', label: '冬', emoji: '❄️' },
]

export const STYLES: { id: Style; label: string }[] = [
  { id: 'commute', label: '通勤' },
  { id: 'casual', label: '休闲' },
  { id: 'sport', label: '运动' },
  { id: 'formal', label: '正式' },
  { id: 'date', label: '约会' },
  { id: 'home', label: '居家' },
]

export const PATTERNS: { id: Pattern; label: string }[] = [
  { id: 'solid', label: '纯色' },
  { id: 'stripe', label: '条纹' },
  { id: 'check', label: '格子' },
  { id: 'floral', label: '碎花' },
  { id: 'dot', label: '波点' },
  { id: 'print', label: '图案' },
  { id: 'other', label: '其他' },
]

export const CLEAN_STATES: { id: CleanState; label: string; emoji: string }[] = [
  { id: 'clean', label: '干净', emoji: '✅' },
  { id: 'worn', label: '穿过', emoji: '👕' },
  { id: 'to_wash', label: '待洗', emoji: '🧺' },
  { id: 'washing', label: '洗涤中', emoji: '💧' },
]

export const ITEM_STATUSES: { id: ItemStatus; label: string }[] = [
  { id: 'active', label: '在役' },
  { id: 'idle', label: '闲置' },
  { id: 'pending', label: '待处理' },
]

export const FORMALITY_LABELS: Record<number, string> = {
  1: '很休闲',
  2: '休闲',
  3: '日常',
  4: '偏正式',
  5: '正式',
}

export const WARMTH_LABELS: Record<number, string> = {
  1: '很薄',
  2: '薄',
  3: '适中',
  4: '偏厚',
  5: '很厚',
}

export interface PaletteColor {
  name: string
  hex: string
  neutral: boolean
}

export const PALETTE: PaletteColor[] = [
  { name: '黑', hex: '#1c1c1e', neutral: true },
  { name: '白', hex: '#f7f7f5', neutral: true },
  { name: '灰', hex: '#9a9a9d', neutral: true },
  { name: '米白', hex: '#e8e0d0', neutral: true },
  { name: '卡其', hex: '#c3a878', neutral: true },
  { name: '棕', hex: '#7a5236', neutral: false },
  { name: '深蓝', hex: '#22304f', neutral: true },
  { name: '牛仔蓝', hex: '#4a6b96', neutral: true },
  { name: '浅蓝', hex: '#a9c6e2', neutral: false },
  { name: '天蓝', hex: '#5aa9e6', neutral: false },
  { name: '藏青', hex: '#1b2138', neutral: true },
  { name: '红', hex: '#c0392b', neutral: false },
  { name: '酒红', hex: '#7b2d3b', neutral: false },
  { name: '粉', hex: '#e8a0b4', neutral: false },
  { name: '橙', hex: '#e07b39', neutral: false },
  { name: '黄', hex: '#e8c547', neutral: false },
  { name: '绿', hex: '#3f7d52', neutral: false },
  { name: '墨绿', hex: '#24443a', neutral: false },
  { name: '紫', hex: '#6b4a8f', neutral: false },
]

export function paletteNameOf(hex: string | undefined): string | undefined {
  if (!hex) return undefined
  const target = hex.toLowerCase()
  return PALETTE.find((c) => c.hex.toLowerCase() === target)?.name
}

export function isNeutralHex(hex: string | undefined): boolean {
  if (!hex) return false
  const target = hex.toLowerCase()
  return PALETTE.find((c) => c.hex.toLowerCase() === target)?.neutral ?? false
}
