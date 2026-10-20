<script setup lang="ts">
import { CATEGORIES } from '@/db/constants'
import type { CategoryId } from '@/db/types'

defineProps<{ modelValue: CategoryId }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: CategoryId): void }>()
</script>

<template>
  <div class="cat-grid">
    <button
      v-for="category in CATEGORIES"
      :key="category.id"
      type="button"
      class="cat"
      :class="{ 'cat--on': modelValue === category.id }"
      @click="emit('update:modelValue', category.id)"
    >
      <span class="cat__emoji">{{ category.emoji }}</span>
      <span class="cat__label">{{ category.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.cat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.cat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 4px;
  border-radius: var(--radius-sm);
  background: var(--bg-elev);
  border: 1px solid var(--border);
  color: var(--text-dim);
}

.cat--on {
  background: var(--accent-soft);
  border-color: var(--accent-strong);
  color: var(--accent);
}

.cat__emoji {
  font-size: 22px;
  line-height: 1;
}

.cat__label {
  font-size: 12px;
  font-weight: 550;
}
</style>
