---
layout: doc
---

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vitepress'

const router = useRouter()

onMounted(() => {
  router.go('/getting-started')
})
</script>

# Redirecting...

If you are not redirected automatically, please click [here](/getting-started).
