<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '@/components/Icon.vue'
import { useToast } from '@/composables/useToast'
import { useObjectUrl } from '@/composables/useObjectUrl'
import {
  categoryDef,
  CLEAN_STATES,
  FORMALITY_LABELS,
  ITEM_STATUSES,
  PATTERNS,
  paletteNameOf,
  SEASONS,
  STYLES,
  WARMTH_LABELS,
} from '@/db/constants'
import { getImage, getItem } from '@/db/repo'
import type { CleanState, Item } from '@/db/types'
import { createCutout, CutoutAbortError, describeCutoutProgress, type CutoutProgressState } from '@/services/cutout'
import { useWardrobeStore } from '@/stores/wardrobe'

const route = useRoute()
const router = useRouter()
const store = useWardrobeStore()
const { show } = useToast()

const item = ref<Item | null>(null)
const original = ref<Blob | null>(null)
const cutout = ref<Blob | null>(null)
const viewMode = ref<'original' | 'cutout'>('original')
const viewerOpen = ref(false)
const retrying = ref(false)
const cutoutProgress = ref<CutoutProgressState | null>(null)

const id = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))

const hasCutout = computed(() => Boolean(cutout.value))
const displayImage = computed(() => {
  if (viewMode.value === 'cutout' && cutout.value) return cutout.value
  return original.value ?? item.value?.thumb ?? null
})
const imageUrl = useObjectUrl(displayImage)

const title = computed(() => {
  const current = item.value
  if (!current) return ''
  return (
    current.name?.trim() ||
    current.subcategory ||
    categoryDef(current.category).label
  )
})

const labelOf = <T extends string>(
  options: { id: T; label: string }[],
  value: T | undefined,
): string => options.find((o) => o.id === value)?.label ?? '—'

const colorName = computed(() => paletteNameOf(item.value?.colorPrimary) ?? item.value?.colorPrimary ?? '—')

const rows = computed(() => {
  const current = item.value
  if (!current) return []
  return [
    { label: '分类', value: `${categoryDef(current.category).label}${current.subcategory ? ` · ${current.subcategory}` : ''}` },
    { label: '图案', value: labelOf(PATTERNS, current.pattern) },
    { label: '材质', value: current.material ?? '—' },
    { label: '品牌', value: current.brand ?? '—' },
    { label: '尺码', value: current.size ?? '—' },
    { label: '价格', value: current.price != null ? `¥${current.price}` : '—' },
    { label: '购入日期', value: current.purchaseDate ?? '—' },
    { label: '存放位置', value: current.location ?? '—' },
    { label: '正式度', value: current.formality ? FORMALITY_LABELS[current.formality] : '—' },
    { label: '保暖度', value: current.warmth ? WARMTH_LABELS[current.warmth] : '—' },
    { label: '在役状态', value: labelOf(ITEM_STATUSES, current.status) },
    { label: '穿着次数', value: `${current.wearCount} 次` },
    { label: '最后穿着', value: current.lastWornAt ?? '—' },
  ]
})

const seasonLabels = computed(() =>
  (item.value?.seasons ?? [])
    .map((id) => SEASONS.find((s) => s.id === id)?.label)
    .filter(Boolean)
    .join(' '),
)

const styleLabels = computed(() =>
  (item.value?.styles ?? [])
    .map((id) => STYLES.find((s) => s.id === id)?.label)
    .filter(Boolean)
    .join(' '),
)

onMounted(async () => {
  await store.load()
  const found = store.byId(id.value) ?? (await getItem(id.value))
  if (!found) {
    show('单品不存在')
    router.replace('/')
    return
  }
  item.value = found
  original.value = (await getImage(found.id, 'original')) ?? found.thumb ?? null
  cutout.value = (await getImage(found.id, 'cutout')) ?? null
  if (cutout.value) viewMode.value = 'cutout'
})

async function regenerateCutout() {
  const current = item.value
  if (!current || !original.value) return
  retrying.value = true
  cutoutProgress.value = null
  try {
    const result = await createCutout(original.value, (label, current, total) => {
      cutoutProgress.value = describeCutoutProgress(label, current, total)
    })
    await store.attachCutout(current.id, result.cutout, result.thumb)
    cutout.value = result.cutout
    viewMode.value = 'cutout'
    show('抠图完成')
  } catch (error) {
    show(error instanceof CutoutAbortError ? error.message : '抠图失败，请稍后重试')
  } finally {
    retrying.value = false
    cutoutProgress.value = null
  }
}

async function markWorn() {
  if (!item.value) return
  await store.markWorn(item.value.id)
  show('已记录今天穿了这件')
}

async function setClean(state: CleanState) {
  if (!item.value) return
  await store.setCleanState(item.value.id, state)
}

function edit() {
  if (item.value) router.push(`/item/${item.value.id}/edit`)
}

async function remove() {
  const current = item.value
  if (!current) return
  if (!window.confirm(`删除「${title.value}」？此操作不可撤销。`)) return
  await store.removeItem(current.id)
  show('已删除')
  router.replace('/')
}
</script>

