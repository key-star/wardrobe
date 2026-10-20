<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CategoryPicker from '@/components/CategoryPicker.vue'
import ChipGroup from '@/components/ChipGroup.vue'
import ColorPicker from '@/components/ColorPicker.vue'
import Icon from '@/components/Icon.vue'
import LevelPicker from '@/components/LevelPicker.vue'
import PhotoField from '@/components/PhotoField.vue'
import { useToast } from '@/composables/useToast'
import {
  categoryDef,
  CLEAN_STATES,
  FORMALITY_LABELS,
  ITEM_STATUSES,
  PATTERNS,
  SEASONS,
  STYLES,
  WARMTH_LABELS,
} from '@/db/constants'
import { getImage, getItem, nowIso } from '@/db/repo'
import type { CategoryId, CleanState, Item, ItemStatus, Pattern } from '@/db/types'
import { createCutout } from '@/services/cutout'
import { processPhoto } from '@/services/image'
import { createEmptyItem, useWardrobeStore } from '@/stores/wardrobe'

type CutoutState = 'idle' | 'processing' | 'done' | 'error'

const route = useRoute()
const router = useRouter()
const store = useWardrobeStore()
const { show } = useToast()

const editingId = computed(() =>
  typeof route.params.id === 'string' ? route.params.id : undefined,
)
const isEditing = computed(() => Boolean(editingId.value))

const draft = reactive<Item>(createEmptyItem())
const pickedOriginal = ref<Blob | null>(null)
const pickedThumb = ref<Blob | null>(null)
const storedOriginal = ref<Blob | null>(null)
const pickedCutout = ref<Blob | null>(null)
const pickedCutoutThumb = ref<Blob | null>(null)
const storedCutout = ref<Blob | null>(null)
const cutoutState = ref<CutoutState>('idle')
const processing = ref(false)
const saving = ref(false)
const ready = ref(false)

let cutoutPromise: Promise<void> | null = null
let cutoutToken = 0

const previewBlob = computed(() => pickedOriginal.value ?? storedOriginal.value)

const subcategoryOptions = computed(() =>
  categoryDef(draft.category).subcategories.map((name) => ({ id: name, label: name })),
)

function readText(event: Event): string | undefined {
  const raw = (event.target as HTMLInputElement | HTMLTextAreaElement).value
  return raw.trim() === '' ? undefined : raw
}

function readNumber(event: Event): number | undefined {
  const raw = (event.target as HTMLInputElement).value.replace(/[^\d.]/g, '')
  if (raw.trim() === '') return undefined
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : undefined
}

const tagsText = computed({
  get: () => draft.tags.join('、'),
  set: (value: string) => {
    draft.tags = value
      .split(/[、,，;；\s]+/)
      .map((tag) => tag.trim())
      .filter(Boolean)
  },
})

const seasonModel = computed<string[]>(() => [...draft.seasons])
const styleModel = computed<string[]>(() => [...draft.styles])
const subcategoryModel = computed<string[]>(() =>
  draft.subcategory ? [draft.subcategory] : [],
)
const patternModel = computed<string[]>(() => (draft.pattern ? [draft.pattern] : []))
const statusModel = computed<string[]>(() => [draft.status])
const cleanModel = computed<string[]>(() => [draft.cleanState])

function setCategory(value: CategoryId) {
  if (draft.category === value) return
  draft.category = value
  if (draft.subcategory && !categoryDef(value).subcategories.includes(draft.subcategory)) {
    draft.subcategory = undefined
  }
}

onMounted(async () => {
  await store.load()
  const id = editingId.value
  if (!id) {
    ready.value = true
    return
  }
  const item = store.byId(id) ?? (await getItem(id))
  if (!item) {
    show('单品不存在')
    router.replace('/')
    return
  }
  Object.assign(draft, item)
  const original = await getImage(id, 'original')
  storedOriginal.value = original ?? item.thumb ?? null
  storedCutout.value = (await getImage(id, 'cutout')) ?? null
  cutoutState.value = storedCutout.value ? 'done' : 'idle'
  ready.value = true
})

async function runCutout(source: Blob) {
  const token = ++cutoutToken
  cutoutState.value = 'processing'
  cutoutPromise = (async () => {
    try {
      const result = await createCutout(source)
      if (token !== cutoutToken) return
      pickedCutout.value = result.cutout
      pickedCutoutThumb.value = result.thumb
      cutoutState.value = 'done'
    } catch {
      if (token !== cutoutToken) return
      pickedCutout.value = null
      pickedCutoutThumb.value = null
      cutoutState.value = 'error'
    }
  })()
  await cutoutPromise
}

