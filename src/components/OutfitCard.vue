<script setup lang="ts">
import { computed } from 'vue'
import OutfitPreview from '@/components/OutfitPreview.vue'
import { useObjectUrl } from '@/composables/useObjectUrl'
import { STYLES } from '@/db/constants'
import type { Outfit } from '@/db/types'
import type { CollagePiece } from '@/services/collage'

const props = defineProps<{
  outfit: Outfit
  pieces: CollagePiece[]
  count: number
}>()

const cover = computed(() => props.outfit.cover ?? null)
const coverUrl = useObjectUrl(cover)

const title = computed(() => props.outfit.name?.trim() || '未命名搭配')

const tagText = computed(() =>
  props.outfit.occasions
    .map((id) => STYLES.find((style) => style.id === id)?.label)
    .filter(Boolean)
    .slice(0, 2)
    .join(' · '),
)
</script>

<template>
  <router-link :to="`/outfits/${outfit.id}`" class="outfit-card">
    <div class="outfit-card__shot">
      <img v-if="coverUrl" :src="coverUrl" :alt="title" />
      <OutfitPreview v-else :pieces="pieces" aspect-ratio="3 / 4" empty-text="空搭配" />
      <span v-if="outfit.favorite" class="outfit-card__fav" aria-label="收藏">★</span>
    </div>
    <div class="outfit-card__meta">
      <span class="outfit-card__title">{{ title }}</span>
      <span class="outfit-card__sub">
        {{ count }} 件{{ tagText ? ` · ${tagText}` : '' }}
      </span>
    </div>
  </router-link>
</template>

<style scoped>
.outfit-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: inherit;
}

.outfit-card__shot {
  position: relative;
  aspect-ratio: 3 / 4;
  border-radius: var(--radius);
  overflow: hidden;
}

.outfit-card__shot img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.outfit-card__shot :deep(.preview) {
  height: 100%;
  border-radius: var(--radius);
}

.outfit-card__fav {
  position: absolute;
  top: 6px;
  right: 8px;
  z-index: 80;
  color: #ffd166;
  font-size: 16px;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}

.outfit-card__meta {
  display: flex;
  flex-direction: column;
  line-height: 1.35;
  padding: 0 2px;
}

.outfit-card__title {
  font-size: 14px;
  font-weight: 550;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.outfit-card__sub {
  font-size: 12px;
  color: var(--text-faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
