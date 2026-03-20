<script setup>
import { computed } from 'vue'

const props = defineProps({
  code: {
    type: String,
    required: true
  },
  language: {
    type: String,
    default: 'txt'
  }
})

const normalizedCode = computed(() => props.code.replace(/\s+$/, ''))
</script>

<template>
  <div :class="`language-${language}`">
    <pre><code>{{ normalizedCode }}</code></pre>
  </div>
</template>
