<script setup lang="ts">
import { useRoute } from 'vue-router'
import Icon from './Icon.vue'

const route = useRoute()

const tabs = [
  { to: '/', label: '衣柜', icon: 'grid', match: 'wardrobe' },
  { to: '/outfits', label: '搭配', icon: 'shirt', match: 'outfit' },
  { to: '/today', label: '今天', icon: 'sun', match: 'today' },
  { to: '/settings', label: '设置', icon: 'gear', match: 'settings' },
]

function isActive(match: string): boolean {
  return String(route.name ?? '').startsWith(match)
}
</script>

<template>
  <nav class="tabbar">
    <router-link
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="tabbar__item"
      :class="{ 'tabbar__item--on': isActive(tab.match) }"
    >
      <Icon :name="tab.icon" :size="23" />
      <span>{{ tab.label }}</span>
    </router-link>
  </nav>
</template>

<style scoped>
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  height: calc(var(--tabbar-h) + var(--safe-bottom));
  padding-bottom: var(--safe-bottom);
  display: flex;
  background: color-mix(in srgb, var(--bg-elev) 92%, transparent);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border-top: 1px solid var(--border);
}

.tabbar__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-size: 11px;
  color: var(--text-faint);
  transition: color 0.15s ease;
}

.tabbar__item--on {
  color: var(--accent);
}
</style>
