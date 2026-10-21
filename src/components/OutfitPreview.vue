<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { categoryDef } from '@/db/constants'
import { pieceLayout, type CollagePiece } from '@/services/collage'

const props = withDefaults(
  defineProps<{
    pieces: CollagePiece[]
    aspectRatio?: string
    emptyText?: string
  }>(),
  { aspectRatio: '3 / 4', emptyText: '还没有选择单品' },
)

const urls = ref<Record<string, string>>({})

function revokeAll() {
  for (const url of Object.values(urls.value)) URL.revokeObjectURL(url)
  urls.value = {}
}

watch(
  () => props.pieces.map((piece) => [piece.item.id, piece.item.thumb] as const),
  (entries) => {
    revokeAll()
    const next: Record<string, string> = {}
    for (const [id, blob] of entries) {
      if (blob) next[id] = URL.createObjectURL(blob)
    }
    urls.value = next
  },
  { immediate: true },
)

onScopeDispose(revokeAll)

const laid = computed(() => {
  const counts = new Map<string, number>()
  const seen = new Map<string, number>()
  for (const piece of props.pieces) {
    counts.set(piece.slot, (counts.get(piece.slot) ?? 0) + 1)
  }
  return [...props.pieces]
    .sort((a, b) => a.layer - b.layer)
    .map((piece) => {
      const index = seen.get(piece.slot) ?? 0
      seen.set(piece.slot, index + 1)
      return {
        ...piece,
        layout: pieceLayout(piece.slot, index, counts.get(piece.slot) ?? 1),
      }
    })
})
</script>

<template>
  <div class="preview" :style="{ aspectRatio }">
    <div
      v-for="piece in laid"
      :key="`${piece.item.id}-${piece.slot}-${piece.layer}`"
      class="preview__piece"
      :style="{
        left: `${piece.layout.cx * 100}%`,
        top: `${piece.layout.cy * 100}%`,
        width: `${piece.layout.w * 100}%`,
        height: `${piece.layout.h * 100}%`,
        zIndex: piece.layer,
      }"
    >
      <img v-if="urls[piece.item.id]" :src="urls[piece.item.id]" alt="" />
      <span v-else class="preview__placeholder">
        {{ categoryDef(piece.slot).emoji }}
      </span>
    </div>
    <div v-if="!pieces.length" class="preview__empty">{{ emptyText }}</div>
  </div>
</template>

<style scoped>
.preview {
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background:
    radial-gradient(
      circle at 50% 34%,
      rgba(124, 143, 255, 0.16),
      transparent 62%
    ),
    linear-gradient(180deg, #242833 0%, #1b1e27 55%, #14161c 100%);
}

.preview__piece {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview__piece img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 8px 14px rgba(0, 0, 0, 0.38));
}

.preview__placeholder {
  font-size: 26px;
  opacity: 0.45;
}

.preview__empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-faint);
  font-size: 13px;
}
</style>
