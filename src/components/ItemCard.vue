<script setup lang="ts">
import { computed } from 'vue'
import { useObjectUrl } from '@/composables/useObjectUrl'
import { categoryLabel, CLEAN_STATES } from '@/db/constants'
import type { Item } from '@/db/types'

const props = defineProps<{ item: Item }>()

const thumb = computed(() => props.item.thumb)
const thumbUrl = useObjectUrl(thumb)

const title = computed(
  () => props.item.name?.trim() || props.item.subcategory || categoryLabel(props.item.category),
)

const cleanDef = computed(
  () => CLEAN_STATES.find((s) => s.id === props.item.cleanState) ?? CLEAN_STATES[0],
)
</script>

<template>
  <router-link :to="`/item/${item.id}`" class="item-card">
    <div
      class="item-card__shot thumbsize"
      :class="{ 'item-card__shot--cutout': item.hasCutout }"
    >
      <img v-if="thumbUrl" :src="thumbUrl" :alt="title" loading="lazy" />
      <span v-else class="item-card__placeholder">{{ categoryLabel(item.category) }}</span>
      <span class="item-card__clean" :title="cleanDef.label">{{ cleanDef.emoji }}</span>
      <span
        v-if="item.colorPrimary"
        class="item-card__color"
        :style="{ background: item.colorPrimary }"
      />
    </div>
    <div class="item-card__meta">
      <span class="item-card__title">{{ title }}</span>
      <span class="item-card__sub">{{ categoryLabel(item.category) }}</span>
    </div>
  </router-link>
</template>

<style scoped>
.item-card {
  display: flex;
  flex-direction: column;
  color: inherit;
  gap: 6px;
}

.item-card__shot {
  position: relative;
  aspect-ratio: 3 / 4;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-card__shot--cutout {
  background:
    repeating-conic-gradient(
      color-mix(in srgb, var(--text) 6%, transparent) 0% 25%,
      transparent 0% 50%
    )
    0 0 / 18px 18px;
}

.item-card__shot img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.item-card__placeholder {
  color: var(--text-faint);
  font-size: 13px;
}

.item-card__clean {
  position: absolute;
  top: 6px;
  right: 6px;
  font-size: 13px;
  line-height: 1;
  padding: 4px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 1px 4px rgba(27, 32, 52, 0.12);
  backdrop-filter: blur(4px);
}

.item-card__color {
  position: absolute;
  left: 7px;
  bottom: 7px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.85);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.item-card__meta {
  display: flex;
  flex-direction: column;
  line-height: 1.35;
  padding: 0 2px;
}

.item-card__title {
  font-size: 14px;
  font-weight: 550;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-card__sub {
  font-size: 12px;
  color: var(--text-faint);
}
</style>
