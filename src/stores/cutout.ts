import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getImage, getItem } from '@/db/repo'
import { createCutout } from '@/services/cutout'
import { useWardrobeStore } from './wardrobe'

export const useCutoutStore = defineStore('cutout', () => {
  const pending = ref<string[]>([])
  const activeId = ref<string | null>(null)
  const running = ref(false)
  const total = ref(0)
  const done = ref(0)
  const succeeded = ref(0)
  const failed = ref(0)

  const remaining = computed(() => pending.value.length + (activeId.value ? 1 : 0))
  const percent = computed(() => (total.value ? Math.round((done.value / total.value) * 100) : 0))

  function enqueue(ids: string[], resetWhenIdle = false): void {
    const queue = [...pending.value]
    if (activeId.value) queue.push(activeId.value)
    const fresh = [...new Set(ids)].filter((id) => !queue.includes(id))
    if (!fresh.length) return

    if (!running.value) {
      if (resetWhenIdle || done.value >= total.value) {
        total.value = 0
        done.value = 0
        succeeded.value = 0
        failed.value = 0
      }
    }

    total.value += fresh.length
    pending.value.push(...fresh)
    void pump()
  }

  async function pump(): Promise<void> {
    if (running.value) return
    running.value = true
    const wardrobe = useWardrobeStore()

    try {
      while (pending.value.length) {
        const id = pending.value.shift() as string
        activeId.value = id
        try {
          const item = wardrobe.byId(id) ?? (await getItem(id))
          if (!item) throw new Error('单品不存在')
          const source = (await getImage(id, 'original')) ?? item.thumb
          if (!source) throw new Error('没有可抠图的照片')
          const result = await createCutout(source)
          await wardrobe.attachCutout(id, result.cutout, result.thumb)
          succeeded.value += 1
        } catch (error) {
          failed.value += 1
          console.warn('抠图失败', id, error)
        } finally {
          done.value += 1
          activeId.value = null
        }
      }
    } finally {
      running.value = false
      activeId.value = null
    }
  }

  return {
    pending,
    activeId,
    running,
    total,
    done,
    succeeded,
    failed,
    remaining,
    percent,
    enqueue,
  }
})