async function onPick(file: File) {
  processing.value = true
  try {
    const result = await processPhoto(file)
    pickedOriginal.value = result.original
    pickedThumb.value = result.thumb
    if (result.colorHex && !draft.colorPrimary) draft.colorPrimary = result.colorHex
    pickedCutout.value = null
    pickedCutoutThumb.value = null
    storedCutout.value = null
    void runCutout(result.original)
  } catch {
    show('照片处理失败，请重试')
  } finally {
    processing.value = false
  }
}

function retryCutout() {
  const source = pickedOriginal.value ?? storedOriginal.value
  if (!source) return
  void runCutout(source)
}

function clearPhoto() {
  cutoutToken += 1
  pickedOriginal.value = null
  pickedThumb.value = null
  pickedCutout.value = null
  pickedCutoutThumb.value = null
  storedCutout.value = null
  cutoutState.value = 'idle'
  if (isEditing.value) storedOriginal.value = null
}

async function save() {
  if (!previewBlob.value) {
    show('请先拍照或选择一张照片')
    return
  }
  saving.value = true
  try {
    if (cutoutState.value === 'processing' && cutoutPromise) await cutoutPromise
    if (pickedThumb.value) draft.thumb = pickedThumb.value
    if (pickedCutout.value && pickedCutoutThumb.value) draft.thumb = pickedCutoutThumb.value
    draft.updatedAt = nowIso()
    await store.saveItem({
      item: { ...draft },
      original: pickedOriginal.value,
      cutout: pickedCutout.value,
      cutoutThumb: pickedCutoutThumb.value,
    })
    if (pickedOriginal.value && cutoutState.value === 'error') {
      show('已保存，抠图失败，可在详情页重试')
    } else {
      show(isEditing.value ? '已保存' : '已加入衣橱')
    }
    router.replace(`/item/${draft.id}`)
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
      <div class="topbar__title">{{ isEditing ? '编辑单品' : '添加单品' }}</div>
      <button class="btn btn--primary topbar__save" :disabled="saving" @click="save">
        {{ saving ? '保存中' : '保存' }}
      </button>
    </header>

    <template v-if="ready">
      <div class="section" style="margin-top: 16px">
        <PhotoField
          :blob="previewBlob"
          :processing="processing"
          :has-stored="Boolean(storedOriginal)"
          @pick="onPick"
          @clear="clearPhoto"
        />
        <p v-if="cutoutState === 'processing'" class="cutout-hint">
          <span class="spin">◌</span> 正在生成透明底图，首次使用需下载模型（约 80MB）
        </p>
        <p v-else-if="cutoutState === 'error'" class="cutout-hint cutout-hint--warn">
          <Icon name="alert" :size="15" /> 抠图失败，保存后将使用原图
          <button class="cutout-hint__retry" @click="retryCutout">重试</button>
        </p>
        <p v-else-if="cutoutState === 'done'" class="cutout-hint">
          <Icon name="check" :size="15" /> 已生成透明底图，可在详情页切换查看
        </p>
      </div>

      <div class="section">
        <div class="section__title">分类</div>
        <CategoryPicker :model-value="draft.category" @update:model-value="setCategory" />
      </div>

      <div class="section">
        <label class="field">
          <span class="field__label">名称（可选）</span>
          <input class="input" placeholder="例如：白色亚麻衬衫" :value="draft.name ?? ''" @input="draft.name = readText($event)" />
        </label>

        <div v-if="subcategoryOptions.length" class="field">
          <span class="field__label">子类</span>
          <ChipGroup
            :options="subcategoryOptions"
            :model-value="subcategoryModel"
            :multiple="false"
            @update:model-value="(v) => (draft.subcategory = v[0])"
          />
        </div>
      </div>

      <div class="section">
        <div class="field">
          <span class="field__label">适合季节</span>
          <ChipGroup
            :options="SEASONS"
            :model-value="seasonModel"
            @update:model-value="(v) => (draft.seasons = v as Item['seasons'])"
          />
        </div>
        <div class="field">
          <span class="field__label">风格</span>
          <ChipGroup
            :options="STYLES"
            :model-value="styleModel"
            @update:model-value="(v) => (draft.styles = v as Item['styles'])"
          />
        </div>
      </div>

      <div class="section">
        <details class="more">
          <summary class="more__summary">
            <span>更多信息（可选）</span>
            <Icon name="back" :size="16" class="more__chevron" />
          </summary>

          <div class="more__body">
            <div class="field">
              <span class="field__label">图案</span>
              <ChipGroup
                :options="PATTERNS"
                :model-value="patternModel"
                :multiple="false"
                @update:model-value="(v) => (draft.pattern = v[0] as Pattern | undefined)"
              />
            </div>

            <div class="field">
              <span class="field__label">颜色</span>
              <ColorPicker
                :primary="draft.colorPrimary"
                :secondary="draft.colorSecondary ?? []"
                @update:primary="(v) => (draft.colorPrimary = v)"
                @update:secondary="(v) => (draft.colorSecondary = v)"
              />
            </div>

            <div class="field">
              <span class="field__label">正式度</span>
              <LevelPicker
                :value="draft.formality"
                :labels="FORMALITY_LABELS"
                low-label="未设置"
                @update:value="(v) => (draft.formality = v)"
              />
            </div>

            <div class="field">
              <span class="field__label">保暖度</span>
              <LevelPicker
                :value="draft.warmth"
                :labels="WARMTH_LABELS"
                low-label="未设置"
                @update:value="(v) => (draft.warmth = v)"
              />
            </div>

            <label class="field">
              <span class="field__label">材质</span>
              <input class="input" placeholder="棉 / 羊毛 / 聚酯纤维…" :value="draft.material ?? ''" @input="draft.material = readText($event)" />
            </label>

            <div class="row">
              <label class="field">
                <span class="field__label">品牌</span>
                <input class="input" :value="draft.brand ?? ''" @input="draft.brand = readText($event)" />
              </label>
              <label class="field">
                <span class="field__label">尺码</span>
                <input class="input" placeholder="M / 40" :value="draft.size ?? ''" @input="draft.size = readText($event)" />
              </label>
            </div>

            <div class="row">
              <label class="field">
                <span class="field__label">价格</span>
                <input class="input" inputmode="decimal" placeholder="0" :value="draft.price ?? ''" @input="draft.price = readNumber($event)" />
              </label>
              <label class="field">
                <span class="field__label">购入日期</span>
                <input class="input" type="date" :value="draft.purchaseDate ?? ''" @input="draft.purchaseDate = readText($event)" />
              </label>
            </div>

            <label class="field">
              <span class="field__label">存放位置</span>
              <input class="input" placeholder="主卧衣柜 2 层 / 收纳箱 3" :value="draft.location ?? ''" @input="draft.location = readText($event)" />
            </label>

            <div class="field">
              <span class="field__label">在役状态</span>
              <ChipGroup
                :options="ITEM_STATUSES"
                :model-value="statusModel"
                :multiple="false"
                @update:model-value="(v) => (draft.status = (v[0] as ItemStatus) ?? 'active')"
              />
            </div>

            <div class="field">
              <span class="field__label">清洁状态</span>
              <ChipGroup
                :options="CLEAN_STATES"
                :model-value="cleanModel"
                :multiple="false"
                @update:model-value="(v) => (draft.cleanState = (v[0] as CleanState) ?? 'clean')"
              />
            </div>

            <label class="field">
              <span class="field__label">标签</span>
              <input class="input" placeholder="用空格或顿号分隔" v-model="tagsText" />
            </label>

            <label class="field">
              <span class="field__label">备注</span>
              <textarea class="textarea" rows="3" :value="draft.notes ?? ''" @input="draft.notes = readText($event)" />
            </label>
          </div>
        </details>
      </div>
    </template>

    <div class="savebar">
      <button class="btn btn--primary btn--block" :disabled="saving || processing" @click="save">
        <Icon name="check" :size="19" />{{ isEditing ? '保存修改' : '加入衣橱' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.topbar__save {
  min-height: 36px;
  padding: 0 16px;
  font-size: 14px;
}

.cutout-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 10px 2px 0;
  font-size: 12.5px;
  color: var(--text-faint);
}

.cutout-hint--warn {
  color: var(--warn, #e6b566);
}

.cutout-hint__retry {
  margin-left: auto;
  color: var(--accent);
  font-size: 12.5px;
  font-weight: 550;
}

.more {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.more__summary {
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  font-size: 14px;
  font-weight: 550;
  color: var(--text-dim);
  cursor: pointer;
}

.more__summary::-webkit-details-marker {
  display: none;
}

.more__chevron {
  transform: rotate(-90deg);
  transition: transform 0.2s ease;
  color: var(--text-faint);
}

.more[open] .more__chevron {
  transform: rotate(-270deg);
}

.more__body {
  padding: 4px 16px 16px;
  border-top: 1px solid var(--border);
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
</style>
