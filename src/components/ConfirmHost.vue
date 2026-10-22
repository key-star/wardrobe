<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { settleConfirm, useConfirm } from '@/composables/useConfirm'

const { current } = useConfirm()
const confirmButton = ref<HTMLButtonElement | null>(null)

watch(current, async (state) => {
  if (!state) return
  await nextTick()
  confirmButton.value?.focus()
})

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && current.value) settleConfirm(false)
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div
        v-if="current"
        class="confirm"
        role="presentation"
        @click.self="settleConfirm(false)"
      >
        <section
          class="confirm__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <h2 id="confirm-title" class="confirm__title">{{ current.title }}</h2>
          <p v-if="current.message" class="confirm__message">{{ current.message }}</p>
          <div class="confirm__actions">
            <button class="btn" @click="settleConfirm(false)">
              {{ current.cancelText }}
            </button>
            <button
              ref="confirmButton"
              class="btn"
              :class="current.danger ? 'btn--danger' : 'btn--primary'"
              @click="settleConfirm(true)"
            >
              {{ current.confirmText }}
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 16px;
  padding-bottom: calc(var(--safe-bottom) + 16px);
  background: rgba(6, 7, 10, 0.64);
}

.confirm__panel {
  width: 100%;
  max-width: 520px;
  padding: 20px;
  border: 1px solid var(--border-strong);
  border-radius: 20px;
  background: var(--bg-elev);
  box-shadow: var(--shadow);
  animation: confirm-in 0.18s ease;
}

.confirm__title {
  font-size: 17px;
  font-weight: 650;
}

.confirm__message {
  margin-top: 8px;
  color: var(--text-dim);
  font-size: 13px;
  line-height: 1.65;
  overflow-wrap: anywhere;
}

.confirm__actions {
  display: flex;
  gap: 8px;
  margin-top: 18px;
}

.confirm__actions .btn {
  flex: 1;
  min-height: 44px;
}

.confirm-enter-active,
.confirm-leave-active {
  transition: opacity 0.16s ease;
}

.confirm-enter-from,
.confirm-leave-to {
  opacity: 0;
}

@keyframes confirm-in {
  from {
    transform: translateY(16px);
    opacity: 0;
  }
}
</style>
