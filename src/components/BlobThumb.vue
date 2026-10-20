<script setup lang="ts">
import { computed } from 'vue'
import { useObjectUrl } from '@/composables/useObjectUrl'

const props = defineProps<{ blob?: Blob | null }>()
const src = useObjectUrl(computed(() => props.blob ?? null))
</script>

<template>
  <img v-if="src" :src="src" alt="" />
</template>
