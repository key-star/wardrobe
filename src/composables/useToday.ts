import { onBeforeUnmount, onMounted, ref } from 'vue'
import { localDateKey, todayHeading } from '@/services/today'

const MIDNIGHT_DELAY = 1000

export function useToday(onChange?: (today: string) => void) {
  const today = ref(localDateKey())
  const heading = ref(todayHeading())
  let timer: number | undefined

  function refresh(): boolean {
    const next = localDateKey()
    if (next === today.value) return false
    today.value = next
    heading.value = todayHeading()
    onChange?.(next)
    return true
  }

  function schedule() {
    if (timer) window.clearTimeout(timer)
    const now = new Date()
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      MIDNIGHT_DELAY / 1000,
    )
    timer = window.setTimeout(() => {
      refresh()
      schedule()
    }, Math.max(MIDNIGHT_DELAY, nextMidnight.getTime() - now.getTime()))
  }

  function onVisibilityChange() {
    if (document.visibilityState !== 'visible') return
    refresh()
    schedule()
  }

  function onFocus() {
    refresh()
  }

  onMounted(() => {
    schedule()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)
  })

  onBeforeUnmount(() => {
    if (timer) window.clearTimeout(timer)
    window.removeEventListener('focus', onFocus)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  return { today, heading, refresh }
}
