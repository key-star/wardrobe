import { ref } from 'vue'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void
}

const current = ref<ConfirmState | null>(null)

export function askConfirm(options: ConfirmOptions): Promise<boolean> {
  current.value?.resolve(false)
  return new Promise((resolve) => {
    current.value = {
      confirmText: '确定',
      cancelText: '取消',
      ...options,
      resolve,
    }
  })
}

export function settleConfirm(value: boolean) {
  const state = current.value
  if (!state) return
  current.value = null
  state.resolve(value)
}

export function useConfirm() {
  return { current, askConfirm, settleConfirm }
}