<template>
  <div class="page page--padded">
    <header class="topbar">
      <button class="icon-btn icon-btn--plain" aria-label="返回" @click="router.back()">
        <Icon name="back" :size="20" />
      </button>
      <div class="topbar__title">{{ title }}</div>
      <button class="icon-btn" aria-label="编辑" @click="edit">
        <Icon name="pencil" :size="18" />
      </button>
    </header>

    <template v-if="item">
      <div
        class="hero thumbsize"
        :class="{ 'hero--cutout': viewMode === 'cutout' && hasCutout }"
        @click="viewerOpen = true"
      >
        <img v-if="imageUrl" :src="imageUrl" :alt="title" />
        <span v-else class="hero__placeholder">{{ categoryDef(item.category).label }}</span>
      </div>

      <div v-if="original" class="media-bar">
        <div class="media-bar__toggle">
          <button
            class="chip"
            :class="{ 'chip--on': viewMode === 'original' }"
            @click="viewMode = 'original'"
          >
            原图
          </button>
          <button
            class="chip"
            :class="{ 'chip--on': viewMode === 'cutout' }"
            :disabled="!hasCutout"
            @click="viewMode = 'cutout'"
          >
            抠图
          </button>
        </div>
        <button
          v-if="!hasCutout"
          class="media-bar__retry"
          :disabled="retrying"
          @click="regenerateCutout"
        >
          <Icon name="sparkle" :size="15" :class="{ spin: retrying }" />
          {{
            retrying
              ? cutoutProgress?.percent != null
                ? `抠图中 ${cutoutProgress.percent}%`
                : '抠图中'
              : '一键抠图'
          }}
        </button>
      </div>

      <div class="section actions">
        <button class="btn btn--primary" @click="markWorn">
          <Icon name="check" :size="18" />今天穿了
        </button>
        <button class="btn" @click="edit">
          <Icon name="pencil" :size="18" />编辑
        </button>
      </div>

      <div class="section">
        <div class="section__title">清洁状态</div>
        <div class="chips">
          <button
            v-for="state in CLEAN_STATES"
            :key="state.id"
            class="chip"
            :class="{ 'chip--on': item.cleanState === state.id }"
            @click="setClean(state.id)"
          >
            {{ state.emoji }} {{ state.label }}
          </button>
        </div>
      </div>

      <div v-if="item.colorPrimary || seasonLabels || styleLabels || item.tags.length" class="section">
        <div class="facts">
          <div v-if="item.colorPrimary" class="fact">
            <span class="fact__swatch" :style="{ background: item.colorPrimary }" />
            <span>{{ colorName }}</span>
          </div>
          <div v-for="hex in item.colorSecondary ?? []" :key="hex" class="fact">
            <span class="fact__swatch" :style="{ background: hex }" />
            <span>{{ paletteNameOf(hex) ?? hex }}</span>
          </div>
          <div v-if="seasonLabels" class="fact">{{ seasonLabels }}</div>
          <div v-if="styleLabels" class="fact">{{ styleLabels }}</div>
          <div v-for="tag in item.tags" :key="tag" class="fact">#{{ tag }}</div>
        </div>
      </div>

      <div class="section">
        <div class="section__title">详细信息</div>
        <dl class="info">
          <div v-for="row in rows" :key="row.label" class="info__row">
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </div>
        </dl>
      </div>

      <div v-if="item.notes" class="section">
        <div class="section__title">备注</div>
        <p class="notes">{{ item.notes }}</p>
      </div>

      <div class="section">
        <button class="btn btn--danger btn--block" @click="remove">
          <Icon name="trash" :size="18" />删除这件单品
        </button>
      </div>
    </template>

    <div
      v-if="viewerOpen && imageUrl"
      class="viewer"
      @click="viewerOpen = false"
    >
      <img :src="imageUrl" :alt="title" />
      <button class="viewer__close" aria-label="关闭">
        <Icon name="close" :size="22" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.hero {
  margin: 16px;
  aspect-ratio: 1;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.hero--cutout {
  background:
    repeating-conic-gradient(
      color-mix(in srgb, var(--text) 6%, transparent) 0% 25%,
      transparent 0% 50%
    )
    0 0 / 22px 22px;
}

.hero__placeholder {
  color: var(--text-faint);
}

.media-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: -4px 16px 4px;
}

.media-bar__toggle {
  display: flex;
  gap: 8px;
}

.media-bar__retry {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 550;
  color: var(--accent);
}

.actions {
  display: flex;
  gap: 10px;
}

.actions .btn {
  flex: 1;
}

.facts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.fact {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  font-size: 13px;
  color: var(--text-dim);
}

.fact__swatch {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  outline: 1px solid var(--border-strong);
}

.info {
  margin: 0;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.info__row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
}

.info__row:last-child {
  border-bottom: none;
}

.info__row dt {
  color: var(--text-faint);
  flex: none;
}

.info__row dd {
  margin: 0;
  text-align: right;
  color: var(--text);
  word-break: break-word;
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

.viewer {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: rgba(6, 7, 10, 0.94);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.viewer img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.viewer__close {
  position: absolute;
  top: calc(var(--safe-top) + 14px);
  right: 16px;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
