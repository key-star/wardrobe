<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import Icon from '@/components/Icon.vue'
import OutfitCard from '@/components/OutfitCard.vue'
import type { CollagePiece } from '@/services/collage'
import { useOutfitsStore } from '@/stores/outfits'
import { useWardrobeStore } from '@/stores/wardrobe'

const outfitsStore = useOutfitsStore()
const wardrobe = useWardrobeStore()
const { outfits, loading, total } = storeToRefs(outfitsStore)

function piecesFor(outfitId: string): CollagePiece[] {
  return outfitsStore
    .piecesFor(outfitId)
    .map((piece) => {
      const item = wardrobe.byId(piece.itemId)
      return item ? { item, slot: piece.slot, layer: piece.layer } : null
    })
    .filter((piece): piece is CollagePiece => piece !== null)
}

onMounted(async () => {
  await Promise.all([outfitsStore.load(true), wardrobe.load(true)])
})
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="topbar__title">
        搭配
        <div class="topbar__sub">共 {{ total }} 套 · 用槽位把单品拼成套装</div>
      </div>
      <router-link to="/outfits/new" class="icon-btn" aria-label="新建搭配">
        <Icon name="plus" :size="20" />
      </router-link>
    </header>

    <div v-if="outfits.length" class="grid">
      <OutfitCard
        v-for="outfit in outfits"
        :key="outfit.id"
        :outfit="outfit"
        :pieces="piecesFor(outfit.id)"
        :count="outfitsStore.countFor(outfit.id)"
      />
    </div>

    <div v-else-if="loading" class="empty">
      <span class="spin" style="font-size: 28px">◌</span>
    </div>

    <div v-else class="empty">
      <span class="empty__emoji">🎨</span>
      <p>还没有搭配</p>
      <p style="font-size: 13px">把不同单品组合成一套，保存后随时复用</p>
      <router-link to="/outfits/new" class="btn btn--primary" style="margin-top: 6px">
        <Icon name="plus" :size="19" />新建第一套
      </router-link>
    </div>

    <router-link v-if="outfits.length" to="/outfits/new" class="fab" aria-label="新建搭配">
      <Icon name="plus" :size="24" :stroke="2" />
    </router-link>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 14px 12px;
  padding: 16px 16px 40px;
}

.fab {
  position: fixed;
  right: 18px;
  bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 18px);
  width: 54px;
  height: 54px;
  border-radius: 18px;
  background: var(--accent-strong);
  color: #10121a;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 24px rgba(124, 143, 255, 0.34);
  z-index: 30;
}

.fab:active {
  transform: scale(0.95);
}
</style>
