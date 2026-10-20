<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Icon from '@/components/Icon.vue'

const route = useRoute()

const content = computed(() => {
  if (route.name === 'outfits') {
    return {
      emoji: '🎨',
      title: '搭配',
      desc: '用槽位卡片把单品拼成套装，自动叠穿预览。',
      milestone: 'M3',
    }
  }
  return {
    emoji: '☀️',
    title: '今天',
    desc: '按天气和场合挑一套，一键记录穿着。',
    milestone: 'M4',
  }
})
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="topbar__title">{{ content.title }}</div>
    </header>
    <div class="empty">
      <span class="empty__emoji">{{ content.emoji }}</span>
      <p>{{ content.title }}功能还在开发中</p>
      <p style="font-size: 13px; max-width: 260px">{{ content.desc }}</p>
      <span class="badge"><Icon name="sparkle" :size="14" />计划于 {{ content.milestone }} 上线</span>
    </div>
  </div>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12px;
}
</style>
