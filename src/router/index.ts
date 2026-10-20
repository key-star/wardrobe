import { createRouter, createWebHashHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'wardrobe',
      component: () => import('@/views/WardrobeView.vue'),
      meta: { tab: true },
    },
    {
      path: '/outfits',
      name: 'outfits',
      component: () => import('@/views/ComingSoonView.vue'),
      meta: { tab: true },
    },
    {
      path: '/today',
      name: 'today',
      component: () => import('@/views/ComingSoonView.vue'),
      meta: { tab: true },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { tab: true },
    },
    {
      path: '/capture',
      name: 'capture',
      component: () => import('@/views/CaptureView.vue'),
    },
    {
      path: '/item/new',
      name: 'item-new',
      component: () => import('@/views/ItemEditView.vue'),
    },
    {
      path: '/item/:id',
      name: 'item-detail',
      component: () => import('@/views/ItemDetailView.vue'),
    },
    {
      path: '/item/:id/edit',
      name: 'item-edit',
      component: () => import('@/views/ItemEditView.vue'),
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})
