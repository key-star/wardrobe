<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BlobThumb from '@/components/BlobThumb.vue'
import Icon from '@/components/Icon.vue'
import OutfitPreview from '@/components/OutfitPreview.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { categoryDef, SEASONS, SLOTS, STYLES } from '@/db/constants'
import type { Item, Outfit, OutfitItem } from '@/db/types'
import {
  buildOutfitShareImage,
  shareFileName,
  shareOutfitImage,
  type CollagePiece,
} from '@/services/collage'
import { useOutfitsStore } from '@/stores/outfits'
import { useWardrobeStore } from '@/stores/wardrobe'

const route = useRoute()
const router = useRouter()
const outfitsStore = useOutfitsStore()
const wardrobe = useWardrobeStore()
const { show } = useToast()
const { askConfirm } = useConfirm()

const outfit = ref<Outfit | null>(null)
const pieces = ref<OutfitItem[]>([])
const sharing = ref(false)
const ready = ref(false)

const id = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))

const title = computed(() => outfit.value?.name?.trim() || '未命名搭配')

const previewPieces = computed<CollagePiece[]>(() =>
  pieces.value
    .map((piece) => {
      const item = wardrobe.byId(piece.itemId)
      return item ? { item, slot: piece.slot, layer: piece.layer } : null
    })
    .filter((piece): piece is CollagePiece => piece !== null),
)

const groups = computed(() =>
  SLOTS.map((slot) => ({
    slot,
    def: categoryDef(slot),
    rows: pieces.value
      .filter((piece) => piece.slot === slot)
      .sort((a, b) => a.layer - b.layer),
  })).filter((group) => group.rows.length),
)

const occasionLabels = computed(() =>
  (outfit.value?.occasions ?? [])
    .map((occasion) => STYLES.find((style) => style.id === occasion)?.label)
    .filter(Boolean),
)

const seasonLabels = computed(() =>
  (outfit.value?.seasons ?? [])
    .map((season) => SEASONS.find((entry) => entry.id === season)?.label)
    .filter(Boolean),
)

const totalCount = computed(() => pieces.value.length)

function itemOf(piece: OutfitItem): Item | undefined {
  return wardrobe.byId(piece.itemId)
}

function titleOf(piece: OutfitItem): string {
  const item = itemOf(piece)
  if (!item) return '单品已删除'
  return item.name?.trim() || item.subcategory || categoryDef(item.category).label
}

function subOf(piece: OutfitItem): string {
  const item = itemOf(piece)
  if (!item) return ''
  return item.subcategory || categoryDef(item.category).label
}

onMounted(async () => {
  await Promise.all([wardrobe.load(true), outfitsStore.load(true)])
  const found = outfitsStore.byId(id.value)
  if (!found) {
    show('搭配不存在')
    router.replace('/outfits')
    return
  }
  outfit.value = found
  pieces.value = outfitsStore.piecesFor(id.value)
  ready.value = true
})

async function toggleFavorite() {
  if (!outfit.value) return
  const next = !outfit.value.favorite
  await outfitsStore.setFavorite(outfit.value.id, next)
  show(next ? '已收藏' : '已取消收藏')
}

function edit() {
  if (outfit.value) router.push(`/outfits/${outfit.value.id}/edit`)
}

async function share() {
  const current = outfit.value
  if (!current || !previewPieces.value.length) {
    show('这套搭配还没有单品')
    return
  }
  sharing.value = true
  try {
    const blob = await buildOutfitShareImage(current, previewPieces.value)
    const result = await shareOutfitImage(blob, shareFileName(current), title.value)
    if (result === 'shared') show('已分享')
    else if (result === 'downloaded') show('已生成分享图')
    else show('已取消分享')
  } catch {
    show('生成分享图失败，请重试')
  } finally {
    sharing.value = false
  }
}

async function remove() {
  const current = outfit.value
  if (!current) return
  const confirmed = await askConfirm({
    title: '删除搭配',
    message: `删除「${title.value}」？此操作不可撤销。`,
    confirmText: '删除',
    danger: true,
  })
  if (!confirmed) return
  await outfitsStore.removeOutfit(current.id)
  show('已删除')
  router.replace('/outfits')
}
</script>

