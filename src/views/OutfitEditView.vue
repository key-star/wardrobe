<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BlobThumb from '@/components/BlobThumb.vue'
import ChipGroup from '@/components/ChipGroup.vue'
import Icon from '@/components/Icon.vue'
import OutfitPreview from '@/components/OutfitPreview.vue'
import SlotPickerSheet from '@/components/SlotPickerSheet.vue'
import { useToast } from '@/composables/useToast'
import { categoryDef, SEASONS, SLOTS, STYLES } from '@/db/constants'
import type { Item, Outfit, OutfitItem, Season, SlotId, Style } from '@/db/types'
import { newId } from '@/db/repo'
import {
  renderOutfitCover,
  type CollagePiece,
} from '@/services/collage'
import {
  createEmptyOutfit,
  layerFor,
  useOutfitsStore,
} from '@/stores/outfits'
import { useWardrobeStore } from '@/stores/wardrobe'

const route = useRoute()
const router = useRouter()
const outfitsStore = useOutfitsStore()
const wardrobe = useWardrobeStore()
const { show } = useToast()

const editingId = computed(() =>
  typeof route.params.id === 'string' ? route.params.id : undefined,
)
const isEditing = computed(() => Boolean(editingId.value))

const draft = reactive<Outfit>(createEmptyOutfit())
const pieces = ref<OutfitItem[]>([])
const ready = ref(false)
const saving = ref(false)
const pickerOpen = ref(false)
const pickerSlot = ref<SlotId>('top')

const previewPieces = computed<CollagePiece[]>(() =>
  pieces.value
    .map((piece) => {
      const item = wardrobe.byId(piece.itemId)
      return item ? { item, slot: piece.slot, layer: piece.layer } : null
    })
    .filter((piece): piece is CollagePiece => piece !== null),
)

const seasonModel = computed<string[]>(() => [...draft.seasons])
const occasionModel = computed<string[]>(() => [...draft.occasions])

const excludeIds = computed(() => {
  if (pickerSlot.value === 'accessory') {
    return pieces.value.map((piece) => piece.itemId)
  }
  return pieces.value
    .filter((piece) => piece.slot !== pickerSlot.value)
    .map((piece) => piece.itemId)
})

function readText(event: Event): string | undefined {
  const raw = (event.target as HTMLInputElement | HTMLTextAreaElement).value
  return raw.trim() === '' ? undefined : raw
}

function piecesForSlot(slot: SlotId): OutfitItem[] {
  return pieces.value
    .filter((piece) => piece.slot === slot)
    .sort((a, b) => a.layer - b.layer)
}

function itemOf(piece: OutfitItem): Item | undefined {
  return wardrobe.byId(piece.itemId)
}

function titleOf(piece: OutfitItem): string {
  const item = itemOf(piece)
  if (!item) return '单品已删除'
  return item.name?.trim() || item.subcategory || categoryDef(item.category).label
}

function normalizeLayers() {
  const next: OutfitItem[] = []
  for (const slot of SLOTS) {
    const list = pieces.value
      .filter((piece) => piece.slot === slot)
      .sort((a, b) => a.layer - b.layer)
    list.forEach((piece, index) => next.push({ ...piece, layer: layerFor(slot, index) }))
  }
  pieces.value = next
}

function openPicker(slot: SlotId) {
  pickerSlot.value = slot
  pickerOpen.value = true
}

function selectItem(item: Item) {
  const slot = pickerSlot.value
  if (slot === 'accessory') {
    pieces.value = pieces.value.concat({
      id: newId(),
      outfitId: draft.id,
      itemId: item.id,
      slot,
      layer: layerFor(slot, piecesForSlot(slot).length),
    })
  } else {
    pieces.value = pieces.value
      .filter((piece) => piece.slot !== slot)
      .concat({
        id: newId(),
        outfitId: draft.id,
        itemId: item.id,
        slot,
        layer: layerFor(slot),
      })
  }
  normalizeLayers()
  pickerOpen.value = false
}

function removePiece(id: string) {
  pieces.value = pieces.value.filter((piece) => piece.id !== id)
  normalizeLayers()
}

function updateSeasons(value: string[]) {
  draft.seasons = value as Season[]
}

function updateOccasions(value: string[]) {
  draft.occasions = value as Style[]
}

onMounted(async () => {
  await Promise.all([wardrobe.load(true), outfitsStore.load()])
  const id = editingId.value
  if (!id) {
    ready.value = true
    return
  }
  await outfitsStore.load(true)
  const outfit = outfitsStore.byId(id)
  if (!outfit) {
    show('搭配不存在')
    router.replace('/outfits')
    return
  }
  Object.assign(draft, outfit)
  pieces.value = outfitsStore.piecesFor(id)
  normalizeLayers()
  ready.value = true
})

