<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/Icon.vue'
import OutfitPreview from '@/components/OutfitPreview.vue'
import { categoryLabel } from '@/db/constants'
import type { CollagePiece } from '@/services/collage'
import type { Recommendation } from '@/services/recommend'
import { layerFor } from '@/stores/outfits'

const props = defineProps<{
  recommendation: Recommendation
  saving?: boolean
  saved?: boolean
}>()

const emit = defineEmits<{
  (e: 'save'): void
}>()

const pieces = computed<CollagePiece[]>(() =>
  props.recommendation.items.map((item) => ({
    item,
    slot: item.category,
    layer: layerFor(item.category),
  })),
)

const names = computed(() =>
  props.recommendation.items
    .map(
      (item) =>
        item.name?.trim() || item.subcategory || categoryLabel(item.category),
    )
    .join(' · '),
)

const score = computed(() => Math.round(props.recommendation.score))
</script>

<template>
  <article class="recommend">
    <div class="recommend__shot">
      <OutfitPreview :pieces="pieces" aspect-ratio="1 / 1" empty-text="推荐组合" />
    </div>

    <div class="recommend__body">
      <div class="recommend__head">
        <span class="recommend__title">规则推荐</span>
        <span class="recommend__score">{{ score }} 分</span>
      </div>
      <p class="recommend__names">{{ names }}</p>
      <p class="recommend__meta">
        色彩 {{ Math.round(recommendation.breakdown.color) }} · 正式度
        {{ Math.round(recommendation.breakdown.formality) }} · 保暖
        {{ Math.round(recommendation.breakdown.warmth) }}
      </p>
      <button
        class="btn recommend__btn"
        :class="{ 'btn--primary': !saved }"
        :disabled="saving || saved"
        @click="emit('save')"
      >
        <Icon :name="saved ? 'check' : 'plus'" :size="16" />
        {{ saved ? '已保存为搭配' : saving ? '保存中' : '存为搭配' }}
      </button>
    </div>
  </article>
</template>

<style scoped>
.recommend {
  display: flex;
  gap: 12px;
  padding: 10px;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.recommend__shot {
  width: 88px;
  flex: none;
}

.recommend__shot :deep(.preview) {
  height: 100%;
  border: none;
  border-radius: var(--radius-sm);
}

.recommend__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 2px 0;
}

.recommend__head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.recommend__title {
  flex: 1;
  font-size: 14px;
  font-weight: 650;
}

.recommend__score {
  flex: none;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 11px;
  font-weight: 650;
}

.recommend__names {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--text-dim);
}

.recommend__meta {
  font-size: 11px;
  color: var(--text-faint);
}

.recommend__btn {
  min-height: 34px;
  margin-top: auto;
  padding: 0 12px;
  border-radius: 9px;
  font-size: 12.5px;
}
</style>
