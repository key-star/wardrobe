<script setup lang="ts">
import { computed } from 'vue'
import { PALETTE } from '@/db/constants'

const props = withDefaults(
  defineProps<{
    primary?: string
    secondary?: string[]
    maxSecondary?: number
  }>(),
  { secondary: () => [], maxSecondary: 2 },
)

const emit = defineEmits<{
  (e: 'update:primary', value: string | undefined): void
  (e: 'update:secondary', value: string[]): void
}>()

const secondarySet = computed(() => new Set(props.secondary ?? []))

function togglePrimary(hex: string) {
  emit('update:primary', props.primary === hex ? undefined : hex)
}

function toggleSecondary(hex: string) {
  const set = new Set(props.secondary ?? [])
  if (set.has(hex)) set.delete(hex)
  else if (set.size >= props.maxSecondary) return
  else set.add(hex)
  emit('update:secondary', [...set])
}
</script>

<template>
  <div class="colors">
    <div class="colors__row-label">主色</div>
    <div class="colors__grid">
      <button
        v-for="color in PALETTE"
        :key="`p-${color.hex}`"
        type="button"
        class="swatch"
        :class="{ 'swatch--on': primary === color.hex }"
        :style="{ background: color.hex }"
        :title="color.name"
        @click="togglePrimary(color.hex)"
      />
    </div>

    <div class="colors__row-label">
      副色 <span class="colors__hint">最多 {{ maxSecondary }} 个，可留空</span>
    </div>
    <div class="colors__grid">
      <button
        v-for="color in PALETTE"
        :key="`s-${color.hex}`"
        type="button"
        class="swatch swatch--sm"
        :class="{ 'swatch--on': secondarySet.has(color.hex) }"
        :style="{ background: color.hex }"
        :title="color.name"
        @click="toggleSecondary(color.hex)"
      />
    </div>
  </div>
</template>

<style scoped>
.colors__row-label {
  font-size: 13px;
  color: var(--text-dim);
  margin: 4px 0 8px;
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.colors__hint {
  font-size: 11px;
  color: var(--text-faint);
}

.colors__grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.swatch {
  aspect-ratio: 1;
  border-radius: 50%;
  border: 2px solid transparent;
  outline: 1px solid var(--border-strong);
  outline-offset: -1px;
}

.swatch--sm {
  transform: scale(0.82);
}

.swatch--on {
  border-color: var(--accent);
  outline-color: var(--accent);
}
</style>
