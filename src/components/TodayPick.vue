<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/Icon.vue'
import OutfitPreview from '@/components/OutfitPreview.vue'
import { useObjectUrl } from '@/composables/useObjectUrl'
import { STYLES } from '@/db/constants'
import type { Outfit } from '@/db/types'
import type { CollagePiece } from '@/services/collage'

const props = defineProps<{
  outfit: Outfit
  pieces: CollagePiece[]
  count: number
  worn: boolean
  picked: boolean
  score?: number
}>()

const emit = defineEmits<{
  (e: 'wear'): void
}>()

const coverUrl = useObjectUrl(computed(() => props.outfit.cover ?? null))
const title = computed(() => props.outfit.name?.trim() || '未命名搭配')
const occasionText = computed(() =>
  props.outfit.occasions
    .map((id) => STYLES.find((style) => style.id === id)?.label)
    .filter(Boolean)
    .slice(0, 2)
    .join(' · '),
)
</script>

<template>
  <article class="pick" :class="{ 'pick--picked': picked, 'pick--worn': worn }">
    <router-link :to="`/outfits/${outfit.id}`" class="pick__shot">
      <img v-if="coverUrl" :src="coverUrl" :alt="title" />
      <OutfitPreview v-else :pieces="pieces" aspect-ratio="3 / 4" empty-text="空搭配" />
    </router-link>

    <div class="pick__body">
      <div class="pick__head">
        <router-link :to="`/outfits/${outfit.id}`" class="pick__title">{{ title }}</router-link>
        <span v-if="score != null" class="pick__score">匹配 {{ Math.round(score) }}</span>
        <span v-if="picked" class="pick__flag">随机选中</span>
      </div>
      <div class="pick__meta">
        {{ count }} 件{{ occasionText ? ` · ${occasionText}` : '' }}
      </div>
      <button
        class="btn pick__btn"
        :class="{ 'btn--primary': !worn }"
        :disabled="worn"
        @click="emit('wear')"
      >
        <Icon :name="worn ? 'check' : 'shirt'" :size="16" />
        {{ worn ? '今天已穿' : '穿这套' }}
      </button>
    </div>
  </article>
</template>

<style scoped>
.pick {
  display: flex;
  gap: 12px;
  padding: 10px;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}

.pick--picked {
  border-color: var(--accent-strong);
  background: color-mix(in srgb, var(--accent-soft) 45%, var(--bg-elev));
}

.pick--worn {
  opacity: 0.72;
}

.pick__shot {
  position: relative;
  width: 88px;
  flex: none;
  aspect-ratio: 3 / 4;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--border);
}

.pick__shot img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pick__shot :deep(.preview) {
  height: 100%;
  border: none;
  border-radius: 0;
}

.pick__score {
  flex: none;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 10px;
  font-weight: 650;
  line-height: 1.5;
  white-space: nowrap;
}

.pick__flag {
  flex: none;
  padding: 2px 8px;
  border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 10px;
  font-weight: 650;
  line-height: 1.5;
  white-space: nowrap;
}

.pick__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 2px 0;
}

.pick__head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.pick__title {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 100%;
  color: var(--text);
  font-size: 15px;
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pick__meta {
  color: var(--text-faint);
  font-size: 12px;
}

.pick__btn {
  min-height: 36px;
  margin-top: auto;
  padding: 0 14px;
  border-radius: 10px;
  font-size: 13px;
}
</style>
