<script setup lang="ts">
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useToast } from '@/composables/useToast'
import { useCutoutStore } from '@/stores/cutout'
import Icon from './Icon.vue'

const cutout = useCutoutStore()
const { running, total, done, failed, succeeded, percent } = storeToRefs(cutout)
const { show } = useToast()

const label = computed(() => {
  if (running.value) return `正在抠图 ${done.value}/${total.value}`
  if (total.value > 0 && !failed.value) return `抠图完成 ${total.value} 张`
  return ''
})

watch(running, (value, previous) => {
  if (previous && !value && total.value > 0) {
    if (failed.value > 0) {
      show(`抠图完成 ${succeeded.value} 张，${failed.value} 张失败`)
    } else {
      show(`已抠图 ${succeeded.value} 张`)
    }
  }
})
</script>

<template>
  <transition name="cutout">
    <div v-if="running" class="cutout-indicator">
      <Icon name="sparkle" :size="15" class="spin" />
      <div class="cutout-indicator__body">
        <span class="cutout-indicator__text">{{ label }}</span>
        <div class="cutout-indicator__bar">
          <div class="cutout-indicator__fill" :style="{ width: `${percent}%` }" />
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.cutout-indicator {
  position: fixed;
  top: calc(var(--safe-top) + 10px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 75;
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 190px;
  max-width: calc(100vw - 40px);
  padding: 9px 14px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-elev-2) 94%, transparent);
  border: 1px solid var(--border-strong);
  box-shadow: var(--shadow);
  backdrop-filter: blur(10px);
  color: var(--text-dim);
}

.cutout-indicator__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.cutout-indicator__text {
  font-size: 12px;
  line-height: 1.2;
}

.cutout-indicator__bar {
  height: 3px;
  border-radius: 2px;
  background: var(--bg-input);
  overflow: hidden;
}

.cutout-indicator__fill {
  height: 100%;
  border-radius: 2px;
  background: var(--accent-strong);
  transition: width 0.25s ease;
}

.cutout-enter-active,
.cutout-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.cutout-enter-from,
.cutout-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}
</style>
