<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { message } = useToast()
</script>

<template>
  <transition name="toast">
    <div v-if="message" class="toast">{{ message }}</div>
  </transition>
</template>

<style scoped>
.toast {
  position: fixed;
  left: 50%;
  bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 24px);
  transform: translateX(-50%);
  z-index: 80;
  max-width: calc(100vw - 48px);
  padding: 10px 16px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid var(--border-strong);
  color: var(--text);
  font-size: 13px;
  text-align: center;
  box-shadow: var(--shadow);
  backdrop-filter: blur(8px);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>
