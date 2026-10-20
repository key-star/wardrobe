<script setup lang="ts">
export interface ChipOption {
  id: string
  label: string
  emoji?: string
}

const props = withDefaults(
  defineProps<{
    options: ChipOption[]
    modelValue: string[]
    multiple?: boolean
    scroll?: boolean
  }>(),
  { multiple: true, scroll: false },
)

const emit = defineEmits<{ (e: 'update:modelValue', value: string[]): void }>()

function toggle(id: string) {
  if (props.multiple) {
    const next = new Set(props.modelValue)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    emit('update:modelValue', [...next])
    return
  }
  const isOn = props.modelValue.includes(id)
  emit('update:modelValue', isOn ? [] : [id])
}
</script>

<template>
  <div class="chips" :class="{ 'chips--scroll': scroll }">
    <button
      v-for="option in options"
      :key="option.id"
      type="button"
      class="chip"
      :class="{ 'chip--on': modelValue.includes(option.id) }"
      @click="toggle(option.id)"
    >
      <span v-if="option.emoji">{{ option.emoji }}</span> {{ option.label }}
    </button>
  </div>
</template>