async function save() {
  if (!pieces.value.length) {
    show('先至少选择一件单品')
    return
  }
  saving.value = true
  try {
    draft.name = draft.name?.trim() || undefined
    await outfitsStore.saveOutfit({ outfit: { ...draft }, items: pieces.value })
    try {
      const cover = await renderOutfitCover(previewPieces.value)
      await outfitsStore.setCover(draft.id, cover)
    } catch {
      // Cover is nice-to-have; the outfit is already saved.
    }
    show(isEditing.value ? '已保存' : '已创建搭配')
    router.replace(`/outfits/${draft.id}`)
  } catch {
    show('保存失败，请重试')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page page--padded">
    <header class="topbar">
      <button class="icon-btn icon-btn--plain" aria-label="返回" @click="router.back()">
        <Icon name="back" :size="20" />
      </button>
      <div class="topbar__title">{{ isEditing ? '编辑搭配' : '新建搭配' }}</div>
      <button class="btn btn--primary topbar__save" :disabled="saving" @click="save">
        {{ saving ? '保存中' : '保存' }}
      </button>
    </header>

    <template v-if="ready">
      <div class="section" style="margin-top: 16px">
        <OutfitPreview :pieces="previewPieces" aspect-ratio="3 / 4" empty-text="选择单品后自动叠穿预览" />
      </div>

      <div class="section">
        <label class="field">
          <span class="field__label">搭配名称（可选）</span>
          <input
            class="input"
            placeholder="例如：通勤周一"
            :value="draft.name ?? ''"
            @input="draft.name = readText($event)"
          />
        </label>

        <div class="field">
          <span class="field__label">适合季节</span>
          <ChipGroup :options="SEASONS" :model-value="seasonModel" @update:model-value="updateSeasons" />
        </div>

        <div class="field">
          <span class="field__label">场合</span>
          <ChipGroup :options="STYLES" :model-value="occasionModel" @update:model-value="updateOccasions" />
        </div>
      </div>

      <div class="section">
        <div class="section__title">槽位</div>
        <div class="slots">
          <div
            v-for="slot in SLOTS"
            :key="slot"
            class="slot"
            @click="openPicker(slot)"
          >
            <div class="slot__head">
              <span>
                <span class="slot__emoji">{{ categoryDef(slot).emoji }}</span>
                {{ categoryDef(slot).label }}
              </span>
              <span class="slot__hint">
                {{ piecesForSlot(slot).length ? '更换' : '选择' }}
              </span>
            </div>

            <template v-if="piecesForSlot(slot).length">
              <div
                v-for="piece in piecesForSlot(slot)"
                :key="piece.id"
                class="slot__piece"
                @click.stop
              >
                <span
                  class="slot__thumb"
                  :class="{ 'slot__thumb--cutout': itemOf(piece)?.hasCutout }"
                >
                  <BlobThumb :blob="itemOf(piece)?.thumb" />
                </span>
                <span class="slot__name" :class="{ 'slot__name--missing': !itemOf(piece) }">
                  {{ titleOf(piece) }}
                </span>
                <button class="slot__remove" aria-label="移除" @click.stop="removePiece(piece.id)">
                  <Icon name="close" :size="16" />
                </button>
              </div>
            </template>
            <div v-else class="slot__empty">点击选择{{ categoryDef(slot).label }}</div>

            <button
              v-if="slot === 'accessory' && piecesForSlot(slot).length"
              class="slot__add"
              @click.stop="openPicker(slot)"
            >
              <Icon name="plus" :size="15" />再添加一件
            </button>
          </div>
        </div>
      </div>

      <div class="section">
        <label class="field">
          <span class="field__label">备注</span>
          <textarea
            class="textarea"
            rows="3"
            placeholder="这套适合什么天气、什么场合…"
            :value="draft.notes ?? ''"
            @input="draft.notes = readText($event)"
          />
        </label>
      </div>
    </template>

    <div class="savebar">
      <button class="btn btn--primary btn--block" :disabled="saving" @click="save">
        <Icon name="check" :size="19" />{{ isEditing ? '保存修改' : '创建搭配' }}
      </button>
    </div>

    <SlotPickerSheet
      :open="pickerOpen"
      :slot="pickerSlot"
      :items="wardrobe.items"
      :exclude-ids="excludeIds"
      :seasons="draft.seasons"
      @close="pickerOpen = false"
      @select="selectItem"
    />
  </div>
</template>

<style scoped>
.topbar__save {
  min-height: 36px;
  padding: 0 16px;
  font-size: 14px;
}

.slots {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.slot {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 14px;
  cursor: pointer;
}

.slot:active {
  background: var(--bg-elev-2);
}

.slot__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 600;
}

.slot__emoji {
  margin-right: 4px;
}

.slot__hint {
  font-size: 12px;
  color: var(--text-faint);
  font-weight: 400;
}

.slot__piece {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  padding: 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-input);
}

.slot__thumb {
  width: 42px;
  height: 54px;
  flex: none;
  border-radius: 8px;
  border: 1px solid var(--border);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-elev-2);
}

.slot__thumb--cutout {
  background:
    repeating-conic-gradient(
      color-mix(in srgb, var(--text) 6%, transparent) 0% 25%,
      transparent 0% 50%
    )
    0 0 / 12px 12px;
}

.slot__thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.slot__name {
  flex: 1;
  min-width: 0;
  font-size: 13.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slot__name--missing {
  color: var(--text-faint);
}

.slot__remove {
  width: 30px;
  height: 30px;
  flex: none;
  border-radius: 50%;
  background: var(--bg-elev-2);
  color: var(--text-faint);
  display: flex;
  align-items: center;
  justify-content: center;
}

.slot__empty {
  margin-top: 8px;
  padding: 12px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-sm);
  color: var(--text-faint);
  font-size: 13px;
  text-align: center;
}

.slot__add {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  color: var(--accent);
  font-size: 12.5px;
  font-weight: 550;
}

.savebar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  padding: 12px 16px calc(12px + var(--safe-bottom));
  background: color-mix(in srgb, var(--bg) 92%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-top: 1px solid var(--border);
}

.page--padded {
  padding-bottom: 96px;
}

@media (min-width: 640px) {
  .section {
    max-width: 560px;
    width: 100%;
    margin-left: auto;
    margin-right: auto;
  }
}
</style>
