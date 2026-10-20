<script setup lang="ts">
const props = defineProps<{
  value?: number
  labels?: Record<number, string>
  lowLabel?: string
  highLabel?: string
}>()

const emit = defineEmits<{ (e: 'update:value', value: number | undefined): void }>()

const levels = [1, 2, 3, 4, 5]

function pick(level: number) {
  emit('update:value', props.value === level ? undefined : level)
}
</script>

<template>
  <div class="level">
    <div class="level__track">
      <button
        v-for="level in levels"
        :key="level"
        type="button"
        class="level__btn"
        :class="{ 'level__btn--on': value === level }"
        @click="pick(level)"
      >
        <span class="level__bar" :style="{ height: `${5 + level * 3}px` }" />
        <span class="level__num">{{ level }}</span>
      </button>
    </div>
    <p class="level__caption">
      <template v-if="value && labels?.[value]">{{ labels[value] }}</template>
      <template v-else>{{ lowLabel }}</template>
    </p>
  </div>
</template>

<style scoped>
.level__track {
  display: flex;
  gap: 8px;
}

.level__btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  height: 46px;
  padding: 6px 0 4px;
  border-radius: var(--radius-sm);
  background: var(--bg-input);
  border: 1px solid var(--border);
  color: var(--text-faint);
}

.level__btn--on {
  background: var(--accent-soft);
  border-color: var(--accent-strong);
  color: var(--accent);
}

.level__bar {
  width: 70%;
  max-width: 22px;
  border-radius: 3px;
  background: currentColor;
  opacity: 0.55;
}

.level__btn--on .level__bar {
  opacity: 1;
}

.level__num {
  font-size: 11px;
  font-weight: 600;
}

.level__caption {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-faint);
  min-height: 18px;
}
</style>
