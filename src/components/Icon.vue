<script setup lang="ts">
import { computed } from 'vue'

const PATHS: Record<string, string[]> = {
  grid: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z'],
  shirt: ['M9 3l3 1.8L15 3l4.5 2.6-1.8 3.2-2.2-1.1V21H8.5V7.7L6.3 8.8 4.5 5.6z'],
  sun: [
    'M12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9z',
    'M12 2v2.2',
    'M12 19.8V22',
    'M3.6 3.6l1.6 1.6',
    'M18.8 18.8l1.6 1.6',
    'M2 12h2.2',
    'M19.8 12H22',
    'M3.6 20.4l1.6-1.6',
    'M18.8 5.2l1.6-1.6',
  ],
  gear: [
    'M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z',
    'M12 2.5v2.6',
    'M12 18.9v2.6',
    'M4.3 4.3l1.9 1.9',
    'M17.8 17.8l1.9 1.9',
    'M2.5 12h2.6',
    'M18.9 12h2.6',
    'M4.3 19.7l1.9-1.9',
    'M17.8 6.2l1.9-1.9',
  ],
  plus: ['M12 5.5v13', 'M5.5 12h13'],
  camera: [
    'M4 8.5h3.2L8.6 6h6.8l1.4 2.5H20V19H4z',
    'M12 16.2a3.4 3.4 0 100-6.8 3.4 3.4 0 000 6.8z',
  ],
  photo: [
    'M4 5.5h16v13H4z',
    'M8 12.5l2.8 3 2.2-2.4L17 17',
    'M9 9.8a1.2 1.2 0 100-2.4 1.2 1.2 0 000 2.4z',
  ],
  back: ['M15 5l-7 7 7 7'],
  trash: ['M4.5 7h15', 'M9.5 7V4.5h5V7', 'M6.5 7l1 13h9l1-13', 'M10.5 11v5.5', 'M13.5 11v5.5'],
  pencil: ['M4 20h4.2L20 8.2 15.8 4 4 15.8z', 'M14.2 5.6l4.2 4.2'],
  search: ['M11 17a6 6 0 100-12 6 6 0 000 12z', 'M20 20l-4.7-4.7'],
  download: ['M12 4v10.5', 'M7.5 10.5L12 15l4.5-4.5', 'M4.5 19.5h15'],
  upload: ['M12 19.5V9', 'M7.5 13.5L12 9l4.5 4.5', 'M4.5 4.5h15'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  check: ['M5 12.5l4.5 4.5L19 7'],
  alert: ['M12 8.5v5', 'M12 16.8h.01', 'M12 3.5l9 16H3z'],
  sparkle: ['M12 3.5l1.7 5L19 10l-5.3 1.5L12 16.5l-1.7-5L5 10l5.3-1.5z'],
  hanger: [
    'M12 6.5a2 2 0 100-4 2 2 0 000 4z',
    'M12 6.5v3l8 5.5H4z',
  ],
  pin: [
    'M12 21s6-5.2 6-11a6 6 0 10-12 0c0 5.8 6 11 6 11z',
    'M12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  ],
  refresh: [
    'M4.5 12a7.5 7.5 0 0112.6-5.5',
    'M20 4.5v6h-6',
    'M19.5 12a7.5 7.5 0 01-12.6 5.5',
    'M4 19.5v-6h6',
  ],
}

const props = withDefaults(
  defineProps<{ name: string; size?: number; stroke?: number }>(),
  { size: 22, stroke: 1.7 },
)

const paths = computed(() => PATHS[props.name] ?? [])
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    :stroke-width="stroke"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="(d, i) in paths" :key="i" :d="d" />
  </svg>
</template>
