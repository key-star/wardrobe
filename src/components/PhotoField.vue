<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from './Icon.vue'
import { useObjectUrl } from '@/composables/useObjectUrl'

const props = defineProps<{
  blob: Blob | null
  processing?: boolean
  hasStored?: boolean
}>()

const emit = defineEmits<{
  (e: 'pick', file: File): void
  (e: 'clear'): void
}>()

const cameraInput = ref<HTMLInputElement | null>(null)
const galleryInput = ref<HTMLInputElement | null>(null)
const previewUrl = useObjectUrl(computed(() => props.blob))

function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('pick', file)
  input.value = ''
}
</script>

<template>
  <div class="photo">
    <div v-if="previewUrl" class="photo__preview thumbsize">
      <img :src="previewUrl" alt="单品照片" />
      <div v-if="processing" class="photo__overlay">
        <Icon name="sparkle" :size="26" class="spin" />
        <span>处理中…</span>
      </div>
      <div v-else class="photo__actions">
        <button class="photo__action" @click="cameraInput?.click()">
          <Icon name="camera" :size="18" />重拍
        </button>
        <button class="photo__action" @click="emit('clear')">
          <Icon name="trash" :size="18" />移除
        </button>
      </div>
    </div>

    <div v-else class="photo__empty">
      <Icon name="hanger" :size="34" />
      <p class="photo__hint">拍一张单品照片，其余信息可后补</p>
      <div class="photo__buttons">
        <button class="btn btn--primary" @click="cameraInput?.click()">
          <Icon name="camera" :size="19" />拍照
        </button>
        <button class="btn" @click="galleryInput?.click()">
          <Icon name="photo" :size="19" />相册
        </button>
      </div>
      <p v-if="hasStored" class="photo__note">已有一张照片，重新拍摄将替换它</p>
    </div>

    <input
      ref="cameraInput"
      class="photo__input"
      type="file"
      accept="image/*"
      capture="environment"
      @change="onFile"
    />
    <input
      ref="galleryInput"
      class="photo__input"
      type="file"
      accept="image/*"
      @change="onFile"
    />
  </div>
</template>

<style scoped>
.photo__input {
  display: none;
}

.photo__preview {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 5;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.photo__preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.photo__overlay {
  position: absolute;
  inset: 0;
  background: rgba(10, 11, 16, 0.6);
  backdrop-filter: blur(3px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  color: #ffffff;
}

.photo__actions {
  position: absolute;
  bottom: 10px;
  right: 10px;
  display: flex;
  gap: 8px;
}

.photo__action {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 13px;
  background: rgba(12, 13, 18, 0.72);
  color: #fff;
  backdrop-filter: blur(6px);
}

.photo__empty {
  width: 100%;
  aspect-ratio: 4 / 5;
  border-radius: var(--radius-lg);
  border: 1px dashed var(--border-strong);
  background: var(--bg-elev);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-faint);
  padding: 24px;
}

.photo__hint {
  font-size: 13px;
  text-align: center;
}

.photo__buttons {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

.photo__note {
  font-size: 12px;
  color: var(--text-faint);
}
</style>
