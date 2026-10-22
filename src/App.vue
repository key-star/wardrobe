<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppTabBar from '@/components/AppTabBar.vue'
import ConfirmHost from '@/components/ConfirmHost.vue'
import CutoutIndicator from '@/components/CutoutIndicator.vue'
import ToastHost from '@/components/ToastHost.vue'

const route = useRoute()
const showTabBar = computed(() => route.meta.tab === true)
</script>

<template>
  <div class="app-shell">
    <main class="app-main" :class="{ 'has-tabbar': showTabBar }">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <AppTabBar v-if="showTabBar" />
    <CutoutIndicator />
    <ConfirmHost />
    <ToastHost />
  </div>
</template>
