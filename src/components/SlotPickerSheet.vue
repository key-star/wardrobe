<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BlobThumb from '@/components/BlobThumb.vue'
import Icon from '@/components/Icon.vue'
import { categoryDef } from '@/db/constants'
import type { Item, Season, SlotId } from '@/db/types'

const props = defineProps<{
  open: boolean
  slot: SlotId
  items: Item[]
  excludeIds: string[]
  seasons: Season[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select', item: Item): void
}>()

const showAll = ref(false)

watch(
  () => props.open,
  (open) => {
    if (open) showAll.value = false
  },
)

const def = computed(() => categoryDef(props.slot))

const candidates = computed(() => {
  const excluded = new Set(props.excludeIds)
  return props.items
    .filter((item) => item.category === props.slot)
    .filter((item) => !excluded.has(item.id))
    .filter((item) => {
      if (showAll.value) return true
      if (item.status !== 'active') return false
      if (item.cleanState !== 'clean') return false
      if (!props.seasons.length) return true
      if (!item.seasons.length) return true
      return item.seasons.some((season) => props.seasons.includes(season))
    })
})

function titleOf(item: Item): string {
  return item.name?.trim() || item.subcategory || categoryDef(item.category).label
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="sheet" @click.self="emit('close')">
        <div class="sheet__panel">
          <header class="sheet__head">
            <div class="sheet__title">
              <span>{{ def.emoji }}</span> 选择{{ def.label }}
            </div>
            <button class="icon-btn icon-btn--plain" aria-label="关闭" @click="emit('close')">
              <Icon name="close" :size="20" />
            </button>
          </header>

          <div class="sheet__filters">
            <button class="chip" :class="{ 'chip--on': !showAll }" @click="showAll = false">
              干净 · 在役 · 当季
            </button>
            <button class="chip" :class="{ 'chip--on': showAll }" @click="showAll = true">
              显示全部
            </button>
          </div>

          <div v-if="candidates.length" class="sheet__grid">
            <button
              v-for="item in candidates"
              :key="item.id"
              class="candidate"
              @click="emit('select', item)"
            >
              <span class="candidate__shot" :class="{ 'candidate__shot--cutout': item.hasCutout }">
                <BlobThumb :blob="item.thumb" />
                <span v-if="!item.thumb" class="candidate__empty">{{ def.emoji }}</span>
              </span>
              <span class="candidate__name">{{ titleOf(item) }}</span>
            </button>
          </div>

          <div v-else class="sheet__empty">
            <span>{{ def.emoji }}</span>
            <p>{{ showAll ? '衣橱里还没有这一类的单品' : '没有符合「干净 · 在役 · 当季」的单品' }}</p>
            <button v-if="!showAll" class="btn" @click="showAll = true">显示全部</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: rgba(6, 7, 10, 0.6);
  display: flex;
  align-items: flex-end;
}

.sheet__panel {
  width: 100%;
  max-height: 78svh;
  display: flex;
  flex-direction: column;
  background: var(--bg-elev);
  border-top-left-radius: 22px;
  border-top-right-radius: 22px;
  border-top: 1px solid var(--border);
  padding-bottom: calc(var(--safe-bottom) + 8px);
  animation: sheet-in 0.2s ease;
}

@keyframes sheet-in {
  from {
    transform: translateY(18px);
    opacity: 0;
  }
}

.sheet__head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px 10px;
}

.sheet__title {
  flex: 1;
  font-size: 17px;
  font-weight: 650;
}

.sheet__filters {
  display: flex;
  gap: 8px;
  padding: 0 16px 12px;
}

.sheet__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px 10px;
  overflow-y: auto;
  padding: 4px 16px 16px;
}

.candidate {
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
}

.candidate:active {
  transform: scale(0.97);
}

.candidate__shot {
  position: relative;
  aspect-ratio: 3 / 4;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-input);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.candidate__shot--cutout {
  background:
    repeating-conic-gradient(
      color-mix(in srgb, var(--text) 6%, transparent) 0% 25%,
      transparent 0% 50%
    )
    0 0 / 18px 18px;
}

.candidate__shot img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.candidate__empty {
  font-size: 24px;
  opacity: 0.5;
}

.candidate__name {
  font-size: 12.5px;
  color: var(--text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet__empty {
  padding: 40px 24px 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: var(--text-faint);
  font-size: 13px;
  text-align: center;
}

.sheet__empty span {
  font-size: 40px;
}

.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.16s ease;
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
</style>