<template>
  <div class="page page--padded">
    <header class="topbar">
      <button class="icon-btn icon-btn--plain" aria-label="返回" @click="router.back()">
        <Icon name="back" :size="20" />
      </button>
      <div class="topbar__title">{{ title }}</div>
      <button
        class="icon-btn icon-btn--plain fav"
        :class="{ 'fav--on': outfit?.favorite }"
        :aria-label="outfit?.favorite ? '取消收藏' : '收藏'"
        @click="toggleFavorite"
      >
        ★
      </button>
      <button class="icon-btn" aria-label="编辑" @click="edit">
        <Icon name="pencil" :size="18" />
      </button>
    </header>

    <template v-if="ready && outfit">
      <div class="section" style="margin-top: 16px">
        <OutfitPreview :pieces="previewPieces" aspect-ratio="3 / 4" />
      </div>

      <div v-if="occasionLabels.length || seasonLabels.length" class="section facts">
        <span v-for="label in occasionLabels" :key="`o-${label}`" class="fact">{{ label }}</span>
        <span v-for="label in seasonLabels" :key="`s-${label}`" class="fact">{{ label }}</span>
        <span class="fact">{{ totalCount }} 件</span>
      </div>

      <div class="section actions">
        <button class="btn btn--primary" :disabled="sharing" @click="share">
          <Icon name="download" :size="18" />{{ sharing ? '生成中' : '分享长图' }}
        </button>
        <button class="btn" @click="edit">
          <Icon name="pencil" :size="18" />编辑
        </button>
      </div>

      <div class="section">
        <div class="section__title">单品清单</div>
        <div class="groups">
          <div v-for="group in groups" :key="group.slot" class="group">
            <div class="group__title">
              <span>{{ group.def.emoji }}</span>{{ group.def.label }}
            </div>
            <template v-for="piece in group.rows" :key="piece.id">
              <router-link
                v-if="itemOf(piece)"
                :to="`/item/${piece.itemId}`"
                class="row-item"
              >
                <span class="row-item__thumb" :class="{ 'row-item__thumb--cutout': itemOf(piece)?.hasCutout }">
                  <BlobThumb :blob="itemOf(piece)?.thumb" />
                </span>
                <span class="row-item__body">
                  <span class="row-item__name">{{ titleOf(piece) }}</span>
                  <span class="row-item__sub">
                    {{ subOf(piece) }}
                  </span>
                </span>
                <Icon name="back" :size="16" class="row-item__arrow" />
              </router-link>
              <div v-else class="row-item row-item--missing">
                <span class="row-item__body">单品已删除</span>
              </div>
            </template>
          </div>
        </div>
      </div>

      <div v-if="outfit.notes" class="section">
        <div class="section__title">备注</div>
        <p class="notes">{{ outfit.notes }}</p>
      </div>

      <div class="section">
        <button class="btn btn--danger btn--block" @click="remove">
          <Icon name="trash" :size="18" />删除这套搭配
        </button>
      </div>
    </template>

    <div v-else class="empty">
      <span class="spin" style="font-size: 28px">◌</span>
    </div>
  </div>
</template>

<style scoped>
.fav {
  font-size: 20px;
  color: var(--text-faint);
}

.fav--on {
  color: #ffd166;
}

.facts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.fact {
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  font-size: 13px;
  color: var(--text-dim);
}

.actions {
  display: flex;
  gap: 10px;
}

.actions .btn {
  flex: 1;
}

.groups {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.group {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.group__title {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-faint);
  border-bottom: 1px solid var(--border);
}

.row-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  color: inherit;
  border-bottom: 1px solid var(--border);
}

.row-item:last-child {
  border-bottom: none;
}

.row-item:active {
  background: var(--bg-elev-2);
}

.row-item__thumb {
  width: 40px;
  height: 52px;
  flex: none;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-input);
}

.row-item__thumb--cutout {
  background:
    repeating-conic-gradient(
      color-mix(in srgb, var(--text) 6%, transparent) 0% 25%,
      transparent 0% 50%
    )
    0 0 / 12px 12px;
}

.row-item__thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.row-item__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.row-item__name {
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-item__sub {
  font-size: 12px;
  color: var(--text-faint);
}

.row-item__arrow {
  transform: rotate(180deg);
  color: var(--text-faint);
}

.row-item--missing {
  color: var(--text-faint);
  font-size: 13px;
}

.notes {
  font-size: 14px;
  color: var(--text-dim);
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px;
  white-space: pre-wrap;
}
</style>
