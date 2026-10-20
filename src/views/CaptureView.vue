<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import BlobThumb from '@/components/BlobThumb.vue'
import Icon from '@/components/Icon.vue'
import { useToast } from '@/composables/useToast'
import { CATEGORIES } from '@/db/constants'
import type { CategoryId } from '@/db/types'
import { processPhoto } from '@/services/image'
import { useCutoutStore } from '@/stores/cutout'
import { createEmptyItem, useWardrobeStore } from '@/stores/wardrobe'

interface CaptureEntry {
  tempId: string
  file: File
  status: 'processing' | 'done' | 'error'
  original?: Blob
  thumb?: Blob
  colorHex?: string
  category: CategoryId
  name?: string
}

const router = useRouter()
const store = useWardrobeStore()
const cutout = useCutoutStore()
const { show } = useToast()

const entries = ref<CaptureEntry[]>([])
const step = ref<'capture' | 'classify'>('capture')
const saving = ref(false)
const saved = ref(false)
const lastCategory = ref<CategoryId>('top')

const cameraInput = ref<HTMLInputElement | null>(null)
const galleryInput = ref<HTMLInputElement | null>(null)

const pendingCount = computed(
  () => entries.value.filter((entry) => entry.status === 'processing').length,
)
const errorCount = computed(
  () => entries.value.filter((entry) => entry.status === 'error').length,
)

let tempSeed = 0

function newTempId(): string {
  tempSeed += 1
  return `shot-${Date.now().toString(36)}-${tempSeed}`
}

async function processEntry(entry: CaptureEntry) {
  entry.status = 'processing'
  try {
    const result = await processPhoto(entry.file)
    entry.original = result.original
    entry.thumb = result.thumb
    entry.colorHex = result.colorHex
    entry.status = 'done'
  } catch {
    entry.status = 'error'
  }
}

async function addFiles(files: File[]) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue
    const entry = reactive<CaptureEntry>({
      tempId: newTempId(),
      file,
      status: 'processing',
      category: lastCategory.value,
    })
    entries.value.push(entry)
    await processEntry(entry)
  }
}

function onCamera(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) void addFiles([file])
}

function onGallery(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (files.length) void addFiles(files)
}

function removeEntry(tempId: string) {
  entries.value = entries.value.filter((entry) => entry.tempId !== tempId)
}

function retryEntry(entry: CaptureEntry) {
  void processEntry(entry)
}

function setCategory(entry: CaptureEntry, category: CategoryId) {
  entry.category = category
  lastCategory.value = category
}

function goClassify() {
  if (!entries.value.length) return
  if (errorCount.value) {
    show('有照片处理失败，请重试或移除')
    return
  }
  if (pendingCount.value) {
    show('还有照片在处理中，请稍等')
    return
  }
  step.value = 'classify'
}

async function saveAll() {
  if (errorCount.value || pendingCount.value) {
    show('有照片未处理完成，请返回检查')
    return
  }
  saving.value = true
  try {
    const ids: string[] = []
    for (const entry of entries.value) {
      if (!entry.original || !entry.thumb) continue
      const item = createEmptyItem(entry.category)
      item.name = entry.name?.trim() || undefined
      if (entry.colorHex) item.colorPrimary = entry.colorHex
      item.thumb = entry.thumb
      const savedItem = await store.saveItem({ item, original: entry.original })
      ids.push(savedItem.id)
    }
    saved.value = true
    if (ids.length) cutout.enqueue(ids, true)
    show(`已加入 ${ids.length} 件`)
    router.replace('/')
  } catch {
    show('保存失败，请重试')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await store.load()
})

onBeforeRouteLeave(() => {
  if (saved.value || !entries.value.length) return true
  return window.confirm('队列里还有未保存的照片，确定离开？')
})
</script>

