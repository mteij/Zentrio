<template>
  <Transition :name="animation" appear>
    <div v-if="isVisible" ref="el">
      <slot />
    </div>
  </Transition>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";

const props = defineProps({
  animation: {
    type: String,
    default: "fade-up", // fade-up, fade-in, scale-in, slide-left, slide-right
  },
  threshold: {
    type: Number,
    default: 0.1,
  },
  delay: {
    type: Number,
    default: 0,
  },
  once: {
    type: Boolean,
    default: true,
  },
});

const el = ref(null);
const isVisible = ref(false);
let observer = null;

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            isVisible.value = true;
          }, props.delay);

          if (props.once && observer) {
            observer.unobserve(entry.target);
          }
        } else if (!props.once) {
          isVisible.value = false;
        }
      });
    },
    { threshold: props.threshold }
  );

  // Observe the parent element since we're using v-if
  if (el.value?.parentElement) {
    observer.observe(el.value.parentElement);
  }
});

onUnmounted(() => {
  if (observer) {
    observer.disconnect();
  }
});
</script>

<style>
/* Fade Up Animation */
.fade-up-enter-active {
  transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
.fade-up-enter-from {
  opacity: 0;
  transform: translateY(30px);
}
.fade-up-enter-to {
  opacity: 1;
  transform: translateY(0);
}

/* Fade In Animation */
.fade-in-enter-active {
  transition: opacity 0.5s ease;
}
.fade-in-enter-from {
  opacity: 0;
}
.fade-in-enter-to {
  opacity: 1;
}

/* Scale In Animation */
.scale-in-enter-active {
  transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.scale-in-enter-from {
  opacity: 0;
  transform: scale(0.9);
}
.scale-in-enter-to {
  opacity: 1;
  transform: scale(1);
}

/* Slide Left Animation */
.slide-left-enter-active {
  transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-left-enter-from {
  opacity: 0;
  transform: translateX(50px);
}
.slide-left-enter-to {
  opacity: 1;
  transform: translateX(0);
}

/* Slide Right Animation */
.slide-right-enter-active {
  transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-right-enter-from {
  opacity: 0;
  transform: translateX(-50px);
}
.slide-right-enter-to {
  opacity: 1;
  transform: translateX(0);
}
</style>
