import { onScopeDispose, ref, watch, type Ref } from 'vue'

export function useObjectUrl(source: Ref<Blob | null | undefined>) {
  const url = ref<string | undefined>(undefined)

  const revoke = () => {
    if (url.value) {
      URL.revokeObjectURL(url.value)
      url.value = undefined
    }
  }

  watch(
    source,
    (blob) => {
      revoke()
      if (blob) url.value = URL.createObjectURL(blob)
    },
    { immediate: true },
  )

  onScopeDispose(revoke)

  return url
}
