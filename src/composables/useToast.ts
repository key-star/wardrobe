import { ref } from 'vue'

const message = ref<string | null>(null)
let timer: number | undefined

export function useToast() {
  function show(text: string, ms = 2200) {
    message.value = text
    if (timer) window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      message.value = null
    }, ms)
  }
  return { message, show }
}