<template>
  <div class="page page--padded">
    <header class="topbar">
      <button
        class="icon-btn icon-btn--plain"
        aria-label="返回"
        @click="step === 'classify' ? (step = 'capture') : router.back()"
      >
        <Icon name="back" :size="20" />
      </button>
      <div class="topbar__title">
        {{ step === 'classify' ? '批量分类' : '连续录入' }}
        <div v-if="entries.length" class="topbar__sub">
          已拍 {{ entries.length }} 件<template v-if="pendingCount"> · 处理中 {{ pendingCount }}</template>
        </div>
      </div>
      <button
        v-if="step === 'classify'"
        class="btn btn--primary topbar__save"
        :disabled="saving"
        @click="saveAll"
      >
        {{ saving ? '保存中' : '保存' }}
      </button>
      <span v-else style="width: 36px" />
    </header>

    <template v-if="step === 'capture'">
      <div v-if="!entries.length" class="capture-empty">
        <span class="capture-empty__emoji">📸</span>
        <p class="capture-empty__title">连续拍摄，一次录入多件</p>
        <p class="capture-empty__desc">
          拍完一件接着拍下一件，队列会先攒着。保存后会在后台自动抠图。
        </p>
        <div class="capture-empty__buttons">
          <button class="btn btn--primary" @click="cameraInput?.click()">
            <Icon name="camera" :size="19" />拍第一件
          </button>
          <button class="btn" @click="galleryInput?.click()">
            <Icon name="photo" :size="19" />相册批量
          </button>
        </div>
      </div>

      <template v-else>
        <div class="queue">
          <div v-for="entry in entries" :key="entry.tempId" class="queue__item">
            <div class="queue__shot">
              <BlobThumb :blob="entry.thumb" />
              <span v-if="entry.status === 'processing'" class="queue__badge">
                <Icon name="sparkle" :size="14" class="spin" />
              </span>
              <span v-else-if="entry.status === 'error'" class="queue__badge queue__badge--err">
                <Icon name="alert" :size="14" />
              </span>
            </div>
            <button
              v-if="entry.status === 'error'"
              class="queue__action"
              @click="retryEntry(entry)"
            >
              重试
            </button>
            <button v-else class="queue__action" @click="removeEntry(entry.tempId)">
              移除
            </button>
          </div>
        </div>

        <div class="capture-actions">
          <button class="btn btn--primary btn--block" @click="cameraInput?.click()">
            <Icon name="camera" :size="20" />拍下一件
          </button>
          <button
            class="btn btn--block"
            :disabled="pendingCount > 0 || errorCount > 0"
            @click="goClassify"
          >
            下一步：分类（{{ entries.length }} 件）
          </button>
          <p class="capture-actions__hint">
            <Icon name="sparkle" :size="14" /> 保存后自动抠图，不影响继续拍下一件
          </p>
        </div>
      </template>
    </template>

    <template v-else>
      <div class="classify">
        <div v-for="(entry, index) in entries" :key="entry.tempId" class="classify__card">
          <div class="classify__shot">
            <BlobThumb :blob="entry.thumb" />
          </div>
          <div class="classify__body">
            <div class="classify__head">
              <span class="classify__index">#{{ index + 1 }}</span>
              <input
                class="input classify__name"
                placeholder="名称（可选）"
                :value="entry.name ?? ''"
                @input="entry.name = ($event.target as HTMLInputElement).value"
              />
            </div>
            <div class="classify__cats">
              <button
                v-for="cat in CATEGORIES"
                :key="cat.id"
                class="cat-chip"
                :class="{ 'cat-chip--on': entry.category === cat.id }"
                @click="setCategory(entry, cat.id)"
              >
                <span>{{ cat.emoji }}</span>{{ cat.label }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="savebar">
        <button class="btn btn--primary btn--block" :disabled="saving" @click="saveAll">
          <Icon name="check" :size="19" />
          {{ saving ? '保存中…' : `加入衣橱（${entries.length} 件）` }}
        </button>
      </div>
    </template>

    <input
      ref="cameraInput"
      class="hidden-input"
      type="file"
      accept="image/*"
      capture="environment"
      @change="onCamera"
    />
    <input
      ref="galleryInput"
      class="hidden-input"
      type="file"
      accept="image/*"
      multiple
      @change="onGallery"
    />
  </div>
</template>

<style scoped>
.topbar__save {
  min-height: 36px;
  padding: 0 16px;
  font-size: 14px;
}

.topbar__sub {
  font-size: 12px;
  font-weight: 450;
  color: var(--text-faint);
  margin-top: 2px;
}

.capture-empty {
  margin: 40px 24px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
}

.capture-empty__emoji {
  font-size: 42px;
}

.capture-empty__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}

.capture-empty__desc {
  font-size: 13px;
  color: var(--text-faint);
  line-height: 1.6;
  max-width: 300px;
}

.capture-empty__buttons {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}

.queue {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 16px;
  scroll-snap-type: x mandatory;
}

.queue__item {
  flex: none;
  width: 108px;
  scroll-snap-align: start;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.queue__shot {
  position: relative;
  aspect-ratio: 4 / 5;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg-elev);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.queue__shot img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.queue__badge {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 11, 16, 0.55);
  color: #fff;
}

.queue__badge--err {
  color: var(--warn, #e6b566);
}

.queue__action {
  font-size: 12.5px;
  color: var(--text-faint);
  text-align: center;
}

.capture-actions {
  padding: 4px 16px 40px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.capture-actions__hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-faint);
}

.classify {
  padding: 14px 16px 120px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.classify__card {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: var(--radius);
  background: var(--bg-elev);
  border: 1px solid var(--border);
}

.classify__shot {
  flex: none;
  width: 78px;
  aspect-ratio: 4 / 5;
  border-radius: 10px;
  border: 1px solid var(--border);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.classify__shot img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.classify__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.classify__head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.classify__index {
  font-size: 12px;
  color: var(--text-faint);
  flex: none;
}

.classify__name {
  height: 34px;
  font-size: 13px;
  padding: 0 10px;
}

.classify__cats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cat-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12.5px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  color: var(--text-dim);
}

.cat-chip--on {
  background: color-mix(in srgb, var(--accent-strong) 22%, transparent);
  border-color: var(--accent-strong);
  color: var(--text);
}

.cat-chip:active {
  transform: scale(0.96);
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

.hidden-input {
  display: none;
}

.page--padded {
  padding-bottom: 32px;
}
</style>
