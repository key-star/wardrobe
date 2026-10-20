<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import ChipGroup from '@/components/ChipGroup.vue'
import Icon from '@/components/Icon.vue'
import ItemCard from '@/components/ItemCard.vue'
import { CATEGORIES, CLEAN_STATES } from '@/db/constants'
import type { CategoryId, CleanState } from '@/db/types'
import { useWardrobeStore } from '@/stores/wardrobe'

const store = useWardrobeStore()
const { filtered, search, category, clean, loading, total } = storeToRefs(store)

const categoryOptions = [
  { id: 'all', label: '全部' },
  ...CATEGORIES.map((c) => ({ id: c.id, label: c.label, emoji: c.emoji })),
]

const cleanOptions = [
  { id: 'all', label: '状态不限' },
  ...CLEAN_STATES.map((c) => ({ id: c.id, label: c.label })),
]

const categoryModel = computed<string[]>(() => [category.value])
function setCategory(value: string[]) {
  category.value = (value[0] ?? 'all') as CategoryId | 'all'
}

const cleanModel = computed<string[]>(() => [clean.value])
function setClean(value: string[]) {
  clean.value = (value[0] ?? 'all') as CleanState | 'all'
}

const hasAny = computed(() => total.value > 0)

onMounted(() => {
  store.load()
})
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="topbar__title">
        我的衣橱
        <div class="topbar__sub">共 {{ total }} 件 · 显示 {{ filtered.length }} 件</div>
      </div>
      <router-link to="/item/new" class="icon-btn" aria-label="添加单品">
        <Icon name="plus" :size="20" />
      </router-link>
    </header>

    <div class="search">
      <Icon name="search" :size="18" class="search__icon" />
      <input v-model="search" class="search__input" placeholder="搜索名称、品牌、标签…" />
      <button v-if="search" class="search__clear" @click="search = ''">
        <Icon name="close" :size="16" />
      </button>
    </div>

    <div class="filters">
      <ChipGroup
        :options="categoryOptions"
        :model-value="categoryModel"
        :multiple="false"
        scroll
        @update:model-value="setCategory"
      />
      <ChipGroup
        :options="cleanOptions"
        :model-value="cleanModel"
        :multiple="false"
        scroll
        @update:model-value="setClean"
      />
    </div>

    <div v-if="filtered.length" class="grid">
      <ItemCard v-for="item in filtered" :key="item.id" :item="item" />
    </div>

    <div v-else-if="loading" class="empty">
      <span class="spin" style="font-size: 28px">◌</span>
    </div>

    <div v-else-if="!hasAny" class="empty">
      <span class="empty__emoji">🧺</span>
      <p>衣橱还是空的</p>
      <p style="font-size: 13px">拍下第一件衣服，开始建立你的衣橱</p>
      <router-link to="/item/new" class="btn btn--primary" style="margin-top: 6px">
        <Icon name="camera" :size="19" />添加第一件
      </router-link>
    </div>

    <div v-else class="empty">
      <span class="empty__emoji">🔍</span>
      <p>没有符合条件的单品</p>
    </div>

    <router-link v-if="hasAny" to="/item/new" class="fab" aria-label="添加单品">
      <Icon name="plus" :size="24" :stroke="2" />
    </router-link>
  </div>
</template>

<style scoped>
.search {
  position: relative;
  margin: 12px 16px 0;
  display: flex;
  align-items: center;
}

.search__icon {
  position: absolute;
  left: 12px;
  color: var(--text-faint);
  pointer-events: none;
}

.search__input {
  width: 100%;
  height: 42px;
  padding: 0 38px;
  border-radius: 12px;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  outline: none;
  font-size: 14px;
}

.search__input:focus {
  border-color: var(--accent-strong);
}

.search__clear {
  position: absolute;
  right: 10px;
  color: var(--text-faint);
  display: flex;
}

.filters {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px 10px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(142px, 1fr));
  gap: 14px 12px;
  padding: 4px 16px 40px;
}

.fab {
  position: fixed;
  right: 18px;
  bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 18px);
  width: 54px;
  height: 54px;
  border-radius: 18px;
  background: var(--accent-strong);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 24px rgba(91, 111, 224, 0.32);
  z-index: 30;
}

.fab:active {
  transform: scale(0.95);
}
</style>
